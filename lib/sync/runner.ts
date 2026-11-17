import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiFootballClient, BudgetExceededError, BudgetGuard, type BudgetStore } from "@/lib/api-football/client";
import { getServerEnvKeys } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Exécution d'une tâche de synchronisation :
 *  - ligne sync_runs créée au début (status running), complétée à la fin ;
 *  - api_calls mis à jour en base après CHAQUE appel (le garde-fou budgétaire
 *    additionne sync_runs.api_calls du jour avant chaque appel) ;
 *  - délai interne (deadline) pour rester sous maxDuration de Vercel ;
 *  - une erreur sur un élément est journalisée et le lot continue.
 */

export type DB = SupabaseClient<Database>;

export type SyncContext = {
  db: DB;
  api: ApiFootballClient;
  now: Date;
  /** Millisecondes restantes avant la limite interne de la tâche. */
  timeLeft: () => number;
  /** Ajoute des éléments traités au compteur de la tâche. */
  processed: (count: number) => void;
  /** Journalise une erreur non bloquante (le lot continue). */
  error: (message: string) => void;
  /** Informations ajoutées au résumé (ex. nombre de matchs par compétition). */
  details: Record<string, unknown>;
};

export type SyncJob = (ctx: SyncContext) => Promise<void>;

export type SyncSummary = {
  job: string;
  runId: number | null;
  status: Database["public"]["Enums"]["run_status"];
  apiCalls: number;
  itemsProcessed: number;
  quotaRemaining: number | null;
  durationMs: number;
  errors: string[];
  details: Record<string, unknown>;
};

/** Marge de temps : on ne commence plus de nouvel appel sous ce seuil. */
export const MIN_TIME_FOR_CALL_MS = 17_000;

/** Début du jour UTC (pour le budget quotidien). */
export function startOfUtcDay(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString();
}

/** Budget stocké dans sync_runs : somme des api_calls des tâches du jour (UTC). */
export function createDbBudgetStore(db: DB, runId: () => number | null, now: () => Date): BudgetStore & { calls: number } {
  const store = {
    calls: 0,
    async usedToday(): Promise<number> {
      const { data, error } = await db.from("sync_runs").select("api_calls").gte("started_at", startOfUtcDay(now()));
      if (error) throw new Error(`Lecture du budget impossible : ${error.message}`);
      return (data ?? []).reduce((sum, row) => sum + (row.api_calls ?? 0), 0);
    },
    async record(calls: number): Promise<void> {
      store.calls += calls;
      const id = runId();
      if (id === null) return;
      const { error } = await db.from("sync_runs").update({ api_calls: store.calls }).eq("id", id);
      if (error) console.error("[sync] api_calls non enregistré :", error.message);
    },
  };
  return store;
}

export type RunJobOptions = {
  db?: DB;
  apiKey?: string;
  dailyBudget?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Durée maximale de la tâche (défaut 50 s, sous maxDuration = 60 s). */
  timeBudgetMs?: number;
};

export async function runJob(name: string, job: SyncJob, options: RunJobOptions = {}): Promise<SyncSummary> {
  const started = Date.now();
  const timeBudgetMs = options.timeBudgetMs ?? 50_000;
  const db = options.db ?? createAdminClient();
  const now = options.now ?? new Date();

  const env =
    options.apiKey && options.dailyBudget
      ? { API_FOOTBALL_KEY: options.apiKey, API_FOOTBALL_DAILY_BUDGET: options.dailyBudget }
      : getServerEnvKeys(["API_FOOTBALL_KEY", "API_FOOTBALL_DAILY_BUDGET"]);

  const { data: run, error: runError } = await db
    .from("sync_runs")
    .insert({ job: name, status: "running", started_at: now.toISOString() })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`Création de sync_runs impossible : ${runError?.message}`);
  const runId = run.id;

  const store = createDbBudgetStore(db, () => runId, () => new Date());
  const api = new ApiFootballClient({
    apiKey: env.API_FOOTBALL_KEY,
    budget: new BudgetGuard(store, env.API_FOOTBALL_DAILY_BUDGET),
    fetchImpl: options.fetchImpl,
  });

  const errors: string[] = [];
  let processed = 0;
  const details: Record<string, unknown> = {};
  let fatal: string | null = null;
  let budgetStopped = false;

  try {
    await job({
      db,
      api,
      now,
      timeLeft: () => timeBudgetMs - (Date.now() - started),
      processed: (count) => {
        processed += count;
      },
      error: (message) => {
        errors.push(message);
        console.error(`[sync:${name}]`, message);
      },
      details,
    });
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      budgetStopped = true;
      errors.push(error.message);
    } else {
      fatal = (error as Error).message;
      errors.push(fatal);
      console.error(`[sync:${name}] échec :`, fatal);
    }
  }

  // Échec bloquant ou budget atteint : « partial » si une partie a été traitée, sinon « failed ».
  // Erreurs non bloquantes seulement : « partial ». Aucune erreur : « success ».
  const status: SyncSummary["status"] =
    fatal || budgetStopped ? (processed > 0 ? "partial" : "failed") : errors.length > 0 ? "partial" : "success";

  const quotaRemaining = api.lastQuota.dailyRemaining;
  const errorText = errors.length ? errors.join("\n").slice(0, 4000) : null;

  const { error: finishError } = await db
    .from("sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      api_calls: store.calls,
      items_processed: processed,
      quota_remaining: quotaRemaining,
      error: errorText,
    })
    .eq("id", runId);
  if (finishError) console.error(`[sync:${name}] fin non enregistrée :`, finishError.message);

  return {
    job: name,
    runId,
    status,
    apiCalls: store.calls,
    itemsProcessed: processed,
    quotaRemaining,
    durationMs: Date.now() - started,
    errors,
    details,
  };
}
