# Audit de sécurité — phase 11 (recette)

Point de vue : un auditeur qui n'a pas écrit le code et cherche activement les failles.
Date : 18 novembre 2026. Base : projet Supabase de **développement** (`pgeytactmugqskdzsxnw`).

**Méthodes**

- **Requêtes réelles** sur la base DEV, en se faisant passer pour les rôles de l'API : `set local role anon` ou `authenticated` et `request.jwt.claims` (utilisateur précis). Chaque scénario s'exécute dans une transaction annulée à la fin, donc rien ne reste en base. Les résultats sont recopiés ci-dessous.
- **Tests automatisés** qui rejouent ces attaques avec la vraie clé publique en CI : `tests/security/audit.test.ts` (nouveau), `rls.test.ts`, `admin-access.test.ts`, `catalog.test.ts`, `tests/credits`, `tests/payments`, `tests/settlement`, `tests/admin`, et `lib/admin/actions/actions.test.ts` pour les Server Actions.
- **Requêtes HTTP** sur l'application compilée (`next start`) : routes cron, webhook, en-têtes, pages admin.
- **Analyse du bundle client** (`.next/static`) après un build où les variables secrètes contiennent des marqueurs reconnaissables.
- **`npm audit`**.

Légende des résultats : ✅ conforme · 🔧 faille trouvée et corrigée · ⚠️ point ouvert ou accepté.

## 1. Lecture avec la clé publique

Requête réelle (transaction annulée). Données de test : une victime avec 10 crédits, un déblocage et une recharge ; un match avec pronostic, analyse, dossier IA, génération IA, journal de tâches, entrée d'audit et révision.

| Table | Anonyme | Utilisateur connecté (autre compte) | Résultat |
|---|---|---|---|
| `predictions` | 0 ligne | 0 ligne | ✅ |
| `prediction_analyses` | 0 | 0 | ✅ |
| `match_contexts` | 0 | 0 | ✅ |
| `ai_generation_runs` | 0 | 0 | ✅ |
| `admin_audit_log` | 0 | 0 | ✅ |
| `sync_runs` | 0 | 0 | ✅ |
| `prediction_revisions` | 0 | 0 | ✅ |
| `profiles` de la victime | 0 | 0 | ✅ |
| `wallets` de la victime | 0 | 0 | ✅ |
| `credit_transactions` de la victime | 0 | 0 | ✅ |
| `unlocks` de la victime | 0 | 0 | ✅ |
| `topups` de la victime | 0 | 0 | ✅ |

Tests automatisés : `tests/security/audit.test.ts` (« lecture avec la clé publique »), `tests/security/rls.test.ts`, `tests/credits/unlock.test.ts` (test 7).

## 2. Écriture avec la clé publique (utilisateur connecté)

| Tentative | Résultat | Statut |
|---|---|---|
| `update wallets set balance = 9999` (son portefeuille) | refusé (42501) | ✅ |
| `insert credit_transactions` (bonus de 999) | refusé (42501) | ✅ |
| `delete credit_transactions` | refusé (42501) | ✅ |
| `insert unlocks` (déblocage gratuit) | refusé (42501) | ✅ |
| `insert topups` (recharge `succeeded` à 1 XOF) | refusé (42501) | ✅ |
| `update` / `insert pricing_rules` | 0 ligne / refusé | ✅ |
| `update app_settings` (mode maintenance) | 0 ligne | ✅ |
| `update credit_packs`, `markets`, `fixtures`, `predictions` | 0 ligne | ✅ |
| `insert` / `delete admin_audit_log` | refusé (42501) | ✅ |
| son `role` → `admin` | refusé (42501) | ✅ |
| son `is_banned` (compte suspendu qui se réactive) | refusé (42501) | ✅ |
| son `terms_accepted_at` | refusé (42501) | ✅ |
| profil d'un autre utilisateur | 0 ligne | ✅ |
| supprimer son profil | 0 ligne | ✅ |
| **son `created_at` (antidater l'inscription)** | **accepté (1 ligne)** avant correction, refusé (42501) après | 🔧 |
| **son `timezone` = texte libre (`Mars/Olympus`, 100 caractères)** | **accepté** avant correction, refusé (23514) après | 🔧 |
| `display_name`, `phone`, `country` trop longs | refusés (23514, contraintes existantes) | ✅ |

**Corrections** (migration `20261118063349_qa_hardening.sql`) :
- `created_at` est désormais protégé par le déclencheur `protect_profile_columns` pour les rôles `anon` et `authenticated`. Avant, un utilisateur pouvait fausser les statistiques admin, par exemple les inscrits sur 7 jours.
- Une contrainte `profiles_timezone_format` impose la forme d'un identifiant IANA de 64 caractères au plus.

Vérification après correction : `created_at` → refusé (42501), fuseau fantaisiste ou trop long → refusé (23514), mise à jour légitime (`Europe/Paris` et nom) → 1 ligne. Le test automatisé correspondant est `audit.test.ts` (« role, is_banned, terms_accepted_at et created_at… »).

## 3. Fonctions SQL avec des paramètres hostiles

**Inventaire des droits d'exécution** (requête réelle sur `pg_proc` avec `has_function_privilege`) :
- **Exécutables par `anon`** : seules les fonctions publiques par conception, à savoir `fixtures_with_prediction_flag`, `get_fixture_public_context`, `get_fixture_predictions`, `get_performance_stats`, `is_fixture_visible` et `is_admin`.
- **Fonctions serveur** : `apply_topup`, `settle_fixture`, `refund_fixture`, `save_ai_generation`, `settle_outcome` et `handle_new_user` ne sont exécutables **ni** par `anon` **ni** par `authenticated`.
- **Schéma `private`** : aucune fonction n'est exécutable par l'API.
- 🔧 `public.rls_auto_enable()`, une fonction fournie par Supabase, était exécutable par `anon` et `authenticated`. Ce droit est retiré, puisqu'elle ne sert qu'en déclencheur d'événement.

| Appel (utilisateur connecté, 0 crédit) | Résultat | Statut |
|---|---|---|
| `unlock_prediction(match, 'CORNERS')` (marché inexistant) | `NOT_AVAILABLE` | ✅ |
| `unlock_prediction(match, 'BTTS''; drop table x;--')` | `NOT_AVAILABLE` (paramètre lié, aucune injection) | ✅ |
| `unlock_prediction(-1, null)` (match inexistant) | `NOT_AVAILABLE` | ✅ |
| `unlock_prediction` sans solde | `INSUFFICIENT_BALANCE` | ✅ |
| `unlock_prediction` sur un match commencé | `MATCH_STARTED` | ✅ |
| `unlock_prediction` / `create_topup` par un compte suspendu | `BANNED` | ✅ |
| `get_unlock_price(-5, 'BTTS')` | `NOT_AVAILABLE` | ✅ |
| `create_topup(-1, 'mock')`, fournisseur `paypal` | `NOT_AVAILABLE`, `INVALID_INPUT` | ✅ |
| `create_topup` avec `p_amount_xof` ajouté | fonction introuvable, rien n'est créé | ✅ |
| `admin_adjust_balance(soi-même, 1000)` / montant négatif | `FORBIDDEN` | ✅ |
| `admin_get_user(autre utilisateur)` et les 13 autres `admin_*` | `FORBIDDEN` | ✅ |
| `apply_topup`, `settle_fixture`, `refund_fixture`, `save_ai_generation`, `settle_outcome`, `private.invoke_sync_job`, `private.compute_price` | refusés (42501) | ✅ |
| `get_my_predictions` (attaquant) | `[]` | ✅ |
| `get_fixture_predictions` (attaquant, match débloqué par la victime) | aucun contenu verrouillé | ✅ |

Aucune fonction destinée aux utilisateurs n'accepte d'identifiant d'utilisateur. Tests automatisés : `audit.test.ts` (« fonctions SQL avec des paramètres hostiles »), `tests/credits`, `tests/payments` (test 5), `tests/admin`.

## 4. Routes `/api/cron/*` et webhook de paiement

Requêtes HTTP sur `next start` (le 500 « bon secret » vient de la base injoignable depuis la machine d'audit : l'authentification est passée).

| Requête | Code | Statut |
|---|---|---|
| `GET /api/cron/sync-results` sans en-tête | 401 | ✅ |
| `POST` sans en-tête | 401 | ✅ |
| `Authorization: Bearer <faux secret>` | 401 | ✅ |
| secret sans `Bearer` | 401 | ✅ |
| bon secret + tâche inconnue (`drop-database`) | 404 | ✅ |
| bon secret | 500 ici (base injoignable), donc authentification acceptée | ✅ |
| webhook `mock` sans signature | 401 | ✅ |
| signature fausse | 401 | ✅ |
| signature valide mais **rejouée** 1 h plus tard | 401 (fenêtre de 5 min) | ✅ |
| signée avec un autre secret | 401 | ✅ |
| fournisseur inconnu (`/webhook/stripe`) | 404 | ✅ |
| doublon d'une notification valide | 200, aucun nouveau crédit | ✅ (`tests/payments` 2) |

La comparaison du secret cron se fait en temps constant (`lib/sync/cron-auth.ts`, testée). La signature du mock est un HMAC-SHA256 horodaté comparé en temps constant (`lib/payments/payments.test.ts`).

## 5. Server Actions d'administration avec un compte non admin

- `lib/admin/actions/actions.test.ts` **découvre automatiquement** toutes les Server Actions admin exportées et les appelle avec un formulaire valide. Il couvre les 24 actions de `lib/admin/actions/*` plus `adminAdjustBalanceAction`, `runSyncJobAction` et `regeneratePredictions`. `requireAdmin()` est simulé comme pour un non-admin. Chaque action rejette avant tout accès à Supabase, aux tâches ou à l'IA ; tout accès ferait échouer le test.
- Côté base, la même attaque directe par l'API avec la clé publique est refusée (`FORBIDDEN`), même si la Server Action était contournée (`tests/admin`).
- Sans session, les 15 routes `/admin/*`, export CSV compris, répondent **404** (vérifié par HTTP).

## 6. Bundle client

Build lancé avec des marqueurs (`QA_MARKER_…`) dans `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `OPENAI_API_KEY`, `CRON_SECRET` et `PAYMENT_MOCK_SECRET`.

| Recherche dans `.next/static` (34 fichiers) | Résultat |
|---|---|
| marqueurs des secrets | aucun ✅ |
| noms des variables secrètes | aucun ✅ |
| `createAdminClient`, `auth.admin`, `service_role`, `admin_adjust_balance`, `apply_topup` | aucun ✅ |
| hôtes `api-sports.io`, `api.openai.com`, en-tête `x-apisports-key` | aucun ✅ |
| marqueurs dans les pages HTML prérendues | aucun ✅ |

`lib/supabase/admin.ts`, `lib/env.ts` (côté serveur), `lib/sync`, `lib/ai`, `lib/payments` et les autres modules qui utilisent des secrets importent tous `server-only`, ce qui ferait échouer le build en cas d'import côté client.

## 7. Mise en cache

| Page | `Cache-Control` | Statut |
|---|---|---|
| `/matchs/[id]` (pronostics) | `private, no-cache, no-store, max-age=0, must-revalidate` | ✅ |
| `/mes-pronostics` | idem | ✅ |
| `/performances` | idem | ✅ |
| `/cgu` (statique, aucun contenu utilisateur) | `s-maxage=31536000` | ✅ |

Cache Components est désactivé. Toutes les pages qui lisent la session sont rendues à la demande (ƒ dans la sortie du build) et aucun `fetch` n'est mis en cache.

## 8. Dépendances (`npm audit`)

| Avant | Après |
|---|---|
| 23 vulnérabilités (21 hautes, 2 modérées), dont **10 dans les dépendances de production** | **0 en production** (`npm audit --omit=dev`) ; 22 hautes dans les outils de développement |

Corrections :
- **`shadcn` passé en `devDependencies`.** C'est une CLI, et seul son fichier CSS est importé au build. Les dépendances de développement sont installées sur Vercel au moment du build.
- **`minimatch` forcé en version 11** pour `@ts-morph/common` (`overrides`), ce qui supprime la vulnérabilité modérée.

⚠️ **Reste ouvert : `picomatch` (GHSA-fc5q-39xc-vjpf, ReDoS).** Aucune version corrigée n'est publiée, et la plus récente (4.0.7) est vulnérable. On le trouve uniquement dans les outils de développement et de build (Vite/Vitest, ESLint, CLI shadcn). Ces outils ne reçoivent jamais de motif fourni par un utilisateur, et rien de tout cela ne s'exécute dans l'application déployée. À mettre à jour dès qu'un correctif paraît.

## 9. Autres contrôles et durcissement

| Point | Résultat |
|---|---|
| En-têtes HTTP | 🔧 ajoutés (`next.config.ts`) : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` ; `X-Powered-By` retiré |
| Redirections ouvertes (`next`, `retour`) | ✅ toujours via `safeNextPath()` (testé) |
| Injection CSV (export admin) | ✅ cellules commençant par `= + - @` neutralisées (testé) |
| `dangerouslySetInnerHTML` | ✅ aucun usage |
| Montants envoyés par le navigateur | ✅ ignorés (Server Actions et fonctions SQL ne les acceptent pas ; testé) |
| Secrets commités | ✅ `.env*` ignoré, diff relu à chaque phase |
| Conseiller de sécurité Supabase | ✅ restent uniquement les fonctions `SECURITY DEFINER` exposées **volontairement** (contrôle `auth.uid()` / `is_admin()` interne) |

## 9 bis. Crédits v2, lot 1 (23/11/2026)

| Point | Résultat |
|---|---|
| Journal comptable immuable | 🔧 `credit_transactions` : UPDATE et DELETE refusés à **tous les rôles**, y compris la clé serveur (déclencheur `protect_ledger` + droits retirés, TRUNCATE compris). Seule exception : la cascade de suppression d'un compte. Vérifié en SQL sur la base de test ; test `audit.test.ts` « journal comptable immuable » |
| Notifications | ✅ écrites uniquement par des déclencheurs `SECURITY DEFINER` ; lecture RLS de ses seules notifications ; aucune écriture avec la clé publique (testé) ; lien interne uniquement (contrainte SQL + `safeNotificationLink`, testé) ; une notification ne peut jamais faire échouer une opération financière (exception capturée) |
| Reçus de paiement | ✅ `/portefeuille/recus/[id]` : filtre `user_id` **et** RLS ; reçu d'un autre compte, inexistant ou identifiant invalide → **404** (testé dans un navigateur avec deux comptes) ; jamais mis en cache |
| Marquer comme lues | ✅ `mark_notifications_read()` sans identifiant d'utilisateur (auth.uid()), 200 identifiants au plus |
| Résumé du portefeuille | ✅ `get_my_wallet_summary()` en `SECURITY INVOKER` (la RLS s'applique) |

## 9 ter. Crédits v2, lot 2 (24/11/2026)

| Point | Résultat |
|---|---|
| Codes promo | ✅ jamais lisibles par un utilisateur (RLS admin) ; bonus **calculé en base** (`start_topup`), jamais reçu du navigateur ; verrou `FOR UPDATE` sur le code (pas de dépassement de `max_uses` en parallèle) ; limite par utilisateur ; **10 codes refusés par heure au plus** (anti-énumération). Vérifié en SQL (code expiré, réutilisé, deviné, autre compte) et dans le navigateur |
| Packs datés et moyens de paiement | ✅ période de l'offre et moyen de paiement désactivé **revérifiés par la base**, y compris par l'ancienne fonction `create_topup` (testé) |
| Annulation d'une transaction (admin) | ✅ `admin_reverse_transaction` : admin uniquement (FORBIDDEN sinon, testé), motif obligatoire, **une seule fois** (index unique + contrôle), solde jamais négatif, journal d'audit ; un déblocage remboursé n'est pas remboursé une 2e fois si le match est annulé (testé) |
| Revenus | ✅ `admin_revenue` admin uniquement, période bornée à 2 ans |
| Nouvelles Server Actions admin | ✅ `requireAdmin()` en première ligne ; test automatique `lib/admin/actions/actions.test.ts` étendu (promotions, moyens de paiement, annulation) |

## 9 quater. Crédits v2, lot 3 : génération à la demande (24/11/2026)

| Point | Résultat |
|---|---|
| Prix | ✅ calculé en base (`request_generation` → `compute_price`) ; la Server Action ne reçoit que le match, le type d'analyse et une clé d'idempotence |
| Double débit / rejeu | ✅ clé d'idempotence unique par utilisateur ; une seule demande active par utilisateur, match et type (index unique) ; accès déjà acquis refusé ; 5 demandes par 10 minutes au plus ; verrou du portefeuille (testé en SQL et dans le navigateur) |
| Réservation | ✅ débit immédiat dans le journal immuable (`generation_hold`), rendu par `generation_release` si l'IA échoue, si la limite quotidienne est atteinte ou après 10 minutes (Cron) ; jamais de débit sans résultat (testé) |
| Mutualisation | ✅ une seule génération par match (verrou + statut « running ») ; les demandes suivantes attendent le résultat partagé, sans nouvel appel à l'IA (testé) |
| Relecture du 24/11 | 🔧 2 défauts corrigés (migration `generation_hardening`) : double remboursement possible si l'admin annulait une réservation d'analyse en cours ou déjà rendue ; accès donné sur un match annulé pendant l'analyse. Les deux cas sont rejoués en SQL |
| Fonctions serveur | ✅ `start_generation`, `complete_generation`, `fail_generation`, `expire_generation_requests` : `service_role` uniquement (refus testé pour un utilisateur) ; demande lue avec filtre `user_id` + RLS |

## 10. Points ouverts et risques acceptés

1. ⚠️ **`picomatch`** (outils de développement uniquement) : voir § 8.
2. ⚠️ **Création de comptes en masse** : l'inscription est ouverte avec la clé publique, comme dans toute application Supabase. Les crédits de bienvenue valent 0 par défaut. S'ils sont activés, prévoir un CAPTCHA (Supabase Auth le propose) et la confirmation d'e-mail obligatoire.
3. ⚠️ **Ces tests n'ont pas tourné en CI** : les tests d'intégration et de bout en bout s'exécutent en CI dès que les secrets `SUPABASE_DEV_*` sont ajoutés au dépôt. Les vérifications de ce document ont été faites ici par requêtes réelles.
4. ⚠️ **Réglages Supabase Auth à vérifier avant la production** : protection contre les mots de passe divulgués, confirmation d'e-mail, limites de débit.
