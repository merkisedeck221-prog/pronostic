-- =============================================================================
-- Migration 1/8 — Types énumérés et fonctions utilitaires
-- Cahier des charges : sections 5, 6 et 10.
-- =============================================================================

-- Rôle d'un compte (RG-F1-3 : seul un admin ou la base peut attribuer « admin »).
create type public.user_role as enum ('user', 'admin');

-- Catégorie d'une compétition : championnat de clubs ou compétition de sélections.
create type public.competition_category as enum ('club_league', 'international');

-- Types de mouvements de crédits (section 6).
create type public.transaction_type as enum ('topup', 'unlock', 'bonus', 'refund', 'admin_adjustment');

-- Statut d'une recharge (RG-F6-1).
create type public.topup_status as enum ('pending', 'succeeded', 'failed', 'cancelled');

-- Visibilité d'un pronostic (RG-F4-3 : un pronostic masqué n'est ni visible ni achetable).
create type public.prediction_status as enum ('published', 'hidden');

-- Résultat d'un pronostic après le match (F7).
create type public.prediction_result as enum ('pending', 'won', 'lost', 'void');

-- Indice de confiance affiché : Faible, Moyen, Élevé.
create type public.confidence_level as enum ('low', 'medium', 'high');

-- Statut d'une exécution de tâche (sync_runs) ou d'une génération IA (ai_generation_runs).
-- « partial » : le lot s'est terminé mais certains éléments ont échoué (section 11, Fiabilité).
create type public.run_status as enum ('running', 'success', 'partial', 'failed');

-- -----------------------------------------------------------------------------
-- Déclencheur générique : met à jour updated_at à chaque modification de ligne.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Déclencheur BEFORE UPDATE : renseigne updated_at = now().';
