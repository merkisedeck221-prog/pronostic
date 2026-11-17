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
| 7. Crédits et déblocage | Portefeuille, prix, déblocage par marché et par match | Les 5 tests obligatoires de la section 11 passent | À faire |
| 8. Recharge simulée | Packs, fournisseur `mock`, page de résultat | Une recharge simulée crédite le compte une seule fois | À faire |
| 9. Résolution et suivi | `settle-predictions`, remboursements, Mes pronostics, Performances | Un match terminé met à jour les statuts ; les taux affichés sont justes | À faire |
| 10. Administration | Les 13 pages admin et le journal d'audit | Toutes les actions de la section 4 fonctionnent et sont journalisées | À faire |
| 11. Recette | Tests automatisés, audit de sécurité, corrections | Le parcours complet est testé de bout en bout ; aucune faille connue | À faire |
| 12. Mise en production | Projet Supabase prod, variables Vercel, forfait API-Football Pro, domaine | L'application tourne en production avec de vraies données | À faire |

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
