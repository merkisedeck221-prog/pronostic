# Synchronisation API-Football

Référence : [cahier des charges](cahier-des-charges.md), section 7. Code : `lib/api-football/` (client), `lib/sync/` (tâches), `app/api/cron/[job]/route.ts` (route), `supabase/migrations/*_cron_sync_jobs.sql` (planification).

## Fonctionnement

```
Supabase Cron (pg_cron) ──► private.invoke_sync_job('sync-…') ──pg_net──► POST <app_url>/api/cron/sync-…
                                     │ lit app_url, cron_secret (et vercel_bypass_secret) dans Vault
                                     ▼
                         Route Next.js (vérifie Authorization: Bearer CRON_SECRET)
                                     ▼
                 lib/sync : tâche ─► API-Football (client + garde-fou budgétaire) ─► tables Supabase
                                     └─► journal sync_runs (début, fin, statut, appels, quota, erreurs)
```

| Tâche | Fréquence (UTC) | Appels | Effet |
|---|---|---|---|
| `sync-competitions` | lundi 03:17 | ~2 / compétition active | saison en cours, couverture, logo, équipes |
| `sync-fixtures` | 05:07 et 17:07 | 1 / compétition active | matchs J-3 à J+14 (équipes créées à la volée, `is_published` jamais écrasé, coup d'envoi initial conservé) |
| `sync-standings` | 05:37 | 1 / compétition avec classement | classements |
| `sync-results` | toutes les 15 min | 1 / 20 matchs en cours | scores, mi-temps, temps réglementaire, statut ; **0 appel** s'il n'y a aucun match commencé depuis moins de 4 h |

### Quota et garde-fou

- Avant **chaque** requête (nouvelles tentatives comprises), le client additionne `sync_runs.api_calls` du jour (UTC) et refuse l'appel si `API_FOOTBALL_DAILY_BUDGET` est atteint (90 par défaut en forfait gratuit). La tâche s'arrête alors proprement (`partial` ou `failed`).
- Le quota restant renvoyé par API-Football (`x-ratelimit-requests-remaining`) est enregistré dans `sync_runs.quota_remaining`.
- Une réponse 200 avec un champ `errors` non vide (clé invalide, saison hors forfait…) est traitée comme une erreur, sans nouvelle tentative.
- Délai de 15 s par appel, 2 nouvelles tentatives (1 s puis 2 s d'attente) sur erreur réseau, 429 ou 5xx.
- Durée : `maxDuration = 60 s` (offre Vercel Hobby) ; chaque tâche s'arrête après 50 s et ne lance plus d'appel sous 17 s restantes. Le reste est repris à l'exécution suivante.

Estimation en forfait gratuit avec 3 compétitions actives : ~6 (fixtures) + ~2 (standings) + 0 à ~40 (results, selon les matchs du jour) + ~6 par semaine (competitions).

## Mise en service

### 1. Variables Vercel (Production)

`API_FOOTBALL_KEY`, `API_FOOTBALL_DAILY_BUDGET` (ex. 90), `CRON_SECRET` (32 caractères minimum : `openssl rand -hex 32`), en plus des variables Supabase.

### 2. Protection Vercel

La protection de déploiement Vercel bloque aussi `https://pronostic-brown.vercel.app` : Supabase Cron recevrait une page de connexion Vercel. Au choix :

- **Recommandé** : Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation** → générer un secret, puis l'enregistrer dans Vault sous le nom `vercel_bypass_secret` (étape 3). L'appel envoie alors l'en-tête `x-vercel-protection-bypass`.
- ou désactiver la protection pour la production, ou utiliser un domaine personnalisé (non protégé).

### 3. Secrets dans Supabase Vault (à exécuter soi-même dans le *SQL Editor*)

Ne jamais mettre ces valeurs dans une migration ou un fichier du dépôt.

```sql
select vault.create_secret('https://pronostic-brown.vercel.app', 'app_url', 'URL de production appelée par Supabase Cron');
select vault.create_secret('<VALEUR DE CRON_SECRET>', 'cron_secret', 'Même valeur que CRON_SECRET sur Vercel');
-- Facultatif (protection Vercel) :
select vault.create_secret('<SECRET PROTECTION BYPASS>', 'vercel_bypass_secret', 'Vercel Protection Bypass for Automation');
```

Modifier une valeur :

```sql
select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<NOUVELLE VALEUR>');
```

Tant que `app_url` ou `cron_secret` manquent, les tâches planifiées ne font rien (avertissement dans les journaux).

### 4. Vérifier les exécutions

```sql
-- Tâches planifiées
select jobid, jobname, schedule, active from cron.job order by jobname;

-- Dernières exécutions de pg_cron
select j.jobname, d.status, d.return_message, d.start_time, d.end_time
from cron.job_run_details d join cron.job j using (jobid)
order by d.start_time desc limit 20;

-- Réponses HTTP de l'application (pg_net)
select id, status_code, left(content::text, 300) as content, created
from net._http_response order by created desc limit 20;

-- Journal applicatif et consommation du jour
select job, status, api_calls, items_processed, quota_remaining, left(error, 200) as error, started_at, finished_at
from public.sync_runs order by started_at desc limit 20;

select coalesce(sum(api_calls), 0) as appels_aujourd_hui
from public.sync_runs where started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
```

Suspendre / reprendre une tâche : `select cron.alter_job((select jobid from cron.job where jobname = 'sync-results'), active := false);`

## Lancement manuel

- **Administrateur** : Server Action `runSyncJobAction(job)` (`lib/sync/actions.ts`), protégée par `requireAdmin()` et journalisée ; branchée à `/admin/synchronisation` en phase 10.
- **Ligne de commande** (avec `.env.local` du projet DEV, dont `SUPABASE_SERVICE_ROLE_KEY` et `API_FOOTBALL_KEY`) :

```bash
npm run discover:leagues
npm run sync -- sync-competitions sync-fixtures sync-standings
```

- **GitHub Actions** (workflow « API-Football (lancement manuel) ») : secrets du dépôt `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`. Depuis `main` : bouton *Run workflow*. Depuis une branche `phase-*` : écrire le nom de la tâche (`discover-leagues`, `sync-initial`, `sync-results`…) sur la 1re ligne de `.github/api-football-request` et pousser. Les réponses brutes (sans la clé), `docs/leagues.md` et `sync-report.json` sont disponibles dans l'artefact de l'exécution.

## Compétitions

Résultat de la découverte : [leagues.md](leagues.md). En forfait gratuit, seules **Premier League**, **Ligue 1** et **Matchs amicaux internationaux** sont actives ; les autres sont créées mais désactivées (à activer au passage au forfait Pro, depuis l'admin en phase 10 ou en SQL : `update competitions set is_active = true where slug = '…';`).
