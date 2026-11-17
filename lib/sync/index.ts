import "server-only";

import { z } from "zod";
import { syncCompetitions, syncFixtures, syncResults, syncStandings } from "./jobs";
import { runJob, type RunJobOptions, type SyncJob, type SyncSummary } from "./runner";

/**
 * Registre des tâches planifiées (section 7). build-contexts,
 * generate-predictions et settle-predictions arrivent aux phases 6 et 9.
 */
export const SYNC_JOBS = {
  "sync-competitions": syncCompetitions,
  "sync-fixtures": syncFixtures,
  "sync-standings": syncStandings,
  "sync-results": syncResults,
} satisfies Record<string, SyncJob>;

export type SyncJobName = keyof typeof SYNC_JOBS;

export const syncJobNameSchema = z.enum(Object.keys(SYNC_JOBS) as [SyncJobName, ...SyncJobName[]]);

export function isSyncJobName(value: string): value is SyncJobName {
  return Object.hasOwn(SYNC_JOBS, value);
}

export function runSyncJob(name: SyncJobName, options?: RunJobOptions): Promise<SyncSummary> {
  return runJob(name, SYNC_JOBS[name], options);
}

export type { SyncSummary } from "./runner";
