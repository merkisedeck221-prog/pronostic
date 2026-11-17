-- =============================================================================
-- Migration 4/8 — Domaine « Pronostics »
-- markets, predictions, prediction_analyses, prediction_revisions, ai_generation_runs
-- Cahier des charges : sections 5 (F4, F5), 8 et 10.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- markets : types de pronostics (MATCH_RESULT, EXACT_SCORE, OVER_UNDER_2_5, BTTS).
-- -----------------------------------------------------------------------------
create table public.markets (
  code         text primary key check (code ~ '^[A-Z0-9_]+$'),
  label        text not null,
  description  text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.markets is 'Types de pronostics (marchés), activables par l''admin.';

create trigger markets_set_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Vérifie la forme des probabilités 1N2 : {"home": int, "draw": int, "away": int},
-- chaque valeur entre 0 et 100. (La somme = 100 est contrôlée par le code, section 8.)
-- -----------------------------------------------------------------------------
create or replace function public.is_valid_1x2_probabilities(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and jsonb_typeof(p -> 'home') = 'number'
    and jsonb_typeof(p -> 'draw') = 'number'
    and jsonb_typeof(p -> 'away') = 'number'
    and (p ->> 'home')::numeric between 0 and 100
    and (p ->> 'draw')::numeric between 0 and 100
    and (p ->> 'away')::numeric between 0 and 100
  );
$$;

-- -----------------------------------------------------------------------------
-- predictions : un pronostic par match et par marché.
-- AUCUNE lecture directe pour les utilisateurs (section 11) : accès par
-- get_fixture_predictions() (phase 7). Admin en lecture et écriture.
-- -----------------------------------------------------------------------------
create table public.predictions (
  id               bigint generated always as identity primary key,
  fixture_id       bigint not null references public.fixtures (id) on delete cascade,
  market_code      text not null references public.markets (code) on delete restrict,
  selection        text not null,
  selection_label  text not null,
  -- Probabilité estimée de la sélection, en %.
  probability      smallint not null check (probability between 0 and 100),
  -- 1N2 uniquement : les trois probabilités.
  probabilities    jsonb check (public.is_valid_1x2_probabilities(probabilities)),
  confidence       public.confidence_level not null,
  reasoning        text not null,
  status           public.prediction_status not null default 'published',
  result           public.prediction_result not null default 'pending',
  -- Figé dès le premier achat (RG-F5-6).
  is_locked        boolean not null default false,
  version          integer not null default 1 check (version >= 1),
  prompt_version   text not null,
  settled_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- L'index unique sert aussi d'index de recherche sur fixture_id (colonne de tête).
  constraint predictions_fixture_market_unique unique (fixture_id, market_code)
);

comment on table public.predictions is 'Pronostics. Lecture directe interdite aux utilisateurs (section 11).';

create index predictions_result_settled_idx on public.predictions (result, settled_at desc);
create index predictions_market_code_idx on public.predictions (market_code);

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prediction_analyses : analyse globale du match (incluse dans « match complet »).
-- -----------------------------------------------------------------------------
create table public.prediction_analyses (
  id              bigint generated always as identity primary key,
  fixture_id      bigint not null unique references public.fixtures (id) on delete cascade,
  summary         text not null,
  key_factors     jsonb not null default '[]'::jsonb check (jsonb_typeof(key_factors) = 'array'),
  model           text not null,
  prompt_version  text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.prediction_analyses is 'Analyse globale d''un match. Même règle d''accès que predictions.';

create trigger prediction_analyses_set_updated_at
  before update on public.prediction_analyses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prediction_revisions : historique des modifications et régénérations.
-- -----------------------------------------------------------------------------
create table public.prediction_revisions (
  id             bigint generated always as identity primary key,
  prediction_id  bigint not null references public.predictions (id) on delete cascade,
  previous       jsonb not null,
  changed_by     uuid references public.profiles (id) on delete set null,
  reason         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.prediction_revisions is 'Historique des modifications de pronostics (RG-F5-6). Admin uniquement.';

create index prediction_revisions_prediction_id_idx on public.prediction_revisions (prediction_id);
create index prediction_revisions_changed_by_idx on public.prediction_revisions (changed_by);

create trigger prediction_revisions_set_updated_at
  before update on public.prediction_revisions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ai_generation_runs : suivi des appels OpenAI (tokens, coût, durée, erreurs).
-- -----------------------------------------------------------------------------
create table public.ai_generation_runs (
  id                 bigint generated always as identity primary key,
  fixture_id         bigint references public.fixtures (id) on delete set null,
  status             public.run_status not null,
  model              text not null,
  prompt_version     text not null,
  input_tokens       integer check (input_tokens >= 0),
  output_tokens      integer check (output_tokens >= 0),
  cost_estimate_usd  numeric(12, 6) check (cost_estimate_usd >= 0),
  duration_ms        integer check (duration_ms >= 0),
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.ai_generation_runs is 'Suivi des générations IA. Admin uniquement.';

create index ai_generation_runs_created_at_idx on public.ai_generation_runs (created_at desc);
create index ai_generation_runs_fixture_id_idx on public.ai_generation_runs (fixture_id);

create trigger ai_generation_runs_set_updated_at
  before update on public.ai_generation_runs
  for each row execute function public.set_updated_at();
