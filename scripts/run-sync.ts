/**
 * Lance une ou plusieurs tâches de synchronisation à la main (hors Vercel),
 * avec la clé secrète Supabase. Exemples :
 *   npm run sync -- sync-competitions
 *   npm run sync -- sync-competitions sync-fixtures sync-standings
 * Option : SAVE_API_SAMPLES=dossier → enregistre les réponses brutes (réponses de test).
 * Affiche un résumé : matchs à venir par compétition, appels, quota restant.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isSyncJobName, runSyncJob, type SyncSummary } from "@/lib/sync";
import type { Database } from "@/types/database";
import { loadDotEnvLocal, recordingFetch } from "./lib/script-env";

loadDotEnvLocal();

async function main() {
  const jobs = process.argv.slice(2);
  if (jobs.length === 0 || !jobs.every(isSyncJobName)) {
    throw new Error(`Usage : npm run sync -- <tâche...> ; tâches : sync-competitions, sync-fixtures, sync-standings, sync-results, build-contexts, generate-predictions, settle-predictions`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  const fetchImpl = process.env.SAVE_API_SAMPLES ? recordingFetch(process.env.SAVE_API_SAMPLES) : undefined;

  const summaries: SyncSummary[] = [];
  for (const job of jobs) {
    if (!isSyncJobName(job)) continue;
    console.log(`\n▶ ${job}`);
    const summary = await runSyncJob(job, { db, fetchImpl, timeBudgetMs: 10 * 60_000 });
    summaries.push(summary);
    console.log(JSON.stringify(summary, null, 2));
  }

  const now = new Date().toISOString();
  const { data: upcoming } = await db
    .from("fixtures")
    .select("competition_id, competitions(name)")
    .gt("kickoff_at", now);
  const byCompetition = new Map<string, number>();
  for (const row of upcoming ?? []) {
    const name = (row.competitions as { name: string } | null)?.name ?? String(row.competition_id);
    byCompetition.set(name, (byCompetition.get(name) ?? 0) + 1);
  }

  const report = {
    finishedAt: now,
    jobs: summaries.map((s) => ({ job: s.job, status: s.status, apiCalls: s.apiCalls, items: s.itemsProcessed, errors: s.errors })),
    totalApiCalls: summaries.reduce((sum, s) => sum + s.apiCalls, 0),
    quotaRemaining: summaries.at(-1)?.quotaRemaining ?? null,
    upcomingFixturesByCompetition: Object.fromEntries(byCompetition),
  };
  writeFileSync("sync-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== Résumé ===");
  console.log(JSON.stringify(report, null, 2));
  if (summaries.some((s) => s.status === "failed")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
