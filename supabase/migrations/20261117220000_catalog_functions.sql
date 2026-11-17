-- =============================================================================
-- Phase 5 — Catalogue : fonctions de lecture de la partie GRATUITE des matchs
-- Cahier des charges : sections 5 (F2, F3, RG-F3-1) et 11.
--
-- Règle : ces fonctions ne renvoient JAMAIS de contenu de pronostic
-- (sélection, probabilités, confiance, explication, analyse) ni la prédiction
-- d'API-Football (match_contexts.raw / summary.provider_prediction).
-- Les données issues de match_contexts.summary sont lues par LISTE BLANCHE.
-- =============================================================================

-- Index pour la forme récente et les confrontations directes (équipe + date).
drop index if exists public.fixtures_home_team_id_idx;
drop index if exists public.fixtures_away_team_id_idx;
create index fixtures_home_team_kickoff_idx on public.fixtures (home_team_id, kickoff_at desc);
create index fixtures_away_team_kickoff_idx on public.fixtures (away_team_id, kickoff_at desc);

-- -----------------------------------------------------------------------------
-- Visibilité d'un match pour les utilisateurs (RG-F2-1) : publié ET compétition active.
-- -----------------------------------------------------------------------------
create or replace function public.is_fixture_visible(p_fixture_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    where f.id = p_fixture_id and f.is_published and c.is_active
  );
$$;

revoke all on function public.is_fixture_visible(bigint) from public;
grant execute on function public.is_fixture_visible(bigint) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- fixtures_with_prediction_flag : pour une liste de matchs visibles, indique
-- s'il existe au moins un pronostic publié (marché actif). Renvoie UNIQUEMENT
-- un booléen par match ; les matchs non visibles sont ignorés.
-- -----------------------------------------------------------------------------
create or replace function public.fixtures_with_prediction_flag(p_fixture_ids bigint[])
returns table (fixture_id bigint, has_prediction boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id as fixture_id,
         exists (
           select 1
           from public.predictions p
           join public.markets m on m.code = p.market_code and m.is_active
           where p.fixture_id = f.id and p.status = 'published'
         ) as has_prediction
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
  where f.id = any (p_fixture_ids[1:500])
    and f.is_published
    and c.is_active;
$$;

comment on function public.fixtures_with_prediction_flag(bigint[]) is
  'Pastille « Pronostic disponible » : booléen par match visible (500 au plus), sans aucun contenu de pronostic.';

revoke all on function public.fixtures_with_prediction_flag(bigint[]) from public;
grant execute on function public.fixtures_with_prediction_flag(bigint[]) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- get_fixture_public_context : partie gratuite de la fiche match (F3).
--   - forme : 5 derniers matchs terminés de chaque équipe (base), sinon la
--     forme du classement ou du dossier (liste blanche : last5 uniquement) ;
--   - classement des deux équipes (compétition et saison du match) ;
--   - 5 dernières confrontations directes terminées (base), complétées par le
--     dossier (liste blanche : date, home, away, score).
-- NULL si le match n'est pas visible (non publié ou compétition inactive).
-- -----------------------------------------------------------------------------
create or replace function public.get_fixture_public_context(p_fixture_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f           public.fixtures%rowtype;
  v_summary   jsonb;
  v_result    jsonb;
  v_side      text;
  v_team_id   bigint;
  v_form      jsonb;
  v_standing  jsonb;
  v_form_str  text;
  v_h2h       jsonb;
  v_sides     jsonb := '{}'::jsonb;
  finished    text[] := array['FT', 'AET', 'PEN'];
begin
  if not public.is_fixture_visible(p_fixture_id) then
    return null;
  end if;

  select * into f from public.fixtures where id = p_fixture_id;
  select mc.summary into v_summary from public.match_contexts mc where mc.fixture_id = p_fixture_id;

  foreach v_side in array array['home', 'away'] loop
    v_team_id := case when v_side = 'home' then f.home_team_id else f.away_team_id end;

    -- Forme : 5 derniers matchs terminés de l'équipe avant ce match (toutes compétitions en base).
    select coalesce(jsonb_agg(m order by m ->> 'date' desc), '[]'::jsonb)
      into v_form
      from (
        select jsonb_build_object(
                 'fixture_id', x.id,
                 'date', x.kickoff_at,
                 'venue', case when x.home_team_id = v_team_id then 'home' else 'away' end,
                 'opponent', opp.name,
                 'opponent_logo', opp.logo_url,
                 'goals_for', case when x.home_team_id = v_team_id then x.goals_home else x.goals_away end,
                 'goals_against', case when x.home_team_id = v_team_id then x.goals_away else x.goals_home end,
                 'result', case
                   when x.goals_home = x.goals_away then 'D'
                   when (x.home_team_id = v_team_id) = (x.goals_home > x.goals_away) then 'W'
                   else 'L'
                 end
               ) as m
          from public.fixtures x
          join public.teams opp on opp.id = case when x.home_team_id = v_team_id then x.away_team_id else x.home_team_id end
         where (x.home_team_id = v_team_id or x.away_team_id = v_team_id)
           and x.id <> f.id
           and x.kickoff_at < f.kickoff_at
           and x.status_short = any (finished)
           and x.goals_home is not null and x.goals_away is not null
         order by x.kickoff_at desc
         limit 5
      ) recent;

    -- Classement de l'équipe dans la compétition et la saison du match.
    select jsonb_build_object(
             'rank', s.rank, 'points', s.points, 'played', s.played,
             'won', s.won, 'drawn', s.drawn, 'lost', s.lost,
             'goals_for', s.goals_for, 'goals_against', s.goals_against,
             'goal_diff', s.goals_for - s.goals_against,
             'group_name', nullif(s.group_name, ''), 'form', s.form
           )
      into v_standing
      from public.standings s
     where s.competition_id = f.competition_id and s.season = f.season and s.team_id = v_team_id
     order by s.updated_at desc
     limit 1;

    -- Forme de secours (chaîne « WDLWW ») : classement, sinon dossier (liste blanche).
    v_form_str := coalesce(v_standing ->> 'form', v_summary -> v_side ->> 'last5');
    if v_form_str is not null then
      v_form_str := right(regexp_replace(upper(v_form_str), '[^WDL]', '', 'g'), 5);
      if v_form_str = '' then v_form_str := null; end if;
    end if;

    v_sides := v_sides || jsonb_build_object(
      v_side,
      jsonb_build_object(
        'team_id', v_team_id,
        'form', v_form,
        'form_string', v_form_str,
        'standing', v_standing
      )
    );
  end loop;

  -- Confrontations directes terminées en base.
  select coalesce(jsonb_agg(m order by m ->> 'date' desc), '[]'::jsonb)
    into v_h2h
    from (
      select jsonb_build_object(
               'fixture_id', x.id,
               'date', x.kickoff_at,
               'home', h.name,
               'away', a.name,
               'goals_home', x.goals_home,
               'goals_away', x.goals_away
             ) as m
        from public.fixtures x
        join public.teams h on h.id = x.home_team_id
        join public.teams a on a.id = x.away_team_id
       where ((x.home_team_id = f.home_team_id and x.away_team_id = f.away_team_id)
           or (x.home_team_id = f.away_team_id and x.away_team_id = f.home_team_id))
         and x.id <> f.id
         and x.kickoff_at < f.kickoff_at
         and x.status_short = any (finished)
         and x.goals_home is not null and x.goals_away is not null
       order by x.kickoff_at desc
       limit 5
    ) recent;

  -- Si la base en contient moins de 5, compléter avec le dossier (liste blanche).
  if jsonb_array_length(v_h2h) < 5 and jsonb_typeof(v_summary -> 'head_to_head') = 'array' then
    select v_h2h || coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_h2h
      from (
        select jsonb_build_object(
                 'fixture_id', null,
                 'date', e ->> 'date',
                 'home', e ->> 'home',
                 'away', e ->> 'away',
                 'score', e ->> 'score'
               ) as item
          from jsonb_array_elements(v_summary -> 'head_to_head') e
         where jsonb_typeof(e) = 'object'
         limit 5 - jsonb_array_length(v_h2h)
      ) extra;
  end if;

  v_result := jsonb_build_object(
    'fixture_id', f.id,
    'home', v_sides -> 'home',
    'away', v_sides -> 'away',
    'head_to_head', v_h2h,
    'has_standings', (v_sides -> 'home' -> 'standing') is not null and jsonb_typeof(v_sides -> 'home' -> 'standing') = 'object'
  );
  return v_result;
end;
$$;

comment on function public.get_fixture_public_context(bigint) is
  'Partie gratuite d''une fiche match (forme, classement, confrontations). Jamais de contenu de pronostic.';

revoke all on function public.get_fixture_public_context(bigint) from public;
grant execute on function public.get_fixture_public_context(bigint) to anon, authenticated, service_role;
