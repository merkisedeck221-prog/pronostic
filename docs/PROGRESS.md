# Journal d'avancement

Tenu par Claude Code. Référence : [cahier-des-charges.md](cahier-des-charges.md), section 12.

## Tableau des phases

| Phase | Livrable | Critère de validation | Statut |
|---|---|---|---|
| 0. Préparation (porteur du projet) | Comptes et clés : GitHub, Vercel, Supabase, API-Football, OpenAI | Toutes les clés sont réunies et Claude Code accède à GitHub, Vercel et Supabase | En cours |
| 1. Initialisation | Projet Next.js, `CLAUDE.md`, dépôt GitHub, déploiement Vercel | L'URL Vercel affiche l'accueil provisoire | En validation |
| 2. Base de données | Les 20 tables, la RLS, les fonctions SQL, les données de départ | Les migrations passent ; les tests de sécurité SQL sont au vert | À faire |
| 3. Authentification | Inscription, connexion, mot de passe, profil, rôles | Un compte se crée avec profil et portefeuille ; les pages privées et admin sont protégées | À faire |
| 4. Synchronisation | Client API-Football, tâches `sync-*`, Supabase Cron, journal | Les matchs des 14 prochains jours apparaissent en base ; le quota est respecté | À faire |
| 5. Catalogue | Compétitions, matchs à venir, fiche match gratuite | Navigation complète jusqu'à la fiche d'un match réel | À faire |
| 6. Moteur IA | Dossiers, prompt v1, appel OpenAI, validation, stockage | Les matchs à moins de 48 h ont leurs 4 pronostics, cohérents et en français | À faire |
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

### Blocage en cours

- **Vercel** : la création du projet depuis Claude Code a été refusée (403, droits insuffisants de l'intégration Vercel sur l'équipe `merkisedeck`). Le porteur du projet doit importer le dépôt lui-même dans Vercel (*Add New → Project → Import* `merkisedeck221-prog/pronostic`, framework Next.js, réglages par défaut). Le build ne nécessite aucune variable pour l'instant. Le critère de validation de la phase 1 (« l'URL Vercel affiche l'accueil provisoire ») sera vérifié dès que ce sera fait.

### Dettes techniques

- `npm audit` signale des vulnérabilités « high » dans des dépendances **de développement** d'ESLint (`picomatch` via `eslint-config-next`). Aucun impact en production ; à revoir quand `eslint-config-next` publiera un correctif (ne pas lancer `npm audit fix --force`, qui rétrograde Next).
- Pas encore de types Supabase générés (`types/database.ts`) : à faire en phase 2 ; les clients Supabase seront alors typés avec `Database`.
- Pas encore de `proxy.ts` (rafraîchissement de session Supabase) : phase 3.

### Prochaine phase

**Phase 2 — Base de données** : les 20 tables, la RLS, les fonctions SQL `SECURITY DEFINER`, `seed.sql`, et les tests de sécurité SQL. Prérequis : projet Supabase « dev » accessible.
