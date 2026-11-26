# Journal d'avancement

Tenu par Claude Code. Référence : [cahier-des-charges.md](cahier-des-charges.md), section 12.

## Tableau des phases

| Phase | Livrable | Critère de validation | Statut |
|---|---|---|---|
| 0. Préparation (porteur du projet) | Comptes et clés : GitHub, Vercel, Supabase, API-Football, OpenAI | Toutes les clés sont réunies et Claude Code accède à GitHub, Vercel et Supabase | En cours |
| 1. Initialisation | Projet Next.js, `CLAUDE.md`, dépôt GitHub, déploiement Vercel | L'URL Vercel affiche l'accueil provisoire | Validée |
| 2. Base de données | Les 20 tables, la RLS, les fonctions SQL, les données de départ | Les migrations passent ; les tests de sécurité SQL sont au vert | En validation |
| 3. Authentification | Inscription, connexion, mot de passe, profil, rôles | Un compte se crée avec profil et portefeuille ; les pages privées et admin sont protégées | En validation |
| 4. Synchronisation | Client API-Football, tâches `sync-*`, Supabase Cron, journal | Les matchs des 14 prochains jours apparaissent en base ; le quota est respecté | En cours (code prêt ; découverte et synchro réelle en attente des secrets) |
| 5. Catalogue | Compétitions, matchs à venir, fiche match gratuite | Navigation complète jusqu'à la fiche d'un match réel | En validation (en attente de données réelles, phase 4) |
| 6. Moteur IA | Dossiers, prompt v1, appel OpenAI, validation, stockage | Les matchs à moins de 48 h ont leurs 4 pronostics, cohérents et en français | En cours (code prêt ; génération réelle en attente des secrets et des données) |
| 7. Crédits et déblocage | Portefeuille, prix, déblocage par marché et par match | Les 5 tests obligatoires de la section 11 passent | En validation (SQL vérifié ; tests d'intégration en attente des secrets GitHub) |
| 8. Recharge simulée | Packs, fournisseur `mock`, page de résultat | Une recharge simulée crédite le compte une seule fois | En validation (SQL vérifié ; tests d'intégration en attente des secrets GitHub) |
| 9. Résolution et suivi | `settle-predictions`, remboursements, Mes pronostics, Performances | Un match terminé met à jour les statuts ; les taux affichés sont justes | En validation (SQL vérifié ; tests d'intégration en attente des secrets GitHub ; aucun match réel en base) |
| 10. Administration | Les 13 pages admin et le journal d'audit | Toutes les actions de la section 4 fonctionnent et sont journalisées | En validation (SQL vérifié ; à tester dans l'interface avec un compte admin) |
| 11. Recette | Tests automatisés, audit de sécurité, corrections | Le parcours complet est testé de bout en bout ; aucune faille connue | En validation (audit fait ; Playwright et tests d'intégration en attente des secrets GitHub) |
| 12. Mise en production | Projet Supabase prod, variables Vercel, forfait API-Football Pro, domaine | L'application tourne en production avec de vraies données | En cours (infrastructure prête ; en attente du forfait API-Football Pro) |

Statuts possibles : À faire · En cours · En validation · Validée.

---

## Phase 1 — Initialisation

**Date** : 17 novembre 2026 · **Branche** : `main` (exception accordée pour cette phase)

### Ce qui a été fait

- Cahier des charges converti du PDF en `docs/cahier-des-charges.md`.
- Application Next.js 16.4 (App Router, Turbopack, TypeScript strict, ESLint, Tailwind CSS 4, alias `@/*`).
- shadcn/ui initialisé (style `base-nova`, primitives Base UI) avec : button, input, label, card, dialog, alert-dialog, badge, table, tabs, select, dropdown-menu, sonner, skeleton, separator, field.
- Dépendances : `@supabase/supabase-js`, `@supabase/ssr`, `zod` 4, `openai`, `date-fns`, `date-fns-tz`, `server-only` ; en dev : `vitest`, `@vitest/coverage-v8`.
- Scripts npm : `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:coverage`.
- Arborescence de la section 9, avec un `README.md` dans chaque dossier de `lib/`.
- Trois clients Supabase : `lib/supabase/client.ts`, `server.ts`, `admin.ts` (`server-only`).
- `lib/env.ts` : validation Zod des variables, séparée client / serveur, message d'erreur listant toutes les variables manquantes ; 6 tests Vitest.
- `.env.example` (toutes les variables de la section 9, commentées), `.env.local` créé à partir de ce modèle (ignoré par Git).
- Accueil provisoire `app/(public)/page.tsx` + pages vides `/inscription` et `/connexion`.
- `CLAUDE.md` (règles du projet, procédure de fin de phase) et ce journal.

### Décisions prises

- **Validation des variables paresseuse** (au premier appel de `getClientEnv()` / `getServerEnv()`) : le build Vercel passe même avant que les variables soient renseignées. Une chaîne vide = variable absente.
- **Valeurs par défaut** : `API_FOOTBALL_DAILY_BUDGET=90`, `AI_DAILY_GENERATION_LIMIT=20`, `PAYMENT_PROVIDER=mock`, `DEFAULT_TIMEZONE=Africa/Porto-Novo`, `ADMIN_EMAILS` vide. `OPENAI_MODEL` est obligatoire (pas de modèle imposé dans le code). `CRON_SECRET` : 32 caractères minimum.
- **`DEFAULT_TIMEZONE`** n'a pas le préfixe `NEXT_PUBLIC_` (nom imposé par le cahier des charges) : elle est exposée au navigateur via `env` dans `next.config.ts`.
- `lib/utils.ts` (créé par shadcn) déplacé en `lib/utils/index.ts` pour respecter le dossier `lib/utils/` ; l'import `@/lib/utils` reste valable.
- `typecheck` lance `next typegen` avant `tsc` pour que les types de routes de Next 16 soient toujours à jour.
- Next 16 active **Cache Components** par défaut : conservé. À surveiller dès qu'on lira des données utilisateur (règle « jamais de cache serveur d'un contenu débloqué »).
- Environnement Claude Code : création d'un environnement cloud « pronostic » autorisant `ui.shadcn.com` (registre shadcn bloqué par défaut). Il faudra y ajouter `v3.football.api-sports.io` et `api.openai.com` pour tester les phases 4 et 6 depuis la session.
- Dépôt GitHub : le dépôt privé `merkisedeck221-prog/pronostic` existait déjà (vide) : il est réutilisé au lieu d'en créer un avec `gh`.

### Écarts avec le cahier des charges / le prompt

- Composant **`form`** : dans le style shadcn actuel (Base UI), `form` n'existe plus et est remplacé par **`field`** (`Field`, `FieldLabel`, `FieldError`…), compatible avec n'importe quelle librairie de formulaire. `field` a été installé à la place.
- La redirection d'un utilisateur connecté de `/` vers `/tableau-de-bord` sera faite en phase 3 (nécessite l'authentification).
- `.env.local` contient deux valeurs par défaut non sensibles (`DEFAULT_TIMEZONE`, `PAYMENT_PROVIDER=mock`) reprises de `.env.example` ; tout le reste est vide.

### Déploiement Vercel

- Projet Vercel `pronostic` (équipe MERKISEDECK, Hobby), relié à `merkisedeck221-prog/pronostic`, branche de production `main`, déploiement automatique à chaque push.
- Premier déploiement `dpl_419Kiqn14998cDZYLMeX7JFNvoad` (commit `88fdb36`) : **READY**, build en 28 s sans erreur.
- URL : https://pronostic-brown.vercel.app (alias : `pronostic-merkisedeck.vercel.app`, `pronostic-git-main-merkisedeck.vercel.app`).
- Vérifié : `/` affiche l'accueil provisoire (titre, 3 lignes, boutons, mention 18 ans), `/inscription` répond 200.
- La première création du projet par Claude Code a été refusée (403) ; le porteur du projet l'a importé, puis a élargi les droits de l'intégration Vercel.

### Dettes techniques

- `npm audit` signale des vulnérabilités « high » dans des dépendances **de développement** d'ESLint (`picomatch` via `eslint-config-next`). Aucun impact en production ; à revoir quand `eslint-config-next` publiera un correctif (ne pas lancer `npm audit fix --force`, qui rétrograde Next).
- Pas encore de types Supabase générés (`types/database.ts`) : à faire en phase 2 ; les clients Supabase seront alors typés avec `Database`.
- **Protection Vercel (SSO) active sur tous les déploiements sauf domaines personnalisés** : il faut être connecté à Vercel pour voir le site. À traiter avant la phase 4, sinon Supabase Cron ne pourra pas appeler `/api/cron/*` (options : domaine personnalisé, *Protection Bypass for Automation*, ou désactivation de la protection en production).
- `engines.node: ">=22"` : Vercel avertit d'une montée de version automatique ; le projet Vercel est réglé sur Node 26.x. À figer si une incompatibilité apparaît.
- Pas encore de `proxy.ts` (rafraîchissement de session Supabase) : phase 3.

### Prochaine phase

**Phase 2 — Base de données** : les 20 tables, la RLS, les fonctions SQL `SECURITY DEFINER`, `seed.sql`, et les tests de sécurité SQL. Prérequis : projet Supabase « dev » accessible.

---

## Phase 2 — Base de données

**Date** : 17 novembre 2026 · **Branche** : `phase-2-database` · **Projet Supabase** : `pronostics` (dev, réf. `pgeytactmugqskdzsxnw`)

### Ce qui a été fait

- 8 migrations SQL commentées dans `supabase/migrations/`, appliquées au projet de dev (noms de fichiers alignés sur les versions distantes) :
  types énumérés, 20 tables en 5 domaines, clés étrangères, `NOT NULL`, valeurs par défaut, `created_at`/`updated_at` + déclencheur générique, index de recherche, contraintes d'intégrité.
- Contraintes clés : `wallets.balance >= 0`, `unlocks UNIQUE NULLS NOT DISTINCT (user_id, fixture_id, market_code)`, `topups.provider_ref UNIQUE`, `predictions UNIQUE (fixture_id, market_code)`, probabilités 0-100 (y compris le JSON 1N2), signe du montant cohérent avec le type de transaction, bonus de bienvenue unique par compte.
- `is_admin()` (`SECURITY DEFINER`, `STABLE`) ; déclencheur de protection de `role`, `is_banned`, `terms_accepted_at`.
- RLS activée sur les 20 tables avec les politiques de la section 10 ; privilèges d'écriture retirés à `anon` et, sur les tables sensibles, à `authenticated` (défense en profondeur).
- Déclencheur `handle_new_user` : profil (nom, pays, téléphone, date CGU depuis les métadonnées), portefeuille à 0, bonus de bienvenue si `welcome_credits > 0`.
- `supabase/seed.sql` idempotent, appliqué : 4 marchés, 5 règles de prix, 3 packs, 6 paramètres.
- `types/database.ts` généré ; script `npm run db:types` (CLI Supabase en dépendance de dev) ; clients Supabase typés.
- Tests d'intégration `tests/security/rls.test.ts` (22 tests) + script `npm run test:security`.
- Workflow GitHub Actions `.github/workflows/ci.yml` : lint, typecheck, tests, build, puis tests de sécurité.
- `docs/database.md` : schéma, relations, politiques par table, commandes.

### Vérifications effectuées

- Simulation SQL (transaction annulée) avec deux utilisateurs, un anonyme et un admin : isolation des profils, portefeuilles et transactions ; écritures directes refusées (`42501`) ; auto-promotion admin refusée ; 0 pronostic visible pour un utilisateur ou un anonyme alors qu'une ligne existe ; lecture publique des marchés, packs, tarifs et paramètres ; un admin ne peut ni se rétrograder lui-même ni modifier un solde directement.
- Bonus de bienvenue testé avec `welcome_credits = 5` (transaction annulée) : solde 5, transaction `bonus` avec `balance_after = 5`.
- Seed relancé : aucun doublon, valeurs existantes conservées.
- Conseiller de sécurité Supabase : seule alerte, `is_admin()` exécutable par `anon`/`authenticated` (voulu, nécessaire à la RLS) et `rls_auto_enable()` (fonction fournie par Supabase).

### Décisions prises

- Identifiants `bigint` (identity) pour les données, `uuid` pour les utilisateurs et les recharges.
- `fixtures.is_published` vaut `true` par défaut (la synchronisation publie, l'admin peut masquer) ; `competitions.is_active` vaut `false` par défaut.
- `run_status` comprend aussi `running` et `partial` (lot terminé avec des erreurs partielles).
- `app_settings.is_public` ajouté pour distinguer les clés lisibles par tous.
- `terms_accepted_at` protégé comme `role` et `is_banned` (preuve d'acceptation des CGU).
- Un admin ne peut pas modifier son propre rôle ni sa propre suspension.
- Seed en `ON CONFLICT DO NOTHING` : il ne réécrase jamais une valeur modifiée depuis l'admin.

### Écarts avec le cahier des charges

- Les fonctions SQL de crédits et de pronostics de la section 10 (`get_unlock_price`, `unlock_prediction`, `get_fixture_predictions`, `apply_topup`, `admin_adjust_balance`, `refund_fixture`, `settle_fixture`) ne sont **pas** dans cette phase : le prompt de phase 2 ne demandait que `is_admin()` et `handle_new_user()`. Elles viendront en phases 7 à 9.
- `terms_accepted_at` est nullable en base : l'obligation (RG-F1-1) sera imposée par le formulaire d'inscription en phase 3 (un compte créé depuis le tableau de bord Supabase n'a pas de date).
- Aucune politique ne bloque encore un compte suspendu (RG-F1-2) côté données : à traiter en phase 3 (pages) et 7 (fonctions de déblocage).

### Dettes techniques / points ouverts

- **Tests de sécurité non exécutés depuis Claude Code** : la clé secrète Supabase ne peut pas être transmise à la session sans risque. Ils s'exécutent dans GitHub Actions dès que les 3 secrets du dépôt sont ajoutés (voir résumé de phase). Les mêmes règles ont été vérifiées en SQL.
- Protection Vercel (SSO) à régler avant la phase 4 (cron).
- `npm audit` : vulnérabilités dans des dépendances de développement (ESLint, CLI Supabase).

### Prochaine phase

**Phase 3 — Authentification** : inscription (avec date CGU obligatoire), connexion, mot de passe oublié, profil, promotion `ADMIN_EMAILS`, `proxy.ts` (session), protection des pages privées et admin, blocage des comptes suspendus.

---

## Phase 3 — Authentification

**Date** : 17 novembre 2026 · **Branche** : `phase-3-auth` (créée depuis `phase-2-database`, dont elle dépend)

### Ce qui a été fait

- **Proxy** (`proxy.ts`, nom Next 16 du middleware) : rafraîchissement de la session Supabase à chaque requête (`@supabase/ssr`, `getClaims()`), en-tête `x-pathname` pour le paramètre `next` (valeur du client toujours écrasée).
- **Trois mises en page** :
  - `app/(public)` : en-tête simple et pied de page avec la mention obligatoire ;
  - `app/(app)` : session exigée (sinon `307 /connexion?next=…`), compte suspendu bloqué avec message, en-tête avec navigation, solde (`wallets`) et menu utilisateur (Profil, Administration si admin, Déconnexion) ;
  - `app/admin` : `is_admin()` vérifié côté serveur, sinon **404** (visiteur, utilisateur, admin suspendu).
- **Pages** : `/inscription` (avec écran « Vérifiez votre boîte mail »), `/connexion` (retour vers `next`), `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/auth/callback` (flux PKCE `?code=` et `?token_hash=&type=`), `/profil` (nom, pays, téléphone, fuseau ; mot de passe ; déconnexion), `/tableau-de-bord` minimal, `/cgu` et `/jeu-responsable` (textes provisoires section 11), `/admin` minimal. L'accueil redirige un utilisateur connecté vers `/tableau-de-bord`.
- Pages provisoires « Bientôt disponible » pour `/matchs`, `/competitions`, `/mes-pronostics`, `/portefeuille`, `/recharger` (cibles de la navigation).
- **Formulaires** : schémas Zod partagés (`lib/auth/schemas.ts`) validés dans le navigateur et dans les Server Actions (`lib/auth/actions.ts`) ; erreurs Supabase traduites en français (`lib/auth/errors.ts`) sans révéler si un e-mail a un compte.
- **Promotion `ADMIN_EMAILS`** (`lib/auth/admin-promotion.ts`) : au callback et à chaque connexion, rôle `user` → `admin` avec la clé secrète, journalisé dans `admin_audit_log` ; ne bloque jamais la connexion.
- **Utilitaires** `lib/auth/session.ts` : `getCurrentUser()`, `requireUser()`, `requireAdmin()` (profil typé).
- **Tests** : unitaires (schémas Zod, `safeNextPath`, promotion admin simulée, formatage, env) — 35 au total ; intégration `tests/security/admin-access.test.ts` (application démarrée + vraie session Supabase : 404 sur `/admin` pour un utilisateur, 200 pour un admin, 404 pour un admin suspendu, message pour un compte suspendu, redirections).
- `docs/database.md` : promotion admin automatique et commande SQL manuelle (avec journal d'audit).

### Vérifications effectuées (localement, Supabase volontairement injoignable)

- Codes HTTP : `/tableau-de-bord`, `/profil`, `/matchs` → `307 /connexion?next=…` (encodé) ; `/admin` → `404` ; callback invalide → `307 /connexion?erreur=lien-invalide` ; en-tête `x-pathname` falsifié ignoré ; `?next=https://…` neutralisé.
- Navigateur (Playwright, 390 px) : erreurs Zod en français sous chaque champ, Bénin par défaut, case CGU obligatoire, message d'erreur serveur affiché, e-mail conservé et mot de passe vidé après une erreur.

### Décisions prises

- **Cache Components désactivé** (`next.config.ts`) : avec lui, toute lecture de session doit être en streaming derrière `<Suspense>`, et un `notFound()`/`redirect()` arrivé après le début du flux ne change plus le code HTTP (un non-admin recevrait 200 au lieu de 404). Désactivé, les contrôles bloquent le rendu, donnent de vrais 307/404, et rien d'utilisateur n'est mis en cache côté serveur (règle n° 8).
- `getCurrentUser()` appelle `connection()` : les pages dépendant de la session ne sont jamais pré-rendues au build (constaté sur un build sans variables).
- `getServerEnvKeys([...])` : validation des seules variables nécessaires (la promotion admin ne dépend plus des clés OpenAI/API-Football).
- `NEXT_PUBLIC_APP_URL` devient **facultative** : l'origine des liens d'e-mail est lue sur la requête (fonctionne sur chaque URL de prévisualisation).
- Callback d'authentification à `/auth/callback` (route technique, pas une page).
- Liste de pays : Afrique francophone + diaspora fréquente (codes ISO, libellés via `Intl`), Bénin par défaut ; fuseaux : liste courte, `Africa/Porto-Novo` par défaut.
- Correction d'un bug hérité de shadcn : la police Geist n'était pas appliquée (variable `--font-sans` circulaire).

### Écarts avec le cahier des charges / le prompt

- « Middleware » → `proxy.ts` (renommage imposé par Next 16, même rôle).
- Le changement de mot de passe depuis le profil ne redemande pas l'ancien (Supabase ne l'exige pas par défaut) ; option « Secure password change » activable dans Supabase si souhaité.
- Le tableau de bord minimal renvoie vers des pages provisoires (construites en phases 5 à 9).

### Dettes techniques / points ouverts

- **E-mails Supabase** : le service d'envoi par défaut de Supabase est **fortement limité** (quelques e-mails par heure, destiné aux tests). Un **SMTP personnalisé** (Resend, Brevo, Postmark, SES…) sera nécessaire en production — **phase 12**. Les modèles d'e-mails (confirmation, réinitialisation) devront aussi être traduits en français.
- **Configuration Supabase Auth à faire par le porteur du projet** : *Site URL* et *Redirect URLs* (voir le résumé de phase).
- **Variables Vercel** : celles créées par l'intégration Supabase ne ciblent que *Production* ; à étendre à *Preview* pour tester les branches.
- Tests d'intégration HTTP exécutés en CI seulement (clé secrète requise) ; secrets GitHub encore à ajouter.
- Pas encore de limitation de débit propre à l'application (on s'appuie sur celle de Supabase Auth).

### Prochaine phase

**Phase 4 — Synchronisation** : client API-Football, tâches `sync-*`, Supabase Cron, journal `sync_runs`. Prérequis : clé API-Football, `CRON_SECRET`, et réglage de la protection Vercel pour `/api/cron/*`.

---

## Phase 4 — Synchronisation

**Date** : 17 novembre 2026 · **Branche** : `phase-4-sync` (créée depuis `phase-3-auth`)

### Ce qui a été fait

- **Client API-Football** (`lib/api-football/`, serveur uniquement) : appel générique typé (Zod), `x-apisports-key`, `timezone=UTC`, délai de 15 s, 2 nouvelles tentatives (1 s, 2 s) sur erreur réseau/429/5xx, lecture du quota (en-têtes) et du champ `errors` (réponse 200 en erreur = échec sans nouvelle tentative), **garde-fou budgétaire** avant chaque requête (somme de `sync_runs.api_calls` du jour UTC ≥ `API_FOOTBALL_DAILY_BUDGET` → refus sans appel).
- Schémas Zod `/leagues`, `/teams`, `/fixtures`, `/standings`, `/status` et convertisseurs purs vers nos tables (`convert.ts`).
- **Tâches** (`lib/sync/`) : `syncCompetitions`, `syncFixtures`, `syncStandings`, `syncResults` ; exécuteur commun qui journalise dans `sync_runs` (début, fin, statut `success`/`partial`/`failed`, appels — mis à jour après chaque appel —, éléments, quota, erreurs) et coupe avant la limite de temps.
- **Route** `app/api/cron/[job]/route.ts` : GET/POST, `Authorization: Bearer CRON_SECRET` comparé en temps constant (SHA-256 + `timingSafeEqual`), 401 sinon, 404 tâche inconnue, résumé JSON, `maxDuration = 60`.
- **Migrations** : colonne `competitions.coverage` ; `pg_cron` + `pg_net`, fonction `private.invoke_sync_job()` qui lit `app_url`, `cron_secret` (et `vercel_bypass_secret`) dans **Vault**, 4 tâches planifiées. Appliquées au projet dev (tâches actives mais inertes tant que Vault est vide).
- **Action admin** `runSyncJobAction(job)` (`requireAdmin()`, journal d'audit) pour la phase 10.
- **Scripts** : `npm run discover:leagues` (écrit `docs/leagues.md` / `docs/leagues.json`, rien en base de données métier) et `npm run sync -- <tâches>`.
- **Workflow GitHub** « API-Football (lancement manuel) » : exécute ces scripts avec les secrets du dépôt et enregistre les réponses brutes en artefact.
- **Tests** : 56 tests unitaires (convertisseurs, garde-fou budgétaire, nouvelles tentatives, erreurs dans un 200, authentification cron) sur des réponses enregistrées.
- `docs/sync.md` : fonctionnement, commandes Vault, requêtes de vérification, protection Vercel.

### Vérifications effectuées

- Route en local : 401 sans en-tête / mauvais secret / secret sans « Bearer », 404 tâche inconnue, 405 autre méthode, erreur propre si Supabase indisponible.
- Supabase dev : migrations appliquées, `cron.job` contient les 4 tâches aux bonnes fréquences.

### Décisions prises

- `competitions.coverage` (jsonb) ajoutée : décide de `sync-standings` (type `league` ou couverture classement) et servira à la phase 6 (`predictions`, `injuries`).
- `is_published` n'est jamais envoyé par la synchronisation (choix de l'admin préservé) ; `original_kickoff_at` = premier coup d'envoi connu (détection des reports > 48 h, RG-F5-7).
- `ft_home/ft_away` = `score.fulltime` d'API-Football (score à 90 min + temps additionnel, RG-F4-1).
- Protection Vercel : en-tête `x-vercel-protection-bypass` optionnel envoyé par pg_net (secret Vault).
- Exécutions manuelles via GitHub Actions (déclencheur par fichier `.github/api-football-request` sur les branches `phase-*`, car `workflow_dispatch` n'apparaît que sur `main`).

### Écarts / points bloqués

- **Clé API-Football non fournie à la session** : le script de découverte, l'insertion des compétitions et la synchronisation réelle (étapes 2, 3 et 9 du prompt) **n'ont pas encore été exécutés**. Ils le seront via GitHub Actions dès que les secrets seront ajoutés.
- Réponses de test **construites d'après la documentation** (valeurs fictives) ; à remplacer par les réponses réelles de l'artefact du workflow.

### Dettes techniques

- Les tâches build-contexts, generate-predictions, settle-predictions arrivent en phases 6 et 9.
- Pas encore de purge de `sync_runs` / `net._http_response` (à prévoir).
- `npm audit` : dépendances de développement (inchangé).

### Prochaine phase

**Phase 5 — Catalogue** : compétitions, matchs à venir, fiche match gratuite.

---

## Phase 5 — Catalogue

**Date** : 17 novembre 2026 · **Branche** : `phase-5-catalog` (créée depuis `phase-4-sync`)

### Ce qui a été fait

- `lib/utils/dates.ts` : fuseau de l'utilisateur (`profiles.timezone`, sinon `DEFAULT_TIMEZONE`, sinon Africa/Porto-Novo), formats français (« sam. 22 nov. à 16:00 »), « Aujourd'hui / Demain / Hier » sur le calendrier de l'utilisateur, périodes de `/matchs`, regroupement par jour.
- `lib/utils/match-status.ts` : libellés français des statuts API-Football et catégorie (à venir, en cours, terminé, annulé ou reporté).
- Migration `catalog_functions` : `is_fixture_visible`, `fixtures_with_prediction_flag` (booléen seulement), `get_fixture_public_context` (forme, classement, confrontations ; dossier lu par liste blanche), index (équipe, date) pour la forme et les confrontations.
- `lib/catalog/` : requêtes en lecture seule avec le client utilisateur (RLS), jointures PostgREST (compétition + équipes en une requête), un seul appel pour toutes les pastilles, limites (60 matchs à venir, 10 résultats, 300 matchs par période, 500 pastilles).
- Pages : `/competitions` (Championnats / International, nombre de matchs sur 7 jours), `/competitions/[slug]` (onglets Matchs à venir groupés par date, Classement si disponible, 10 derniers Résultats), `/matchs` (`?periode=aujourdhui|demain|7-jours`, `?competition=<slug>`, groupé par compétition puis par heure, pastille « Pronostic disponible »), `/matchs/[id]` (en-tête, score final et mi-temps après le match, Forme V/N/D, Classement, Confrontations directes, emplacement « Pronostics IA », mention légale). Squelettes de chargement, états vides explicites, métadonnées françaises.
- **404** : match non publié, de compétition inactive, inexistant ou identifiant invalide ; compétition inactive ou inexistante.
- Tests : 83 tests unitaires (dont dates avec changements de jour et heure d'été, statuts) ; intégration `tests/security/catalog.test.ts` (aucune clé de pronostic dans le contexte public, `null` pour un match invisible, pastille booléenne, pages 200/404).

### Vérifications effectuées

- SQL (transaction annulée) : forme calculée correctement (V/N/D, prolongations prises en compte, matchs non terminés ignorés), confrontations complétées par le dossier sans champ superflu, **aucune fuite** (`provider_prediction`, `advice`, sélection, probabilités, explication), `null` pour un match caché ou d'une compétition inactive, pastille limitée aux matchs visibles.
- Expérience Next.js : `notFound()` dans une **mise en page** donne un vrai **404** même avec `loading.tsx`, alors que dans la page (sous le squelette) il donne **200**. D'où les mises en page `competitions/[slug]/layout.tsx` et `matchs/[id]/layout.tsx` qui vérifient l'existence avant le squelette (requête mise en cache pour la requête en cours).
- Sans session : toutes les pages du catalogue redirigent vers `/connexion?next=…` (307).

### Décisions prises

- Les fonctions du catalogue sont `SECURITY DEFINER` et exécutables par `anon` (alerte Supabase acceptée, données déjà publiques + booléen).
- Forme : matchs terminés en base d'abord (toutes compétitions), sinon la forme du classement ou du dossier (`last5`).
- Logos API-Football affichés via `next/image` **non optimisé** (pas de consommation du quota d'images Vercel Hobby).
- Filtre de compétition par formulaire GET (fonctionne sans JavaScript).
- Les anciens index simples `fixtures_home_team_id_idx` / `fixtures_away_team_id_idx` sont conservés (suppression refusée lors de l'application).

### Écarts / limites

- **Aucune donnée réelle en base** tant que la découverte et la synchronisation (phase 4) n'ont pas tourné : les pages affichent leurs états vides. La navigation jusqu'à la fiche d'un match réel (critère de validation) reste à vérifier après la synchronisation.
- Tests d'intégration exécutés en CI seulement (secrets GitHub requis).
- Le score affiché après un match est le score final (prolongations comprises) ; le statut précise « après prolongations » ou « aux tirs au but ». Le score des tirs au but n'est pas stocké.

### Prochaine phase

**Phase 6 — Moteur IA** : dossiers de match (`build-contexts`), prompt v1, appel OpenAI, validation Zod, stockage.

---

## Phase 6 — Moteur IA

**Date** : 17 novembre 2026 · **Branche** : `phase-6-ai` (créée depuis `phase-5-catalog`)

### Ce qui a été fait

- **Dossier de match** (`lib/ai/context/`) : `buildMatchContext()` appelle `/predictions` et `/injuries` via le client API-Football (garde-fou budgétaire ; appel sauté si la compétition ne le couvre pas), lit classement, derniers résultats et confrontations en base, enregistre `match_contexts.raw` et `summary` au format de la section 8 (dont `data_quality`). Résumeur pur testé sur un match de championnat et un amical international.
- **Prompt v1** (`lib/ai/prompts/v1.ts`, `PROMPT_VERSION = 'v1'`) : analyste rigoureux, données du dossier uniquement, rien d'inventé, terrain neutre, amicaux moins fiables, prédiction d'API-Football = simple indice, aucun « sûr / garanti / certain », règles de cohérence entre marchés rappelées.
- **Schéma de sortie** (`lib/ai/schema.ts`) : Zod = source unique ; JSON Schema strict dérivé (`z.toJSONSchema` + toutes propriétés obligatoires, `additionalProperties: false`, mots-clés non garantis retirés et revérifiés par Zod).
- **Appel OpenAI** (`lib/ai/generate.ts`, SDK officiel) : `OPENAI_MODEL`, température 0,3 (omise pour les modèles de raisonnement qui la refusent), `response_format` strict, 60 s max, tokens et coût estimé (`lib/ai/pricing.ts`, tarifs configurables).
- **Validation** (`lib/ai/validate.ts`) : entiers 0-100, 1N2 à 100 ±1 puis normalisé, sélection 1N2 = issue la plus probable, score exact cohérent avec OVER/UNDER, BTTS et 1N2, sélections binaires ≥ 50 %, `high` interdit (amical ou historique mince), mots interdits. Un seul nouvel essai avec les erreurs, sinon statut `failed`.
- **Enregistrement** : migration `ai_generation` — fonction SQL `save_ai_generation()` (une transaction, `service_role` uniquement) : une ligne par marché **actif** (libellé français clair, `published`, `pending`, version, `prompt_version`), `prediction_analyses`, `ai_generation_runs` ; mode `initial` refusé si des pronostics existent ; mode `regenerate` refusé s'il existe un déblocage ou un pronostic figé, archive dans `prediction_revisions`, version + 1.
- **Tâches** `build-contexts` et `generate-predictions` (route cron + Supabase Cron toutes les heures, :11 et :31), lots de 5, limite `AI_DAILY_GENERATION_LIMIT`, pas plus de 2 échecs par match et par jour.
- **Régénération admin** `regeneratePredictions(fixtureId)` (`lib/ai/actions.ts`, `requireAdmin()`, journal d'audit).
- **Script** `npm run ai:sample` et tâches `build-contexts`, `generate-predictions`, `ai-sample` dans le workflow GitHub.
- **Tests** : 120 tests unitaires (dont 37 pour le moteur IA : résumeur, validation valide/invalide, JSON Schema strict, libellés, coût, appel OpenAI simulé avec nouvel essai et abandon).
- `docs/ai.md`.

### Vérifications effectuées

- SQL (transaction annulée) : `save_ai_generation` enregistre 3 marchés et ignore un marché désactivé (noté dans le run), refuse un 2e enregistrement initial, régénère avec archivage (3 révisions) et version 2, refuse la régénération dès qu'un déblocage existe, refuse l'appel par un utilisateur connecté (42501).
- Supabase Cron : 6 tâches planifiées (dont `build-contexts` et `generate-predictions`).

### Décisions prises

- Enregistrement dans une fonction SQL (vraie transaction, impossible avec des appels REST successifs).
- Dossier : `home_record` pour l'équipe qui reçoit, `away_record` pour celle qui se déplace ; `is_neutral_venue` déduit (phase finale d'un tournoi de sélections).
- Validation renforcée au-delà de la section 8 : score exact aussi cohérent avec le 1N2, sélections binaires ≥ 50 %.
- Délai OpenAI réduit dynamiquement pour rester sous `maxDuration` (60 s) de la route cron ; les lots de 5 sont un maximum par exécution.
- Pas de modèle OpenAI imposé dans le code ni le workflow : `OPENAI_MODEL` obligatoire.

### Écarts / points bloqués

- **Génération réelle sur 3 matchs (étape 9) non exécutée** : pas de clé OpenAI ni API-Football dans la session, et aucune donnée de match en base tant que la synchronisation (phase 4) n'a pas tourné. Prête via le workflow (tâche `ai-sample`) dès que les secrets sont ajoutés. Le prompt v1 n'a donc pas encore été confronté à de vraies réponses.
- Réponses `/predictions` et `/injuries` de test construites d'après la documentation (à remplacer par les réponses réelles de l'artefact).
- Tarifs OpenAI indicatifs (à vérifier).

### Dettes techniques

- `regeneratePredictions` peut dépasser la durée par défaut d'une Server Action sur Vercel : à appeler depuis une page avec `maxDuration` suffisant (phase 10).
- Pas encore de purge des anciens `match_contexts.raw` (volumineux).

### Prochaine phase

**Phase 7 — Crédits et déblocage** : portefeuille, prix (`get_unlock_price`), `unlock_prediction`, `get_fixture_predictions`, affichage des pronostics sur la fiche match, les 5 tests obligatoires de la section 11.

---

## Phase 7 — Crédits et déblocage

Branche `phase-7-credits`.

### Ce qui a été fait

- **Migration `credits_unlock`** (`20261117223746`) : `get_unlock_price`, `unlock_prediction`, `get_fixture_predictions`, `admin_adjust_balance` ; helpers dans le schéma `private` ; toutes en `SECURITY DEFINER`, `search_path = ''`, `auth.uid()` ; `EXECUTE` retiré à `public`/`anon`, accordé à `authenticated` (+ `service_role` pour le prix et l'ajustement) ; exception : `get_fixture_predictions` exécutable par `anon` (demandé). Index `unlocks (user_id, fixture_id)`.
- **`lib/credits/`** : schémas Zod, traduction des codes en français, lectures (`getFixturePredictions`, `getUnlockPrice`, `getWalletBalance`, `listTransactions`), Server Actions `unlockPredictionAction` et `adminAdjustBalanceAction` (cette dernière sera branchée à l'admin en phase 10).
- **Fiche match** : bloc « Pronostics IA » (`components/predictions/`) — carte verrouillée (cadenas, nom, prix, « Débloquer ») ou débloquée (sélection, barre de probabilité, trois barres pour le 1N2, badge de confiance Faible/Moyen/Élevé, explication, résultat si réglé) ; « Débloquer le match complet » avec prix effectif (prix barré expliqué si déduction) ; fenêtre de confirmation (prix, solde actuel, solde après) ; « Recharger » vers `/recharger?next=/matchs/[id]` si solde insuffisant ; bouton désactivé pendant le traitement ; message de succès ; `router.refresh()` met à jour cartes, analyse et solde de l'en-tête ; analyse globale (résumé + facteurs clés) quand accessible ; après le coup d'envoi, plus de bouton et « Les déblocages sont fermés pour ce match ». Rendu dynamique, rien en cache.
- **`/portefeuille`** : solde, « Recharger », historique paginé (20 par page), date locale, type en français, libellé, montant coloré +/−, solde après.
- **Tests** : 14 tests unitaires (`lib/credits/credits.test.ts`, total 134) ; 10 tests d'intégration `tests/credits/unlock.test.ts` (`npm run test:credits`, ajoutés au job CI « Tests de sécurité »).

### Vérifications effectuées (base DEV, transaction annulée via SQL)

| # | Scénario | Résultat |
|---|---|---|
| 1 | Déblocage normal (1N2, 10 crédits) | `ok`, solde 8, transaction `unlock` −2 / `balance_after` 8 / référence `fixture`, libellé « Déblocage : Arsenal T – Chelsea T, Résultat du match (1N2) », unlock créé, `is_locked = true` ; 2e appel → `ALREADY_UNLOCKED` |
| 2 | 5 appels simultanés | **non reproductible via SQL** (une seule connexion) : garanti par `FOR UPDATE` + vérification après verrou + contrainte d'unicité ; test d'intégration prêt (CI) |
| 3 | Solde insuffisant (0 crédit, score exact à 3) | `INSUFFICIENT_BALANCE`, solde 0 inchangé, aucune transaction |
| 4 | Match commencé | `MATCH_STARTED` |
| 5 | Match complet après le 1N2 | prix 5 (7 − 2), déduction 2 ; débit 5, solde 3 ; BTTS ensuite → `ALREADY_UNLOCKED` ; tout le contenu et l'analyse visibles |
| 6 | `get_fixture_predictions` sans déblocage | utilisateur et anonyme : 4 marchés, prix, aucun champ de contenu, analyse `null`, aucun texte secret |
| 7 | Lecture directe `predictions` / `prediction_analyses` | 0 ligne (anonyme et utilisateur) |
| 8 | `admin_adjust_balance` par un non-admin | `FORBIDDEN` ; anonyme : `permission denied` sur `unlock_prediction` |

### Décisions prises

- Erreurs métier en JSON (pas d'exception) pour que la Server Action affiche un message précis ; seule la course sur la contrainte d'unicité lève une exception (annulation du débit).
- Un match complet entièrement déduit (prix 0) crée un accès sans transaction (montant 0 interdit par la contrainte).
- Matchs reportés/annulés : `NOT_AVAILABLE` ; en cours : `MATCH_STARTED`.
- Un marché acheté reste visible par l'acheteur même si le marché est ensuite désactivé.
- `admin_adjust_balance` accepte aussi `service_role` (préparation des tests, tâches serveur).

### Écarts / points ouverts

- **Tests d'intégration non exécutés dans cette session** : pas de clé `service_role` disponible ici. Ils tournent dans le job CI dès que les secrets `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY` sont ajoutés au dépôt.
- La fiche match reste réservée aux utilisateurs connectés (phase 5) ; la fonction fonctionne déjà pour les visiteurs.
- `/recharger` est encore un écran « bientôt » (phase 8).

### Dettes techniques

- `rls_auto_enable()` (fournie par Supabase) apparaît exécutable par `anon` dans le conseiller : à examiner en recette.

### Prochaine phase

**Phase 8 — Recharge simulée** : packs, `PaymentProvider` `mock`, `apply_topup`, page de résultat.

---

## Phase 8 — Recharge

Branche `phase-8-topup` (partie de `phase-7-credits`).

### Ce qui a été fait

- **Migration `topups`** (`20261118052343`) : `create_topup(pack_id, provider)` (utilisateur ; `auth.uid()`, maintenance, compte suspendu, pack actif, montants lus en base, 10 recharges en attente max par heure) et `apply_topup(topup_id, status)` (`service_role` uniquement ; verrous recharge puis portefeuille ; idempotente ; `succeeded`, `failed`, `cancelled`).
- **`lib/payments/`** : interface `PaymentProvider` (`createCheckout`, `handleWebhook`, `getStatus` facultatif), registre selon `PAYMENT_PROVIDER` (`mock`, `fedapay`, `kkiapay` ; seuls les vrais fournisseurs ne sont pas implémentés), règle RG-F6-3, fournisseur `mock` (notifications HMAC-SHA256 horodatées, 5 min de tolérance), traitement commun des webhooks, `README.md` (ajout de FedaPay / KkiaPay).
- **Pages** : `/recharger` (packs actifs, bonus mis en avant, prix « 2 500 FCFA », solde, `next` conservé, message de maintenance), `/recharger/paiement-simule/[topupId]` (pack, montant, « Simuler un paiement réussi », « Simuler un échec », « Annuler »), `/recharger/resultat?topup=…&next=…` (succès / échec / annulé / en attente avec rafraîchissement toutes les 3 s pendant 30 s, nouveau solde, retour vers `next`), route `POST /api/payments/webhook/[provider]`. Bandeau « Paiement de test » sur les trois pages quand le mock sert.
- `formatXof` : « 2 500 FCFA » (au lieu de « F CFA »). Nouvelle variable facultative `PAYMENT_MOCK_SECRET`.
- **Tests** : 10 tests unitaires (`lib/payments/payments.test.ts` : signature valide / invalide / absente / expirée, secret, règle RG-F6-3, entrée de la recharge) — total 144 ; 6 tests d'intégration `tests/payments/topup.test.ts` (`npm run test:payments`, ajoutés au job CI).

### Vérifications effectuées

SQL sur la base DEV (transaction annulée) :

| Scénario | Résultat |
|---|---|
| `create_topup` (pack Standard) | `pending`, 25 crédits, 3 bonus, 2 500 XOF lus en base |
| `apply_topup(succeeded)` | solde 0 → 28, transaction `topup` +28 / `balance_after` 28, « Recharge : pack Standard (25 crédits + 3 bonus) », `completed_at` |
| Même appel une 2e fois | `already_processed: true`, aucun nouveau crédit ; `failed` ensuite ignoré |
| `apply_topup(failed)` puis `succeeded` | statut `failed`, aucun crédit, le succès tardif est ignoré |
| `apply_topup` par un utilisateur / `create_topup` par un anonyme | `permission denied` |
| Insertion / modification directe de `topups` par l'utilisateur | `permission denied` |
| Mode maintenance | `create_topup` → `MAINTENANCE` |
| Fournisseur inconnu / pack inexistant | `INVALID_INPUT` / `NOT_AVAILABLE` |

Route locale (`next start`) : notification non signée ou mal signée → 401 ; fournisseur inconnu ou non configuré (`paypal`, `fedapay`) → 404 ; `GET` → 405 ; pages de recharge sans session → 307 vers `/connexion?next=…`.

### Décisions prises

- `create_topup` en SQL (session utilisateur) plutôt qu'une insertion avec la clé secrète : montants lus en base, contrôles au même endroit que les autres règles.
- `provider_ref` renseigné ensuite par le serveur avec la clé secrète (l'utilisateur ne doit pas pouvoir choisir la référence qui sera créditée).
- Les boutons du mock passent par une Server Action qui calcule la signature côté serveur et appelle **le même traitement** que la route webhook (sans requête réseau : la protection des déploiements Vercel bloquerait un appel HTTP vers soi-même). La route reste appelable de l'extérieur avec une signature valide.
- Un seul mouvement `topup` par recharge (crédits + bonus), libellé détaillé.
- « Production » = `VERCEL_ENV=production` ; hors production, le mock reste disponible même si un vrai fournisseur est configuré (tests).

### Écarts / points ouverts

- Libellés des boutons du mock : ceux du prompt (« Simuler un paiement réussi », « Simuler un échec », « Annuler ») plutôt que « Payer / Échec / Annuler » du cahier des charges (même fonction).
- **Tests d'intégration non exécutés dans cette session** (pas de clé `service_role`) : ils tournent en CI avec les secrets `SUPABASE_DEV_*`.
- La prévisualisation Vercel n'a toujours pas les variables `SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET` / `PAYMENT_MOCK_SECRET` en environnement Preview : sans elles, la recharge échoue (« Impossible de créer la recharge ») à l'étape `provider_ref`.

### Dettes techniques

- Pas de purge des recharges `pending` abandonnées (à faire avec l'admin, phase 10).
- Contrôle de cohérence solde = somme des transactions (RG-F6-4) : page admin, phase 10.

### Prochaine phase

**Phase 9 — Résolution et suivi** : `settle-predictions`, `refund_fixture`, Mes pronostics, Performances.

---

## Phase 9 — Résolution et suivi

Branche `phase-9-settlement` (partie de `phase-8-topup`).

### Ce qui a été fait

- **Règles pures** `lib/settle/rules.ts` : une fonction par marché (`MATCH_RESULT`, `EXACT_SCORE`, `OVER_UNDER_2_5`, `BTTS`) → `won` / `lost`, sur le score au temps réglementaire (`ft_home`, `ft_away`) ; `regulationScore()` (RG-F7-1), `successRate()` (RG-F8-1). **Couverture 100 %** (lignes, branches, fonctions). Table de cas partagée `tests/fixtures/settlement-cases.json` (37 cas : 0-0, 1-1, 2-1, 3-0, 1-2 et match AET).
- **Migration `settlement`** (`20261118053930`) : `settle_outcome` (miroir SQL), `settle_fixture`, `refund_fixture` (`service_role` uniquement, idempotentes), `get_performance_stats` (public), `get_my_predictions` (utilisateur), `get_fixture_predictions` complété (résultat seul après résolution), index des pronostics en attente, Supabase Cron `settle-predictions` à :05, :20, :35, :50.
- `fixtures.original_kickoff_at` **existait déjà** (phase 2) et est rempli à la première synchronisation (`lib/api-football/convert.ts`) : aucune colonne ajoutée.
- **Tâche `settle-predictions`** (`lib/sync/jobs-settle.ts`) : résolution puis remboursements, journalisée dans `sync_runs`, sans clé API-Football requise ; ajoutée à la route cron, au script `npm run sync` et au workflow GitHub.
- **Pages** : `/mes-pronostics` (match complet développé, filtres « À venir » / « Terminés », statut En attente / Gagné / Perdu / Annulé et remboursé, score final avec prolongation signalée, taux personnel), `/performances` publique (global, 30 jours, par type, par compétition, 20 derniers résolus si `reveal_after_match`, avertissement sous 50 pronostics résolus, message si indisponible), tableau de bord complet (solde, Recharger, 8 matchs à venir sous 48 h avec pronostic, 5 derniers pronostics, lien Performances), badges Gagné / Perdu / Annulé sur la fiche match, lien « Performances » dans le pied de page.
- **Tests** : 50 tests unitaires (`lib/settle/`) — total 194 ; tests d'intégration `tests/settlement/` (`npm run test:settlement`, ajoutés au job CI).

### Vérifications effectuées (base DEV)

- **Test croisé** : `settle_outcome` = résultat attendu sur les **37/37** cas de la table partagée ; sélection invalide ou marché inconnu → `NULL`.
- Scénario complet (transaction annulée) :

| Scénario | Résultat |
|---|---|
| Match FT 2-1, 4 pronostics | 4 `won` ; rejoué : `settled: 0` |
| Match AET 1-1 (2-1 a.p.) | 1N2 « 1 » perdu, « 2-1 » perdu, OVER perdu, BTTS gagné (temps réglementaire) |
| Match non terminé | `settle_fixture` → `NOT_FINISHED` |
| Match annulé (déblocages 2 + 5 crédits) | 7 crédits rendus (2 transactions `refund`), 4 pronostics `void` ; rejoué : 0 |
| Reporté de 5 jours | remboursé (« match reporté ») |
| Reporté de 24 h | `NOT_ELIGIBLE`, pronostics toujours `pending` |
| Match terminé | `refund_fixture` → `NOT_ELIGIBLE` |
| Solde | 30 → 14 après déblocages → 23 après remboursements (9 rendus) |
| `get_my_predictions` | 9 lignes (match complet développé, doublon marché + match complet fusionné), `refunded: true` sur le match annulé |
| `get_performance_stats` (anonyme) | 5 gagnés, 3 perdus, 8 annulés (pronostics non achetés compris), par marché et par compétition corrects |
| Permissions | `settle_fixture` / `refund_fixture` refusées à un utilisateur ; `get_my_predictions` refusée à un anonyme |

- `/performances` accessible sans compte (200) ; `/mes-pronostics` et `/tableau-de-bord` → 307 vers `/connexion` sans session.

### Décisions prises

- Résultat seul (`result`) exposé par `get_fixture_predictions` une fois résolu, même sans déblocage : ni sélection ni explication, conforme à la règle 1 de sécurité.
- « Reporté sans date » : statut `PST` dont le coup d'envoi n'a pas été déplacé (ou date initiale inconnue) → remboursé.
- `refund_on_cancel = false` : pas de remboursement, mais les pronostics passent quand même à `void` (match non joué).
- Une sélection invalide n'est jamais résolue au hasard : le pronostic reste `pending` et l'erreur est journalisée.
- Taux de réussite arrondi au dixième ; les annulés sont affichés mais exclus du calcul.

### Écarts / points ouverts

- **Tests d'intégration non exécutés dans cette session** (pas de clé `service_role`, pas d'accès réseau à Supabase depuis la session) ; ils tournent en CI avec les secrets `SUPABASE_DEV_*`.
- Aucune donnée réelle en base (synchronisation en attente des secrets) : pages vides pour l'instant.
- La page publique `/performances` utilise l'en-tête public (liens « Se connecter / S'inscrire ») même pour un utilisateur connecté.

### Dettes techniques

- Un déblocage remboursé conserve l'accès au contenu (match annulé : sans conséquence).
- `get_performance_stats` calcule à la volée : prévoir une vue matérialisée si le volume grandit.

### Prochaine phase

**Phase 10 — Administration** : les 13 pages admin et le journal d'audit.

---

## Phase 10 — Administration

Branche `phase-10-admin` (partie de `phase-9-settlement`), 4 commits (SQL, pages et actions, tests, documentation).

### Ce qui a été fait

- **Migration `admin`** (`20261118060511`) : 13 fonctions `admin_*` (voir docs/database.md), chacune avec contrôle `is_admin()` et écriture dans `admin_audit_log`. Les autres écritures passent par la RLS admin existante puis `admin_log_action` (pas de clé secrète côté pages).
- **Mise en page** : barre latérale de 13 entrées (les 11 sections du cahier des charges + journal d'audit + retour à l'application) ; `requireAdmin()` dans la mise en page et dans chaque page ; tableaux shadcn avec recherche, filtres, tri et pagination côté serveur (paramètres d'URL).
- **Pages** :
  1. `/admin` : inscrits (total, 7 jours), crédits vendus / dépensés / remboursés / en circulation, chiffre d'affaires simulé, matchs < 48 h avec et sans pronostic, « À surveiller » (matchs du jour sans pronostic, tâches en erreur, générations IA en échec), quota API-Football.
  2. `/admin/competitions` : activer / désactiver, ordre, ajout par identifiant API-Football (vérification `/leagues`, 1 appel compté), « Synchroniser maintenant » (sync-fixtures + sync-standings).
  3. `/admin/matchs` (filtres compétition, période, statut, avec / sans pronostic, publication ; publier / masquer) et `/admin/matchs/[id]` : informations, dossier IA (JSON repliable), pronostics, déblocages et crédits encaissés, Régénérer (désactivé avec explication s'il y a un achat), Masquer / réafficher un marché, Modifier le texte (historisé), Générer maintenant (si aucun pronostic), Résoudre maintenant, Rembourser (confirmation + saisie de REMBOURSER + motif), historique des générations et des révisions.
  4. `/admin/pronostics` : filtres marché, compétition, statut, résultat, confiance ; taux de réussite du filtre courant.
  5. `/admin/utilisateurs` (recherche e-mail / nom / identifiant, tri, statut) et `/admin/utilisateurs/[id]` : profil, solde (avec contrôle de cohérence), transactions, déblocages, recharges ; Ajuster le solde, Suspendre / réactiver, Promouvoir admin (boîte de confirmation + saisie de PROMOUVOIR).
  6. `/admin/tarifs` : `pricing_mode`, prix de chaque marché et du match complet, surcharges par compétition (ajout, modification, suppression) ; avertissement si le match complet coûte plus que la somme des marchés.
  7. `/admin/packs` : créer (inactif), modifier, activer / désactiver, ordonner ; suppression refusée si le pack a été acheté.
  8. `/admin/transactions` : mouvements et recharges, filtres type / statut, période, utilisateur ; export CSV de la vue filtrée (`;`, BOM UTF-8, protection contre l'injection de formules) ; « Contrôle de cohérence » (RG-F6-4).
  9. `/admin/synchronisation` : historique `sync_runs` filtrable, quota restant, appels du jour, lancement manuel de chaque tâche avec résultat, état des tâches Supabase Cron.
  10. `/admin/ia` : historique des générations, tokens et coût par jour et par mois, taux d'échec, réussite par version de prompt.
  11. `/admin/parametres` : chaque clé de `app_settings` avec un champ adapté (interrupteur, nombre, liste, choix, JSON) et sa description ; activation des marchés.
  12. `/admin/journal` : journal d'audit (qui, quoi, quand, avant / après, motif).
- **Tests** : `lib/admin/actions/actions.test.ts` (les 26 Server Actions admin, découvertes automatiquement, refusent un non-admin avant tout accès aux données), `lib/admin/admin.test.ts` (colonnes et échappement CSV, paramètres d'URL, paramètres de l'application, avertissement de prix) — total 205 ; tests d'intégration `tests/admin/` (`npm run test:admin`, ajoutés au CI).

### Vérifications effectuées

- SQL (base DEV, transaction annulée) : les 14 fonctions admin (dont `admin_adjust_balance`) appelées par un utilisateur → `FORBIDDEN` ; un utilisateur ne lit pas le journal ; par un admin : vue d'ensemble, recherche par e-mail, fiche, ajustement +15 (et refus d'un solde négatif), suspension / réactivation, promotion / rétrogradation, refus sur soi-même (`SELF`), modification de texte historisée (1 révision), refus d'un texte trop court, masquage, résolution d'un match non terminé refusée, remboursement sans motif refusé puis effectué, contrôle de cohérence, 7 tâches Cron listées, statistiques IA ; **journal** : `adjust_balance, ban_user, unban_user, set_user_role ×2, edit_prediction_text, hide_prediction, settle_fixture, refund_fixture, update_pack`.
- `next start` sans session : les 15 routes admin (dont l'export CSV) répondent 404.

### Décisions prises

- Fonctions SQL `admin_*` en `SECURITY DEFINER` pour ce que la RLS ne permet pas (e-mails de `auth.users`, Supabase Cron, révisions, remboursement manuel) ; le reste par la RLS admin, sans clé secrète.
- Remboursement manuel possible quel que soit le statut du match (décision de l'admin, motif obligatoire), libellé « décision de l'administration ».
- Un pack créé est inactif par défaut ; une compétition ajoutée est inactive sauf choix contraire.
- « Synchroniser maintenant » lance sync-fixtures puis sync-standings (sync-competitions reste dans la page Synchronisation).

### Écarts / points ouverts

- **Pages non testées dans un navigateur avec un compte admin** : la session n'a ni accès réseau à Supabase ni compte admin. À vérifier sur la prévisualisation (variables Vercel Preview requises).
- Tests d'intégration en attente des secrets GitHub `SUPABASE_DEV_*`.
- Les actions longues (Générer maintenant, Régénérer, Synchroniser) peuvent dépasser la durée maximale d'une Server Action sur Vercel selon le forfait.

### Dettes techniques

- Filtre « avec / sans pronostic » de `/admin/matchs` calculé en mémoire (2 000 matchs au plus par filtre).
- Export CSV limité à 10 000 lignes.

### Prochaine phase

**Phase 11 — Recette** : tests de bout en bout (Playwright), audit de sécurité, corrections.

---

## Phase 11 — Recette

Branche `phase-11-qa` (partie de `phase-10-admin`).

### Ce qui a été fait

- **Audit de sécurité** ([docs/SECURITE.md](SECURITE.md)) :
  - requêtes réelles sur la base DEV avec les rôles `anon` et `authenticated` (lecture de 12 tables, 18 tentatives d'écriture, paramètres hostiles sur les fonctions, inventaire des droits d'exécution) ;
  - routes cron et webhook en HTTP ;
  - analyse du bundle client avec des secrets marqueurs ;
  - en-têtes de cache ;
  - `npm audit`.
  
  Nouveau test `tests/security/audit.test.ts` qui rejoue les attaques en CI.
- **Failles trouvées et corrigées** :
  1. un utilisateur pouvait modifier son `profiles.created_at` (antidater l'inscription) ;
  2. `profiles.timezone` acceptait n'importe quel texte sans limite ;
  3. `rls_auto_enable()` exécutable par `anon` / `authenticated` ;
  4. aucun en-tête de sécurité HTTP (clickjacking possible, `X-Powered-By` exposé) ;
  5. 10 vulnérabilités dans les dépendances de production (`shadcn` passé en dépendance de développement) et `minimatch` modéré (override) : **0 en production**.
- **Recette fonctionnelle** ([docs/RECETTE.md](RECETTE.md)) : 30 règles, exigences de la section 11, 32 pages. Écarts corrigés :
  - RG-F2-4 : fenêtre des matchs paramétrable (`fixtures_window_days`) ;
  - saison courante modifiable dans `/admin/competitions` ;
  - colonne « Dernière synchro » dans `/admin/matchs` ;
  - mention de la suppression de compte dans `/profil`.
- **Playwright** (`tests/e2e/`, `npm run test:e2e`, ajouté au CI) :
  - parcours utilisateur : inscription, confirmation contournée par le client admin, connexion, fiche match, refus faute de solde, recharge simulée, déblocage d'un marché, match complet à prix réduit, portefeuille, résolution simulée, Mes pronostics ;
  - parcours admin : prix, ajustement de solde, masquage d'un marché, journal d'audit ;
  - les deux vérifient l'absence d'erreur dans la console du navigateur.
- **Robustesse** : `lib/sync/runner.test.ts` couvre API-Football injoignable, API en erreur (lot qui continue), quota atteint (arrêt avant tout appel), exception inattendue et deux exécutions successives. S'y ajoutent les tests existants : nouvelles tentatives d'API-Football, échec d'OpenAI, idempotence de la résolution, du remboursement et des recharges.
- **Qualité** :
  - pages 404 et 500 en français (`not-found`, `error`, `global-error`) ;
  - états de chargement (tableau de bord, Mes pronostics, Portefeuille, Performances, pages admin de liste) ;
  - build sans avertissement ;
  - index vérifiés.
- **Nettoyage** : aucun `TODO`, aucun `console.log` hors scripts en ligne de commande ; README complet (installation, variables, commandes, tests, déploiement).
- **Tests** : 211 tests unitaires.

### Décisions prises

- Les vérifications de sécurité se font par requêtes réelles avec changement de rôle. La session n'a ni clé `service_role` ni accès réseau à Supabase hors des outils d'intégration. Les mêmes scénarios sont automatisés pour la CI.
- `loading.tsx` n'est pas placé sur les segments dont la page appelle `notFound()`, pour conserver de vrais codes 404 (constat de la phase 5).
- `picomatch` (ReDoS, outils de développement uniquement, aucune version corrigée publiée) est accepté et documenté.

### Écarts / points ouverts

- **Playwright et tests d'intégration non exécutés ici** : ils tournent en CI dès l'ajout des secrets `SUPABASE_DEV_*`.
- Critère « mises à jour seules pendant 7 jours » non vérifiable tant que la synchronisation réelle n'a pas tourné (secrets API-Football / OpenAI, variables Vercel Preview, secrets Vault).
- Temps de chargement non mesurés avec de vraies données (base vide) ; index vérifiés, requêtes bornées.

### Dettes techniques

- Index en double `admin_audit_log_created_idx` / `admin_audit_log_created_at_idx` (sans effet fonctionnel) : à supprimer lors d'une migration de maintenance.
- `picomatch` à mettre à jour dès qu'un correctif paraît.
- Avant la production : CAPTCHA à l'inscription si les crédits de bienvenue sont activés ; réglages Supabase Auth (confirmation d'e-mail, mots de passe divulgués).

### Prochaine phase

**Phase 12 — Mise en production** : projet Supabase de production, variables Vercel, forfait API-Football Pro, domaine.

---

## Phase 12 — Mise en production

**Dates** : 18 et 23 novembre 2026 · **Branche** : `main` (fusion accordée), puis `claude/laughing-franklin-0mmobb` (documentation) · Check-list détaillée : [PRODUCTION.md](PRODUCTION.md)

### Ce qui a été fait

- **Base de production** : `pronostics` (`pgeytactmugqskdzsxnw`), décision du porteur. 19 migrations et données de départ appliquées, RLS sur les 21 tables. Le second projet `pronostics-prod`, vide et inutilisé, a été supprimé par le porteur le 22/11.
- **Vercel** : les 11 variables applicatives sont posées en Production (clés API-Football et OpenAI, `OPENAI_MODEL`, `CRON_SECRET`, `PAYMENT_MOCK_SECRET`, `ADMIN_EMAILS`…), et le redéploiement est READY.
- **Supabase Cron** : les secrets Vault `app_url`, `cron_secret` et `vercel_bypass_secret` sont posés. Le secret de contournement Vercel est créé (« Supabase Cron »). Les 8 tâches tournent : `generate-predictions` et `settle-predictions` se sont exécutées seules, avec succès.
- **Administrateur** : le compte du porteur est promu, avec une écriture identique à `promoteIfAdminEmail` (journal d'audit n° 15).
- **Compétitions** : Premier League (39), LaLiga (140), Serie A (135), Bundesliga (78) et Ligue 1 (61) sont ajoutées et activées, et journalisées. `sync-competitions` a renseigné saison 2026 et logos.
- **Test de fumée HTTP** :
  - pages publiques en 200 ;
  - pages privées en 307 vers `/connexion?next=…` ;
  - `/admin` en 404 sans session ;
  - `/api/cron/*` en 401 sans secret ou avec un mauvais secret ;
  - en-têtes de sécurité présents (HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`).

### Décisions prises

- **Exception à la règle « aucun secret transmis à Claude Code »**, accordée par le porteur le 23/11 : Claude a généré `CRON_SECRET` et le secret de contournement, puis les a posés dans Vercel et dans Vault. Ces deux secrets peuvent être régénérés à tout moment.
- Promotion admin et ajout des compétitions faits en SQL, avec journalisation identique à celle des Server Actions. Le porteur n'arrivait pas à faire ces étapes dans les tableaux de bord.

### Points ouverts

- **Bloquant : la clé API-Football est sur le forfait gratuit.** API-Football répond « Free plans do not have access to this season, try from 2022 to 2024 » : ni équipes, ni matchs, ni pronostics. Le porteur activera le forfait Pro (environ 19 $/mois, 7 500 requêtes/jour). Il faudra ensuite relancer `sync-competitions`, `sync-fixtures`, `sync-standings`, `build-contexts` et `generate-predictions`, et vérifier le nom du modèle OpenAI (`gpt-6.2-sol`) au premier pronostic.
- **`pronostic-brown.vercel.app` est accessible publiquement.** La protection Vercel standard ne couvre pas le domaine de production. Avec `PAYMENT_PROVIDER=mock`, n'importe qui pourrait se créditer dès que l'envoi d'e-mails fonctionne. À traiter avant d'annoncer le site : désactiver les packs, protéger aussi la production, ou brancher le vrai paiement.
- À faire par le porteur : URL d'authentification Supabase (Site URL et Redirect URLs), modèles d'e-mails en français, SMTP personnalisé, sauvegardes.

### Dettes techniques

- Index en double `admin_audit_log_created_idx` / `admin_audit_log_created_at_idx` (déjà noté en phase 11).

### Prochaine étape

Activation du forfait API-Football Pro, première synchronisation complète et génération des pronostics. Ensuite : test de fumée utilisateur (inscription, recharge, déblocage) et clôture du MVP.

---

## Crédits v2 (lots 0 à 5)

**Dates** : 23 et 24 novembre 2026 · **Branche** : `claude/laughing-franklin-0mmobb` · Plan et décisions : [PLAN-credits-v2.md](PLAN-credits-v2.md)

**Statut : EN PRODUCTION depuis le 24/11/2026** (accord du porteur) : 6 migrations appliquées à `pronostics` (25 au total, RLS sur les 25 tables), contrôle fonctionnel en transaction annulée (journal immuable, notification, résolution), `main` fusionnée, déploiement Vercel `dpl_JCUcSCdrLtuxNpVFfaGTqBF7fqpv` READY, aucune erreur d'exécution. Test de fumée HTTP : pages publiques 200, pages privées 307 vers /connexion, admin 404 sans session, cron 401 sans secret.

### Ce qui a été fait

- **Lot 0** : projet Supabase de test `pronostics-dev` (`mumyxqitlazkpjmcxfjm`), 18 migrations sur 19 (`health_monitoring` en attente d'une confirmation du porteur), données de départ.
- **Lot 1** : journal des crédits immuable ; notifications (cloche, page) ; portefeuille filtré avec totaux ; reçus de paiement.
- **Lot 2** : packs Starter → VIP datés ; codes promo ; moyens de paiement ; annulation d'une transaction par l'admin ; page Revenus.
- **Lot 3** : génération IA à la demande, mutualisée, avec réservation des crédits (jamais de débit sans résultat).
- **Lot 4** : 6 nouveaux types d'analyses (prompt v2), résolution TS + SQL (75 cas croisés).
- **Lot 5** : pronostic acheté figé (déclencheur), historique détaillé, suivi admin des générations.
- **Relecture** : 2 défauts corrigés (double remboursement possible, accès sur match annulé pendant l'analyse).

### Vérifications

Lint, types, 290 tests unitaires, build ; chaque migration rejouée en SQL sur la base de test (scénarios dans des transactions annulées) ; parcours dans un navigateur (portefeuille, reçus, notifications, promotions, revenus, annulation, génération, historique).

### Points ouverts

- Appel réel à l'IA non testé : il faut des matchs réels (forfait API-Football Pro).
- Prix du match complet resté à 7 crédits pour 10 marchés (22 crédits au détail) : à fixer par le porteur dans `/admin/tarifs`.
- Prix des packs Pro et VIP à fixer, puis à activer.
- Lot B (corners, cartons, combinés) : en production depuis le 24/11 (voir ci-dessous).

## Crédits v2, lot B — corners, cartons, combiné IA (24/11/2026)

Statut : **EN PRODUCTION (24/11/2026)** : migration appliquée sur `pronostics` après essai dans une transaction annulée, code fusionné dans `main`, déploiement Vercel `READY`, aucune erreur d'exécution.

### Fait

- 3 nouveaux types : **plus/moins de 9,5 corners**, **plus/moins de 4,5 cartons** (jaunes + rouges), **combiné IA** (2 ou 3 sélections du même match, gagné si toutes gagnées). Prix de départ : 2, 2 et 3 crédits (modifiables dans `/admin/tarifs`).
- Tâche `sync-statistics` (chaque heure à :45) : corners et cartons des matchs terminés depuis moins de 14 jours, 1 appel par match, 15 au plus par passage, 6 essais au plus. Affichés sur la fiche match.
- Dossier IA : moyennes de corners (pour / contre) et de cartons sur les 5 derniers matchs avec statistiques ; prompt **v3** (v2 inchangé).
- Résolution : corners / cartons sur les totaux ; **match prolongé (AET/PEN) → annulé et remboursé** (décision 2) ; statistiques jamais reçues 7 jours après → annulé et remboursé ; sinon en attente.
- Historique mince → **confiance « faible » imposée** sur corners et cartons (décision 3).
- Correction de sécurité au passage : l'annulation par l'admin d'un déblocage déjà remboursé est refusée (évitait un double remboursement).

### Décisions prises

- Remboursement d'un pronostic annulé acheté via le **match complet** : part du prix payé proportionnelle au prix de base du marché, arrondie au crédit supérieur (ex. 7 crédits pour 13 marchés : 1 à 2 crédits). Modifiable si le porteur préfère une autre règle.
- Statistiques API-Football : prolongations comprises, d'où l'annulation en cas de prolongation.

### Vérifications

Lint, types, 328 tests unitaires, build ; migration appliquée sur la base de test ; 99 cas de résolution identiques en TypeScript et en SQL ; scénarios SQL (prolongation, remboursement partiel, match ensuite annulé, statistiques manquantes puis périmées, double remboursement refusé, droits d'un utilisateur).

### Points ouverts

- Les corners / cartons ne s'alimentent qu'avec de vrais matchs (forfait API-Football Pro) ; au début, la confiance sera « faible » le temps d'accumuler 3 matchs par équipe.
- Prix du match complet à revoir (13 marchés désormais).


## Contrôle général du 24/11/2026 (sécurité, bugs, rapidité)

- **Rapidité** : les fonctions Vercel tournaient à Washington (`iad1`) alors que la base est en Irlande (`eu-west-1`) ; `vercel.json` les place à Dublin (`dub1`). Production avant changement : 0,2 à 0,5 s par page une fois le serveur réveillé (1,6 s au premier accès).
- **Sécurité** : ajout d'une politique de sécurité du contenu (CSP) et de `Cross-Origin-Opener-Policy` (voir `docs/SECURITE.md`, section 9 septies).
- **Bugs** : parcours complet dans un navigateur (14 pages utilisateur, 16 pages admin, connexion, navigation par le menu) : aucune erreur, aucun blocage par la CSP.
- **Prévisualisations Vercel** : elles n'avaient aucune variable d'environnement (pages en erreur) ; elles utilisent maintenant la base de **test** `pronostics-dev` (valeurs publiques uniquement).
- **Hors de portée des outils (à faire par le porteur dans Supabase)** : adresses de connexion (Site URL, Redirect URLs), SMTP, réactivation de la confirmation de l'e-mail (désactivée en production), protection des mots de passe piratés.

## PRONEX — packs fixes, suppression des bonus (25/11/2026)

Statut : **fait et vérifié sur la base de test** ; production après accord du porteur.

- Grille officielle : STARTER 1 000 F = 10, BASIC 2 500 F = 25, PREMIUM 5 000 F = 50 (recommandé), PRO 10 000 F = 110, VIP 20 000 F = 250 crédits. Chaque achat crédite exactement ces crédits.
- Supprimés : crédits de bienvenue, bonus des packs, codes promo (page `/admin/promotions` et actions retirées). Il n'existait ni bonus de premier achat ni parrainage.
- Page `/recharger` aux couleurs PRONEX (nuit #080B20, rose #FF1493, violet #A000FF, gris #9CA3AF), PREMIUM mis en avant, solde affiché, aucun bonus affiché.
- Admin : prix, crédits, activation et « Recommandé » dans `/admin/packs` (ventes et montant encaissé par pack) ; `/admin/revenus` : ventes par pack (crédits) et lien d'export CSV des ventes ; indicateurs de bonus retirés.
- Migration non destructive `20261125120000_fixed_packs_no_bonus.sql` : aucune table, colonne, donnée ni solde supprimé ou modifié.
- Écart volontaire avec le cahier des charges (packs avec bonus, crédits de bienvenue configurables) : décision du porteur.


## Refonte PRONEX — phase A : fondations (25/11/2026)

- Audit UX/UI (étape 1) remis au porteur ; plan en phases A → G validé.
- Thème sombre unique aux couleurs PRONEX dans tout le site (jetons `app/globals.css`), titres en Exo 2, halo néon discret.
- Logo intégré (`public/brand/`, `components/layout/brand.tsx`), icônes d'onglet et d'application ; nom « PRONEX » dans les titres, les pages légales, l'administration et les modèles d'e-mails (`supabase/templates/`, à recopier dans Supabase).
- En-tête collant (logo, navigation sur ordinateur, solde cliquable vers l'achat, notifications, menu) ; **barre de navigation fixe en bas sur mobile** (le menu horizontal coupé est supprimé) ; pied de page avec le slogan.
- Vérifié : lint, types, 329 tests, build ; 14 pages utilisateur et 12 pages admin sans erreur ; aucun débordement horizontal à 360 px.
- Restent pour les phases suivantes : accueil (B), fiche match et cartes de pronostics (C), portefeuille en cartes sur mobile (D), administration (E).

## Refonte PRONEX — phase B : pages publiques (25/11/2026)

- Accueil : accroche « Prédisez. Analysez. Dominez. », logo, « Comment ça marche » en 3 étapes, liste des types de pronostics **lue en base** (actifs uniquement), bloc performances (vrai taux de réussite ou message d'attente, jamais de chiffre inventé), prix du plus petit pack lu en base (`lib/catalog/landing.ts`).
- Connexion, inscription, mot de passe oublié et réinitialisation : panneau PRONEX sur ordinateur, carte du formulaire au contour néon (`components/auth/auth-card.tsx`).
- Performances : grands chiffres en dégradé, état vide explicatif ; composants partagés `EmptyState` (icône) et `PageHeader` (trait néon) ; pages CGU et jeu responsable en carte.
- Vérifié : lint, types, 329 tests, build ; 6 pages publiques sur mobile et ordinateur sans erreur ni débordement.

## Refonte PRONEX — phase C : cœur de l'application (26/11/2026)

- Fiche match : en-tête du match (compétition, date, logos, score ou heure en grand, statut, pastilles mi-temps / corners / cartons), section « Données du match » (forme, classement, confrontations), avertissement en double supprimé ; texte des matchs annulés conforme au réglage `refund_on_cancel` (lecture seule).
- Cartes de pronostics (`components/predictions/predictions-block.tsx`) : offre « match complet » mise en avant, cartes en grille, carte verrouillée avec aperçu flou **décoratif** (aucune donnée envoyée avant déblocage), bouton « Débloquer · N crédits », confiance et résultats en couleurs (vert gagné, rouge perdu, gris annulé), barres de probabilité en dégradé, analyse du match.
- Liste des matchs : sélecteur de période en pastilles, groupes par compétition en cartes, badge « Pronostic disponible » ; statut « en direct » animé.
- Tableau de bord : bandeau d'accueil avec solde et « Acheter des crédits ».
- Aucun changement de logique (prix, déblocage, résolution, remboursements).
- Vérifié : lint, types, 329 tests, build ; tableau de bord, matchs, fiche match et compétitions sur mobile et ordinateur, sans erreur ni débordement ; fenêtre de confirmation du déblocage.

## Refonte PRONEX — phase D : compte (26/11/2026)

- Portefeuille : bandeau solde, filtres en pastilles, **historique en cartes** (icône par type, montant coloré, solde après, lien vers le reçu) : plus aucune colonne coupée sur mobile.
- Reçus : liste en cartes, reçu avec logo ; **style d'impression clair** (`@media print` dans `app/globals.css` : fond blanc, sans en-tête, navigation ni pied de page).
- Mes pronostics : taux de réussite en grand, filtres en pastilles, cartes avec la sélection mise en avant.
- Notifications : pastille rose pour les non lues ; profil avec en-tête de page ; résultat de recharge avec icône d'état ; bandeau « Paiement de test » harmonisé.
- En-tête : menu horizontal à partir de 1024 px (barre du bas en dessous), nom et mot « crédits » masqués entre 1024 et 1280 px ; vérifié sans chevauchement de 320 à 1280 px.
- Vérifié : lint, types, 329 tests, build ; 6 pages sur mobile et ordinateur sans erreur ni débordement ; aperçu d'impression du reçu.

## Refonte PRONEX — phase E : administration (26/11/2026)

- Barre latérale groupée (Contenu, Ventes, Système) avec icônes et page active en néon ; sur téléphone, menu repliable qui affiche la page en cours et se referme après chaque navigation.
- En-têtes de page avec trait néon, tuiles chiffrées (`Stat`) avec icône et tons (rose, violet, alerte ambre), filtres et champs aux couleurs PRONEX.
- Vue d'ensemble : chiffres regroupés (« Ventes et crédits », « Activité »), encadrés « À surveiller » verts (OK) ou ambre (à traiter), panneau de surveillance vert ou rouge.
- Tableaux : en-têtes discrets ; sur téléphone, chaque ligne devient une carte « libellé / valeur » (aucune modification des 11 pages à tableaux).
- Aucune modification des fonctions, des contrôles d'accès, des Server Actions ni de la base de données.
- Vérifié : 16 pages admin à 320, 390, 768 et 1366 px, sans débordement ni erreur console ; lint, typecheck, 329 tests, build.

## Refonte PRONEX — phase F : finitions (26/11/2026)

- Pages 404 et erreur (500, erreur globale) aux couleurs PRONEX : logo, grand code en dégradé, actions claires (`components/layout/status-screen.tsx`).
- Chargements : squelettes avec reflet rose / violet (`[data-slot=skeleton]`), apparition douce des pages ; toutes les animations sont coupées si l'appareil demande moins d'animations.
- Accessibilité (audit axe-core, WCAG 2 A/AA, 22 pages, mobile) : 0 problème restant.
  - Texte blanc sur rose plein (3,6:1) : boutons et badges principaux passés au dégradé PRONEX avec le rose à 85 % (≥ 4,5:1), couleurs de marque inchangées.
  - Bouton « danger » : texte éclairci (4,48:1 → conforme).
  - Administration : zone principale `<main>` (repère manquant).
  - Lien « Aller au contenu » au premier appui sur Tab ; contour de focus rose visible au clavier partout.
- Recherche globale : non faite (non demandée).

## Refonte PRONEX — phase G : contrôle final (26/11/2026)

Parcours réel sur la base de test (application compilée en local) :
1. Inscription : formulaire, validation et case CGU vérifiés. Une adresse refusée par Supabase (ex. `@example.com`) affichait « Une erreur est survenue » : message dédié ajouté (`email_address_invalid`, test unitaire).
2. Achat : 5 packs visibles sans bonus, bandeau « Paiement de test », code promo refusé, recharge Starter créée par l'utilisateur, validée par `apply_topup` (rôle du webhook vérifié) : 16 → 26 crédits, deuxième validation sans effet. (L'action serveur d'achat exige la clé secrète, absente en local : comportement voulu.)
3. Déblocage : fenêtre de confirmation (prix, solde avant / après), 26 → 24 crédits, sélection, confiance et probabilités affichées, solde de l'en-tête à jour ; « match complet » proposé au prix restant (1 crédit, déjà payé déduit).
4. Portefeuille, reçu (RC-…, 1 000 FCFA, pack Starter) et Mes pronostics cohérents ; aucune erreur console.

Sécurité : voir docs/SECURITE.md § 9 nonies (84 tentatives d'attaque, toutes refusées).

Accessibilité : axe-core sur 22 pages, 0 problème ; affichage des 16 pages admin de 320 à 1366 px sans débordement.

Rapidité (production, mesures depuis un serveur européen) :
- temps de réponse : accueil 0,58 s en moyenne, autres pages 0,18 à 0,27 s ;
- affichage principal (LCP) : 0,4 à 1,1 s, aucun décalage de mise en page notable (CLS ≤ 0,015) ;
- correction : le logo était servi en PNG d'origine (726 Ko pour les trois images, optimisation Vercel désactivée). Versions WebP sans perte de transparence (127 Ko) ; le grand logo de la page de connexion n'est plus chargé sur téléphone (caché). Poids du logo sur /connexion mobile : 725 Ko → 29 Ko.

Tests automatiques : sélecteurs périmés de `tests/e2e/*.spec.ts` corrigés (cartes `article`, encadrés `rounded-xl`, case CGU cochée directement). Lint, typecheck, 332 tests, build : OK.

Points ouverts (porteur) : domaine, e-mails Resend + modèles français (évite l'erreur « lien ouvert dans un autre navigateur »), confirmation d'e-mail, protection des mots de passe divulgués, offre API-Football Pro, décisions `refund_on_cancel` et prix du match complet. Conseiller performance : index en double sur `admin_audit_log` (à supprimer par une migration, avec accord).

## Décisions du porteur (26/11/2026)

- **Direction artistique validée** (étape 2 : design system PRONEX, couleurs d'état officielles #22C55E / #F59E0B / #EF4444, néon avec modération). Planche visuelle remise ; choix de la couleur des boutons standards (violet plein recommandé, ou rose plein) en attente.
- **Remboursement automatique des matchs annulés activé** en production (`app_settings.refund_on_cancel = true`), journalisé (`update_setting`).
- **Crédits de test retirés** en production : 5 paiements simulés du 26/11 (445 crédits) annulés par `admin_adjust_balance(-445)` au nom du compte admin du porteur, journalisé ; solde 455 → 10 (les 10 restants viennent aussi d'un paiement simulé du 25/11). Les recharges simulées restent dans l'historique (registre immuable).
- Logo vectoriel : non fourni ; une vectorisation automatique de l'image déformerait les dégradés et halos du logo (interdit par la charte) ; à demander au créateur du logo.
- Nom de domaine : achat reporté par le porteur.
- **Logo version 2** fourni (plus net, « P » rose et violet) : découpé sans retouche (fond retiré, ballon conservé opaque), déclinaisons `pronex-logo`, `pronex-symbol` (en-tête, pied de page), `pronex-icon` (carré), `pronex-wordmark` en PNG (sources) et WebP (pages), icônes `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico` régénérées. En-tête vérifié de 320 à 1280 px sans chevauchement (nom masqué sous 380 px).
- Couleurs « rose et violet maintenues » : rose et violet restent les deux accents ; boutons standards en violet plein, dégradé rose → violet pour le bouton principal de chaque écran (à confirmer à l'étape 3).

## Étape 3 — refonte de l'espace utilisateur (26/11/2026)

Fondations du design system validé : couleurs d'état officielles, boutons standards violets (dégradé seulement pour le bouton principal d'un écran), badges teintés, champs 48 px sur mobile, confirmations en feuille du bas sur téléphone, composants `SegmentedNav`, `StatCard`, `SectionHeading`, pied de page professionnel (liens, 18+).

- **Accueil** : hero avec logo et slogan, présentation de PRONEX AI, avantages, types d'analyses (base), aperçu des prochains matchs analysés (seulement s'il en existe), performances réelles, packs de crédits (base), fonctionnement, FAQ (textes conditionnés aux réglages publics `refund_on_cancel`, `reveal_after_match`), appel à l'action.
- **Tableau de bord** : solde et achat en premier, analyses disponibles, réussite de l'IA, accès rapide (6 entrées), prochains matchs analysés, derniers pronostics, historique récent, notifications, performances.
- **Matchs** : recherche (équipe ou compétition, sans accents), filtres compétition, statut (à venir, en cours, terminés, reportés), période et jour précis ; regroupement par jour puis compétition ; états vides distincts (aucune donnée / aucun résultat de filtre). Filtres purs testés (`lib/catalog/fixture-filters.ts`).
- **Fiche match** : séparation « Contenu payant » / « Accès libre », forme avec moyennes de buts, classement (G-N-P), statistiques corners / cartons, absences (si connues), confrontations. Migration `20261126120000_public_context_stats.sql` (lecture seule) appliquée sur la base de test puis en production.
- **Mes pronostics** : taux personnel, gagnés, perdus, crédits dépensés (match complet compté une fois), filtres À venir / Terminés / Tous, carte détaillée (type, date d'achat, crédits, probabilité, confiance, score final, mi-temps), mention « contenu figé ».
- **Portefeuille** : solde, totaux, filtres par type (Achats, Déblocages, Remboursements, Ajustements), détail dépliable de chaque mouvement (n°, date, montant, solde après, libellé, lien vers le reçu). Anciens filtres `recus` / `consommes` toujours acceptés.
- **Performances** : période (depuis le début / 30 jours), taux, gagnés, perdus, annulés, graphique sur 12 semaines (`by_week`), taux par type et par compétition en barres, équivalents textuels accessibles.
- **Profil** : en-tête du compte, sections Informations et préférences (fuseau), Sécurité (mot de passe), Sessions (déconnexion de cet appareil ou de tous), Compte. **Notifications** : filtre Toutes / Non lues. Mode clair : n'existe pas (thème sombre unique), non ajouté.
- **Pages d'accès** : carte plus sobre avec logo sur mobile, message clair si un lien est ouvert dans un autre navigateur, confirmation après déconnexion globale ; déclaration 18+ inchangée.

Vérifications : lint, typecheck, 345 tests, build ; 19 pages à 320, 390, 768 et 1366 px sans débordement ni erreur console ; axe-core (WCAG A/AA) sur 25 pages : 0 problème.

## Étape 4 — refonte de l'administration (26/11/2026)

Aucune migration ni nouvelle intégration : uniquement des lectures (RLS admin) et de la présentation ; actions sensibles inchangées (Server Actions `requireAdmin()` + journal d'audit).

- **Centre de contrôle** (`/admin`, `lib/admin/control-center.ts`) : utilisateurs (total, actifs sur 30 jours = au moins un mouvement de crédits, suspendus), matchs (en base, à venir 7 j, publiés), pronostics générés et matchs couverts, déblocages (total, 30 j), transactions (total, 30 j, recharges en attente) ; état des systèmes : tâches Supabase Cron, dernière exécution de chaque synchronisation (OK / erreur / en retard > 26 h / jamais), moteur IA (générations et échecs 24 h, durée moyenne, demandes en cours ; un échec à la demande, crédits rendus, est une alerte orange) ; revenus (simulés) et crédits ; « À surveiller ».
- **Compétitions** : chiffres clés, matchs en base (à venir / terminés), couverture API-Football par compétition (classement, statistiques, absences, prédictions). **Matchs** : recherche équipe / compétition, chiffres du filtre, colonne « Données » (dossier IA, score, mi-temps, statistiques). **Fiche match** : carte « Données disponibles » (dossier, forme, classement, confrontations, corners / cartons, absences, score, statistiques) ; durée de chaque génération.
- **Pronostics** : explication de l'IA dépliable, nombre de déblocages (marché + match complet, jeu partagé), date de génération, version du prompt et du pronostic.
- **Suivi de l'IA** : état du moteur (clé configurée oui / non, jamais sa valeur ; modèle ; prompt v3), temps de traitement médian et 90 %, échecs récents, erreurs les plus fréquentes (validations refusées), qualité des dossiers sur 30 jours (erreurs de collecte), générations à la demande.
- **Utilisateurs** : achats, déblocages, pronostics obtenus, résultats ; historique des pronostics (match, type, sélection, probabilité, crédits, résultat).
- **Packs** : contrôle automatique de la grille officielle (`lib/admin/pack-grid.ts`, testé) ; aucun tarif modifié.
- **Transactions / revenus** : numéro de reçu des recharges réussies ; barres du chiffre d'affaires par jour.
- **Paramètres** groupés (généraux, IA, compétitions et matchs, synchronisation, paiement) avec liens vers les pages dédiées ; définitions ajoutées pour `on_demand_generation_enabled`, `on_demand_window_hours`, `alert_quota_min`, `payment_methods`. **Journal d'audit** : filtres objet et période, nombre d'actions sur 24 h et 7 jours.

Vérifications : lint, typecheck, 348 tests, build ; 16 pages admin à 320, 390, 768 et 1366 px sans débordement ni erreur ; axe-core : 0 problème sur 20 pages (dont 14 admin).

Point à décider : `alert_quota_min` vaut 200 alors que l'offre gratuite d'API-Football donne 100 appels par jour : la surveillance signalera un quota bas tant que l'offre Pro n'est pas prise.

## Décisions du porteur (26/11/2026, suite)

- Production : 10 derniers crédits de test retirés (`admin_adjust_balance(-10)`, journalisé) : solde 0 ; `alert_quota_min` = 20 (quota gratuit de 100 appels / jour), à remonter avec l'offre Pro d'API-Football.
- Reporté **après l'achat du nom de domaine** (dans cet ordre) : branchement du domaine (Vercel + URL du site et redirections Supabase + `NEXT_PUBLIC_APP_URL`), modèles d'e-mails français (`supabase/templates/`), SMTP Resend (domaine vérifié requis), puis activation de « Confirm email » (à ne PAS activer avant : le SMTP par défaut n'envoie qu'aux membres de l'équipe Supabase, aucune inscription ne serait possible).
- Protection des mots de passe divulgués : réservée à l'offre Supabase Pro ; non bloquant (8 caractères minimum déjà exigés).

## Étape 5 — finalisation de PRONEX AI (26/11/2026)

Audit du moteur (lecture complète de `lib/ai`, `lib/generation`, tâches `build-contexts` / `generate-predictions`, fonctions SQL et contraintes) puis améliorations :

- **Audit, déjà conforme** : 13 marchés (schéma Zod strict → JSON Schema OpenAI), combiné limité à 2 ou 3 sélections du MÊME match, génération automatique à 48 h (`prediction_window_hours`) puis validation et enregistrement atomique (`save_ai_generation`), génération à la demande avec réservation / débit au succès / remboursement à l'échec ou à l'expiration (aucun second système), un seul jeu par match (contraintes uniques), contenu figé (déclencheur), masquage serveur + base (attaques rejouées), tarifs 2 / 3 / 7 inchangés.
- **Dossier analytique** : chaque source classée fiable / incomplète / indisponible, dossier « insuffisant » détecté, absences « inconnues » distinguées de « aucune absence » (`lib/ai/context/summarize.ts`, `build.ts`).
- **Validation renforcée** (`lib/ai/validate.ts`) : confiance abaissée si incohérente avec la probabilité ou si les données sont insuffisantes, contradiction BTTS / plus de 1,5 but, aucune probabilité à 0 ou 100 %, longueur des explications, nouvelles expressions interdites. Règle « score exact ↔ lignes 1,5 / 3,5 » volontairement non imposée (décision v2).
- **Prompt v4** (`lib/ai/prompts/v4.ts`, v3 inchangé) : usage de la qualité des données, justification chiffrée, seuils de confiance ; moteur et administration passés en v4.
- Administration : nombre de dossiers « données insuffisantes » dans Suivi de l'IA.
- Tests : 65 tests du moteur IA (dont 9 nouveaux) ; aucun appel réel à OpenAI.
- Non vérifiable sans offre Pro d'API-Football ni clé OpenAI en production : génération réelle de bout en bout sur de vrais matchs (`npm run ai:sample` à lancer dès que possible).

## Étape 6 — animation de génération PRONEX AI (26/11/2026)

- **Phases réelles** : le serveur enregistre la phase en cours de chaque génération à la demande (migration `20261126140000_generation_stages.sql`, test puis production après essai annulé) : démarrage, vérification du match, dossier, appel à l'IA, validation (probabilités, confiance, cohérence), enregistrement (dont le combiné), ou attente d'une analyse mutualisée. Points d'accroche : `runGeneration` (`stage`), `generateForFixture` (`onStage`), `generatePrediction` (`onResponse`).
- **7 étapes visuelles** (`lib/generation/stages.ts`, 7 tests) : une étape n'est « terminée » que lorsque le serveur est passé à la suivante ; la barre affiche les étapes terminées (jamais d'avance simulée) ; l'étape en cours a une animation sans pourcentage ; « Résultat final » seulement au statut `succeeded` ; échec : arrêt sur l'étape réelle et message (crédits rendus) ; délai dépassé : « toujours en cours », crédits réservés puis débités seulement en cas de succès ou rendus automatiquement ; analyse mutualisée : étapes 3 à 6 signalées comme non observables.
- **Interface** (`components/predictions/ai-generation-progress.tsx`) : noyau IA animé, barre rose → violet, coches vertes, étape active (anneau, halo, balayage), temps écoulé réel, carte finale « Analyse validée » puis cartes de pronostics (débloqués : sélection, probabilité, confiance, explication ; autres : masqués avec leur prix). Animations coupées si l'appareil réduit les animations.
- Vérifié : 371 tests, lint, typecheck, build ; tous les états affichés avec des réponses serveur simulées dans le navigateur de test (page de démonstration temporaire, non publiée).
- Limite : sans offre Pro d'API-Football ni génération réelle en production, l'animation n'a pas encore été vue sur une vraie analyse de bout en bout.

## Étapes 7 et 8 — responsive, états, tests et validation finale (26/11/2026)

- Étape 7 :
  - audit responsive sur 6 à 8 profils d'appareils (0 débordement) ;
  - cibles tactiles de 44 px ;
  - micro-interactions (survol, apparition échelonnée, appui) qui respectent la réduction des animations ;
  - erreurs par zone, squelettes de chargement, message « session expirée ».
- Correctif : un cookie de session corrompu provoquait une erreur 500. Désormais, il redirige vers la reconnexion grâce à l'en-tête interne `x-had-session` posé par `proxy.ts`.
- Étape 8 :
  - parcours fonctionnel 36/36 ;
  - axe sans violation ;
  - attaques 84/84 refusées ;
  - doubles débits impossibles ;
  - production cohérente (soldes, packs, tâches Cron) ;
  - moteur de règlement inchangé.
- Performance : logo de l'accueil allégé (89 → 52 Ko), police à chasse fixe non préchargée.
- Rapport complet : [RAPPORT-FINAL.md](RAPPORT-FINAL.md). Verdict : **pas prêt pour un lancement payant**. Il manque les données de la saison (offre API-Football), le domaine et le SMTP, puis le paiement réel.
- À surveiller : `sync-fixtures` du 26/11 à 05:07 a subi une coupure réseau sans trace dans le journal ; relancée à la main, elle fonctionne.

## Remise à zéro des statistiques après les essais (26/11/2026)

- Demande du porteur : les revenus et crédits affichés (39 500 FCFA, 455 crédits) venaient des essais. Choix validé : **date de lancement**, sans suppression (règle « aucune donnée financière supprimée », grand livre immuable).
- Migration `20261126160000_stats_since.sql` : appliquée à la base de test, essayée en production dans une transaction annulée, puis appliquée.
- Effets de la date :
  - le centre de contrôle et la page Revenus comptent les ventes à partir de la date ;
  - les totaux du portefeuille aussi ;
  - les mouvements antérieurs restent consultables dans l'onglet « Avant le lancement » du portefeuille et dans Transactions (admin).
- Réglage modifiable dans Paramètres → « Date de lancement des statistiques » (heure de Porto-Novo ; vide = tout compter).
- Production : date fixée au 26/11/2026 à 16:19 (Porto-Novo), action journalisée. Résultat : chiffre d'affaires 0, crédits vendus 0, totaux du portefeuille 0. Les 8 mouvements et les 6 recharges sont conservés.
