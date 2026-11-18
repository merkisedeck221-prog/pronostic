# Pronostics IA

Application web de pronostics football générés par IA (OpenAI), vendus à l'unité contre des crédits prépayés (XOF). Données sportives : API-Football. Back-end : Supabase (PostgreSQL, Auth, RLS, Cron). Front-end : Next.js 16 sur Vercel. Interface en français, mobile d'abord.

| Document | Contenu |
|---|---|
| [docs/cahier-des-charges.md](docs/cahier-des-charges.md) | Spécifications (référence unique) |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Avancement phase par phase, décisions, dettes techniques |
| [docs/RECETTE.md](docs/RECETTE.md) | Conformité règle par règle et page par page |
| [docs/SECURITE.md](docs/SECURITE.md) | Audit de sécurité (tests, résultats, corrections) |
| [docs/database.md](docs/database.md) | Schéma, RLS, fonctions SQL, désigner un administrateur |
| [docs/sync.md](docs/sync.md) | Synchronisation API-Football, Supabase Cron, Vault |
| [docs/ai.md](docs/ai.md) | Moteur de pronostic IA |
| [lib/payments/README.md](lib/payments/README.md) | Couche de paiement, ajout de FedaPay / KkiaPay |
| [CLAUDE.md](CLAUDE.md) | Règles du projet pour Claude Code |

## Installation locale

Prérequis : Node.js 22, un projet Supabase de **développement**.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Renseignez `.env.local` (voir ci-dessous), puis lancez :

```bash
npm run dev
```

L'application tourne sur http://localhost:3000.

## Variables d'environnement

Toutes sont validées par Zod (`lib/env.ts`). `.env.local` n'est jamais commité ; `.env.example` liste les variables sans valeur.

| Variable | Où | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + serveur | clé publique (anon / publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur** | clé secrète (tâches planifiées, webhooks) |
| `NEXT_PUBLIC_APP_URL` | client + serveur | URL publique (repli pour les liens d'e-mail) |
| `DEFAULT_TIMEZONE` | client + serveur | `Africa/Porto-Novo` par défaut |
| `API_FOOTBALL_KEY` | **serveur** | clé API-Football |
| `API_FOOTBALL_DAILY_BUDGET` | serveur | plafond quotidien d'appels (90 en forfait gratuit) |
| `OPENAI_API_KEY` | **serveur** | clé OpenAI |
| `OPENAI_MODEL` | serveur | modèle utilisé (obligatoire) |
| `AI_DAILY_GENERATION_LIMIT` | serveur | matchs analysés par jour (20 par défaut) |
| `CRON_SECRET` | **serveur** + Vault | protège `/api/cron/*` (32 caractères min.) |
| `ADMIN_EMAILS` | serveur | e-mails promus administrateurs à la connexion |
| `PAYMENT_PROVIDER` | serveur | `mock` dans le MVP |
| `PAYMENT_MOCK_SECRET` | **serveur** | facultatif : secret HMAC du paiement simulé (sinon dérivé de `CRON_SECRET`) |

## Commandes

```bash
npm run dev            # serveur de développement
npm run build          # build de production
npm run start          # serveur de production (après build)
npm run lint           # ESLint
npm run typecheck      # next typegen + tsc --noEmit
npm test               # tests unitaires (Vitest)
npm run test:coverage  # tests unitaires avec couverture
```

Tests d'intégration et de bout en bout, **contre le projet Supabase de développement uniquement** (clé secrète requise dans `.env.local` ; `npm run build` au préalable pour `test:security` et `test:e2e`) :

```bash
npm run test:security    # RLS, accès admin, catalogue, audit de sécurité
npm run test:credits     # déblocages (dont 5 appels simultanés)
npm run test:payments    # recharges et webhook
npm run test:settlement  # résolution, remboursements, performances
npm run test:admin       # fonctions d'administration
npm run test:e2e         # Playwright : parcours utilisateur et administrateur
```

Scripts manuels (consomment le quota API-Football / OpenAI) :

```bash
npm run discover:leagues          # identifiants des compétitions (~13 appels)
npm run sync -- sync-fixtures     # une ou plusieurs tâches de synchronisation
npm run ai:sample                 # génération réelle sur 3 matchs
```

## Base de données

Migrations versionnées dans `supabase/migrations/`, données de départ dans `supabase/seed.sql`.

```bash
npx supabase link --project-ref <PROJECT_REF>
```

```bash
npx supabase db push --include-seed
```

Après chaque migration, régénérez les types :

```bash
npm run db:types
```

Pour désigner un administrateur, renseignez `ADMIN_EMAILS` ou suivez la procédure de [docs/database.md](docs/database.md).

## Déploiement

1. **Vercel** : le dépôt GitHub est relié au projet Vercel. Chaque branche poussée produit un déploiement de prévisualisation ; `main` est déployée en production. Renseignez toutes les variables ci-dessus dans *Settings → Environment Variables*, pour **Production et Preview**.
2. **Supabase** : appliquez les migrations et le seed (voir plus haut). Dans *Authentication → URL Configuration*, ajoutez l'URL du site et les URL de redirection (`/auth/callback`).
3. **Tâches planifiées** : Supabase Cron appelle `/api/cron/<tâche>` avec `Authorization: Bearer <CRON_SECRET>`. Les secrets `app_url`, `cron_secret` et, si la protection Vercel est active, `vercel_bypass_secret` sont à déposer dans Vault. Procédure : [docs/sync.md](docs/sync.md).
4. **GitHub Actions** (`.github/workflows/ci.yml`) : lint, typecheck, tests unitaires et build à chaque push. Les tests d'intégration et Playwright demandent les secrets du dépôt `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY` et `SUPABASE_DEV_SERVICE_ROLE_KEY`, pointant vers le projet de **développement**.
5. **Contrôles avant la production** : voir les points ouverts de [docs/SECURITE.md](docs/SECURITE.md), en particulier les réglages Supabase Auth.

## Structure

```
app/                 pages (App Router) : (public), (app) connecté, admin, api (cron, webhook)
components/          composants d'interface (shadcn/ui), par domaine
lib/                 logique : auth, catalog, credits, payments, settle, admin, sync, ai, api-football
supabase/            migrations SQL et données de départ
tests/               intégration (security, credits, payments, settlement, admin), e2e (Playwright), réponses enregistrées
docs/                cahier des charges, avancement, recette, sécurité, base, synchro, IA
```
