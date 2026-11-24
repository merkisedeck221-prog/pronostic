-- =============================================================================
-- Crédits v2, lot B — Corners, cartons et combiné IA (module 4, décisions du
-- porteur, docs/PLAN-credits-v2.md) :
--   * CORNERS_OVER_UNDER_9_5 : plus/moins de 9,5 corners (total des deux équipes) ;
--   * CARDS_OVER_UNDER_4_5   : plus/moins de 4,5 cartons (jaunes + rouges) ;
--   * COMBO                  : combiné de 2 ou 3 sélections DU MÊME MATCH, gagné
--                              si toutes sont gagnées (temps réglementaire).
-- Statistiques (corners, cartons) : copiées depuis API-Football par la tâche
-- sync-statistics. Elles incluent les prolongations : un match terminé en AET
-- ou PEN rend les pronostics corners / cartons « void » ET les rembourse
-- (décision 2). Statistiques jamais reçues 7 jours après le match : idem.
-- Règles de résolution : miroir EXACT de lib/settle/rules.ts, vérifié par
-- tests/fixtures/settlement-cases.json.
-- =============================================================================

insert into public.markets (code, label, description, is_active, sort_order) values
  ('CORNERS_OVER_UNDER_9_5', 'Plus/Moins de 9,5 corners', 'Total des corners des deux équipes au temps réglementaire : plus de 9,5 (10 ou plus) ou moins de 9,5 (9 ou moins). Match prolongé : pronostic annulé et remboursé.', true, 11),
  ('CARDS_OVER_UNDER_4_5',   'Plus/Moins de 4,5 cartons', 'Total des cartons (jaunes et rouges) des deux équipes : plus de 4,5 (5 ou plus) ou moins de 4,5 (4 ou moins). Match prolongé : pronostic annulé et remboursé.', true, 12),
  ('COMBO',                  'Combiné IA',                'Deux ou trois sélections de l''IA sur ce match, gagné seulement si toutes sont gagnées (temps réglementaire).', true, 13)
on conflict (code) do nothing;

-- Prix de départ (modifiables dans /admin/tarifs).
insert into public.pricing_rules (scope, market_code, competition_id, credits, is_active) values
  ('market', 'CORNERS_OVER_UNDER_9_5', null, 2, true),
  ('market', 'CARDS_OVER_UNDER_4_5',   null, 2, true),
  ('market', 'COMBO',                  null, 3, true)
on conflict (scope, market_code, competition_id) do nothing;

-- -----------------------------------------------------------------------------
-- Statistiques de match (données publiques, comme le score).
-- -----------------------------------------------------------------------------
alter table public.fixtures
  add column corners_home    smallint check (corners_home >= 0),
  add column corners_away    smallint check (corners_away >= 0),
  add column cards_home      smallint check (cards_home >= 0),
  add column cards_away      smallint check (cards_away >= 0),
  add column stats_synced_at timestamptz,
  add column stats_attempts  smallint not null default 0 check (stats_attempts >= 0);

comment on column public.fixtures.corners_home is 'Corners de l''équipe à domicile (API-Football, prolongations comprises).';
comment on column public.fixtures.cards_home is 'Cartons jaunes + rouges de l''équipe à domicile (API-Football).';
comment on column public.fixtures.stats_synced_at is 'Date de copie des statistiques (null : pas encore reçues).';
comment on column public.fixtures.stats_attempts is 'Nombre de tentatives de copie des statistiques (sync-statistics s''arrête à 6).';

-- Matchs terminés sans statistiques : file de la tâche sync-statistics.
create index fixtures_stats_pending_idx on public.fixtures (kickoff_at)
  where stats_synced_at is null and status_short in ('FT', 'AET', 'PEN');

-- -----------------------------------------------------------------------------
-- Remboursements partiels d'un « match complet » (un marché annulé).
-- Écrits UNIQUEMENT par private.refund_voided_market (aucune écriture par RLS).
-- -----------------------------------------------------------------------------
create table public.unlock_partial_refunds (
  id             bigint generated always as identity primary key,
  unlock_id      bigint not null references public.unlocks (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  fixture_id     bigint not null references public.fixtures (id) on delete cascade,
  market_code    text not null references public.markets (code),
  credits        integer not null check (credits >= 0),
  transaction_id bigint references public.credit_transactions (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint unlock_partial_refunds_unique unique (unlock_id, market_code)
);

comment on table public.unlock_partial_refunds is
  'Part remboursée d''un déblocage « match complet » quand un de ses pronostics est annulé (corners / cartons en prolongation).';

create index unlock_partial_refunds_user_idx on public.unlock_partial_refunds (user_id);
create index unlock_partial_refunds_fixture_idx on public.unlock_partial_refunds (fixture_id);
create index unlock_partial_refunds_market_idx on public.unlock_partial_refunds (market_code);
create index unlock_partial_refunds_tx_idx on public.unlock_partial_refunds (transaction_id);

create trigger unlock_partial_refunds_set_updated_at
  before update on public.unlock_partial_refunds
  for each row execute function public.set_updated_at();

alter table public.unlock_partial_refunds enable row level security;

create policy unlock_partial_refunds_select_own on public.unlock_partial_refunds
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete, truncate on public.unlock_partial_refunds from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Résolution : combiné (sélections au temps réglementaire, marchés distincts).
-- -----------------------------------------------------------------------------
create or replace function public.settle_combo(p_selection text, p_home integer, p_away integer)
returns public.prediction_result
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_legs   text[];
  v_leg    text;
  v_market text;
  v_seen   text[] := '{}';
  v_result public.prediction_result;
  v_all    boolean := true;
begin
  if p_selection is null or p_home is null or p_away is null then
    return null;
  end if;
  v_legs := string_to_array(p_selection, '+');
  if cardinality(v_legs) not between 2 and 3 then
    return null;
  end if;
  foreach v_leg in array v_legs loop
    if v_leg !~ '^[A-Z0-9_]+:[A-Z0-9]+$' then
      return null;
    end if;
    v_market := split_part(v_leg, ':', 1);
    if v_market not in ('MATCH_RESULT', 'DOUBLE_CHANCE', 'OVER_UNDER_1_5', 'OVER_UNDER_2_5', 'OVER_UNDER_3_5', 'BTTS')
       or v_market = any (v_seen) then
      return null;
    end if;
    v_seen := v_seen || v_market;
    v_result := public.settle_outcome_ht(v_market, split_part(v_leg, ':', 2), p_home, p_away, null, null);
    if v_result is null then
      return null;
    end if;
    if v_result <> 'won' then
      v_all := false;
    end if;
  end loop;
  return case when v_all then 'won' else 'lost' end::public.prediction_result;
end;
$$;

comment on function public.settle_combo(text, integer, integer) is
  'Combiné « MARCHÉ:SÉLECTION+… » (2 ou 3 marchés distincts) : gagné si toutes les sélections sont gagnées. Miroir de lib/settle/rules.ts.';
revoke all on function public.settle_combo(text, integer, integer) from public, anon, authenticated;
grant execute on function public.settle_combo(text, integer, integer) to service_role;

-- Tous les marchés : corners et cartons sur les totaux, le reste via settle_outcome_ht.
create or replace function public.settle_outcome_full(
  p_market text, p_selection text, p_home integer, p_away integer,
  p_ht_home integer, p_ht_away integer, p_corners integer, p_cards integer)
returns public.prediction_result
language sql
immutable
set search_path = ''
as $$
  select case
    when p_market = 'CORNERS_OVER_UNDER_9_5' then
      case when p_corners is null or p_selection not in ('OVER', 'UNDER') then null
           when (p_corners >= 10) = (p_selection = 'OVER') then 'won' else 'lost' end::public.prediction_result
    when p_market = 'CARDS_OVER_UNDER_4_5' then
      case when p_cards is null or p_selection not in ('OVER', 'UNDER') then null
           when (p_cards >= 5) = (p_selection = 'OVER') then 'won' else 'lost' end::public.prediction_result
    when p_market = 'COMBO' then public.settle_combo(p_selection, p_home, p_away)
    else public.settle_outcome_ht(p_market, p_selection, p_home, p_away, p_ht_home, p_ht_away)
  end;
$$;

comment on function public.settle_outcome_full(text, text, integer, integer, integer, integer, integer, integer) is
  'Résultat d''un pronostic, tous marchés (corners et cartons : totaux du match). Miroir de lib/settle/rules.ts.';
revoke all on function public.settle_outcome_full(text, text, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.settle_outcome_full(text, text, integer, integer, integer, integer, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Remboursement d'un marché annulé (corners / cartons) :
--   * déblocage de CE pronostic : remboursé en entier ;
--   * déblocage « match complet » : part proportionnelle au prix de base du
--     marché dans la somme des prix de base des pronostics publiés du match,
--     arrondie au crédit supérieur, sans dépasser ce qui reste payé.
-- Idempotent (refunded_at, contrainte unique sur les remboursements partiels).
-- Appelée uniquement par settle_fixture (verrou du match déjà pris).
-- -----------------------------------------------------------------------------
create or replace function private.refund_voided_market(p_fixture_id bigint, p_market text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture  record;
  v_label    text;
  v_unlock   record;
  v_balance  integer;
  v_amount   integer;
  v_base     integer;
  v_total    integer;
  v_already  integer;
  v_tx_id    bigint;
  v_credits  integer := 0;
begin
  select f.competition_id, h.name || ' – ' || a.name as match into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id;
  select m.label into v_label from public.markets m where m.code = p_market;

  for v_unlock in
    select u.id, u.user_id, u.credits_spent from public.unlocks u
     where u.fixture_id = p_fixture_id and u.market_code = p_market and u.refunded_at is null
     order by u.user_id, u.id
     for update
  loop
    if v_unlock.credits_spent > 0 then
      select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
      update public.wallets set balance = v_balance + v_unlock.credits_spent where user_id = v_unlock.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
      values (v_unlock.user_id, 'refund', v_unlock.credits_spent, v_balance + v_unlock.credits_spent, 'fixture', p_fixture_id::text,
              'Remboursement : ' || coalesce(v_label, p_market) || ', ' || v_fixture.match || ' (' || p_reason || ')');
      v_credits := v_credits + v_unlock.credits_spent;
    end if;
    update public.unlocks set refunded_at = now() where id = v_unlock.id;
  end loop;

  v_base := coalesce(private.base_price(v_fixture.competition_id, p_market), 0);
  select coalesce(sum(coalesce(private.base_price(v_fixture.competition_id, p.market_code), 0)), 0)::integer into v_total
    from public.predictions p
   where p.fixture_id = p_fixture_id and p.status = 'published';

  for v_unlock in
    select u.id, u.user_id, u.credits_spent from public.unlocks u
     where u.fixture_id = p_fixture_id and u.market_code is null and u.refunded_at is null
       and not exists (select 1 from public.unlock_partial_refunds r where r.unlock_id = u.id and r.market_code = p_market)
     order by u.user_id, u.id
     for update
  loop
    select coalesce(sum(r.credits), 0)::integer into v_already
      from public.unlock_partial_refunds r where r.unlock_id = v_unlock.id;
    v_amount := case when v_total > 0 then ceil(v_unlock.credits_spent::numeric * v_base / v_total)::integer else 0 end;
    v_amount := greatest(0, least(v_amount, v_unlock.credits_spent - v_already));
    v_tx_id := null;
    if v_amount > 0 then
      select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
      update public.wallets set balance = v_balance + v_amount where user_id = v_unlock.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
      values (v_unlock.user_id, 'refund', v_amount, v_balance + v_amount, 'fixture', p_fixture_id::text,
              'Remboursement partiel du match complet : ' || coalesce(v_label, p_market) || ', ' || v_fixture.match || ' (' || p_reason || ')')
      returning id into v_tx_id;
      v_credits := v_credits + v_amount;
    end if;
    insert into public.unlock_partial_refunds (unlock_id, user_id, fixture_id, market_code, credits, transaction_id)
    values (v_unlock.id, v_unlock.user_id, p_fixture_id, p_market, v_amount, v_tx_id);
  end loop;
  return v_credits;
end;
$$;

comment on function private.refund_voided_market(bigint, text, text) is
  'Rembourse un pronostic annulé (déblocage du marché en entier, match complet au prorata). Appelée par settle_fixture.';
revoke all on function private.refund_voided_market(bigint, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- settle_fixture : corners / cartons / combiné.
-- -----------------------------------------------------------------------------
create or replace function public.settle_fixture(p_fixture_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fixture  record;
  v_pred     record;
  v_result   public.prediction_result;
  v_corners  integer;
  v_cards    integer;
  v_extra    boolean;
  v_stale    boolean;
  v_settled  integer := 0;
  v_invalid  integer := 0;
  v_voided   integer := 0;
  v_waiting  integer := 0;
  v_credits  integer := 0;
begin
  select f.id, f.status_short, f.ft_home, f.ft_away, f.ht_home, f.ht_away, f.kickoff_at,
         f.corners_home, f.corners_away, f.cards_home, f.cards_away
    into v_fixture
    from public.fixtures f where f.id = p_fixture_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_fixture.status_short not in ('FT', 'AET', 'PEN') or v_fixture.ft_home is null or v_fixture.ft_away is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FINISHED', 'status', v_fixture.status_short);
  end if;
  v_corners := v_fixture.corners_home + v_fixture.corners_away;
  v_cards   := v_fixture.cards_home + v_fixture.cards_away;
  v_extra   := v_fixture.status_short in ('AET', 'PEN');
  v_stale   := v_fixture.kickoff_at < now() - interval '7 days';

  for v_pred in
    select p.id, p.market_code, p.selection from public.predictions p
     where p.fixture_id = p_fixture_id and p.result = 'pending'
     order by p.id
     for update
  loop
    if v_pred.market_code in ('CORNERS_OVER_UNDER_9_5', 'CARDS_OVER_UNDER_4_5') then
      if v_extra
         or (v_stale and (case when v_pred.market_code = 'CORNERS_OVER_UNDER_9_5' then v_corners else v_cards end) is null) then
        update public.predictions set result = 'void', settled_at = now() where id = v_pred.id;
        v_credits := v_credits + private.refund_voided_market(p_fixture_id, v_pred.market_code,
                       case when v_extra then 'match prolongé' else 'statistiques indisponibles' end);
        v_voided := v_voided + 1;
        continue;
      end if;
      if (case when v_pred.market_code = 'CORNERS_OVER_UNDER_9_5' then v_corners else v_cards end) is null then
        v_waiting := v_waiting + 1;
        continue;
      end if;
    end if;
    v_result := public.settle_outcome_full(v_pred.market_code, v_pred.selection, v_fixture.ft_home, v_fixture.ft_away,
                                           v_fixture.ht_home, v_fixture.ht_away, v_corners, v_cards);
    if v_result is null then
      v_invalid := v_invalid + 1;
      continue;
    end if;
    update public.predictions set result = v_result, settled_at = now() where id = v_pred.id;
    v_settled := v_settled + 1;
  end loop;

  return jsonb_build_object('ok', true, 'settled', v_settled, 'invalid', v_invalid,
                            'voided', v_voided, 'waiting_stats', v_waiting, 'refunded_credits', v_credits,
                            'score', v_fixture.ft_home || '-' || v_fixture.ft_away,
                            'half_time', case when v_fixture.ht_home is not null then v_fixture.ht_home || '-' || v_fixture.ht_away end);
end;
$$;

-- -----------------------------------------------------------------------------
-- Match annulé / remboursé par l'admin : on ne rembourse que ce qui reste payé
-- (déduction des remboursements partiels déjà versés).
-- -----------------------------------------------------------------------------
create or replace function public.refund_fixture(p_fixture_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture   record;
  v_reason    text;
  v_refund    boolean := coalesce((private.setting('refund_on_cancel', 'true') #>> '{}')::boolean, true);
  v_unlock    record;
  v_balance   integer;
  v_amount    integer;
  v_refunded  integer := 0;
  v_credits   integer := 0;
  v_voided    integer := 0;
begin
  select f.id, f.status_short, f.kickoff_at, f.original_kickoff_at, h.name as home_name, a.name as away_name
    into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id
   for update of f;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_fixture.status_short = 'CANC' then
    v_reason := 'match annulé';
  elsif v_fixture.status_short = 'ABD' then
    v_reason := 'match arrêté';
  elsif v_fixture.status_short = 'PST' and (
          v_fixture.original_kickoff_at is null
       or v_fixture.kickoff_at <= v_fixture.original_kickoff_at
       or v_fixture.kickoff_at - v_fixture.original_kickoff_at > interval '48 hours'
       ) then
    v_reason := 'match reporté';
  else
    return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE', 'status', v_fixture.status_short);
  end if;
  if v_refund then
    for v_unlock in
      select u.id, u.user_id, u.credits_spent,
             u.credits_spent - coalesce((select sum(r.credits) from public.unlock_partial_refunds r where r.unlock_id = u.id), 0)::integer as remaining
        from public.unlocks u
       where u.fixture_id = p_fixture_id and u.refunded_at is null
       order by u.user_id, u.id
       for update of u
    loop
      v_amount := greatest(v_unlock.remaining, 0);
      if v_amount > 0 then
        select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
        update public.wallets set balance = v_balance + v_amount where user_id = v_unlock.user_id;
        insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
        values (v_unlock.user_id, 'refund', v_amount, v_balance + v_amount, 'fixture', p_fixture_id::text,
                'Remboursement : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ' (' || v_reason || ')');
        v_credits := v_credits + v_amount;
      end if;
      update public.unlocks set refunded_at = now() where id = v_unlock.id;
      v_refunded := v_refunded + 1;
    end loop;
  end if;
  update public.predictions
     set result = 'void', settled_at = now()
   where fixture_id = p_fixture_id and result = 'pending';
  get diagnostics v_voided = row_count;
  return jsonb_build_object('ok', true, 'reason', v_reason, 'refund_enabled', v_refund,
                            'refunded_unlocks', v_refunded, 'refunded_credits', v_credits, 'voided', v_voided);
end;
$$;

create or replace function public.admin_refund_fixture(p_fixture_id bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture  record;
  v_unlock   record;
  v_balance  integer;
  v_amount   integer;
  v_refunded integer := 0;
  v_credits  integer := 0;
  v_voided   integer := 0;
  v_result   jsonb;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;
  select f.id, h.name as home_name, a.name as away_name into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id for update of f;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  for v_unlock in
    select u.id, u.user_id,
           u.credits_spent - coalesce((select sum(r.credits) from public.unlock_partial_refunds r where r.unlock_id = u.id), 0)::integer as remaining
      from public.unlocks u
     where u.fixture_id = p_fixture_id and u.refunded_at is null
     order by u.user_id, u.id
     for update of u
  loop
    v_amount := greatest(v_unlock.remaining, 0);
    if v_amount > 0 then
      select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
      update public.wallets set balance = v_balance + v_amount where user_id = v_unlock.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description, created_by)
      values (v_unlock.user_id, 'refund', v_amount, v_balance + v_amount, 'fixture', p_fixture_id::text,
              'Remboursement : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ' (décision de l''administration)',
              (select auth.uid()));
      v_credits := v_credits + v_amount;
    end if;
    update public.unlocks set refunded_at = now() where id = v_unlock.id;
    v_refunded := v_refunded + 1;
  end loop;
  update public.predictions set result = 'void', settled_at = now()
   where fixture_id = p_fixture_id and result = 'pending';
  get diagnostics v_voided = row_count;
  v_result := jsonb_build_object('ok', true, 'refunded_unlocks', v_refunded, 'refunded_credits', v_credits, 'voided', v_voided);
  perform private.audit('refund_fixture', 'fixtures', p_fixture_id::text, null, v_result, p_reason);
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_reverse_transaction : un déblocage déjà remboursé (en tout ou en
-- partie) ne peut plus être annulé (sinon double remboursement) : ajustement.
-- -----------------------------------------------------------------------------
create or replace function public.admin_reverse_transaction(p_transaction_id bigint, p_reason text)
returns jsonb
language plpgsql
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
    select r.status into v_status from public.generation_requests r
     where r.id::text = v_tx.reference_id for update;
    if coalesce(v_status, '') <> 'succeeded' then
      return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE',
        'message', 'Réservation d''une analyse en cours ou déjà rendue : elle ne peut pas être annulée.');
    end if;
  end if;
  if v_tx.type = 'unlock' and exists (
       select 1 from public.unlocks u
        where u.transaction_id = v_tx.id
          and (u.refunded_at is not null
               or exists (select 1 from public.unlock_partial_refunds r where r.unlock_id = u.id and r.credits > 0)))
  then
    return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE',
      'message', 'Ce déblocage a déjà été remboursé (en tout ou en partie) : faites un ajustement.');
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

-- -----------------------------------------------------------------------------
-- Tâche sync-statistics : toutes les heures (après sync-results).
-- -----------------------------------------------------------------------------
select cron.schedule('sync-statistics', '45 * * * *', $$select private.invoke_sync_job('sync-statistics')$$);
