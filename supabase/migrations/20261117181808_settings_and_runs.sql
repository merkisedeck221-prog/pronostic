-- =============================================================================
-- Migration 6/8 — Domaine « Pilotage » : app_settings, sync_runs
-- Cahier des charges : sections 6, 7 et 10.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- app_settings : paramètres modifiables depuis l'admin sans redéploiement.
-- is_public : clé lisible par tous (les clés sensibles futures auront false).
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key          text primary key check (key ~ '^[a-z0-9_]+$'),
  value        jsonb not null,
  description  text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.app_settings is 'Paramètres de l''application (section 6).';

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_runs : journal des tâches planifiées (appels API, quota, erreurs).
-- -----------------------------------------------------------------------------
create table public.sync_runs (
  id               bigint generated always as identity primary key,
  job              text not null,
  status           public.run_status not null default 'running',
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  api_calls        integer not null default 0 check (api_calls >= 0),
  items_processed  integer not null default 0 check (items_processed >= 0),
  quota_remaining  integer,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.sync_runs is 'Journal des tâches planifiées. Admin uniquement.';

create index sync_runs_job_started_idx on public.sync_runs (job, started_at desc);
create index sync_runs_started_idx on public.sync_runs (started_at desc);

create trigger sync_runs_set_updated_at
  before update on public.sync_runs
  for each row execute function public.set_updated_at();
