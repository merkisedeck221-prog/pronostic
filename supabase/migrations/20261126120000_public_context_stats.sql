-- Partie gratuite de la fiche match : absences connues et moyennes de corners / cartons.
-- Performances publiques : série par semaine (12 dernières semaines) pour le graphique.
-- Lecture seule : aucune table ni donnée modifiée. Les absences viennent du dossier du
-- match (match_contexts.summary), en liste blanche (libellés texte, 20 au plus par équipe) ;
-- aucun autre champ du dossier n'est exposé (règle 1 : jamais de pronostic).
-- Les droits d'exécution existants (anon, authenticated) sont conservés par CREATE OR REPLACE.

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
  v_stats     jsonb;
  v_absences  jsonb;
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

    -- Statistiques : moyennes de corners et de cartons sur les 5 derniers matchs terminés
    -- de l'équipe qui en ont (colonnes de fixtures, tâche sync-statistics).
    select case when count(*) = 0 then null else jsonb_build_object(
             'matches', count(*),
             'corners_for', round(avg(cf)::numeric, 1),
             'corners_against', round(avg(ca)::numeric, 1),
             'cards', round(avg(cd)::numeric, 1)
           ) end
      into v_stats
      from (
        select case when x.home_team_id = v_team_id then x.corners_home else x.corners_away end as cf,
               case when x.home_team_id = v_team_id then x.corners_away else x.corners_home end as ca,
               case when x.home_team_id = v_team_id then x.cards_home else x.cards_away end as cd
          from public.fixtures x
         where (x.home_team_id = v_team_id or x.away_team_id = v_team_id)
           and x.id <> f.id
           and x.kickoff_at < f.kickoff_at
           and x.status_short = any (finished)
           and (x.corners_home is not null or x.cards_home is not null)
         order by x.kickoff_at desc
         limit 5
      ) s;

    -- Absences connues (dossier du match, liste blanche : libellés texte uniquement).
    v_absences := null;
    if jsonb_typeof(v_summary -> v_side -> 'absences') = 'array' then
      select coalesce(jsonb_agg(left(e #>> '{}', 120)), '[]'::jsonb)
        into v_absences
        from (select e from jsonb_array_elements(v_summary -> v_side -> 'absences') e
               where jsonb_typeof(e) = 'string' limit 20) a;
    end if;

    v_sides := v_sides || jsonb_build_object(
      v_side,
      jsonb_build_object(
        'team_id', v_team_id,
        'form', v_form,
        'form_string', v_form_str,
        'standing', v_standing,
        'stats', v_stats,
        'absences', v_absences
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
    -- 12 dernières semaines (lundi, heure de Porto-Novo), semaines sans pronostic incluses.
    'by_week', coalesce((
      select jsonb_agg(row_to_json(x) order by x.week_start)
        from (select to_char(w.week_start, 'YYYY-MM-DD') as week_start,
                     count(b.id) filter (where b.result = 'won') as won,
                     count(b.id) filter (where b.result = 'lost') as lost,
                     count(b.id) filter (where b.result = 'void') as void
                from generate_series(
                       date_trunc('week', (now() at time zone 'Africa/Porto-Novo')) - interval '11 weeks',
                       date_trunc('week', (now() at time zone 'Africa/Porto-Novo')),
                       interval '1 week') as w(week_start)
                left join base b
                  on date_trunc('week', b.kickoff_at at time zone 'Africa/Porto-Novo') = w.week_start
               group by w.week_start) x), '[]'::jsonb),
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
