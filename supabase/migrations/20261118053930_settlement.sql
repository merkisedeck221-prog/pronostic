-- =============================================================================
-- Phase 9 — Résolution et suivi (sections 5-F4/F5/F7/F8 et 7)
--
--   settle_outcome(market, selection, home, away)  règles de résolution (miroir
--                                    exact de lib/settle/rules.ts ; table de cas
--                                    partagée tests/fixtures/settlement-cases.json)
--   settle_fixture(fixture)          service_role : résout les pronostics pending
--                                    d'un match FT / AET / PEN avec score (RG-F7-1/2)
--   refund_fixture(fixture)          service_role : match annulé / reporté > 48 h :
--                                    rembourse les déblocages, pronostics void (RG-F5-7)
--   get_performance_stats()          public : taux de réussite (RG-F8-1)
--   get_my_predictions()             utilisateur : ses pronostics débloqués
--   get_fixture_predictions()        + résultat seul (badge) une fois résolu
--   Supabase Cron : settle-predictions toutes les 15 min (après sync-results)
--
-- fixtures.original_kickoff_at existe depuis la migration football (phase 2) et
-- est rempli à la première synchronisation (lib/api-football/convert.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- settle_outcome : score au temps réglementaire uniquement (RG-F4-1).
-- NULL si marché inconnu ou sélection invalide (le pronostic reste pending).
-- -----------------------------------------------------------------------------
create or replace function public.settle_outcome(p_market text, p_selection text, p_home integer, p_away integer)
returns public.prediction_result
language sql
immutable
set search_path = ''
as $$
  select case
    when p_home is null or p_away is null then null
    when p_market = 'MATCH_RESULT' and p_selection in ('1', 'N', '2') then
      case when p_selection = (case when p_home > p_away then '1' when p_home < p_away then '2' else 'N' end)
           then 'won' else 'lost' end::public.prediction_result
    when p_market = 'EXACT_SCORE' and p_selection ~ '^\d{1,2}-\d{1,2}$' then
      case when split_part(p_selection, '-', 1)::integer = p_home and split_part(p_selection, '-', 2)::integer = p_away
           then 'won' else 'lost' end::public.prediction_result
    when p_market = 'OVER_UNDER_2_5' and p_selection = 'OVER' then
      case when p_home + p_away >= 3 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'OVER_UNDER_2_5' and p_selection = 'UNDER' then
      case when p_home + p_away <= 2 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'BTTS' and p_selection = 'YES' then
      case when p_home > 0 and p_away > 0 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'BTTS' and p_selection = 'NO' then
      case when p_home > 0 and p_away > 0 then 'lost' else 'won' end::public.prediction_result
    else null
  end;
$$;

comment on function public.settle_outcome(text, text, integer, integer) is
  'Résultat d''un pronostic au temps réglementaire (miroir de lib/settle/rules.ts).';

revoke all on function public.settle_outcome(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.settle_outcome(text, text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- settle_fixture : idempotente (seuls les pronostics pending sont touchés).
-- -----------------------------------------------------------------------------
create or replace function public.settle_fixture(p_fixture_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fixture record;
  v_settled integer := 0;
  v_invalid integer := 0;
begin
  select f.id, f.status_short, f.ft_home, f.ft_away into v_fixture
    from public.fixtures f where f.id = p_fixture_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_fixture.status_short not in ('FT', 'AET', 'PEN') or v_fixture.ft_home is null or v_fixture.ft_away is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FINISHED', 'status', v_fixture.status_short);
  end if;

  with outcomes as (
    select p.id, public.settle_outcome(p.market_code, p.selection, v_fixture.ft_home, v_fixture.ft_away) as result
      from public.predictions p
     where p.fixture_id = p_fixture_id and p.result = 'pending'
     for update of p
  ), updated as (
    update public.predictions p
       set result = o.result, settled_at = now()
      from outcomes o
     where p.id = o.id and o.result is not null
    returning p.id
  )
  select (select count(*) from updated), (select count(*) from outcomes where result is null)
    into v_settled, v_invalid;

  return jsonb_build_object('ok', true, 'settled', v_settled, 'invalid', v_invalid,
                            'score', v_fixture.ft_home || '-' || v_fixture.ft_away);
end;
$$;

comment on function public.settle_fixture(bigint) is
  'Résout les pronostics pending d''un match terminé (FT, AET, PEN) au temps réglementaire. Idempotente. Serveur uniquement.';

revoke all on function public.settle_fixture(bigint) from public, anon, authenticated;
grant execute on function public.settle_fixture(bigint) to service_role;

-- -----------------------------------------------------------------------------
-- refund_fixture : match annulé (CANC, ABD) ou reporté (PST) de plus de 48 h
-- ou sans nouvelle date. Idempotente (unlocks.refunded_at, pronostics pending).
-- -----------------------------------------------------------------------------
create or replace function public.refund_fixture(p_fixture_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fixture   record;
  v_reason    text;
  v_refund    boolean := coalesce((private.setting('refund_on_cancel', 'true') #>> '{}')::boolean, true);
  v_unlock    record;
  v_balance   integer;
  v_tx_id     bigint;
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
          v_fixture.original_kickoff_at is null                                    -- date initiale inconnue
       or v_fixture.kickoff_at <= v_fixture.original_kickoff_at                    -- pas de nouvelle date
       or v_fixture.kickoff_at - v_fixture.original_kickoff_at > interval '48 hours'
       ) then
    v_reason := 'match reporté';
  else
    return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE', 'status', v_fixture.status_short);
  end if;

  -- Remboursements (désactivables par refund_on_cancel). Ordre par utilisateur.
  if v_refund then
    for v_unlock in
      select u.id, u.user_id, u.credits_spent, u.market_code
        from public.unlocks u
       where u.fixture_id = p_fixture_id and u.refunded_at is null
       order by u.user_id, u.id
       for update
    loop
      v_tx_id := null;
      if v_unlock.credits_spent > 0 then
        select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
        update public.wallets set balance = v_balance + v_unlock.credits_spent where user_id = v_unlock.user_id;
        insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
        values (v_unlock.user_id, 'refund', v_unlock.credits_spent, v_balance + v_unlock.credits_spent, 'fixture', p_fixture_id::text,
                'Remboursement : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ' (' || v_reason || ')')
        returning id into v_tx_id;
        v_credits := v_credits + v_unlock.credits_spent;
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

comment on function public.refund_fixture(bigint) is
  'Match annulé ou reporté de plus de 48 h : rembourse les déblocages (si refund_on_cancel) et passe les pronostics à void. Idempotente. Serveur uniquement.';

revoke all on function public.refund_fixture(bigint) from public, anon, authenticated;
grant execute on function public.refund_fixture(bigint) to service_role;

-- -----------------------------------------------------------------------------
-- get_performance_stats : public (page /performances, sans compte).
-- Tous les pronostics PUBLIÉS (achetés ou non) de matchs publiés (RG-F8-1).
-- -----------------------------------------------------------------------------
create or replace function public.get_performance_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reveal boolean := coalesce((private.setting('reveal_after_match', 'true') #>> '{}')::boolean, true);
  v_result jsonb;
begin
  with base as (
    select p.id, p.market_code, p.selection_label, p.result, p.settled_at,
           f.id as fixture_id, f.kickoff_at, f.ft_home, f.ft_away,
           c.id as competition_id, c.name as competition_name, c.slug as competition_slug,
           m.label as market_label, m.sort_order as market_order,
           h.name as home_name, a.name as away_name
      from public.predictions p
      join public.fixtures f on f.id = p.fixture_id and f.is_published
      join public.competitions c on c.id = f.competition_id
      join public.markets m on m.code = p.market_code
      join public.teams h on h.id = f.home_team_id
      join public.teams a on a.id = f.away_team_id
     where p.status = 'published' and p.result <> 'pending'
  ),
  agg as (
    select jsonb_build_object(
      'won', count(*) filter (where result = 'won'),
      'lost', count(*) filter (where result = 'lost'),
      'void', count(*) filter (where result = 'void')
    ) as totals from base
  )
  select jsonb_build_object(
    'reveal_after_match', v_reveal,
    'global', (select totals from agg),
    'last_30_days', (
      select jsonb_build_object(
        'won', count(*) filter (where result = 'won'),
        'lost', count(*) filter (where result = 'lost'),
        'void', count(*) filter (where result = 'void'))
        from base where kickoff_at >= now() - interval '30 days'),
    'by_market', coalesce((
      select jsonb_agg(row_to_json(x) order by x.sort_order)
        from (select market_code as code, market_label as label, min(market_order) as sort_order,
                     count(*) filter (where result = 'won') as won,
                     count(*) filter (where result = 'lost') as lost,
                     count(*) filter (where result = 'void') as void
                from base group by market_code, market_label) x), '[]'::jsonb),
    'by_competition', coalesce((
      select jsonb_agg(row_to_json(x) order by x.name)
        from (select competition_id as id, competition_name as name, competition_slug as slug,
                     count(*) filter (where result = 'won') as won,
                     count(*) filter (where result = 'lost') as lost,
                     count(*) filter (where result = 'void') as void
                from base group by competition_id, competition_name, competition_slug) x), '[]'::jsonb),
    'recent', case when v_reveal then coalesce((
      select jsonb_agg(row_to_json(x))
        from (select fixture_id, kickoff_at, home_name, away_name, competition_name,
                     market_code, market_label, selection_label, result, ft_home, ft_away
                from base where result in ('won', 'lost')
               order by kickoff_at desc, fixture_id desc, market_order
               limit 20) x), '[]'::jsonb) else '[]'::jsonb end
  ) into v_result;
  return v_result;
end;
$$;

comment on function public.get_performance_stats() is
  'Performances publiques de l''IA : gagnés, perdus, annulés (global, 30 jours, par marché, par compétition) et 20 derniers pronostics résolus si reveal_after_match.';

revoke all on function public.get_performance_stats() from public;
grant execute on function public.get_performance_stats() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_my_predictions : pronostics débloqués par l'utilisateur connecté.
-- Un déblocage « match complet » est développé en ses marchés (pronostics
-- publiés, ou déjà résolus). Contenu = ce que l'utilisateur a payé.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_predictions(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct on (p.id)
           p.id as prediction_id, p.fixture_id, p.market_code, p.selection_label, p.result,
           u.refunded_at is not null as refunded, u.created_at as unlocked_at
      from public.unlocks u
      join public.predictions p
        on p.fixture_id = u.fixture_id
       and (u.market_code = p.market_code or (u.market_code is null and p.status = 'published'))
     where u.user_id = (select auth.uid())
     order by p.id, (u.market_code is null), u.created_at
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.kickoff_at desc, x.fixture_id desc, x.market_order), '[]'::jsonb)
    from (
      select mi.prediction_id, mi.fixture_id, mi.market_code, m.label as market_label, m.sort_order as market_order,
             mi.selection_label, mi.result, mi.refunded, mi.unlocked_at,
             f.kickoff_at, f.status_short, f.ft_home, f.ft_away, f.goals_home, f.goals_away,
             h.name as home_name, a.name as away_name, c.name as competition_name
        from mine mi
        join public.fixtures f on f.id = mi.fixture_id
        join public.competitions c on c.id = f.competition_id
        join public.markets m on m.code = mi.market_code
        join public.teams h on h.id = f.home_team_id
        join public.teams a on a.id = f.away_team_id
       order by f.kickoff_at desc
       limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) x;
$$;

comment on function public.get_my_predictions(integer) is
  'Pronostics débloqués par l''utilisateur connecté (match complet développé), avec statut et score.';

revoke all on function public.get_my_predictions(integer) from public, anon;
grant execute on function public.get_my_predictions(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- get_fixture_predictions : ajoute le résultat seul (badge) une fois résolu.
-- -----------------------------------------------------------------------------
create or replace function public.get_fixture_predictions(p_fixture_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user        uuid := (select auth.uid());
  v_fixture     record;
  v_finished    boolean;
  v_reveal      boolean;
  v_open        boolean;
  v_bundle      boolean;
  v_bundle_json jsonb;
  v_price       jsonb;
  v_markets     jsonb := '[]'::jsonb;
  v_row         record;
  v_access      boolean;
  v_show        boolean;
  v_item        jsonb;
  v_analysis    jsonb := null;
  v_mode        text := private.setting('pricing_mode', '"both"') #>> '{}';
begin
  if not public.is_fixture_visible(p_fixture_id) then
    return null;
  end if;
  select f.kickoff_at, f.status_short into v_fixture from public.fixtures f where f.id = p_fixture_id;

  v_finished := v_fixture.status_short in ('FT', 'AET', 'PEN');
  v_reveal   := v_finished and coalesce((private.setting('reveal_after_match', 'true') #>> '{}')::boolean, true);
  v_open     := v_fixture.kickoff_at > now()
                and v_fixture.status_short in ('NS', 'TBD')
                and not coalesce((private.setting('maintenance_mode', 'false') #>> '{}')::boolean, false);
  v_bundle   := private.has_access(v_user, p_fixture_id, null);

  for v_row in
    select p.market_code, m.label, m.sort_order, p.status, m.is_active,
           p.selection, p.selection_label, p.probability, p.probabilities, p.confidence, p.reasoning, p.result
      from public.predictions p
      join public.markets m on m.code = p.market_code
     where p.fixture_id = p_fixture_id
     order by m.sort_order, p.market_code
  loop
    v_access := private.has_access(v_user, p_fixture_id, v_row.market_code);
    -- Visible : marché actif et pronostic publié (RG-F4-3), ou déjà acheté (l'acheteur le conserve).
    continue when not ((v_row.is_active and v_row.status = 'published') or v_access);

    v_show := v_access or (v_reveal and v_row.status = 'published');
    v_price := private.compute_price(v_user, p_fixture_id, v_row.market_code);

    v_item := jsonb_build_object(
      'code', v_row.market_code,
      'label', v_row.label,
      'unlocked', v_access,
      'price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'price')::integer end,
      'purchasable', v_open and not v_access and (v_price ->> 'ok')::boolean,
      'revealed', v_show
    );
    -- Résultat seul (Gagné / Perdu / Annulé) une fois résolu : ni sélection ni explication.
    if not v_show and v_row.result <> 'pending' then
      v_item := v_item || jsonb_build_object('result', v_row.result);
    end if;
    if v_show then
      v_item := v_item || jsonb_build_object(
        'selection', v_row.selection,
        'selection_label', v_row.selection_label,
        'probability', v_row.probability,
        'probabilities', v_row.probabilities,
        'confidence', v_row.confidence,
        'reasoning', v_row.reasoning,
        'result', v_row.result
      );
    end if;
    v_markets := v_markets || jsonb_build_array(v_item);
  end loop;

  -- Match complet : prix effectif (déduction RG-F5-3) et disponibilité.
  v_price := private.compute_price(v_user, p_fixture_id, null);
  v_bundle_json := jsonb_build_object(
    'unlocked', v_bundle,
    'offered', v_mode in ('per_match', 'both'),
    'price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'price')::integer end,
    'base_price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'base_price')::integer end,
    'purchasable', v_open and not v_bundle and (v_price ->> 'ok')::boolean and jsonb_array_length(v_markets) > 0
  );

  -- Analyse globale : match complet débloqué, ou match terminé (reveal_after_match).
  if v_bundle or v_reveal then
    select jsonb_build_object('summary', a.summary, 'key_factors', a.key_factors)
      into v_analysis
      from public.prediction_analyses a where a.fixture_id = p_fixture_id;
  end if;

  return jsonb_build_object(
    'fixture_id', p_fixture_id,
    'is_finished', v_finished,
    'unlocks_open', v_open,
    'pricing_mode', v_mode,
    'match_bundle', v_bundle_json,
    'markets', v_markets,
    'analysis', v_analysis
  );
end;
$$;

comment on function public.get_fixture_predictions(bigint) is
  'Pronostics d''un match : nom, prix et cadenas ; contenu seulement si débloqué ou match terminé (reveal_after_match).';

revoke all on function public.get_fixture_predictions(bigint) from public;
grant execute on function public.get_fixture_predictions(bigint) to anon, authenticated, service_role;

-- Index : pronostics à résoudre.
create index if not exists predictions_pending_fixture_idx on public.predictions (fixture_id) where result = 'pending';

-- -----------------------------------------------------------------------------
-- Planification (UTC) : toutes les 15 min, 5 min après sync-results (*/15).
-- -----------------------------------------------------------------------------
select cron.schedule('settle-predictions', '5,20,35,50 * * * *', $$select private.invoke_sync_job('settle-predictions')$$);
