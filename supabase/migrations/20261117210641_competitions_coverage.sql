-- =============================================================================
-- Phase 4 — Couverture des données par compétition (API-Football /leagues)
--
-- coverage : objet « coverage » de la saison en cours, ex.
--   {"standings": true, "predictions": true, "injuries": false, "fixtures": {...}}
-- Sert à savoir s'il faut synchroniser le classement (sync-standings) et, en
-- phase 6, si /predictions et /injuries sont disponibles pour le dossier IA.
-- =============================================================================

alter table public.competitions
  add column coverage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(coverage) = 'object');

comment on column public.competitions.coverage is
  'Couverture API-Football de la saison en cours (standings, predictions, injuries…).';
