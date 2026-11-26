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

## 9 quinquies. Crédits v2, lot 5 : historique (24/11/2026)

| Point | Résultat |
|---|---|
| Pronostic acheté non modifiable | 🔧 avant : rien n'empêchait techniquement de changer la sélection ou la probabilité d'un pronostic acheté (accès admin direct). Désormais refusé à tous les rôles (déclencheur) ; seuls le résultat, la visibilité et la correction historisée de l'explication restent permis. Testé en SQL (changement de sélection, de probabilité, déverrouillage, suppression : refusés) |
| Suivi admin des générations | ✅ `admin_generation_requests` : FORBIDDEN pour un utilisateur (testé) |

## 9 sexies. Crédits v2, lot B : corners, cartons, combiné (24/11/2026)

| Point | Résultat |
|---|---|
| Règles de résolution | ✅ TypeScript (`lib/settle/rules.ts`, couverture 100 %) et SQL (`settle_outcome_full`) : 99 cas partagés, 0 écart (vérifié sur la base de test) ; combiné invalide (1 seule sélection, plus de 3, marché répété ou non autorisé) = jamais résolu |
| Prolongation | ✅ corners / cartons d'un match AET ou PEN : `void` + remboursement (déblocage du marché en entier ; « match complet » au prorata du prix de base, arrondi au crédit supérieur) ; rejoué sans effet (testé) |
| Double remboursement | 🔧 avant : l'admin pouvait annuler la transaction d'un déblocage déjà remboursé par un match annulé (crédits rendus deux fois). Désormais `NOT_ELIGIBLE` (testé). `refund_fixture` et `admin_refund_fixture` ne rendent que ce qui reste payé après un remboursement partiel (testé : total rendu = total payé) |
| Nouvelle table `unlock_partial_refunds` | ✅ RLS, lecture de ses propres lignes uniquement, aucune écriture pour `anon` / `authenticated` (testé, ajouté à `tests/security/audit.test.ts`) |
| Nouvelles fonctions | ✅ `settle_combo`, `settle_outcome_full`, `settle_fixture` : `service_role` uniquement ; `private.refund_voided_market` inaccessible (schéma privé) — testé avec un compte utilisateur |
| Données externes | ✅ réponse `/fixtures/statistics` validée par Zod ; valeurs non entières ou hors 0–99 ignorées ; équipes rattachées par identifiant API |

## 9 septies. Contrôle général du 24/11/2026 (sécurité, bugs, rapidité)

| Point | Résultat |
|---|---|
| Politique de sécurité du contenu (CSP) | 🔧 absente avant ; ajoutée dans `next.config.ts` : connexions limitées au site et à Supabase, images limitées aux logos API-Football, aucun cadre (`frame-ancestors 'none'`), aucun plugin, formulaires vers le site seulement, `upgrade-insecure-requests`. `'unsafe-inline'` reste nécessaire pour les scripts de Next.js (pas de nonce). Parcours complet (14 pages utilisateur, 16 pages admin) : 0 blocage, 0 erreur de console |
| `Cross-Origin-Opener-Policy: same-origin` | 🔧 ajouté |
| Région du serveur | 🔧 fonctions Vercel à Washington (`iad1`) alors que la base est en Irlande (`eu-west-1`) : `vercel.json` les place à Dublin (`dub1`) |
| Tâches planifiées | ✅ `/api/cron/*` : 401 sans secret ou avec un faux secret (production) |
| Pages privées / admin | ✅ 307 vers la connexion sans session ; `/admin` : 404 pour un non-admin |
| Confirmation de l'e-mail à l'inscription | ⚠️ **désactivée** en production (`mailer_autoconfirm: true`) : n'importe qui peut s'inscrire avec l'adresse d'un autre. À réactiver dès qu'un SMTP est configuré (réglage Supabase, hors de portée des outils) |
| Protection des mots de passe piratés | ⚠️ désactivée (réglage Supabase, hors de portée des outils) |

## 9 octies. Packs fixes PRONEX, suppression des bonus (25/11/2026)

| Point | Résultat |
|---|---|
| Crédits attribués | ✅ `apply_topup` crédite exactement `topups.credits`, figé à la création par `start_topup` à partir du pack en base ; le navigateur n'envoie que l'identifiant du pack (montant, crédits, bonus, code promo ignorés : test `payments.test.ts`) |
| Double attribution | ✅ verrou `FOR UPDATE` sur la recharge + passage `pending` → final une seule fois : un second appel ou une rafale renvoie `already_processed` sans crédit (testé en SQL sur les 5 packs ; test d'intégration `topup.test.ts`) |
| Bonus réintroduits par erreur | ✅ contraintes `credit_packs_no_bonus` (pack) et `topups_no_bonus` (recharges futures) ; `handle_new_user` n'attribue plus de crédit même si `welcome_credits` est modifié en base (testé) ; paramètre retiré de l'administration |
| Codes promo | ✅ refusés par `start_topup` (`PROMO_DISABLED`), page et actions d'administration retirées, tables conservées |
| Soldes existants | ✅ inchangés (vérifié avant / après sur la base de test) |

## 9 nonies. Contrôle final de la refonte PRONEX (phase G, 26/11/2026)

- Attaques rejouées avec la clé publique seule (script hors CI, équivalent d'`audit.test.ts` sans clé secrète) :
  - base de test, anonyme puis connecté (compte « Intrus ») : 56 tentatives, 56 refusées (lecture des tables sensibles, lecture des données d'un autre compte, écriture sur `wallets` / `credit_transactions` / `unlocks`, passage en admin, modification des prix, fonctions `apply_topup`, `admin_*`, `settle_fixture`) ; `get_fixture_predictions` ne révèle aucun marché non débloqué ;
  - production, anonyme uniquement : 28 tentatives, 28 refusées (aucune écriture possible, aucune donnée créée).
- Recharge : code promo refusé (`PROMO_DISABLED`), `apply_topup` refusé à l'utilisateur (42501), crédit exact du pack (+10), deuxième application sans effet (`already_processed`).
- Conseiller Supabase (production) : alertes « SECURITY DEFINER exécutable » attendues (fonctions protégées par `auth.uid()` / `is_admin()`, voir § 3) ; protection des mots de passe divulgués toujours désactivée (réglage du porteur, voir § 10).
- `npm run test:security` et les autres suites d'intégration n'ont pas pu être relancés : la clé secrète du projet de test n'est pas disponible dans la session.

## 9 decies. Refonte de l'espace utilisateur (étape 3, 26/11/2026)

- Partie gratuite de la fiche match : `get_fixture_public_context` expose désormais les **absences** lues dans `match_contexts.summary`. Seuls les éléments texte du tableau `absences` de chaque équipe passent (liste blanche, 120 caractères, 20 au plus) ; tout autre champ du dossier reste inaccessible (règle 1). Vérifié sur la base de test : un objet, un nombre et une clé étrangère placés dans le dossier ne sortent pas ; le schéma Zod `lib/catalog/context.ts` ignore aussi toute clé inattendue (test `lib/catalog/context.test.ts`).
- Statistiques de corners / cartons : calculées depuis `fixtures` (déjà lisible publiquement pour les matchs publiés), aucun pronostic.
- Déconnexion de tous les appareils (`signOutEverywhereAction`, `signOut({ scope: "global" })`) depuis le profil.
- Aucune nouvelle écriture, aucun changement de prix ni de règle de résolution ; l'achat, le déblocage et le remboursement passent par les mêmes fonctions SQL.

## 9 undecies. PRONEX AI, étape 5 (26/11/2026)

- Masquage revérifié (clé publique seule) : lecture directe de `predictions`, `prediction_analyses`, `match_contexts` → 0 ligne (anonyme et connecté, base de test) ; `get_fixture_predictions` ne révèle que les marchés débloqués (0 fuite) ; production, anonyme : 28 tentatives sur 28 refusées. Routes HTTP : seulement `/api/cron/*` (Bearer) et le webhook de paiement (signature) ; la seule lecture de `predictions` côté utilisateur (génération à la demande) est un comptage sans contenu.
- Un seul jeu par match : contrainte `predictions_fixture_market_unique (fixture_id, market_code)` et `prediction_analyses (fixture_id)` unique ; contenu figé après achat : déclencheur `predictions_protect_locked` (UPDATE / DELETE).
- Tarifs vérifiés en production : 2 crédits (3 pour score exact, mi-temps/fin, combiné), match complet 7, déduction de ce qui a déjà été payé (`get_unlock_price`). Aucun changement.

## 9 duodecies. Animation PRONEX AI (étape 6, 26/11/2026)

- Nouvelle route de lecture `GET /api/generation/[id]` : session obligatoire (401 sinon), identifiant UUID validé, lecture par la RLS **et** filtre `user_id` (une demande d'un autre compte → 404), réponse limitée à `status`, `stage`, `marketCode` (schéma Zod), `Cache-Control: no-store`. Aucun contenu de pronostic.
- `set_generation_stage` : exécution réservée à `service_role` (vérifié : anon et authenticated exclus) ; écrit seulement la phase d'une demande `reserved` / `running`, jamais les crédits ni le statut. Un échec d'écriture de la phase n'interrompt jamais la génération (testé).

## 9 terdecies. Étapes 7 et 8 : états d'interface et contrôle final (26/11/2026)

- **Cookie de session corrompu ou expiré** : provoquait une erreur 500 (lecture de `value` absente). Corrigé : `getCurrentUser()` traite toute session illisible comme absente, et `proxy.ts` pose l'en-tête interne `x-had-session` (toujours recalculé, une valeur envoyée par le navigateur est écrasée) pour afficher « Votre session a expiré » sur `/connexion`. Vérifié : cookie falsifié → 307 vers `/connexion?next=…&info=session-expiree` ; en-tête `x-had-session: 1` envoyé par le client → ignoré.
- Attaques rejouées : 28/28 refusées en anonyme (test), 28/28 connecté « Intrus » (test), 28/28 anonyme (production).
- Routes : `/api/cron/*` sans jeton ou mauvais jeton → 401 ; tâche inconnue → 404 (après authentification seulement) ; webhook mock sans signature ou signature fausse → 401 ; fournisseur inconnu → 404 ; `/api/generation/<id d'un autre>` → 404, id non UUID → 400 ; pages et export admin pour un non-admin → 404 ; reçu d'un autre utilisateur → 404.
- Doubles débits (transaction annulée, base de test) : second `unlock_prediction` → `ALREADY_UNLOCKED`, solde inchangé ; match complet après un marché à 2 crédits → 5 (7 − 2) ; rejeu d'`apply_topup` → `already_processed`, aucun second crédit ; marché, pack ou match inexistant → erreur métier propre.
- Paquet navigateur (`.next/static`) : aucune clé secrète (`sb_secret`, `SERVICE_ROLE`, `OPENAI_API_KEY`, `API_FOOTBALL_KEY`, `CRON_SECRET`, `sk-proj`).
- Production : 0 écart entre soldes et grand livre, 0 solde négatif, packs conformes sans bonus, 10 tâches Cron actives.

## 9 quaterdecies. Compteurs publics de la landing (26/11/2026)

- `get_public_counters()` est appelable sans compte, mais ne renvoie que trois totaux agrégés : aucune donnée personnelle, aucun contenu de pronostic. Sous son seuil d'affichage, une valeur est renvoyée à `null`, donc le chiffre réel reste privé tant qu'il est faible. Toute erreur renvoie `null`.
- Aucun chiffre d'activité n'est fabriqué : il n'y a pas de compteur artificiel. Tant que l'activité réelle n'atteint pas les seuils, la landing affiche les OBJECTIFS du porteur (25 000 / 12 500 / 50 000). Ils sont présentés comme tels : titre « Nos objectifs », chaque libellé commence par « Objectif : » (test `components/landing/counters.test.ts`). Ils ne sont jamais présentés comme des résultats atteints.

## 10. Points ouverts et risques acceptés

1. ⚠️ **`picomatch`** (outils de développement uniquement) : voir § 8.
2. ⚠️ **Création de comptes en masse** : l'inscription est ouverte avec la clé publique, comme dans toute application Supabase. Les crédits de bienvenue valent 0 par défaut. S'ils sont activés, prévoir un CAPTCHA (Supabase Auth le propose) et la confirmation d'e-mail obligatoire.
3. ⚠️ **Ces tests n'ont pas tourné en CI** : les tests d'intégration et de bout en bout s'exécutent en CI dès que les secrets `SUPABASE_DEV_*` sont ajoutés au dépôt. Les vérifications de ce document ont été faites ici par requêtes réelles.
4. ⚠️ **Réglages Supabase Auth à vérifier avant la production** : protection contre les mots de passe divulgués, confirmation d'e-mail, limites de débit.
