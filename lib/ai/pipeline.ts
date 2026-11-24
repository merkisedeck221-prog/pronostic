import "server-only";

import { getServerEnvKeys } from "@/lib/env";
import type { DB } from "@/lib/sync/runner";
import type { Json } from "@/types/database";
import type { MatchSummary } from "./context/summarize";
import { generatePrediction, type GenerationMetrics } from "./generate";
import { toPredictionRows } from "./labels";
import { PROMPT_VERSION } from "./prompts/v3";

/**
 * Génération complète pour un match (section 8, étapes 3 à 5) :
 * dossier (match_contexts.summary) → OpenAI → validation → enregistrement
 * atomique (save_ai_generation). Un échec est tracé dans ai_generation_runs.
 */

export type PipelineResult =
  | { ok: true; fixtureId: number; saved: number; output: unknown; metrics: GenerationMetrics }
  | { ok: false; fixtureId: number; error: string; errors: string[]; raw: unknown; metrics?: GenerationMetrics };

export type PipelineOptions = {
  mode: "initial" | "regenerate";
  changedBy?: string | null;
  reason?: string | null;
  /** Délai OpenAI pour cet appel (≤ 60 s). */
  timeoutMs?: number;
  openai?: { apiKey: string; model: string };
};

export async function generateForFixture(db: DB, fixtureId: number, options: PipelineOptions): Promise<PipelineResult> {
  const openai = options.openai ?? (() => {
    const env = getServerEnvKeys(["OPENAI_API_KEY", "OPENAI_MODEL"]);
    return { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL };
  })();

  const { data: fixture, error } = await db
    .from("fixtures")
    .select("id, home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name), match_contexts(summary)")
    .eq("id", fixtureId)
    .single();
  if (error || !fixture) return { ok: false, fixtureId, error: `Match introuvable : ${error?.message}`, errors: [], raw: null };

  const contextRow = Array.isArray(fixture.match_contexts) ? fixture.match_contexts[0] : fixture.match_contexts;
  const summary = contextRow?.summary as unknown as MatchSummary | undefined;
  if (!summary?.match) return { ok: false, fixtureId, error: "Dossier de match absent (build-contexts).", errors: [], raw: null };

  const generation = await generatePrediction(summary, { apiKey: openai.apiKey, model: openai.model, timeoutMs: options.timeoutMs });

  if (!generation.ok) {
    const errorText = [generation.error, ...generation.errors].join("\n").slice(0, 4000);
    await db.from("ai_generation_runs").insert({
      fixture_id: fixtureId,
      status: "failed",
      model: generation.metrics.model,
      prompt_version: PROMPT_VERSION,
      input_tokens: generation.metrics.inputTokens,
      output_tokens: generation.metrics.outputTokens,
      cost_estimate_usd: generation.metrics.costEstimateUsd,
      duration_ms: generation.metrics.durationMs,
      error: errorText,
    });
    return { ok: false, fixtureId, error: generation.error, errors: generation.errors, raw: generation.raw, metrics: generation.metrics };
  }

  const rows = toPredictionRows(generation.output, { home: fixture.home.name, away: fixture.away.name });
  const { data: saved, error: saveError } = await db.rpc("save_ai_generation", {
    p_fixture_id: fixtureId,
    p_mode: options.mode,
    p_analysis: { summary: generation.output.summary, key_factors: generation.output.key_factors } as unknown as Json,
    p_predictions: rows as unknown as Json,
    p_run: {
      model: generation.metrics.model,
      prompt_version: generation.metrics.promptVersion,
      input_tokens: generation.metrics.inputTokens,
      output_tokens: generation.metrics.outputTokens,
      cost_estimate_usd: generation.metrics.costEstimateUsd,
      duration_ms: generation.metrics.durationMs,
    } as unknown as Json,
    p_changed_by: options.changedBy ?? undefined,
    p_reason: options.reason ?? undefined,
  });
  if (saveError) {
    await db.from("ai_generation_runs").insert({
      fixture_id: fixtureId,
      status: "failed",
      model: generation.metrics.model,
      prompt_version: PROMPT_VERSION,
      input_tokens: generation.metrics.inputTokens,
      output_tokens: generation.metrics.outputTokens,
      cost_estimate_usd: generation.metrics.costEstimateUsd,
      duration_ms: generation.metrics.durationMs,
      error: `Enregistrement refusé : ${saveError.message}`,
    });
    return { ok: false, fixtureId, error: `Enregistrement refusé : ${saveError.message}`, errors: [], raw: generation.raw, metrics: generation.metrics };
  }

  return {
    ok: true,
    fixtureId,
    saved: (saved as { saved?: number } | null)?.saved ?? rows.length,
    output: generation.output,
    metrics: generation.metrics,
  };
}
