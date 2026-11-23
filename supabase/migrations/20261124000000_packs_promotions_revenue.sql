-- =============================================================================
-- Crédits v2, lot 2 — Packs datés, codes promo, moyens de paiement, annulation
-- d'une transaction, revenus. Plan : docs/PLAN-credits-v2.md (modules 2 et 6).
-- Décision D3 : les OFFRES de packs peuvent être datées ; les crédits
-- n'expirent jamais.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Packs : description et période de disponibilité (offre datée).
-- -----------------------------------------------------------------------------
alter table public.credit_packs
  add column description     text check (description is null or char_length(description) <= 200),
  add column available_from  timestamptz,
  add column available_until timestamptz,
  add constraint credit_packs_availability_order
    check (available_from is null or available_until is null or available_until > available_from);

comment on column public.credit_packs.available_from is 'Début de l''offre (NULL = immédiatement).';
comment on column public.credit_packs.available_until is 'Fin de l''offre (NULL = sans limite). Les crédits achetés n''expirent jamais.';

-- Gamme Starter, Basic, Premium, Pro, VIP (module 2). Les packs existants sont
-- renommés (leur historique d'achats est conservé) ; Pro et VIP sont créés
-- INACTIFS : le porteur fixe leurs prix dans /admin/packs avant de les activer.
update public.credit_packs set name = 'Starter', sort_order = 1
 where name = 'Découverte' and not exists (select 1 from public.credit_packs where name = 'Starter');
update public.credit_packs set name = 'Basic', sort_order = 2
 where name = 'Standard' and not exists (select 1 from public.credit_packs where name = 'Basic');
update public.credit_packs set sort_order = 3 where name = 'Premium';
insert into public.credit_packs (name, credits, bonus_credits, price_xof, is_active, sort_order) values
  ('Pro', 130, 20, 10000, false, 4),
  ('VIP', 300, 60, 20000, false, 5)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Codes promo (module 6). Jamais lisibles par les utilisateurs (sinon on
-- pourrait énumérer les codes) : validation uniquement dans start_topup().
-- -----------------------------------------------------------------------------
create table public.promo_codes (
  id                 bigint generated always as identity primary key,
  code               text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description        text check (description is null or char_length(description) <= 200),
  kind               text not null check (kind in ('bonus_credits', 'bonus_percent')),
  value              integer not null check (value > 0),
  starts_at          timestamptz,
  ends_at            timestamptz,
  max_uses           integer check (max_uses is null or max_uses > 0),
  max_uses_per_user  integer not null default 1 check (max_uses_per_user > 0),
  min_price_xof      integer not null default 0 check (min_price_xof >= 0),
  is_active          boolean not null default true,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint promo_codes_percent_max check (kind <> 'bonus_percent' or value <= 200),
  constraint promo_codes_credits_max check (kind <> 'bonus_credits' or value <= 100000),
  constraint promo_codes_period check (starts_at is null or ends_at is null or ends_at > starts_at)
);

comment on table public.promo_codes is 'Codes promo de recharge (bonus en crédits ou en %). Admin uniquement.';

create index promo_codes_created_by_idx on public.promo_codes (created_by);

create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;

create policy promo_codes_select_admin on public.promo_codes
  for select to authenticated using ((select public.is_admin()));
create policy promo_codes_insert_admin on public.promo_codes
  for insert to authenticated with check ((select public.is_admin()));
create policy promo_codes_update_admin on public.promo_codes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke insert, update, delete, truncate on public.promo_codes from anon;
revoke delete, truncate on public.promo_codes from authenticated;

-- Code promo appliqué à une recharge (figé à la création de la recharge).
alter table public.topups
  add column promo_code_id        bigint references public.promo_codes (id) on delete restrict,
  add column promo_bonus_credits  integer not null default 0 check (promo_bonus_credits >= 0);

create index topups_promo_code_idx on public.topups (promo_code_id) where promo_code_id is not null;

-- Tentatives de code promo invalides (anti-énumération : 10 par heure).
create table public.promo_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.promo_attempts is 'Codes promo refusés (limite anti-énumération). Serveur uniquement.';

create index promo_attempts_user_created_idx on public.promo_attempts (user_id, created_at desc);

create trigger promo_attempts_set_updated_at
  before update on public.promo_attempts
  for each row execute function public.set_updated_at();

alter table public.promo_attempts enable row level security;

create policy promo_attempts_select_admin on public.promo_attempts
  for select to authenticated using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.promo_attempts from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Moyens de paiement (module 6) : activation et libellé par fournisseur.
-- Le fournisseur technique reste choisi par PAYMENT_PROVIDER (Vercel) ; un
-- moyen désactivé ici refuse toute nouvelle recharge.
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, description, is_public)
values ('payment_methods',
        '{"mock": {"enabled": true, "label": "Paiement de test"}, "fedapay": {"enabled": true, "label": "Mobile Money (FedaPay)"}, "kkiapay": {"enabled": true, "label": "Mobile Money (KkiaPay)"}}'::jsonb,
        'Moyens de paiement : activation et libellé affiché par fournisseur.', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 4. start_topup() : création d'une recharge avec période du pack, moyen de
-- paiement actif et code promo. Remplace create_topup (qui la délègue).
-- Le bonus promo est calculé ICI, jamais reçu du navigateur.
-- -----------------------------------------------------------------------------
create or replace function public.start_topup(p_pack_id bigint, p_provider text, p_promo_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_pack      record;
  v_pending   integer;
  v_methods   jsonb;
  v_code      text := upper(btrim(coalesce(p_promo_code, '')));
  v_promo     record;
  v_uses      integer;
  v_user_uses integer;
  v_found     boolean := false;
  v_promo_id  bigint;
  v_bonus     integer := 0;
  v_id        uuid;
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
  if p_provider is null or p_provider not in ('mock', 'fedapay', 'kkiapay') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Fournisseur de paiement inconnu.');
  end if;
  v_methods := private.setting('payment_methods', '{}');
  if jsonb_typeof(v_methods -> p_provider) = 'object' and (v_methods -> p_provider ->> 'enabled') = 'false' then
    return jsonb_build_object('ok', false, 'code', 'PAYMENT_DISABLED', 'message', 'Ce moyen de paiement est désactivé.');
  end if;

  select cp.id, cp.name, cp.credits, cp.bonus_credits, cp.price_xof
    into v_pack
    from public.credit_packs cp
   where cp.id = p_pack_id and cp.is_active
     and (cp.available_from is null or cp.available_from <= now())
     and (cp.available_until is null or cp.available_until > now());
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce pack n''est pas disponible.');
  end if;

  select count(*) into v_pending
    from public.topups t
   where t.user_id = v_user and t.status = 'pending' and t.created_at > now() - interval '1 hour';
  if v_pending >= 10 then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING', 'message', 'Trop de recharges en attente. Réessayez plus tard.');
  end if;

  if v_code <> '' then
    if (select count(*) from public.promo_attempts a
         where a.user_id = v_user and a.created_at > now() - interval '1 hour') >= 10 then
      return jsonb_build_object('ok', false, 'code', 'PROMO_RATE_LIMIT', 'message', 'Trop de codes promo essayés. Réessayez dans une heure.');
    end if;
    -- Verrou : deux recharges simultanées ne dépassent pas max_uses.
    select pc.* into v_promo
      from public.promo_codes pc
     where pc.code = v_code and pc.is_active
       and (pc.starts_at is null or pc.starts_at <= now())
       and (pc.ends_at is null or pc.ends_at > now())
     for update;
    v_found := found;
    if v_found then
      -- Utilisations : recharges réussies, ou en attente depuis moins d'une heure.
      select count(*), count(*) filter (where t.user_id = v_user)
        into v_uses, v_user_uses
        from public.topups t
       where t.promo_code_id = v_promo.id
         and (t.status = 'succeeded' or (t.status = 'pending' and t.created_at > now() - interval '1 hour'));
    end if;
    -- (Champs de v_promo lus seulement si le code existe : enregistrement non assigné sinon.)
    if v_found then
      v_found := v_pack.price_xof >= v_promo.min_price_xof
             and (v_promo.max_uses is null or v_uses < v_promo.max_uses)
             and v_user_uses < v_promo.max_uses_per_user;
    end if;
    if not v_found then
      insert into public.promo_attempts (user_id) values (v_user);
      return jsonb_build_object('ok', false, 'code', 'PROMO_INVALID', 'message', 'Code promo invalide, expiré ou déjà utilisé.');
    end if;
    v_promo_id := v_promo.id;
    v_bonus := case when v_promo.kind = 'bonus_credits' then v_promo.value
                    else floor(v_pack.credits * v_promo.value / 100.0)::integer end;
  end if;

  insert into public.topups (user_id, pack_id, credits, bonus_credits, amount_xof, provider, status, promo_code_id, promo_bonus_credits)
  values (v_user, v_pack.id, v_pack.credits, v_pack.bonus_credits, v_pack.price_xof, p_provider, 'pending',
          v_promo_id, v_bonus)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'topup_id', v_id,
    'pack_name', v_pack.name,
    'credits', v_pack.credits,
    'bonus_credits', v_pack.bonus_credits,
    'promo_bonus_credits', v_bonus,
    'amount_xof', v_pack.price_xof
  );
end;
$$;

comment on function public.start_topup(bigint, text, text) is
  'Crée une recharge « pending » : pack actif et dans sa période, moyen de paiement actif, code promo éventuel (bonus calculé en base).';
revoke all on function public.start_topup(bigint, text, text) from public, anon;
grant execute on function public.start_topup(bigint, text, text) to authenticated;

-- create_topup (ancienne signature) applique désormais les mêmes règles.
create or replace function public.create_topup(p_pack_id bigint, p_provider text)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.start_topup(p_pack_id, p_provider, null);
$$;

-- apply_topup : crédite aussi le bonus du code promo (une seule fois).
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
  v_promo   text;
  v_balance integer;
  v_total   integer;
  v_new     integer;
  v_tx_id   bigint;
begin
  if p_status is null or p_status = 'pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Statut final attendu : succeeded, failed ou cancelled.');
  end if;
  select t.* into v_topup from public.topups t where t.id = p_topup_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Recharge introuvable.');
  end if;
  if v_topup.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_topup.status, 'topup_id', v_topup.id);
  end if;
  if p_status = 'succeeded' then
    select w.balance into v_balance from public.wallets w where w.user_id = v_topup.user_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Portefeuille introuvable.');
    end if;
    v_total := v_topup.credits + v_topup.bonus_credits + v_topup.promo_bonus_credits;
    v_new := v_balance + v_total;
    select cp.name into v_pack from public.credit_packs cp where cp.id = v_topup.pack_id;
    select pc.code into v_promo from public.promo_codes pc where pc.id = v_topup.promo_code_id;
    update public.wallets set balance = v_new where user_id = v_topup.user_id;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
    values (
      v_topup.user_id, 'topup', v_total, v_new, 'topup', v_topup.id::text,
      'Recharge' || coalesce(' : pack ' || v_pack, '') || ' (' || v_topup.credits || ' crédits'
        || case when v_topup.bonus_credits > 0 then ' + ' || v_topup.bonus_credits || ' bonus' else '' end
        || case when v_topup.promo_bonus_credits > 0 then ' + ' || v_topup.promo_bonus_credits || ' code ' || coalesce(v_promo, 'promo') else '' end
        || ')'
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

-- -----------------------------------------------------------------------------
-- 5. Annulation (écriture inverse) d'UNE transaction par l'admin (module 6).
-- Débit inverse d'un crédit, ou remboursement d'un débit. Une seule fois par
-- transaction (index unique), motif obligatoire, journalisé, solde ≥ 0.
-- -----------------------------------------------------------------------------
create unique index credit_transactions_reversal_once_idx
  on public.credit_transactions (reference_id)
  where reference_type = 'reversal';

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

comment on function public.admin_reverse_transaction(bigint, text) is
  'Admin : écriture inverse d''une transaction (une seule fois), motif obligatoire, solde jamais négatif, journalisée.';
revoke all on function public.admin_reverse_transaction(bigint, text) from public, anon;
grant execute on function public.admin_reverse_transaction(bigint, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Revenus (module 6) : période [p_from, p_to] en dates de Porto-Novo.
-- -----------------------------------------------------------------------------
create or replace function public.admin_revenue(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz    text := 'Africa/Porto-Novo';
  v_start timestamptz;
  v_end   timestamptz;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Période invalide (2 ans au plus).');
  end if;
  v_start := p_from::timestamp at time zone v_tz;
  v_end   := (p_to + 1)::timestamp at time zone v_tz;
  return (
    with paid as (
      select t.*, coalesce(cp.name, 'Pack supprimé') as pack_name
        from public.topups t left join public.credit_packs cp on cp.id = t.pack_id
       where t.status = 'succeeded' and t.completed_at >= v_start and t.completed_at < v_end
    ), ledger as (
      select * from public.credit_transactions
       where created_at >= v_start and created_at < v_end
    )
    select jsonb_build_object(
      'ok', true,
      'from', p_from, 'to', p_to,
      'revenue_xof', (select coalesce(sum(amount_xof), 0) from paid),
      'topups', (select count(*) from paid),
      'buyers', (select count(distinct user_id) from paid),
      'credits_sold', (select coalesce(sum(credits), 0) from paid),
      'credits_bonus', (select coalesce(sum(bonus_credits), 0) from paid),
      'credits_promo', (select coalesce(sum(promo_bonus_credits), 0) from paid),
      'credits_consumed', (select coalesce(-sum(amount), 0) from ledger where type = 'unlock'),
      'credits_refunded', (select coalesce(sum(amount), 0) from ledger where type = 'refund'),
      'failed_topups', (select count(*) from public.topups where status in ('failed', 'cancelled')
                          and completed_at >= v_start and completed_at < v_end),
      'by_day', coalesce((
        select jsonb_agg(x order by x.day) from (
          select to_char(completed_at at time zone v_tz, 'YYYY-MM-DD') as day,
                 sum(amount_xof) as revenue_xof, count(*) as topups
            from paid group by 1) x), '[]'::jsonb),
      'by_pack', coalesce((
        select jsonb_agg(x order by x.revenue_xof desc) from (
          select pack_name, sum(amount_xof) as revenue_xof, count(*) as topups
            from paid group by pack_name) x), '[]'::jsonb),
      'by_provider', coalesce((
        select jsonb_agg(x order by x.revenue_xof desc) from (
          select provider, sum(amount_xof) as revenue_xof, count(*) as topups
            from paid group by provider) x), '[]'::jsonb),
      'by_promo', coalesce((
        select jsonb_agg(x order by x.topups desc) from (
          select pc.code, count(*) as topups, sum(p.promo_bonus_credits) as credits
            from paid p join public.promo_codes pc on pc.id = p.promo_code_id group by pc.code) x), '[]'::jsonb)
    )
  );
end;
$$;

comment on function public.admin_revenue(date, date) is
  'Admin : revenus et crédits sur une période (dates de Porto-Novo) : total, par jour, par pack, par moyen de paiement, par code promo.';
revoke all on function public.admin_revenue(date, date) from public, anon;
grant execute on function public.admin_revenue(date, date) to authenticated;
