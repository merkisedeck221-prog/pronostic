# lib/sync

Une fonction par tâche planifiée (section 7) : `sync-competitions`, `sync-fixtures`, `sync-standings`, `sync-results`, `build-contexts`.

Les tâches sont appelées par `app/api/cron/[job]/route.ts` (déclenchées par Supabase Cron). Elles sont idempotentes, traitées par petits lots, journalisées dans `sync_runs`, et une erreur sur un élément n'arrête jamais le lot.
