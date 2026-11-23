-- =============================================================================
-- Crédits v2 — Corrections issues de la relecture des lots 2 et 3.
--
-- 1. admin_reverse_transaction : la réservation d'une analyse IA
--    (« generation_hold ») ne peut être annulée que si l'analyse a RÉUSSI.
--    Avant : annuler une réservation encore en cours (ou déjà rendue)
--    remboursait l'utilisateur une seconde fois à la libération.
--    La demande est verrouillée AVANT le portefeuille (même ordre que
--    release_generation : pas d'interblocage).
-- 2. complete_generation : si le match a été annulé, reporté ou a commencé
--    pendant l'analyse, la réservation est rendue au lieu de donner l'accès
--    (sinon : accès payé sur un match déjà remboursé par refund_fixture).
-- =============================================================================

create or replace function public.admin_reverse_transaction(p_transaction_id bigint, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin   uuid := (select auth.uid());
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_tx      record;
  v_status  text;
  v_balance integer;
  v_new     integer;
  v_type    public.transaction_type;
  v_new_id  bigint;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if char_length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;
  select t.* into v_tx from public.credit_transactions t where t.id = p_transaction_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Transaction introuvable.');
  end if;
  if v_tx.reference_type = 'reversal' then
    return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE', 'message', 'Une annulation ne peut pas être annulée : faites un ajustement.');
  end if;
  if v_tx.reference_type = 'generation_hold' then
    -- Verrou de la demande d'abord (même ordre que release_generation).
    select r.status into v_status from public.generation_requests r
     where r.id::text = v_tx.reference_id for update;
    if coalesce(v_status, '') <> 'succeeded' then
      return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE',
        'message', 'Réservation d''une analyse en cours ou déjà rendue : elle ne peut pas être annulée.');
    end if;
  end if;
  select w.balance into v_balance from public.wallets w where w.user_id = v_tx.user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Portefeuille introuvable.');
  end if;
  if exists (select 1 from public.credit_transactions r where r.reference_type = 'reversal' and r.reference_id = v_tx.id::text) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_REVERSED', 'message', 'Cette transaction a déjà été annulée.');
  end if;
  v_new := v_balance - v_tx.amount;
  if v_new < 0 then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE',
      'message', 'Le solde actuel ne permet pas ce débit.', 'balance', v_balance);
  end if;
  v_type := case when v_tx.amount < 0 then 'refund' else 'admin_adjustment' end;
  update public.wallets set balance = v_new where user_id = v_tx.user_id;
  insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description, created_by)
  values (v_tx.user_id, v_type, -v_tx.amount, v_new, 'reversal', v_tx.id::text,
          case when v_tx.amount < 0 then 'Remboursement' else 'Annulation' end
            || ' de la transaction n° ' || v_tx.id || ' : ' || left(v_reason, 200),
          v_admin)
  returning id into v_new_id;
  -- Un déblocage remboursé ne sera pas remboursé une seconde fois si le match est annulé.
  if v_tx.type = 'unlock' then
    update public.unlocks set refunded_at = now() where transaction_id = v_tx.id and refunded_at is null;
  end if;
  perform private.audit('reverse_transaction', 'credit_transactions', v_tx.id::text,
                        jsonb_build_object('balance', v_balance, 'transaction', to_jsonb(v_tx)),
                        jsonb_build_object('balance', v_new, 'reversal_id', v_new_id, 'amount', -v_tx.amount),
                        v_reason);
  return jsonb_build_object('ok', true, 'new_balance', v_new, 'transaction_id', v_new_id);
end;
$$;

create or replace function public.complete_generation(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_req      record;
  v_fixture  record;
  v_balance  integer;
begin
  select * into v_req from public.generation_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_req.status in ('succeeded', 'failed') then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_req.status);
  end if;
  select f.status_short, f.kickoff_at into v_fixture from public.fixtures f where f.id = v_req.fixture_id;
  if v_fixture.status_short in ('PST', 'CANC', 'ABD', 'AWD', 'WO') then
    return private.release_generation(v_req.id, 'Match reporté ou annulé pendant l''analyse');
  end if;
  if v_fixture.status_short not in ('NS', 'TBD') or v_fixture.kickoff_at <= now() then
    return private.release_generation(v_req.id, 'Le match a commencé pendant l''analyse');
  end if;
  if not exists (select 1 from public.predictions p join public.markets m on m.code = p.market_code and m.is_active
                  where p.fixture_id = v_req.fixture_id and p.status = 'published'
                    and (v_req.market_code is null or p.market_code = v_req.market_code)) then
    return private.release_generation(v_req.id, 'Aucun pronostic produit pour ce type d''analyse');
  end if;

  if private.has_access(v_req.user_id, v_req.fixture_id, v_req.market_code) then
    -- Accès déjà acquis entre-temps : la réservation est rendue, pas de double paiement.
    if v_req.price > 0 and v_req.hold_transaction_id is not null then
      select w.balance into v_balance from public.wallets w where w.user_id = v_req.user_id for update;
      update public.wallets set balance = v_balance + v_req.price where user_id = v_req.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
      values (v_req.user_id, 'refund', v_req.price, v_balance + v_req.price, 'generation_release', v_req.id::text,
              'Réservation rendue : vous aviez déjà accès à cette analyse');
    end if;
  else
    insert into public.unlocks (user_id, fixture_id, market_code, credits_spent, transaction_id)
    values (v_req.user_id, v_req.fixture_id, v_req.market_code, v_req.price, v_req.hold_transaction_id);
    update public.predictions p set is_locked = true
     where p.fixture_id = v_req.fixture_id and not p.is_locked
       and (v_req.market_code is null or p.market_code = v_req.market_code);
  end if;

  update public.generation_requests set status = 'succeeded', completed_at = now(), error = null where id = v_req.id;
  perform private.notify(v_req.user_id, 'generation_ready', 'Analyse IA prête',
    'Votre analyse est disponible sur la fiche du match.', '/matchs/' || v_req.fixture_id, 'generation:' || v_req.id);
  return jsonb_build_object('ok', true, 'status', 'succeeded', 'fixture_id', v_req.fixture_id);
end;
$$;
