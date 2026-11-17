-- =============================================================================
-- Migration 3/8 — Domaine « Données football »
-- competitions, teams, fixtures, standings, match_contexts
-- Cahier des charges : sections 5 (F2, F3), 7 et 10.
-- Données alimentées par les tâches de synchronisation API-Football (phase 4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- competitions : compétitions suivies (activables depuis l'admin).
-- -----------------------------------------------------------------------------
create table public.competitions (
  id              bigint generated always as identity primary key,
  api_league_id   integer not null unique,
  name            text not null,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category        public.competition_category not null,
  type            text not null check (type in ('league', 'cup')),
  country         text,
  logo_url        text,
  current_season  integer check (current_season between 1900 and 2200),
  is_active       boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.competitions is 'Compétitions suivies. Seules les actives sont visibles (RG-F2-1).';

create index competitions_active_sort_idx on public.competitions (is_active, sort_order);

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- teams : équipes de clubs et sélections nationales.
-- -----------------------------------------------------------------------------
create table public.teams (
  id           bigint generated always as identity primary key,
  api_team_id  integer not null unique,
  name         text not null,
  short_name   text,
  country      text,
  logo_url     text,
  is_national  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.teams is 'Équipes et sélections (API-Football /teams).';

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- fixtures : matchs. Heures en UTC (RG-F2-2).
-- -----------------------------------------------------------------------------
create table public.fixtures (
  id                   bigint generated always as identity primary key,
  api_fixture_id       integer not null unique,
  competition_id       bigint not null references public.competitions (id) on delete restrict,
  season               integer not null check (season between 1900 and 2200),
  round                text,
  kickoff_at           timestamptz not null,
  -- Statut court API-Football : NS, 1H, HT, 2H, ET, P, FT, AET, PEN, PST, CANC, ABD…
  status_short         text not null default 'NS',
  status_long          text,
  home_team_id         bigint not null references public.teams (id) on delete restrict,
  away_team_id         bigint not null references public.teams (id) on delete restrict,
  -- Score courant / final tel que renvoyé par l'API.
  goals_home           smallint check (goals_home >= 0),
  goals_away           smallint check (goals_away >= 0),
  -- Score à la mi-temps.
  ht_home              smallint check (ht_home >= 0),
  ht_away              smallint check (ht_away >= 0),
  -- Score au temps réglementaire (90 min + temps additionnel), base de la résolution (RG-F4-1).
  ft_home              smallint check (ft_home >= 0),
  ft_away              smallint check (ft_away >= 0),
  venue                text,
  is_published         boolean not null default true,
  -- Coup d'envoi initial, pour détecter un report de plus de 48 h (RG-F5-7).
  original_kickoff_at  timestamptz,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint fixtures_distinct_teams check (home_team_id <> away_team_id)
);

comment on table public.fixtures is 'Matchs. Visibles si publiés et si leur compétition est active (RG-F2-1).';
comment on column public.fixtures.ft_home is 'Buts domicile au temps réglementaire (hors prolongations et tirs au but).';

create index fixtures_kickoff_at_idx on public.fixtures (kickoff_at);
create index fixtures_competition_id_idx on public.fixtures (competition_id, kickoff_at);
create index fixtures_status_short_idx on public.fixtures (status_short);
create index fixtures_home_team_id_idx on public.fixtures (home_team_id);
create index fixtures_away_team_id_idx on public.fixtures (away_team_id);

create trigger fixtures_set_updated_at
  before update on public.fixtures
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- standings : classements (une ligne par équipe, saison et groupe).
-- -----------------------------------------------------------------------------
create table public.standings (
  id              bigint generated always as identity primary key,
  competition_id  bigint not null references public.competitions (id) on delete cascade,
  season          integer not null check (season between 1900 and 2200),
  group_name      text not null default '',
  team_id         bigint not null references public.teams (id) on delete cascade,
  rank            smallint not null check (rank > 0),
  points          smallint not null default 0,
  played          smallint not null default 0 check (played >= 0),
  won             smallint not null default 0 check (won >= 0),
  drawn           smallint not null default 0 check (drawn >= 0),
  lost            smallint not null default 0 check (lost >= 0),
  goals_for       smallint not null default 0 check (goals_for >= 0),
  goals_against   smallint not null default 0 check (goals_against >= 0),
  -- Forme récente, ex. « WWDLW ».
  form            text check (form is null or form ~ '^[WDL]{0,10}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint standings_unique_row unique (competition_id, season, group_name, team_id)
);

comment on table public.standings is 'Classements (API-Football /standings).';

create index standings_team_id_idx on public.standings (team_id);

create trigger standings_set_updated_at
  before update on public.standings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- match_contexts : dossier de match envoyé à l'IA (section 8).
-- ADMIN UNIQUEMENT : contient la prédiction d'API-Football.
-- -----------------------------------------------------------------------------
create table public.match_contexts (
  id          bigint generated always as identity primary key,
  fixture_id  bigint not null unique references public.fixtures (id) on delete cascade,
  raw         jsonb not null,
  summary     jsonb not null,
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.match_contexts is 'Dossier de match (JSON brut et résumé). Admin uniquement.';

create trigger match_contexts_set_updated_at
  before update on public.match_contexts
  for each row execute function public.set_updated_at();
