import "server-only";

import { z } from "zod";
import { syncCompetitions, syncFixtures, syncResults, syncStandings } from "./jobs";
import { buildContexts, generatePredictions } from "./jobs-ai";
import { settlePredictions } from "./jobs-settle";
import { runJob, type RunJobOptions, type SyncJob, type SyncSummary } from "./runner";

/**
 * Registre des tâches planifiées (section 7).
 */
export const SYNC_JOBS = {
  "sync-competitions": syncCompetitions,
  "sync-fixtures": syncFixtures,
  "sync-standings": syncStandings,
  "sync-results": syncResults,
  "build-contexts": buildContexts,
  "generate-predictions": generatePredictions,
  "settle-predictions": settlePredictions,
} satisfies Record<string, SyncJob>;

export type SyncJobName = keyof typeof SYNC_JOBS;

export const syncJobNameSchema = z.enum(Object.keys(SYNC_JOBS) as [SyncJobName, ...SyncJobName[]]);

export function isSyncJobName(value: string): value is SyncJobName {
  return Object.hasOwn(SYNC_JOBS, value);
}

/** Tâches qui n'appellent jamais API-Football. */
const JOBS_WITHOUT_API: ReadonlySet<SyncJobName> = new Set<SyncJobName>(["settle-predictions"]);

export function runSyncJob(name: SyncJobName, options?: RunJobOptions): Promise<SyncSummary> {
  return runJob(name, SYNC_JOBS[name], { apiOptional: JOBS_WITHOUT_API.has(name), ...options });
}

export type { SyncSummary } from "./runner";
