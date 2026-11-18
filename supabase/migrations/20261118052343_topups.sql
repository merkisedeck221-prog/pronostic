-- =============================================================================
-- Phase 8 — Recharge (sections 5-F6, 6 et 10)
--
--   create_topup(pack_id, provider)  utilisateur connecté : crée une recharge
--                                    « pending » ; montants lus EN BASE (pack).
--   apply_topup(topup_id, status)    serveur uniquement (service_role) :
--                                    succeeded → crédite credits + bonus une
--                                    seule fois ; failed / cancelled → clôture.
--                                    Idempotent (RG-F6-1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_topup : appelée par la Server Action /recharger avec la session.
-- -----------------------------------------------------------------------------
create or replace function public.create_topup(p_pack_id bigint, p_provider text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_pack     record;
  v_pending  integer;
  v_id       uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Connectez-vous pour recharger votre compte.');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    return jsonb_build_object('ok', false, 'code', 'BANNED', 'message', 'Ce compte est suspendu.');
  end if;
  if (private.setting('maintenance_mode', 'false') #>> '{}')::boolean then
    return jsonb_build_object('ok', false, 'code', 'MAINTENANCE', 'message', 'Les recharges sont momentanément suspendues (maintenance).');
  end if;

  select cp.id, cp.name, cp.credits, cp.bonus_credits, cp.price_xof
    into v_pack
    from public.credit_packs cp
   where cp.id = p_pack_id and cp.is_active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce pack n''est pas disponible.');
  end if;

  -- Garde-fou contre la création massive de recharges.
  select count(*) into v_pending
    from public.topups t
   where t.user_id = v_user and t.status = 'pending' and t.created_at > now() - interval '1 hour';
  if v_pending >= 10 then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING', 'message', 'Trop de recharges en attente. Réessayez plus tard.');
  end if;

  -- Fournisseur : choisi par le serveur (PAYMENT_PROVIDER) ; le webhook vérifie qu'il correspond.
  if p_provider is null or p_provider not in ('mock', 'fedapay', 'kkiapay') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Fournisseur de paiement inconnu.');
  end if;

  insert into public.topups (user_id, pack_id, credits, bonus_credits, amount_xof, provider, status)
  values (v_user, v_pack.id, v_pack.credits, v_pack.bonus_credits, v_pack.price_xof, p_provider, 'pending')
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'topup_id', v_id,
    'pack_name', v_pack.name,
    'credits', v_pack.credits,
    'bonus_credits', v_pack.bonus_credits,
    'amount_xof', v_pack.price_xof
  );
end;
$$;

comment on function public.create_topup(bigint, text) is
  'Crée une recharge « pending » pour l''utilisateur connecté ; montants lus dans credit_packs (jamais reçus du navigateur).';

revoke all on function public.create_topup(bigint, text) from public, anon;
grant execute on function public.create_topup(bigint, text) to authenticated;

-- -----------------------------------------------------------------------------
-- apply_topup : appelée par le webhook de paiement (clé secrète uniquement).
-- -----------------------------------------------------------------------------
create or replace function public.apply_topup(p_topup_id uuid, p_status public.topup_status)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_topup   record;
  v_pack    text;
  v_balance integer;
  v_total   integer;
  v_new     integer;
  v_tx_id   bigint;
begin
  if p_status is null or p_status = 'pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Statut final attendu : succeeded, failed ou cancelled.');
  end if;

  -- Verrou sur la recharge : deux webhooks simultanés sont traités l'un après l'autre.
  select t.* into v_topup from public.topups t where t.id = p_topup_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Recharge introuvable.');
  end if;

  -- Déjà traitée : rien ne change (idempotence, RG-F6-1).
  if v_topup.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_topup.status, 'topup_id', v_topup.id);
  end if;

  if p_status = 'succeeded' then
    select w.balance into v_balance from public.wallets w where w.user_id = v_topup.user_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Portefeuille introuvable.');
    end if;

    v_total := v_topup.credits + v_topup.bonus_credits;
    v_new := v_balance + v_total;
    select cp.name into v_pack from public.credit_packs cp where cp.id = v_topup.pack_id;

    update public.wallets set balance = v_new where user_id = v_topup.user_id;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
    values (
      v_topup.user_id, 'topup', v_total, v_new, 'topup', v_topup.id::text,
      'Recharge' || coalesce(' : pack ' || v_pack, '') || ' (' || v_topup.credits || ' crédits'
        || case when v_topup.bonus_credits > 0 then ' + ' || v_topup.bonus_credits || ' bonus' else '' end || ')'
    )
    returning id into v_tx_id;

    update public.topups set status = 'succeeded', completed_at = now() where id = v_topup.id;
    return jsonb_build_object('ok', true, 'already_processed', false, 'status', 'succeeded', 'topup_id', v_topup.id,
                              'credited', v_total, 'new_balance', v_new, 'transaction_id', v_tx_id);
  end if;

  update public.topups set status = p_status, completed_at = now() where id = v_topup.id;
  return jsonb_build_object('ok', true, 'already_processed', false, 'status', p_status, 'topup_id', v_topup.id, 'credited', 0);
end;
$$;

comment on function public.apply_topup(uuid, public.topup_status) is
  'Clôture une recharge : succeeded crédite credits + bonus une seule fois ; failed / cancelled sans crédit. Serveur uniquement.';

revoke all on function public.apply_topup(uuid, public.topup_status) from public, anon, authenticated;
grant execute on function public.apply_topup(uuid, public.topup_status) to service_role;
