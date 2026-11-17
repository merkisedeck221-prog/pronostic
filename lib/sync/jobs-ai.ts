import "server-only";

import { buildMatchContext } from "@/lib/ai/context/build";
import { generateForFixture } from "@/lib/ai/pipeline";
import { getServerEnvKeys } from "@/lib/env";
import { MIN_TIME_FOR_CALL_MS, startOfUtcDay, type SyncContext } from "./runner";

/**
 * Tâches du moteur IA (section 7) : build-contexts et generate-predictions,
 * toutes les heures. Aucune régénération automatique d'un match qui a déjà
 * des pronostics.
 */

export const BUILD_CONTEXTS_MAX_PER_RUN = 10;
export const GENERATION_BATCH_SIZE = 5;
/** Un match qui a échoué 2 fois aujourd'hui n'est plus retenté avant demain. */
export const MAX_FAILED_ATTEMPTS_PER_DAY = 2;

async function predictionWindowHours(ctx: SyncContext): Promise<number> {
  const { data } = await ctx.db.from("app_settings").select("value").eq("key", "prediction_window_hours").maybeSingle();
  const hours = Number(data?.value);
  return Number.isFinite(hours) && hours > 0 ? hours : 48;
}

/** Matchs publiés, compétition active, non commencés, dans la fenêtre de génération. */
async function upcomingCandidates(ctx: SyncContext, windowHours: number, limit: number) {
  const until = new Date(ctx.now.getTime() + windowHours * 3600 * 1000).toISOString();
  const { data, error } = await ctx.db
    .from("fixtures")
    .select("id, kickoff_at, competitions!inner(is_active)")
    .eq("is_published", true)
    .eq("competitions.is_active", true)
    .in("status_short", ["NS", "TBD"])
    .gt("kickoff_at", ctx.now.toISOString())
    .lte("kickoff_at", until)
    .order("kickoff_at")
    .limit(limit);
  if (error) throw new Error(`matchs candidats : ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

// ----------------------------------------------------------------------------
// build-contexts : dossiers des matchs de la fenêtre qui n'en ont pas (2 appels / match au plus)
// ----------------------------------------------------------------------------
export async function buildContexts(ctx: SyncContext): Promise<void> {
  const windowHours = await predictionWindowHours(ctx);
  const candidates = await upcomingCandidates(ctx, windowHours, 200);
  if (candidates.length === 0) {
    ctx.details.pending = 0;
    return;
  }

  const { data: existing, error } = await ctx.db.from("match_contexts").select("fixture_id").in("fixture_id", candidates);
  if (error) throw new Error(`match_contexts : ${error.message}`);
  const done = new Set((existing ?? []).map((row) => row.fixture_id));
  const todo = candidates.filter((id) => !done.has(id));
  ctx.details.pending = todo.length;

  for (const fixtureId of todo.slice(0, BUILD_CONTEXTS_MAX_PER_RUN)) {
    if (ctx.timeLeft() < 2 * MIN_TIME_FOR_CALL_MS) {
      ctx.error("Temps limite atteint : dossiers restants reportés à la prochaine exécution.");
      break;
    }
    try {
      await buildMatchContext(ctx.db, ctx.api, fixtureId);
      ctx.processed(1);
    } catch (e) {
      if ((e as Error).name === "BudgetExceededError") throw e;
      ctx.error(`Dossier du match ${fixtureId} : ${(e as Error).message}`);
    }
  }
}

// ----------------------------------------------------------------------------
// generate-predictions : par lots de 5, dans la limite quotidienne AI_DAILY_GENERATION_LIMIT
// ----------------------------------------------------------------------------
export async function generatePredictions(ctx: SyncContext): Promise<void> {
  const env = getServerEnvKeys(["OPENAI_API_KEY", "OPENAI_MODEL", "AI_DAILY_GENERATION_LIMIT"]);

  // Matchs déjà analysés aujourd'hui (succès ou échec) : limite quotidienne.
  const { data: runsToday, error: runsError } = await ctx.db
    .from("ai_generation_runs")
    .select("fixture_id, status")
    .gte("created_at", startOfUtcDay(ctx.now));
  if (runsError) throw new Error(`ai_generation_runs : ${runsError.message}`);
  const analyzedToday = new Set((runsToday ?? []).map((r) => r.fixture_id));
  const failures = new Map<number, number>();
  for (const r of runsToday ?? []) {
    if (r.status === "failed" && r.fixture_id !== null) failures.set(r.fixture_id, (failures.get(r.fixture_id) ?? 0) + 1);
  }
  const remaining = env.AI_DAILY_GENERATION_LIMIT - analyzedToday.size;
  ctx.details.dailyLimit = env.AI_DAILY_GENERATION_LIMIT;
  ctx.details.analyzedToday = analyzedToday.size;
  if (remaining <= 0) {
    ctx.error(`Limite quotidienne de générations atteinte (${env.AI_DAILY_GENERATION_LIMIT}).`);
    return;
  }

  // Matchs à venir avec dossier mais sans aucun pronostic.
  const windowHours = await predictionWindowHours(ctx);
  const candidates = await upcomingCandidates(ctx, windowHours, 200);
  if (candidates.length === 0) return;
  const [contexts, predictions] = await Promise.all([
    ctx.db.from("match_contexts").select("fixture_id").in("fixture_id", candidates),
    ctx.db.from("predictions").select("fixture_id").in("fixture_id", candidates),
  ]);
  if (contexts.error) throw new Error(contexts.error.message);
  if (predictions.error) throw new Error(predictions.error.message);
  const withContext = new Set((contexts.data ?? []).map((r) => r.fixture_id));
  const withPredictions = new Set((predictions.data ?? []).map((r) => r.fixture_id));

  const todo = candidates
    .filter((id) => withContext.has(id) && !withPredictions.has(id))
    .filter((id) => (failures.get(id) ?? 0) < MAX_FAILED_ATTEMPTS_PER_DAY)
    .slice(0, Math.min(GENERATION_BATCH_SIZE, remaining));
  ctx.details.pending = todo.length;

  for (const fixtureId of todo) {
    const left = ctx.timeLeft();
    if (left < 20_000) {
      ctx.error("Temps limite atteint : générations restantes reportées à la prochaine exécution.");
      break;
    }
    const result = await generateForFixture(ctx.db, fixtureId, {
      mode: "initial",
      timeoutMs: Math.min(60_000, left - 8_000),
      openai: { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL },
    });
    if (result.ok) ctx.processed(1);
    else ctx.error(`Match ${fixtureId} : ${result.error}${result.errors.length ? ` (${result.errors.join(" ; ")})` : ""}`);
  }
}
