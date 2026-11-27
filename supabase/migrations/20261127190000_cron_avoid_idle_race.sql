-- Tâches planifiées : éviter l'échec « Error in the HTTP2 framing layer » (27/11/2026).
--
-- Constat (production) : sur 67 appels pg_net vers Vercel, le seul en échec est
-- sync-fixtures, lancé exactement 2 minutes après settle-predictions (:05 → :07).
-- La connexion HTTP/2 réutilisée par pg_net est fermée par le serveur au même
-- moment (fermeture après inactivité) : la requête échoue en 22 ms, avant
-- d'atteindre le site ; aucune ligne dans sync_runs depuis le 23/11.
-- Correction : lancer ces tâches 1 minute après settle-predictions / sync-results,
-- quand la connexion est encore active. Aucun changement de fréquence ni de budget.
select cron.schedule('sync-fixtures',     '6 5,17 * * *', $$select private.invoke_sync_job('sync-fixtures')$$);
select cron.schedule('sync-standings',    '36 5 * * *',   $$select private.invoke_sync_job('sync-standings')$$);
select cron.schedule('sync-competitions', '16 3 * * 1',   $$select private.invoke_sync_job('sync-competitions')$$);
