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
