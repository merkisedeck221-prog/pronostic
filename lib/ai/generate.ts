import "server-only";

import OpenAI from "openai";
import type { MatchSummary } from "./context/summarize";
import { estimateCostUsd } from "./pricing";
import { buildRetryMessageV4, buildUserMessageV4, PROMPT_VERSION, SYSTEM_PROMPT_V4 } from "./prompts/v4";
import { toOpenAiJsonSchema, type PredictionOutput } from "./schema";
import { validatePrediction } from "./validate";

/**
 * Appel OpenAI (section 8, étapes 3 et 4) : sortie structurée stricte,
 * température basse, délai maximal de 60 s, validation puis UN SEUL nouvel
 * essai en renvoyant les erreurs constatées.
 */

export const OPENAI_TIMEOUT_MS = 60_000;
export const TEMPERATURE = 0.3;

export type GenerationMetrics = {
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costEstimateUsd: number | null;
  durationMs: number;
  attempts: number;
};

export type GenerationResult =
  | { ok: true; output: PredictionOutput; raw: unknown; metrics: GenerationMetrics; adjustments: string[] }
  | { ok: false; error: string; errors: string[]; raw: unknown; metrics: GenerationMetrics };

/** Les modèles de raisonnement (o1, o3, gpt-5…) n'acceptent pas de température personnalisée. */
export function supportsTemperature(model: string): boolean {
  return !/^(o\d|gpt-5)/i.test(model);
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type GenerateOptions = {
  apiKey: string;
  model: string;
  /** Délai pour CET appel (≤ 60 s) : réduit si la tâche approche de sa limite de durée. */
  timeoutMs?: number;
  client?: Pick<OpenAI, "chat">;
  /** Appelé quand une réponse de l'IA est reçue, juste avant sa validation (suivi de l'animation). */
  onResponse?: () => void | Promise<void>;
};

export async function generatePrediction(summary: MatchSummary, options: GenerateOptions): Promise<GenerationResult> {
  const client = options.client ?? new OpenAI({ apiKey: options.apiKey, maxRetries: 1 });
  const timeout = Math.min(options.timeoutMs ?? OPENAI_TIMEOUT_MS, OPENAI_TIMEOUT_MS);
  const started = Date.now();
  const metrics: GenerationMetrics = {
    model: options.model,
    promptVersion: PROMPT_VERSION,
    inputTokens: 0,
    outputTokens: 0,
    costEstimateUsd: null,
    durationMs: 0,
    attempts: 0,
  };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_V4 },
    { role: "user", content: buildUserMessageV4(JSON.stringify(summary)) },
  ];

  let lastRaw: unknown = null;
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    metrics.attempts = attempt;
    const remaining = timeout - (Date.now() - started);
    if (remaining < 5_000) {
      lastErrors = [...lastErrors, "Délai maximal atteint avant le nouvel essai."];
      break;
    }

    let content: string | null = null;
    try {
      const completion = await client.chat.completions.create(
        {
          model: options.model,
          messages,
          ...(supportsTemperature(options.model) ? { temperature: TEMPERATURE } : {}),
          response_format: {
            type: "json_schema",
            json_schema: { name: "match_prediction", strict: true, schema: toOpenAiJsonSchema() },
          },
        },
        { timeout: remaining },
      );
      metrics.inputTokens += completion.usage?.prompt_tokens ?? 0;
      metrics.outputTokens += completion.usage?.completion_tokens ?? 0;
      const choice = completion.choices[0];
      if (choice?.message?.refusal) throw new Error(`Refus du modèle : ${choice.message.refusal}`);
      content = choice?.message?.content ?? null;
      if (!content) throw new Error(`Réponse vide (finish_reason : ${choice?.finish_reason ?? "?"})`);
    } catch (error) {
      metrics.durationMs = Date.now() - started;
      metrics.costEstimateUsd = estimateCostUsd(options.model, metrics.inputTokens, metrics.outputTokens);
      return { ok: false, error: `OpenAI : ${(error as Error).message}`, errors: lastErrors, raw: lastRaw, metrics };
    }

    try {
      lastRaw = JSON.parse(content);
    } catch {
      lastRaw = content;
      lastErrors = ["La réponse n'est pas un JSON valide."];
      messages.push({ role: "assistant", content }, { role: "user", content: buildRetryMessageV4(lastErrors) });
      continue;
    }

    await options.onResponse?.();
    const validation = validatePrediction(lastRaw, summary);
    if (validation.ok) {
      metrics.durationMs = Date.now() - started;
      metrics.costEstimateUsd = estimateCostUsd(options.model, metrics.inputTokens, metrics.outputTokens);
      if (validation.adjustments.length) console.info("[ai] corrections de confiance :", validation.adjustments.join(" | "));
      return { ok: true, output: validation.data, raw: lastRaw, metrics, adjustments: validation.adjustments };
    }
    lastErrors = validation.errors;
    messages.push({ role: "assistant", content }, { role: "user", content: buildRetryMessageV4(lastErrors) });
  }

  metrics.durationMs = Date.now() - started;
  metrics.costEstimateUsd = estimateCostUsd(options.model, metrics.inputTokens, metrics.outputTokens);
  return { ok: false, error: `Validation échouée après ${metrics.attempts} essai(s)`, errors: lastErrors, raw: lastRaw, metrics };
}
