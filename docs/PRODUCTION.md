# Mise en production — check-list

Phase 12. Cette liste se remplit au fur et à mesure : ✅ fait · ⏳ en cours ou en attente · 👤 action du porteur du projet · ⬜ à faire.

**Règle absolue** : aucun secret (clé, mot de passe, jeton) n'est transmis à Claude Code ni écrit dans le dépôt. Vous les saisissez vous-même dans Vercel, Supabase ou GitHub.

| Élément | Valeur |
|---|---|
| Projet Supabase de **production** | `pronostics` (réf. `pgeytactmugqskdzsxnw`, `eu-west-1`) — confirmé par le porteur le 18/11/2026 |
| Projet Supabase de développement | **aucun** : l'ancienne base de dev est devenue la production. Les tests d'intégration et Playwright refusent de la viser (`tests/guard.ts`) et sont désactivés en CI (variable `RUN_INTEGRATION_TESTS`). Pour les réactiver : créer un projet de dev séparé. |
| Projet Vercel | `pronostic` (alias actuel `pronostic-brown.vercel.app`) |
| Branche de production | `main` |

---

## 0. Fusion dans `main`

- [x] `phase-12-production` fusionnée dans `main` (avance rapide, phases 2 à 12, commit `469c18e`) à la demande du porteur, le 18/11/2026.
- [x] Déploiement de production Vercel **READY** (`dpl_7itpv4gfk2MCvn5KjZKbVbM9fUDJ`) sur `pronostic-brown.vercel.app`. Contrôle : `/connexion` et `/performances` s'affichent et lisent la base de production ; en-têtes de sécurité présents.
- ⚠️ **Protection Vercel active** (*Vercel Authentication*, mode « tous les déploiements sauf domaines personnalisés ») : `pronostic-brown.vercel.app` n'est accessible qu'aux membres du compte Vercel. Utile tant que le paiement est simulé ; pour ouvrir au public, ajouter un domaine personnalisé (étape 8) ou désactiver la protection. Supabase Cron a **besoin** du secret `vercel_bypass_secret` (étape 5).
- [ ] ⚠️ Chaque fusion dans `main` déclenche un déploiement de production Vercel. Tant que les variables de production (étape 4) ne sont pas renseignées, l'application de production affichera des erreurs : c'est attendu.

## 1. Check-list (vue d'ensemble)

| # | Étape | Qui | État |
|---|---|---|---|
| 1 | Cette check-list | Claude | ✅ |
| 2 | Projet Supabase de production : choix | 👤 | ✅ `pronostics` |
| 2 | Migrations + seed + contrôle RLS | Claude | ✅ |
| 3 | Auth : URL du site et de redirection | 👤 (instructions ci-dessous) | ⬜ |
| 3 | Auth : modèles d'e-mails en français | 👤 (copier-coller) | ⬜ |
| 3 | Auth : SMTP personnalisé (**obligatoire**) | 👤 | ⬜ |
| 4 | Vercel : variables de production | 👤 | ✅ toutes posées, redéploiement READY (23/11/2026) |
| 5 | Supabase Cron : secrets Vault | Claude (exception accordée par le porteur, 23/11) | ✅ `app_url`, `cron_secret`, `vercel_bypass_secret` |
| 5 | Supabase Cron : planification vérifiée | Claude | ✅ 8 tâches actives ; appel Cron → Vercel → API-Football vérifié (HTTP 200, 23/11) |
| 6 | Compétitions créées et activées | Claude (SQL, journalisé) | ✅ 5 championnats (39, 140, 135, 78, 61) |
| 6 | Première synchronisation + génération < 48 h | Claude | ⏳ bloquée : clé API-Football sur forfait **gratuit** (saisons 2022-2024 seulement), forfait Pro requis |
| 7 | Compte administrateur promu | Claude (SQL, journalisé) | ✅ 23/11/2026 (audit n° 15) |
| 8 | Domaine personnalisé (facultatif) | 👤 | ⬜ |
| 9 | Surveillance quotidienne | Claude | ✅ (code et migration prêts) |
| 10 | Test de fumée en production | 👤 + Claude | ⬜ |
| 11 | Sauvegardes | 👤 | ⬜ |
| 12 | PROGRESS.md : MVP terminé | Claude | ⬜ |

---

## 2. Base de production

Décision du porteur : le projet existant `pronostics` devient la production (aucun projet séparé). Les 19 migrations de `supabase/migrations/` et `supabase/seed.sql` y sont appliquées. Contrôles :

```sql
-- Toutes les tables publiques ont la RLS active (résultat attendu : 0 ligne)
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;

-- Nombre de politiques par table
select tablename, count(*) from pg_policies where schemaname = 'public' group by tablename order by tablename;
```

**Résultat (18/11/2026)** ✅

| Contrôle | Résultat |
|---|---|
| Migrations appliquées | 19 / 19 (`enums_and_helpers` → `health_monitoring`) |
| Tables publiques | 21, **toutes avec RLS** (0 table sans RLS) |
| Tables sans politique | aucune (1 à 4 politiques par table) |
| Données de départ | 4 marchés, 5 règles de prix, 3 packs, 8 paramètres (`pricing_mode=both`, `welcome_credits=0`, `prediction_window_hours=48`, `refund_on_cancel=true`, `maintenance_mode=false`, `reveal_after_match=true`, `fixtures_window_days=7`, `alert_quota_min=200`) |
| Tâches Supabase Cron | 8 |
| Données de test résiduelles | aucune (0 utilisateur, 0 match, 0 transaction) |
| Secrets Vault | 0 (étape 5) |

## 3. Authentification

### 3.1 URL (👤 Supabase → projet `pronostics` → *Authentication* → *URL Configuration*)

| Champ | Valeur |
|---|---|
| Site URL | `https://pronostic-brown.vercel.app` (ou votre domaine, étape 8) |
| Redirect URLs | `https://pronostic-brown.vercel.app/auth/callback` et, si domaine, `https://<votre-domaine>/auth/callback` |

### 3.2 Modèles d'e-mails en français (👤 *Authentication* → *Emails* → *Templates*)

Les modèles sont dans le dépôt : `supabase/templates/`. Pour chacun, copier l'**objet** (première ligne du fichier, en commentaire) dans *Subject* et le **contenu** dans *Message body* :

| Modèle Supabase | Fichier | Objet |
|---|---|---|
| Confirm signup | `confirmation.html` | Confirmez votre inscription à Pronostics IA |
| Reset password | `recovery.html` | Réinitialisation de votre mot de passe Pronostics IA |
| Change email address | `email_change.html` | Confirmez votre nouvelle adresse e-mail Pronostics IA |

Les liens utilisent `{{ .SiteURL }}/auth/callback?token_hash=…&type=…`, ce qui fonctionne même si l'utilisateur ouvre l'e-mail sur un autre appareil. La route `/auth/callback` gère ce format.

### 3.3 SMTP personnalisé — **obligatoire avant l'ouverture**

Sans SMTP personnalisé, Supabase **n'envoie les e-mails qu'aux membres de l'équipe du projet** : les utilisateurs ne recevraient jamais leur e-mail de confirmation.

👤 Pas à pas :

1. Choisissez un service d'envoi (Brevo, Resend, Postmark, Amazon SES, ZeptoMail, SendGrid…) et créez un compte.
2. Validez votre **domaine d'envoi** chez ce service (enregistrements DNS **SPF**, **DKIM** et, si proposé, **DMARC**, chez votre registraire). Sans domaine, utilisez l'adresse fournie par le service (moins bonne délivrabilité).
3. Relevez chez le service : hôte SMTP, port (587 recommandé, STARTTLS), identifiant, mot de passe SMTP (ou clé API).
4. Supabase → projet `pronostics` → *Authentication* → *Emails* → *SMTP Settings* → **Enable custom SMTP** :
   - *Sender email* : `no-reply@<votre-domaine>` ;
   - *Sender name* : `Pronostics IA` ;
   - *Host*, *Port*, *Username*, *Password* : ceux du service.
5. Enregistrez, puis *Authentication* → *Rate Limits* : la limite d'envoi démarre à 30 e-mails par heure ; montez-la selon votre trafic (ex. 100).
6. Testez : *Authentication* → *Users* → *Add user* → *Send invitation* vers une adresse personnelle, ou inscrivez-vous sur l'application.

### 3.4 Réglages de sécurité recommandés (👤 *Authentication*)

- *Sign In / Providers* → Email : **Confirm email** activé.
- *Attack Protection* : **Leaked password protection** activée ; **CAPTCHA** (hCaptcha ou Turnstile) si les crédits de bienvenue sont activés.

## 4. Vercel — variables de production

👤 Vercel → projet `pronostic` → *Settings* → *Environment Variables*, environnement **Production**.

✅ Les variables Supabase de Production (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`…) sont déjà posées par l'**intégration Supabase ↔ Vercel**, connectée au projet `pronostics`, qui est désormais la production : rien à changer pour elles.

⚠️ **Preview** : ne pas y ajouter les clés de ce projet. Une prévisualisation avec `PAYMENT_PROVIDER=mock` sur la base de production permettrait de se créditer gratuitement des crédits réels. Les prévisualisations restent donc sans base (pages en erreur) tant qu'il n'y a pas de projet de développement séparé.

| Variable | Valeur attendue | Secret ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ déjà posée par l'intégration (`https://pgeytactmugqskdzsxnw.supabase.co`) | non |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ déjà posée par l'intégration | non (publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ déjà posée par l'intégration | **oui** |
| `NEXT_PUBLIC_APP_URL` | `https://pronostic-brown.vercel.app` (ou votre domaine) | non |
| `DEFAULT_TIMEZONE` | `Africa/Porto-Novo` | non |
| `API_FOOTBALL_KEY` | votre clé API-Football (forfait Pro) | **oui** |
| `API_FOOTBALL_DAILY_BUDGET` | `7000` (forfait Pro = 7 500 requêtes/jour, marge de sécurité) | non |
| `OPENAI_API_KEY` | votre clé OpenAI | **oui** |
| `OPENAI_MODEL` | le modèle choisi (récent, économique, compatible *Structured Outputs*) | non |
| `AI_DAILY_GENERATION_LIMIT` | `60` (≈ 50 matchs par semaine + sélections ; à ajuster selon le coût) | non |
| `CRON_SECRET` | 64 caractères : `openssl rand -hex 32` (même valeur que dans Vault, étape 5) | **oui** |
| `ADMIN_EMAILS` | votre adresse e-mail (séparées par des virgules si plusieurs) | non |
| `PAYMENT_PROVIDER` | `mock` (tant que FedaPay / KkiaPay ne sont pas branchés) | non |
| `PAYMENT_MOCK_SECRET` | 64 caractères : `openssl rand -hex 32` | **oui** |

Variables ajoutées par l'intégration et inutilisées par l'application (`POSTGRES_*`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) : sans effet, à laisser.

Après modification : *Deployments* → dernier déploiement de production → *Redeploy*.

⚠️ Paiement de test en production : avec `PAYMENT_PROVIDER=mock`, n'importe quel utilisateur peut se créditer avec le bouton « Simuler un paiement réussi ». Tant que le vrai paiement n'est pas branché, ne pas ouvrir l'application au public, ou désactiver les packs dans `/admin/packs`.

## 5. Supabase Cron en production

### 5.1 Protection des déploiements Vercel

La protection standard (« all except custom domains ») est active sur les URL de déploiement, mais le 23/11/2026 `pronostic-brown.vercel.app` répondait **sans** authentification (domaine de production non couvert). 👤 Vercel → *Settings* → *Deployment Protection* → *Protection Bypass for Automation* → *Add secret*, puis le déposer dans Vault (`vercel_bypass_secret`, ci-dessous). Avec un domaine personnalisé (non protégé), ce secret devient inutile.

### 5.2 Secrets dans Vault (👤 Supabase → projet `pronostics` → *SQL Editor*)

```sql
select vault.create_secret('https://pronostic-brown.vercel.app', 'app_url', 'URL de production appelée par Supabase Cron');
select vault.create_secret('<MÊME VALEUR QUE CRON_SECRET SUR VERCEL>', 'cron_secret', 'Secret des routes /api/cron');
-- Seulement si la protection Vercel est active (5.1) :
select vault.create_secret('<SECRET PROTECTION BYPASS>', 'vercel_bypass_secret', 'Vercel Protection Bypass for Automation');
```

Pour changer une valeur plus tard (ex. domaine, étape 8) :

```sql
select vault.update_secret((select id from vault.secrets where name = 'app_url'), 'https://<votre-domaine>');
```

### 5.3 Planification (installée par les migrations)

| Tâche | Fréquence (UTC) |
|---|---|
| `sync-competitions` | lundi 03:17 |
| `sync-fixtures` | 05:07 et 17:07 |
| `sync-standings` | 05:37 |
| `sync-results` | toutes les 15 min |
| `build-contexts` | :11 chaque heure |
| `generate-predictions` | :31 chaque heure |
| `settle-predictions` | :05, :20, :35, :50 |
| `health-check` | 06:07 (surveillance, SQL direct) |

Vérification par Claude : ⬜ (à remplir)

## 6. Données de départ

Compétitions de la section 7, ajoutées depuis `/admin/competitions` → *Ajouter une compétition* : chaque ajout vérifie l'identifiant avec `/leagues` (1 appel).

| Compétition | ID indicatif | Activée au lancement |
|---|---|---|
| Premier League | 39 | oui |
| LaLiga | 140 | oui |
| Serie A | 135 | oui |
| Bundesliga | 78 | oui |
| Ligue 1 | 61 | oui |
| Ligue des nations UEFA | 5 | si matchs à venir |
| CAN | 6 | si matchs à venir |
| Qualifications CAN | 36 | si matchs à venir |
| Qualifications Coupe du monde | à rechercher (`npm run discover:leagues` ou `/leagues?search=World Cup`) | si matchs à venir |
| Amicaux internationaux | 10 | si matchs à venir |
| Coupe du monde, Euro, Copa América | 1, 4, 9 | non (à l'approche d'une édition) |

Première synchronisation complète : `sync-competitions` → `sync-fixtures` → `sync-standings`, puis `build-contexts` et `generate-predictions` pour les matchs à moins de 48 h. Lancement depuis `/admin/synchronisation`, ou par Claude via `select private.invoke_sync_job('<tâche>')` dans le projet prod.

Résultat : ⬜ (à remplir : compétitions, matchs à venir, pronostics, appels consommés)

## 7. Compte administrateur

`ADMIN_EMAILS` (étape 4) promeut automatiquement le compte à la **première connexion** (ou au retour du lien de confirmation). 👤 Inscrivez-vous sur la production avec cette adresse, confirmez l'e-mail, connectez-vous, ouvrez `/admin`.

Vérification par Claude :

```sql
select p.display_name, p.role, a.action, a.created_at
from public.profiles p left join public.admin_audit_log a on a.entity_id = p.id::text and a.action = 'promote_admin'
where p.role = 'admin';
```

Résultat : ⬜

## 8. Domaine personnalisé (facultatif)

1. 👤 Vercel → projet → *Settings* → *Domains* → *Add* → `votre-domaine.com` (et `www.votre-domaine.com`, redirigé vers le domaine principal).
2. 👤 Chez votre registraire, créer les enregistrements DNS affichés par Vercel. En général : `A @ 76.76.21.21` et `CNAME www cname.vercel-dns.com`. Attendre la validation (quelques minutes à 48 h) ; le certificat HTTPS est automatique.
3. Mettre à jour :
   - Vercel : `NEXT_PUBLIC_APP_URL=https://votre-domaine.com`, puis *Redeploy* ;
   - Supabase Auth : *Site URL* = `https://votre-domaine.com` ; ajouter `https://votre-domaine.com/auth/callback` aux *Redirect URLs* ;
   - Supabase Vault : `app_url` (commande `vault.update_secret` de l'étape 5.2) ;
   - SMTP : expéditeur `no-reply@votre-domaine.com` (domaine validé, étape 3.3).

## 9. Surveillance

- **Tâche quotidienne** `health-check` (06:07 UTC = 07:07 à Porto-Novo) : fonction SQL `run_health_check()`. Elle détecte :
  - les tâches en erreur sur 24 h ;
  - l'absence de synchronisation réussie depuis 24 h ;
  - les matchs du jour sans pronostic ;
  - un quota API-Football sous `alert_quota_min` (200 par défaut, réglable dans `/admin/parametres`) ;
  - les soldes incohérents.
- **Affichage** en tête de `/admin` (bloc « Surveillance ») : anomalies, liens vers la page concernée, bouton « Relancer la vérification ». Un rapport de plus de 26 h est signalé, ce qui veut dire que la tâche elle-même ne tourne plus.
- **Journaux** :
  - Vercel → projet → *Logs* (filtrer par `/api/cron`, `/api/payments`, niveau *Error*) ; *Observability* pour les erreurs d'exécution.
  - Supabase → projet → *Logs & Analytics* : *Postgres*, *Auth*, *Edge/API* ; *Integrations* → *Cron* → historique des exécutions.
  - SQL : voir [docs/sync.md](sync.md), § « Vérifier les exécutions » (`cron.job_run_details`, `net._http_response`, `sync_runs`).

## 10. Test de fumée en production

👤 Sur l'URL de production, avec une adresse de test (ex. `vous+test@…`) :

1. Inscription, confirmation par e-mail (vérifie le SMTP), connexion.
2. `/recharger` → pack → « Simuler un paiement réussi » → « Recharge réussie ».
3. Une fiche match avec pronostic → débloquer un marché.
4. `/portefeuille` : recharge et déblocage visibles, solde cohérent.

Claude vérifie ensuite en base (transactions, déblocage, cohérence), puis remet à zéro le compte de test : suppression du compte (profil, portefeuille, transactions, déblocages, recharges en cascade).

Résultat : ⬜

## 11. Sauvegardes

| Offre Supabase | Sauvegarde automatique |
|---|---|
| **Free** | **Aucune sauvegarde accessible** : exports manuels réguliers obligatoires |
| **Pro** | Sauvegarde quotidienne, **7 derniers jours**, restauration depuis *Database* → *Backups* |
| Team / Enterprise | 14 / jusqu'à 30 jours |
| Option PITR (Pro et plus, ~100 $/mois pour 7 jours) | Restauration à la seconde près (perte max. ≈ 2 min) |

Les sauvegardes ne contiennent pas les mots de passe des rôles personnalisés (aucun ici) ni les fichiers Storage (non utilisés).

**Export manuel** (recommandé avant chaque migration importante, et chaque semaine en offre Free) :

```bash
npx supabase login
```

```bash
npx supabase link --project-ref pgeytactmugqskdzsxnw
```

```bash
npx supabase db dump -f sauvegarde-schema.sql
```

```bash
npx supabase db dump --data-only -f sauvegarde-donnees.sql
```

```bash
npx supabase db dump --role-only -f sauvegarde-roles.sql
```

Conservez ces fichiers **hors du dépôt Git**, chiffrés (ils contiennent des données personnelles). Restauration : `psql` sur la chaîne de connexion du projet (Supabase → *Project Settings* → *Database*), dans l'ordre rôles → schéma → données.

## 12. Après la mise en production

Voir [docs/PROGRESS.md](PROGRESS.md) : MVP terminé et prochaines étapes.
