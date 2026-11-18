-- =============================================================================
-- Phase 11 — Recette : RG-F2-4 « la fenêtre affichée par défaut couvre les
-- 7 prochains jours (paramètre) » : la durée devient un paramètre éditable
-- dans /admin/parametres (1 à 14 jours). Insertion non destructive.
-- =============================================================================
insert into public.app_settings (key, value, description, is_public)
values ('fixtures_window_days', '7'::jsonb, 'Fenêtre (jours) affichée par défaut sur la page Matchs (RG-F2-4).', true)
on conflict (key) do nothing;
