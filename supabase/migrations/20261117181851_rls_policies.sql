-- =============================================================================
-- Migration 7/8 — Sécurité : RLS sur TOUTES les tables + privilèges
-- Cahier des charges : colonne « Accès » de la section 10 et section 11.
--
-- Principes :
--   * RLS activée sur les 20 tables. Sans politique, une table est inaccessible
--     via l'API (anon / authenticated). service_role contourne la RLS (serveur).
--   * Une seule politique permissive par table et par action (lisibilité +
--     performances) ; auth.uid() et is_admin() sont appelés via (select …) pour
--     être évalués une seule fois par requête.
--   * Défense en profondeur : les privilèges d'écriture sont RETIRÉS à anon et
--     authenticated sur les tables qui ne doivent jamais être écrites via l'API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Activation de la RLS sur les 20 tables
-- -----------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.admin_audit_log      enable row level security;
alter table public.competitions         enable row level security;
alter table public.teams                enable row level security;
alter table public.fixtures             enable row level security;
alter table public.standings            enable row level security;
alter table public.match_contexts       enable row level security;
alter table public.markets              enable row level security;
alter table public.predictions          enable row level security;
alter table public.prediction_analyses  enable row level security;
alter table public.prediction_revisions enable row level security;
alter table public.ai_generation_runs   enable row level security;
alter table public.wallets              enable row level security;
alter table public.credit_transactions  enable row level security;
alter table public.unlocks              enable row level security;
alter table public.pricing_rules        enable row level security;
alter table public.credit_packs         enable row level security;
alter table public.topups               enable row level security;
alter table public.app_settings         enable row level security;
alter table public.sync_runs            enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Privilèges (défense en profondeur, en plus de la RLS)
-- -----------------------------------------------------------------------------
-- Un visiteur anonyme ne modifie jamais rien.
revoke insert, update, delete, truncate on all tables in schema public from anon;
-- TRUNCATE ignore la RLS : retiré à tous les rôles de l'API.
revoke truncate on all tables in schema public from authenticated;

-- Tables écrites uniquement par des fonctions SQL ou par le serveur :
-- aucun privilège d'écriture pour authenticated, même admin.
revoke insert, update, delete on
  public.wallets,
  public.credit_transactions,
  public.unlocks,
  public.topups,
  public.admin_audit_log,
  public.prediction_revisions,
  public.ai_generation_runs,
  public.sync_runs
from authenticated;

-- Le profil est créé par le déclencheur handle_new_user et supprimé avec auth.users.
revoke insert on public.profiles from authenticated;

-- Tables créées par les futures migrations : mêmes retraits par défaut.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate on tables from authenticated;

-- =============================================================================
-- 3. Politiques par domaine
-- =============================================================================

-- ----------------------------- Comptes ---------------------------------------

-- profiles : chacun lit et modifie son profil ; l'admin lit et modifie tout.
-- Les colonnes role, is_banned et terms_accepted_at sont protégées par le
-- déclencheur profiles_protect_columns (migration 2).
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- admin_audit_log : lecture admin ; écriture par fonctions serveur uniquement.
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using ((select public.is_admin()));

-- ----------------------------- Football --------------------------------------

-- competitions : lecture publique des actives ; tout pour l'admin.
create policy competitions_select_active_or_admin on public.competitions
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy competitions_insert_admin on public.competitions
  for insert to authenticated with check ((select public.is_admin()));
create policy competitions_update_admin on public.competitions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy competitions_delete_admin on public.competitions
  for delete to authenticated using ((select public.is_admin()));

-- teams : lecture publique ; écriture admin.
create policy teams_select_public on public.teams
  for select to anon, authenticated
  using (true);

create policy teams_insert_admin on public.teams
  for insert to authenticated with check ((select public.is_admin()));
create policy teams_update_admin on public.teams
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teams_delete_admin on public.teams
  for delete to authenticated using ((select public.is_admin()));

-- fixtures : lecture publique des matchs publiés d'une compétition active (RG-F2-1).
create policy fixtures_select_published_or_admin on public.fixtures
  for select to anon, authenticated
  using (
    (
      is_published
      and exists (
        select 1 from public.competitions c
        where c.id = fixtures.competition_id and c.is_active
      )
    )
    or (select public.is_admin())
  );

create policy fixtures_insert_admin on public.fixtures
  for insert to authenticated with check ((select public.is_admin()));
create policy fixtures_update_admin on public.fixtures
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy fixtures_delete_admin on public.fixtures
  for delete to authenticated using ((select public.is_admin()));

-- standings : lecture publique ; écriture admin.
create policy standings_select_public on public.standings
  for select to anon, authenticated
  using (true);

create policy standings_insert_admin on public.standings
  for insert to authenticated with check ((select public.is_admin()));
create policy standings_update_admin on public.standings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy standings_delete_admin on public.standings
  for delete to authenticated using ((select public.is_admin()));

-- match_contexts : ADMIN UNIQUEMENT (contient la prédiction d'API-Football).
create policy match_contexts_select_admin on public.match_contexts
  for select to authenticated using ((select public.is_admin()));
create policy match_contexts_insert_admin on public.match_contexts
  for insert to authenticated with check ((select public.is_admin()));
create policy match_contexts_update_admin on public.match_contexts
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy match_contexts_delete_admin on public.match_contexts
  for delete to authenticated using ((select public.is_admin()));

-- ----------------------------- Pronostics ------------------------------------

-- markets : lecture publique des marchés actifs ; tout pour l'admin.
create policy markets_select_active_or_admin on public.markets
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy markets_insert_admin on public.markets
  for insert to authenticated with check ((select public.is_admin()));
create policy markets_update_admin on public.markets
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy markets_delete_admin on public.markets
  for delete to authenticated using ((select public.is_admin()));

-- predictions : AUCUNE politique pour les utilisateurs. Admin uniquement.
-- Les utilisateurs passeront par get_fixture_predictions() (phase 7).
create policy predictions_select_admin on public.predictions
  for select to authenticated using ((select public.is_admin()));
create policy predictions_insert_admin on public.predictions
  for insert to authenticated with check ((select public.is_admin()));
create policy predictions_update_admin on public.predictions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy predictions_delete_admin on public.predictions
  for delete to authenticated using ((select public.is_admin()));

-- prediction_analyses : même règle que predictions.
create policy prediction_analyses_select_admin on public.prediction_analyses
  for select to authenticated using ((select public.is_admin()));
create policy prediction_analyses_insert_admin on public.prediction_analyses
  for insert to authenticated with check ((select public.is_admin()));
create policy prediction_analyses_update_admin on public.prediction_analyses
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy prediction_analyses_delete_admin on public.prediction_analyses
  for delete to authenticated using ((select public.is_admin()));

-- prediction_revisions et ai_generation_runs : lecture admin ; écriture serveur.
create policy prediction_revisions_select_admin on public.prediction_revisions
  for select to authenticated using ((select public.is_admin()));

create policy ai_generation_runs_select_admin on public.ai_generation_runs
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------- Crédits ---------------------------------------
-- AUCUNE politique INSERT / UPDATE / DELETE : écritures par fonctions SQL.

create policy wallets_select_own_or_admin on public.wallets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy credit_transactions_select_own_or_admin on public.credit_transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy unlocks_select_own_or_admin on public.unlocks
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy topups_select_own_or_admin on public.topups
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- pricing_rules : lecture publique des règles actives ; écriture admin.
create policy pricing_rules_select_active_or_admin on public.pricing_rules
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy pricing_rules_insert_admin on public.pricing_rules
  for insert to authenticated with check ((select public.is_admin()));
create policy pricing_rules_update_admin on public.pricing_rules
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy pricing_rules_delete_admin on public.pricing_rules
  for delete to authenticated using ((select public.is_admin()));

-- credit_packs : lecture publique des packs actifs ; écriture admin.
create policy credit_packs_select_active_or_admin on public.credit_packs
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy credit_packs_insert_admin on public.credit_packs
  for insert to authenticated with check ((select public.is_admin()));
create policy credit_packs_update_admin on public.credit_packs
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy credit_packs_delete_admin on public.credit_packs
  for delete to authenticated using ((select public.is_admin()));

-- ----------------------------- Pilotage --------------------------------------

-- app_settings : lecture publique des clés non sensibles ; écriture admin.
create policy app_settings_select_public_or_admin on public.app_settings
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));

create policy app_settings_insert_admin on public.app_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy app_settings_update_admin on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy app_settings_delete_admin on public.app_settings
  for delete to authenticated using ((select public.is_admin()));

-- sync_runs : lecture admin ; écriture serveur.
create policy sync_runs_select_admin on public.sync_runs
  for select to authenticated using ((select public.is_admin()));
