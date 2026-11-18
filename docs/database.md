# Base de données (Supabase)

Référence : [cahier des charges](cahier-des-charges.md), sections 5, 6, 10 et 11.
Projet de **développement** : `pronostics` (réf. `pgeytactmugqskdzsxnw`, région eu-west-1, PostgreSQL 17).

## Migrations

Fichiers SQL versionnés dans `supabase/migrations/`, appliqués dans l'ordre :

| Fichier | Contenu |
|---|---|
| `20261117181542_enums_and_helpers.sql` | 8 types énumérés, déclencheur générique `set_updated_at()` |
| `20261117181606_accounts.sql` | `profiles`, `admin_audit_log`, `is_admin()`, protection des colonnes sensibles |
| `20261117181638_football.sql` | `competitions`, `teams`, `fixtures`, `standings`, `match_contexts` |
| `20261117181710_predictions.sql` | `markets`, `predictions`, `prediction_analyses`, `prediction_revisions`, `ai_generation_runs` |
| `20261117181754_credits.sql` | `wallets`, `credit_transactions`, `unlocks`, `pricing_rules`, `credit_packs`, `topups` |
| `20261117181808_settings_and_runs.sql` | `app_settings`, `sync_runs` |
| `20261117181851_rls_policies.sql` | RLS sur les 20 tables, politiques, retrait des privilèges d'écriture |
| `20261117181926_handle_new_user.sql` | Déclencheur `on_auth_user_created` → `handle_new_user()` |
| `20261117210641_competitions_coverage.sql` | Colonne `competitions.coverage` (phase 4) |
| `20261117210710_cron_sync_jobs.sql` | pg_cron + pg_net, `private.invoke_sync_job()`, 4 tâches planifiées (phase 4) |
| `20261117213653_catalog_functions.sql` | Fonctions du catalogue et index équipe + date (phase 5) |
| `20261117215848_ai_generation.sql` | `save_ai_generation()` et tâches planifiées IA (phase 6) |
| `20261117223746_credits_unlock.sql` | Prix, déblocage, lecture des pronostics, ajustement admin (phase 7) |
| `20261118052343_topups.sql` | `create_topup`, `apply_topup` (phase 8) |
| `20261118053930_settlement.sql` | Résolution, remboursements, performances, Mes pronostics, tâche `settle-predictions` (phase 9) |
| `20261118060511_admin.sql` | Fonctions d'administration (phase 10) |
| `20261118063349_qa_hardening.sql` | Recette : `created_at` protégé, contrainte sur `timezone`, droit retiré sur `rls_auto_enable` (phase 11) |
| `20261118064038_fixtures_window_setting.sql` | Paramètre `fixtures_window_days` (RG-F2-4, phase 11) |

Données de départ : `supabase/seed.sql` (4 marchés, 5 règles de prix, 3 packs, 6 paramètres). Idempotent (`ON CONFLICT DO NOTHING`) : relancé, il ne réécrase jamais une valeur modifiée depuis l'admin. Aucune compétition : elles arrivent en phase 4.

### Appliquer les migrations

Avec le CLI Supabase (installé en dépendance de développement ; nécessite `npx supabase login` ou la variable `SUPABASE_ACCESS_TOKEN`) :

```bash
npx supabase link --project-ref pgeytactmugqskdzsxnw
npx supabase db push              # applique les migrations manquantes
npx supabase db push --include-seed   # idem + seed.sql
```

Sans le CLI : coller le contenu de chaque fichier, dans l'ordre, dans le *SQL Editor* du tableau de bord Supabase, puis `seed.sql`.

Depuis Claude Code (intégration Supabase) : `apply_migration` puis `execute_sql` pour le seed, **en gardant toujours le fichier SQL correspondant dans `supabase/migrations/`**, avec le numéro de version renvoyé par `list_migrations` (les noms des fichiers locaux doivent correspondre aux versions distantes).

### Régénérer les types TypeScript

Après **chaque** migration :

```bash
npm run db:types   # écrit types/database.ts (projet : $SUPABASE_PROJECT_REF, défaut = dev)
```

### Règles pour les futures migrations

- Toute nouvelle table : `created_at`, `updated_at`, déclencheur `set_updated_at`, **RLS activée** et politiques explicites.
- Les privilèges d'écriture de `anon` (et `TRUNCATE` de `authenticated`) sont retirés par défaut sur les nouvelles tables (`alter default privileges`). Pour une table écrite seulement par le serveur, retirer aussi `insert, update, delete` à `authenticated`.
- Fonctions `SECURITY DEFINER` : toujours `set search_path = ''` et noms qualifiés (`public.…`).

## Schéma

### Types énumérés

| Type | Valeurs |
|---|---|
| `user_role` | `user`, `admin` |
| `competition_category` | `club_league`, `international` |
| `transaction_type` | `topup`, `unlock`, `bonus`, `refund`, `admin_adjustment` |
| `topup_status` | `pending`, `succeeded`, `failed`, `cancelled` |
| `prediction_status` | `published`, `hidden` |
| `prediction_result` | `pending`, `won`, `lost`, `void` |
| `confidence_level` | `low`, `medium`, `high` |
| `run_status` | `running`, `success`, `partial`, `failed` |

### Tables et relations

```
auth.users ─1:1─ profiles ─1:1─ wallets
                    │
                    ├─< credit_transactions >─┐ (unlocks.transaction_id)
                    ├─< unlocks >── fixtures, markets
                    ├─< topups >── credit_packs
                    ├─< admin_audit_log (admin_id)
                    └─< prediction_revisions (changed_by)

competitions ─< fixtures >── teams (home_team_id, away_team_id)
     │             ├─1:1─ match_contexts
     │             ├─1:1─ prediction_analyses
     │             ├─< predictions >── markets ─< prediction_revisions
     │             └─< ai_generation_runs
     ├─< standings >── teams
     └─< pricing_rules >── markets

app_settings, sync_runs : tables autonomes
```

| Domaine | Table | Clé | Points clés |
|---|---|---|---|
| Comptes | `profiles` | `id` = `auth.users.id` | `role`, `is_banned`, `terms_accepted_at` protégés ; fuseau par défaut `Africa/Porto-Novo` |
| | `admin_audit_log` | `id` | qui / quoi / avant / après / motif |
| Football | `competitions` | `id` ; `api_league_id`, `slug` uniques | `is_active` (défaut `false`), `category`, `type` (`league`/`cup`) |
| | `teams` | `id` ; `api_team_id` unique | `is_national` |
| | `fixtures` | `id` ; `api_fixture_id` unique | heures UTC ; `ft_home/ft_away` = temps réglementaire ; `original_kickoff_at` pour les reports ; index sur `kickoff_at`, `competition_id`, `status_short` |
| | `standings` | `id` ; unique (compétition, saison, groupe, équipe) | `form` au format `WDL` |
| | `match_contexts` | `id` ; `fixture_id` unique | dossier IA (contient la prédiction API-Football) |
| Pronostics | `markets` | `code` | 4 marchés au départ |
| | `predictions` | `id` ; unique (`fixture_id`, `market_code`) | probabilités 0-100 (`CHECK`), `probabilities` 1N2 validées, `is_locked`, `version`, `prompt_version` |
| | `prediction_analyses` | `id` ; `fixture_id` unique | `key_factors` = tableau JSON |
| | `prediction_revisions` | `id` | historique (RG-F5-6) |
| | `ai_generation_runs` | `id` | tokens, coût, durée, erreur |
| Crédits | `wallets` | `user_id` | `CHECK (balance >= 0)` |
| | `credit_transactions` | `id` | montant signé cohérent avec le type ; `balance_after >= 0` ; index (`user_id`, `created_at`) ; bonus de bienvenue unique par compte |
| | `unlocks` | `id` ; `UNIQUE NULLS NOT DISTINCT (user_id, fixture_id, market_code)` | `market_code` NULL = match complet |
| | `pricing_rules` | `id` ; `UNIQUE NULLS NOT DISTINCT (scope, market_code, competition_id)` | `scope` `market` (avec marché) ou `match_bundle` (sans) ; `competition_id` NULL = règle générale |
| | `credit_packs` | `id` ; `name` unique | prix en XOF |
| | `topups` | `id` (uuid) ; `provider_ref` unique | statut `pending` → `succeeded` |
| Pilotage | `app_settings` | `key` | `value` jsonb ; `is_public` |
| | `sync_runs` | `id` | journal des tâches |

## Sécurité : RLS et privilèges

La RLS est **activée sur les 20 tables**. Sans politique, une table est inaccessible via l'API ; la clé secrète (`service_role`, serveur uniquement) contourne la RLS.

En plus des politiques, les **privilèges** d'écriture sont retirés (défense en profondeur) :

- `anon` : aucun `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` sur aucune table ;
- `authenticated` : aucun `TRUNCATE` ; aucune écriture sur `wallets`, `credit_transactions`, `unlocks`, `topups`, `admin_audit_log`, `prediction_revisions`, `ai_generation_runs`, `sync_runs` ; pas d'`INSERT` sur `profiles`.

### Politiques par table

« Admin » = `is_admin()` : profil `role = 'admin'` et non suspendu.

| Table | Lecture | Écriture via l'API |
|---|---|---|
| `profiles` | son profil ; admin : tous | `UPDATE` de son profil (sauf `role`, `is_banned`, `terms_accepted_at` : déclencheur) ; admin : `UPDATE`/`DELETE` de tous, sauf son propre rôle et sa propre suspension |
| `admin_audit_log` | admin | aucune (fonctions serveur) |
| `competitions` | tous (anonyme compris) : actives ; admin : toutes | admin |
| `teams` | tous | admin |
| `fixtures` | tous : publiées **et** compétition active ; admin : toutes | admin |
| `standings` | tous | admin |
| `match_contexts` | **admin uniquement** | admin |
| `markets` | tous : actifs ; admin : tous | admin |
| `predictions` | **admin uniquement** (utilisateurs : uniquement via `get_fixture_predictions`) | admin |
| `prediction_analyses` | **admin uniquement** | admin |
| `prediction_revisions` | admin | aucune (serveur) |
| `ai_generation_runs` | admin | aucune (serveur) |
| `wallets` | son portefeuille ; admin : tous | **aucune** |
| `credit_transactions` | ses transactions ; admin : toutes | **aucune** |
| `unlocks` | ses déblocages ; admin : tous | **aucune** |
| `topups` | ses recharges ; admin : toutes | **aucune** (serveur) |
| `pricing_rules` | tous : actives ; admin : toutes | admin |
| `credit_packs` | tous : actifs ; admin : tous | admin |
| `app_settings` | tous : `is_public` ; admin : toutes | admin |
| `sync_runs` | admin | aucune (serveur) |

### Fonctions

| Fonction | Type | Rôle |
|---|---|---|
| `is_admin()` | `SECURITY DEFINER`, `STABLE` | utilisée par les politiques ; exécutable par `anon`/`authenticated` (nécessaire à la RLS ; ne renvoie que le statut de l'appelant) |
| `protect_profile_columns()` | déclencheur | bloque la modification de `role`, `is_banned`, `terms_accepted_at`, `id` et (phase 11) `created_at` par l'API |
| `handle_new_user()` | `SECURITY DEFINER`, déclencheur sur `auth.users` | crée `profiles` + `wallets` ; crédite `welcome_credits` (transaction `bonus`, une seule fois) ; non exécutable via l'API |
| `set_updated_at()` | déclencheur | `updated_at = now()` |
| `is_valid_1x2_probabilities(jsonb)` | `IMMUTABLE` | contrainte `CHECK` sur `predictions.probabilities` |
| `rls_auto_enable()` | fournie par Supabase | déclencheur d'événement qui active la RLS sur les nouvelles tables |
| `is_fixture_visible(fixture_id)` | `SECURITY DEFINER`, `STABLE` | vrai si le match est publié et sa compétition active (RG-F2-1) |
| `fixtures_with_prediction_flag(fixture_ids[])` | `SECURITY DEFINER`, `STABLE` | pastille « Pronostic disponible » : **un booléen** par match visible (500 au plus), aucun contenu |
| `get_fixture_public_context(fixture_id)` | `SECURITY DEFINER`, `STABLE` | partie gratuite d'une fiche match : forme (5 matchs), classement des deux équipes, 5 confrontations directes ; `match_contexts.summary` lu par **liste blanche** (`last5`, `date/home/away/score`), jamais `provider_prediction` ; `NULL` si le match n'est pas visible |

Les trois fonctions du catalogue sont exécutables par `anon` (alerte du conseiller Supabase acceptée) : elles ne renvoient que des données déjà publiques par la RLS (matchs publiés, classements, équipes) et un booléen ; elles serviront aussi à la page publique Performances.

#### Crédits et déblocage (phase 7)

| Fonction | Exécutable par | Rôle |
|---|---|---|
| `get_unlock_price(fixture_id, market_code)` | `authenticated` | prix pour l'utilisateur connecté ; marché vide = match complet. Règle de la compétition, sinon règle générale ; match complet : déduction de ce qui a déjà été payé sur ce match (RG-F5-3), jamais sous 0 ; respecte `pricing_mode`. Renvoie `{ok, price, base_price, deduction}` ou `{ok:false, code, message}` |
| `unlock_prediction(fixture_id, market_code)` | `authenticated` | déblocage en **une transaction** : connecté, non suspendu, pas de maintenance, match publié, coup d'envoi futur, marché actif avec pronostic publié, `SELECT … FOR UPDATE` du portefeuille, pas déjà débloqué (le match complet couvre les marchés), prix recalculé, solde, débit, `credit_transactions` (`unlock`, montant négatif, `balance_after`, référence `fixture`), `unlocks`, `predictions.is_locked = true`. Codes : `INSUFFICIENT_BALANCE`, `ALREADY_UNLOCKED`, `MATCH_STARTED`, `NOT_AVAILABLE`, `MAINTENANCE`, `BANNED`, `NOT_AUTHENTICATED` |
| `get_fixture_predictions(fixture_id)` | `anon`, `authenticated` | marchés actifs publiés : code, libellé, prix, débloqué ou non ; contenu (sélection, probabilités, confiance, explication, résultat) **seulement** si débloqué ou match terminé avec `reveal_after_match = true` ; analyse globale aux mêmes conditions (match complet) ; prix du match complet |
| `admin_adjust_balance(user_id, amount, reason)` | `authenticated` (refus `FORBIDDEN` si non admin), `service_role` | motif obligatoire, solde jamais négatif, transaction `admin_adjustment`, ligne `admin_audit_log` |

Les helpers `private.setting`, `private.base_price`, `private.has_access` et `private.compute_price` sont dans le schéma `private`, non exposé par l'API.

`get_fixture_predictions` est volontairement exécutable par `anon` (le prompt de phase 7 demande qu'elle fonctionne pour un visiteur anonyme) : elle ne renvoie jamais de contenu verrouillé. Les alertes « SECURITY DEFINER exécutable » du conseiller Supabase sur ces fonctions sont donc attendues.

#### Recharges (phase 8)

| Fonction | Exécutable par | Rôle |
|---|---|---|
| `create_topup(pack_id, provider)` | `authenticated` | crée une recharge `pending` pour `auth.uid()` ; crédits, bonus et montant **lus dans `credit_packs`** ; refus : `MAINTENANCE`, `BANNED`, `NOT_AVAILABLE` (pack inactif), `INVALID_INPUT` (fournisseur inconnu), `TOO_MANY_PENDING` (10 en attente sur 1 h) |
| `apply_topup(topup_id, status)` | `service_role` uniquement | `FOR UPDATE` sur la recharge ; si elle n'est plus `pending` : rien ne change, renvoie l'état (idempotence, RG-F6-1) ; `succeeded` : `FOR UPDATE` du portefeuille, crédit `credits + bonus_credits`, transaction `topup` avec `balance_after`, `completed_at` ; `failed` / `cancelled` : clôture sans crédit |

`topups.provider_ref` est renseigné par le serveur (clé secrète) après `createCheckout()` ; l'utilisateur ne peut ni insérer ni modifier une recharge.

#### Résolution et suivi (phase 9)

| Fonction | Exécutable par | Rôle |
|---|---|---|
| `settle_outcome(market, selection, home, away)` | `service_role` | règles de résolution au temps réglementaire, miroir de `lib/settle/rules.ts` (table de cas partagée `tests/fixtures/settlement-cases.json`) ; `NULL` si sélection invalide |
| `settle_fixture(fixture_id)` | `service_role` | statut `FT`, `AET` ou `PEN` et `ft_home` / `ft_away` renseignés (RG-F7-1) ; met à jour `result` et `settled_at` des pronostics `pending` uniquement (idempotente, RG-F7-2) |
| `refund_fixture(fixture_id)` | `service_role` | `CANC`, `ABD`, ou `PST` reporté de plus de 48 h par rapport à `original_kickoff_at` (ou sans nouvelle date) : rembourse chaque déblocage non remboursé (transaction `refund`, `unlocks.refunded_at`) si `refund_on_cancel`, puis pronostics `pending` → `void`. Idempotente |
| `get_performance_stats()` | `anon`, `authenticated` | gagnés / perdus / annulés : global, 30 derniers jours, par marché, par compétition, sur **tous** les pronostics publiés (RG-F8-1) ; 20 derniers résolus si `reveal_after_match` |
| `get_my_predictions(limit)` | `authenticated` | pronostics débloqués par `auth.uid()` (match complet développé en ses marchés), statut, remboursement, score |

`get_fixture_predictions` renvoie aussi, une fois le pronostic résolu, son **résultat seul** (badge Gagné / Perdu / Annulé), sans sélection ni explication.

#### Administration (phase 10)

Toutes exécutables par `authenticated` seulement, avec contrôle `is_admin()` en tête (sinon `{ ok:false, code:'FORBIDDEN' }`) ; auteur = `auth.uid()` ; journal d'audit systématique (`private.audit`).

| Fonction | Rôle |
|---|---|
| `admin_log_action(action, entity, entity_id, before, after, reason)` | journal des actions faites par la RLS admin (compétitions, matchs, tarifs, packs, paramètres, marchés) |
| `admin_overview()` | chiffres de `/admin` (inscrits, crédits, chiffre d'affaires simulé, matchs < 48 h, à surveiller, quota) |
| `admin_list_users(search, status, sort, limit, offset)`, `admin_get_user(id)` | recherche par e-mail (`auth.users`) ou nom, solde, déblocages, recharges |
| `admin_set_user_banned(id, banned, reason)`, `admin_set_user_role(id, role, reason)` | motif obligatoire, jamais sur soi-même (`SELF`) |
| `admin_edit_prediction_text(id, reasoning, reason)` | explication seulement, ancienne version dans `prediction_revisions` |
| `admin_set_prediction_status(id, status, reason)` | masquer / réafficher un marché |
| `admin_settle_fixture(id)` | `settle_fixture` à la demande |
| `admin_refund_fixture(id, reason)` | remboursement manuel de tous les déblocages non remboursés, quel que soit le statut |
| `admin_consistency_check()` | portefeuilles dont le solde ≠ somme des transactions (RG-F6-4) |
| `admin_cron_status()` | tâches Supabase Cron et dernière exécution |
| `admin_ai_stats()` | générations, tokens, coût par jour / mois, échecs et réussite par version de prompt |

### Désigner un administrateur

Le rôle `admin` ne s'attribue jamais depuis l'application par l'utilisateur lui-même (RG-F1-3). Deux méthodes :

**1. Automatique (`ADMIN_EMAILS`)** — renseigner l'adresse dans la variable d'environnement `ADMIN_EMAILS` (liste séparée par des virgules) sur Vercel. À la prochaine connexion (ou au retour du lien de confirmation), le serveur passe le rôle de `user` à `admin` avec la clé secrète et écrit une ligne `promote_admin` dans `admin_audit_log` (`lib/auth/admin-promotion.ts`). Jamais de rétrogradation automatique.

**2. Manuelle (SQL)** — dans le *SQL Editor* de Supabase (le compte doit déjà exister) :

```sql
with target as (
  select id from auth.users where email = lower('adresse@exemple.com')
),
promoted as (
  update public.profiles p
     set role = 'admin'
    from target
   where p.id = target.id and p.role = 'user'
  returning p.id
)
insert into public.admin_audit_log (admin_id, action, entity, entity_id, before, after, reason)
select null, 'promote_admin', 'profiles', id::text, '{"role":"user"}', '{"role":"admin"}', 'Promotion manuelle (SQL Editor)'
from promoted;
```

Pour retirer le rôle : même requête avec `'user'` à la place de `'admin'` (et l'inverse dans `before`/`after`, action `demote_admin`). Un admin suspendu (`is_banned = true`) perd immédiatement l'accès à `/admin` : `is_admin()` exige un compte non suspendu.

## Tests de sécurité

`tests/security/` (Vitest) : deux utilisateurs de test, un match et un pronostic sont créés avec la clé secrète, puis **toutes les vérifications passent par la clé publique**. Les données de test sont supprimées à la fin.

```bash
npm run test:security
```

Variables requises (`.env.local`, projet de **dev** uniquement) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

En CI (GitHub Actions, `.github/workflows/ci.yml`), les mêmes valeurs viennent des secrets du dépôt : `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`.
