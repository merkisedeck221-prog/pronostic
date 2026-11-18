# CLAUDE.md — Mémoire et règles du projet

@AGENTS.md

## Le projet en 10 lignes

1. Application web de **pronostics football générés par IA**, vendus à l'unité contre des **crédits prépayés**.
2. Couverture MVP : Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 + compétitions internationales de sélections.
3. Les données (calendrier, scores, classements, dossiers) viennent d'**API-Football**, copiées dans Supabase par des tâches planifiées.
4. Chaque match à venir (fenêtre de 48 h) est analysé **une seule fois** par **OpenAI** (sortie JSON structurée, validée par Zod).
5. 4 marchés : `MATCH_RESULT` (1N2), `EXACT_SCORE`, `OVER_UNDER_2_5`, `BTTS`.
6. L'utilisateur débloque un marché ou le « match complet » ; le prix est configurable (`pricing_rules`, `app_settings`).
7. Recharge en XOF via une couche `PaymentProvider` ; fournisseur `mock` (simulé) dans le MVP.
8. Les pronostics sont résolus automatiquement après le match (`won` / `lost` / `void`) ; taux de réussite public.
9. Back-office complet (13 pages admin), journal d'audit de toutes les actions sensibles.
10. Web uniquement (mobile d'abord), interface en français ; Android/iOS plus tard sur le même backend.

**Référence unique : [docs/cahier-des-charges.md](docs/cahier-des-charges.md).** Le lire avant toute phase. Avancement : [docs/PROGRESS.md](docs/PROGRESS.md).

## Stack et conventions (section 9)

- **Next.js 16** (App Router, Turbopack, Cache Components activé) + **TypeScript strict** — aucun `any` non justifié. Next 16 a des changements cassants : consulter `node_modules/next/dist/docs/` (`cookies()`, `params` asynchrones, `middleware` → `proxy.ts`).
- **Tailwind CSS 4 + shadcn/ui** (style `base-nova`, primitives Base UI : pas d'`asChild`, utiliser `render` ou `buttonVariants()` sur un `<Link>`).
- **Supabase** : PostgreSQL, Auth, RLS sur **chaque** table, pg_cron + pg_net. Migrations SQL versionnées dans `supabase/migrations/`, données de départ dans `supabase/seed.sql`.
- **Zod partout** : variables d'environnement (`lib/env.ts`), entrées des Server Actions et routes, réponses d'OpenAI et d'API-Football.
- Lecture des données dans les **composants serveur** ; écritures via **Server Actions** ou **fonctions SQL**.
- Trois clients Supabase (`lib/supabase/`) : `client.ts` (navigateur), `server.ts` (session utilisateur), `admin.ts` (clé secrète, `server-only`, uniquement tâches planifiées et webhooks).
- **Interface en français ; code, tables, colonnes, noms de fichiers techniques en anglais.** URL des pages en français.
- **Heures stockées en UTC**, affichées dans le fuseau de l'utilisateur, par défaut **`Africa/Porto-Novo`** (`DEFAULT_TIMEZONE`).
- 1 crédit = 1 entier. Pas de décimales.
- Types TypeScript générés depuis Supabase dans `types/database.ts`, régénérés après **chaque** migration. Les clients Supabase sont typés avec `Database`.
- Toute nouvelle table : RLS activée + politiques explicites + déclencheur `set_updated_at` ; ajouter un test dans `tests/security/` pour toute règle d'accès sensible.
- Tests : **Vitest** pour la logique métier (prix, résolution, validation IA, paiement), **Playwright** pour le parcours « inscription → recharge → déblocage ».

## Règles de sécurité NON NÉGOCIABLES (section 11)

1. **Un pronostic n'est jamais lisible sans déblocage**, même en interrogeant directement la base avec la clé publique. Aucune politique RLS de lecture sur `predictions`, `prediction_analyses`, `match_contexts` pour les utilisateurs : seul `get_fixture_predictions()` renvoie le contenu débloqué (ou d'un match terminé si `reveal_after_match`). La partie gratuite ne révèle jamais une sélection ni une explication.
2. **Aucune écriture directe sur `wallets`, `credit_transactions` ou `unlocks`** — ni par RLS, ni depuis le code applicatif. Tout passe par les fonctions SQL `SECURITY DEFINER` (`unlock_prediction`, `apply_topup`, `admin_adjust_balance`, `refund_fixture`…), avec `SELECT … FOR UPDATE` sur le portefeuille et `CHECK (balance >= 0)`.
3. **Clés secrètes uniquement côté serveur** (`SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`) : `import "server-only"` dans tout module qui les utilise ; jamais de préfixe `NEXT_PUBLIC_`.
4. **Le prix est toujours calculé côté serveur** (fonction SQL) au moment du déblocage, jamais reçu du navigateur.
5. Les fonctions SQL appelables par un utilisateur s'appuient sur `auth.uid()` et **n'acceptent jamais d'identifiant d'utilisateur** en paramètre.
6. `/api/cron/*` refuse toute requête sans `Authorization: Bearer <CRON_SECRET>` ; le webhook de paiement vérifie la signature.
7. Pages et actions admin : vérification du rôle `admin` **côté serveur**. Aucun utilisateur ne peut se donner le rôle `admin`.
8. Jamais de mise en cache serveur d'un contenu débloqué qui pourrait être servi à un autre utilisateur.
9. Aucun secret commité : `.env*` est ignoré par Git (sauf `.env.example`, sans valeurs).

## Authentification (phase 3)

- `proxy.ts` (ancien middleware) rafraîchit la session Supabase à chaque requête et pose l'en-tête `x-pathname` ; il ne protège rien lui-même.
- Protection CÔTÉ SERVEUR dans `lib/auth/session.ts` : `getCurrentUser()`, `requireUser()` (redirection `/connexion?next=…`, `BannedAccountError` si suspendu), `requireAdmin()` (`is_admin()` en SQL, sinon `notFound()`). Toute page privée, Server Action ou route handler doit appeler l'un d'eux, même si la mise en page le fait déjà.
- Formulaires : schéma Zod partagé (`lib/auth/schemas.ts`) validé dans le navigateur (`useZodForm`) **et** dans la Server Action (`validateForm`). Messages en français.
- `next` après connexion : toujours passer par `safeNextPath()` (pas de redirection ouverte).
- Cache Components est **désactivé** : les contrôles d'accès doivent bloquer le rendu (vrais 307/404) et aucun contenu utilisateur n'est mis en cache côté serveur.

## Synchronisation API-Football (phase 4)

- **Quota** : forfait gratuit = 100 requêtes/jour. Tout appel passe par `ApiFootballClient` (garde-fou `API_FOOTBALL_DAILY_BUDGET` basé sur `sync_runs.api_calls`). Les tests unitaires utilisent **uniquement** les réponses enregistrées de `tests/fixtures/api-football/`, jamais l'API réelle.
- Les pages ne contactent jamais API-Football : elles lisent la base.
- Tâches dans `lib/sync/` (une fonction par tâche, idempotente, journalisée dans `sync_runs`), exposées par `/api/cron/[job]` (Bearer `CRON_SECRET`, comparaison en temps constant) et planifiées par Supabase Cron (secrets dans Vault). Détails : [docs/sync.md](docs/sync.md).
- Scripts manuels : `npm run discover:leagues`, `npm run sync -- <tâches>` (tsx, condition `react-server` pour `server-only`).

## Moteur IA (phase 6)

- Pipeline `lib/ai/` : dossier (`match_contexts.summary`, format section 8) → OpenAI (sortie structurée stricte) → `validate.ts` → `save_ai_generation()` (SQL, une transaction, serveur uniquement). Détails : [docs/ai.md](docs/ai.md).
- Le schéma Zod `lib/ai/schema.ts` est la **source unique** du format de sortie (JSON Schema strict dérivé).
- Tout changement de comportement du prompt = **nouvelle version** (`lib/ai/prompts/v2.ts`, `PROMPT_VERSION`), jamais une modification silencieuse de v1.
- Jamais de régénération automatique d'un match qui a des pronostics ; régénération admin refusée dès qu'il existe un déblocage (RG-F5-6).
- Les tests n'appellent jamais OpenAI : client simulé.

## Crédits et déblocage (phase 7)

- Fonctions SQL : `get_unlock_price`, `unlock_prediction`, `get_fixture_predictions`, `admin_adjust_balance` (détails : [docs/database.md](docs/database.md)). Erreurs métier renvoyées en JSON `{ ok:false, code, message }`, jamais en exception.
- `lib/credits/` : schémas Zod des réponses, `parse.ts` (traduction pure), `errors.ts` (messages français), `queries.ts` (lectures, session utilisateur), `actions.ts` (Server Actions `unlockPredictionAction`, `adminAdjustBalanceAction`). La Server Action ne reçoit **que** `fixtureId` et `marketCode` (null = match complet) : jamais de prix.
- Fiche match : `components/predictions/` ; après un déblocage, `router.refresh()` recharge la carte et le solde de l'en-tête depuis le serveur.
- Tests d'intégration `tests/credits/` : `npm run test:credits` (mêmes variables que `test:security`, projet DEV uniquement ; lancés en CI).

## Recharge (phase 8)

- `lib/payments/` : interface `PaymentProvider` (`types.ts`), registre (`index.ts`, `PAYMENT_PROVIDER`), fournisseur `mock` (HMAC, secret `PAYMENT_MOCK_SECRET` ou dérivé de `CRON_SECRET`), traitement commun des webhooks (`webhook.ts`). Ajouter un fournisseur : [lib/payments/README.md](lib/payments/README.md).
- SQL : `create_topup` (utilisateur, montants lus en base) et `apply_topup` (`service_role` uniquement, idempotent). Seul un webhook **vérifié** crédite, jamais l'URL de retour.
- Le mock est refusé en production si un autre fournisseur est configuré (RG-F6-3) ; bandeau « Paiement de test » partout où il sert.
- Tests d'intégration `tests/payments/` : `npm run test:payments` (projet DEV, lancés en CI).

## Résolution et suivi (phase 9)

- Règles de résolution : `lib/settle/rules.ts` (pures, couverture 100 %) et `public.settle_outcome` (SQL) ; **toute modification se fait dans les deux** et dans `tests/fixtures/settlement-cases.json` (test croisé). Score = `ft_home` / `ft_away` (temps réglementaire), jamais `goals_*`.
- `settle_fixture`, `refund_fixture` : `service_role` uniquement, idempotentes ; appelées par la tâche `settle-predictions` (`lib/sync/jobs-settle.ts`, sans appel API-Football).
- Pages : `/mes-pronostics` (`get_my_predictions`), `/performances` publique (`get_performance_stats`), tableau de bord complet.
- Tests d'intégration `tests/settlement/` : `npm run test:settlement` (projet DEV, lancés en CI).

## Administration (phase 10)

- Pages `app/admin/*` : `requireAdmin()` dans la mise en page **et** dans chaque page ; barre latérale `components/admin/nav.ts` (13 entrées).
- Server Actions `lib/admin/actions/*.ts` : signature `(prev, formData) => AdminActionState`, `requireAdmin()` en première ligne, Zod, puis fonction SQL `admin_*` (journalisée) ou écriture par la RLS admin suivie de `logAdminAction()`. Formulaires : `components/admin/action-form.tsx`.
- Le test `lib/admin/actions/actions.test.ts` découvre **automatiquement** toutes les actions exportées et vérifie qu'elles refusent un non-admin avant tout accès aux données : toute nouvelle action doit commencer par `requireAdmin()`.
- Export CSV : `app/admin/transactions/export/route.ts` (mêmes filtres que la page, `lib/admin/transactions.ts`).
- Tests d'intégration `tests/admin/` : `npm run test:admin`.

## Recette et sécurité (phase 11)

- Rapports : [docs/RECETTE.md](docs/RECETTE.md) (conformité) et [docs/SECURITE.md](docs/SECURITE.md) (audit) : les tenir à jour à chaque nouvelle règle ou correction.
- Attaques rejouées en CI : `tests/security/audit.test.ts` (clé publique seule). Parcours Playwright : `tests/e2e/` (`npm run test:e2e`, application compilée + Supabase DEV).
- En-têtes HTTP de sécurité dans `next.config.ts`. Pages `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` en français.
- `loading.tsx` uniquement sur des segments dont la page n'appelle pas `notFound()` (sinon le 404 devient un 200).

## Fonctionnalités d'abord, pas de design

Interface sobre avec les composants shadcn/ui par défaut. **Aucun travail de design (couleurs, illustrations, animations, landing page) avant la phase dédiée**, qui se fera à partir des inspirations fournies par le porteur du projet.

## Commandes utiles

```bash
npm run dev            # serveur de développement (http://localhost:3000)
npm run build          # build de production
npm run lint           # ESLint
npm run typecheck      # next typegen + tsc --noEmit
npm test               # Vitest (une passe)
npm run test:coverage  # Vitest avec couverture
npm run test:security  # tests de sécurité RLS contre Supabase DEV (clé secrète requise, voir docs/database.md)
npm run test:credits   # tests d'intégration crédits/déblocage contre Supabase DEV (clé secrète requise)
npm run test:payments  # tests d'intégration recharges contre Supabase DEV (clé secrète requise)
npm run test:settlement  # tests d'intégration résolution/remboursements/performances contre Supabase DEV
npm run test:admin     # tests d'intégration administration contre Supabase DEV
npm run test:e2e       # Playwright : parcours utilisateur et admin (après npm run build, Supabase DEV)
npm run discover:leagues   # découverte des compétitions API-Football (~13 appels, écrit docs/leagues.md)
npm run sync -- sync-fixtures   # lancer une ou plusieurs tâches de synchronisation à la main
npm run ai:sample          # génération réelle sur 3 matchs (contrôle qualité du prompt)

# Types Supabase (après CHAQUE migration) — projet dev par défaut, sinon SUPABASE_PROJECT_REF
npm run db:types
# Application des migrations sur le projet lié
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --include-seed
```

Projet Supabase de développement : `pronostics` (réf. `pgeytactmugqskdzsxnw`). Détails du schéma et des politiques : [docs/database.md](docs/database.md).

Dans une session Claude Code avec l'intégration Supabase, on peut aussi utiliser `apply_migration` et `generate_typescript_types` — en gardant **toujours** le fichier SQL correspondant dans `supabase/migrations/`.

## PROCÉDURE DE FIN DE PHASE

À appliquer à la fin de **chaque** phase :

a. Lancer `npm run lint`, `npm run typecheck`, `npm test` et `npm run build` ; corriger jusqu'à ce que tout passe.
b. Relire le diff complet pour vérifier qu'aucun secret n'est commité (`.env.local`, clés, jetons, URL avec identifiants).
c. Commiter sur une branche `phase-N-nom` (ex. `phase-2-database`) avec des messages clairs.
d. Pousser et attendre le déploiement de prévisualisation Vercel (vérifier qu'il est `READY`).
e. Mettre à jour `docs/PROGRESS.md` : ce qui a été fait, décisions prises, écarts avec le cahier des charges, dettes techniques, prochaine phase.
f. Donner au porteur du projet un résumé en français avec l'URL de prévisualisation et une liste numérotée de vérifications manuelles à faire.
g. **Ne pas fusionner dans `main` sans son accord explicite.**

## Règle de conflit

Si une consigne d'un prompt contredit le cahier des charges, **s'arrêter et demander** au porteur du projet avant d'agir.
