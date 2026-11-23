-- =============================================================================
-- Crédits v2, lot 4 — Nouveaux types d'analyses (module 4, décision D2 : lot A).
-- Double chance, résultat à la mi-temps, mi-temps/fin de match, handicap ±1,5,
-- plus/moins 1,5 et 3,5 buts. Générés par le prompt v2 (lib/ai/prompts/v2.ts).
-- Règles de résolution : miroir EXACT de lib/settle/rules.ts, vérifié par la
-- table de cas partagée tests/fixtures/settlement-cases.json.
-- =============================================================================

insert into public.markets (code, label, description, is_active, sort_order) values
  ('DOUBLE_CHANCE',  'Double chance',                 'Deux issues sur trois au temps réglementaire : 1N (domicile ou nul), 12 (pas de nul) ou N2 (nul ou extérieur).', true, 5),
  ('HT_RESULT',      'Résultat à la mi-temps',        'Équipe en tête (1, 2) ou égalité (N) à la mi-temps.',                                                                  true, 6),
  ('HT_FT',          'Mi-temps / fin de match',       'Résultat à la mi-temps ET au temps réglementaire, ex. N/1.',                                                            true, 7),
  ('HANDICAP',       'Handicap (±1,5 but)',           'Handicap européen de 1,5 but au temps réglementaire (jamais de remboursement).',                                        true, 8),
  ('OVER_UNDER_1_5', 'Plus/Moins de 1,5 but',         'Plus de 1,5 but (2 ou plus) ou moins de 1,5 but (0 ou 1) au temps réglementaire.',                                     true, 9),
  ('OVER_UNDER_3_5', 'Plus/Moins de 3,5 buts',        'Plus de 3,5 buts (4 ou plus) ou moins de 3,5 buts (3 ou moins) au temps réglementaire.',                               true, 10)
on conflict (code) do nothing;

-- Prix de départ (modifiables dans /admin/tarifs).
insert into public.pricing_rules (scope, market_code, competition_id, credits, is_active) values
  ('market', 'DOUBLE_CHANCE',  null, 2, true),
  ('market', 'HT_RESULT',      null, 2, true),
  ('market', 'HT_FT',          null, 3, true),
  ('market', 'HANDICAP',       null, 2, true),
  ('market', 'OVER_UNDER_1_5', null, 2, true),
  ('market', 'OVER_UNDER_3_5', null, 2, true)
on conflict (scope, market_code, competition_id) do nothing;

-- -----------------------------------------------------------------------------
-- Résolution avec le score de la mi-temps (marchés HT_RESULT et HT_FT).
-- Les autres marchés délèguent à settle_outcome (inchangée).
-- -----------------------------------------------------------------------------
create or replace function public.settle_outcome_ht(
  p_market text, p_selection text, p_home integer, p_away integer, p_ht_home integer, p_ht_away integer)
returns public.prediction_result
language sql
immutable
set search_path = ''
as $$
  select case
    when p_home is null or p_away is null then null
    when p_market = 'DOUBLE_CHANCE' and p_selection = '1N' then
      case when p_home >= p_away then 'won' else 'lost' end::public.prediction_result
    when p_market = 'DOUBLE_CHANCE' and p_selection = '12' then
      case when p_home <> p_away then 'won' else 'lost' end::public.prediction_result
    when p_market = 'DOUBLE_CHANCE' and p_selection = 'N2' then
      case when p_away >= p_home then 'won' else 'lost' end::public.prediction_result
    when p_market = 'OVER_UNDER_1_5' and p_selection in ('OVER', 'UNDER') then
      case when (p_home + p_away >= 2) = (p_selection = 'OVER') then 'won' else 'lost' end::public.prediction_result
    when p_market = 'OVER_UNDER_3_5' and p_selection in ('OVER', 'UNDER') then
      case when (p_home + p_away >= 4) = (p_selection = 'OVER') then 'won' else 'lost' end::public.prediction_result
    when p_market = 'HANDICAP' and p_selection = 'HOME_-1.5' then
      case when p_home - p_away >= 2 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'HANDICAP' and p_selection = 'AWAY_+1.5' then
      case when p_home - p_away <= 1 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'HANDICAP' and p_selection = 'HOME_+1.5' then
      case when p_home - p_away >= -1 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'HANDICAP' and p_selection = 'AWAY_-1.5' then
      case when p_home - p_away <= -2 then 'won' else 'lost' end::public.prediction_result
    when p_market = 'HT_RESULT' then
      case when p_ht_home is null or p_ht_away is null or p_selection not in ('1', 'N', '2') then null
           else public.settle_outcome('MATCH_RESULT', p_selection, p_ht_home, p_ht_away) end
    when p_market = 'HT_FT' then
      case when p_ht_home is null or p_ht_away is null or p_selection !~ '^[1N2]/[1N2]$' then null
           when public.settle_outcome('MATCH_RESULT', split_part(p_selection, '/', 1), p_ht_home, p_ht_away) = 'won'
            and public.settle_outcome('MATCH_RESULT', split_part(p_selection, '/', 2), p_home, p_away) = 'won'
           then 'won' else 'lost' end::public.prediction_result
    else public.settle_outcome(p_market, p_selection, p_home, p_away)
  end;
$$;

comment on function public.settle_outcome_ht(text, text, integer, integer, integer, integer) is
  'Résultat d''un pronostic (tous marchés) ; score de la mi-temps pour HT_RESULT et HT_FT. Miroir de lib/settle/rules.ts.';
revoke all on function public.settle_outcome_ht(text, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.settle_outcome_ht(text, text, integer, integer, integer, integer) to service_role;

-- settle_fixture : même comportement, avec le score de la mi-temps.
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
  select f.id, f.status_short, f.ft_home, f.ft_away, f.ht_home, f.ht_away into v_fixture
    from public.fixtures f where f.id = p_fixture_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_fixture.status_short not in ('FT', 'AET', 'PEN') or v_fixture.ft_home is null or v_fixture.ft_away is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FINISHED', 'status', v_fixture.status_short);
  end if;
  with outcomes as (
    select p.id, public.settle_outcome_ht(p.market_code, p.selection, v_fixture.ft_home, v_fixture.ft_away,
                                          v_fixture.ht_home, v_fixture.ht_away) as result
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
                            'score', v_fixture.ft_home || '-' || v_fixture.ft_away,
                            'half_time', case when v_fixture.ht_home is not null then v_fixture.ht_home || '-' || v_fixture.ht_away end);
end;
$$;
