"use server";

import { z } from "zod";
import { buildMatchContext } from "@/lib/ai/context/build";
import { generateForFixture } from "@/lib/ai/pipeline";
import { requireUser } from "@/lib/auth/session";
import { getServerEnvKeys } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runJob, startOfUtcDay } from "@/lib/sync/runner";
import { runGeneration, type GenerationDeps } from "./run";
import {
  generationErrorMessage,
  generationInputSchema,
  requestGenerationResultSchema,
  type GenerationOutcome,
} from "./schemas";

export type RequestGenerationResult =
  | { ok: true; requestId: string; price: number; newBalance: number | null }
  | { ok: false; code: string; message: string };

/**
 * Étapes 1 à 4 du module 3 : vérification du solde, prix calculé EN BASE,
 * réservation des crédits. Reçoit seulement le match, le type d'analyse
 * (null = analyse complète) et une clé d'idempotence (double clic, rejeu).
 */
export async function requestGenerationAction(
  fixtureId: number,
  marketCode: string | null,
  idempotencyKey: string,
): Promise<RequestGenerationResult> {
  const user = await requireUser({ allowBanned: true });
  if (user.profile.is_banned) return { ok: false, code: "BANNED", message: generationErrorMessage("BANNED") };
  const input = generationInputSchema.safeParse({ fixtureId, marketCode, idempotencyKey });
  if (!input.success) return { ok: false, code: "INVALID_INPUT", message: generationErrorMessage("INVALID_INPUT") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_generation", {
    p_fixture_id: input.data.fixtureId,
    p_market_code: input.data.marketCode ?? "",
    p_idempotency_key: input.data.idempotencyKey,
  });
  const parsed = requestGenerationResultSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("[generation] request_generation :", error?.message ?? "réponse invalide");
    return { ok: false, code: "ERROR", message: generationErrorMessage(undefined) };
  }
  if (!parsed.data.ok) return { ok: false, code: parsed.data.code, message: generationErrorMessage(parsed.data.code, parsed.data.message) };
  return { ok: true, requestId: parsed.data.request_id, price: parsed.data.price, newBalance: parsed.data.new_balance ?? null };
}

/**
 * Étapes 5 à 7 : moteur IA puis validation (accès + débit définitif) ou
 * libération des crédits. Uniquement sur une demande de l'utilisateur
 * connecté (lecture RLS) ; les écritures passent par des fonctions SQL
 * réservées au serveur.
 */
export async function runGenerationAction(requestId: string): Promise<GenerationOutcome> {
  const user = await requireUser();
  const id = z.uuid().safeParse(requestId);
  if (!id.success) return { status: "failed", message: "Demande invalide." };

  // Propriété de la demande : la RLS ne renvoie que les demandes de l'utilisateur.
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("generation_requests")
    .select("id, fixture_id, market_code")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!request) return { status: "failed", message: "Demande introuvable." };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (error) {
    // Configuration serveur absente : la réservation sera libérée par le filet de sécurité (Cron, 10 min).
    console.error("[generation] client serveur indisponible :", (error as Error).message);
    return { status: "pending", message: "L'analyse n'a pas pu démarrer. Si elle n'aboutit pas, vos crédits seront rendus automatiquement sous 10 minutes." };
  }
  const rpcJson = async (fn: "start_generation" | "complete_generation", reqId: string) => {
    const { data, error } = await db.rpc(fn, { p_request_id: reqId });
    if (error) throw new Error(`${fn} : ${error.message}`);
    return data;
  };

  // Phase réelle pour l'animation PRONEX AI (fonction SQL réservée au serveur, sans effet sur les crédits).
  const setStage = async (stage: string) => {
    const { error } = await db.rpc("set_generation_stage", { p_request_id: id.data, p_stage: stage });
    if (error) console.error("[generation] set_generation_stage :", error.message);
  };

  const deps: GenerationDeps = {
    stage: (_reqId, stage) => setStage(stage),
    start: (reqId) => rpcJson("start_generation", reqId),
    complete: (reqId) => rpcJson("complete_generation", reqId),
    fail: async (reqId, error) => {
      const { data, error: rpcError } = await db.rpc("fail_generation", { p_request_id: reqId, p_error: error });
      if (rpcError) throw new Error(`fail_generation : ${rpcError.message}`);
      return data;
    },
    hasResult: async (fixtureId) => {
      let query = db
        .from("predictions")
        .select("id, markets!inner(is_active)", { count: "exact", head: true })
        .eq("fixture_id", fixtureId)
        .eq("status", "published")
        .eq("markets.is_active", true);
      if (request.market_code) query = query.eq("market_code", request.market_code);
      const { count } = await query;
      return (count ?? 0) > 0;
    },
    dailyLimitReached: async () => {
      const { AI_DAILY_GENERATION_LIMIT } = getServerEnvKeys(["AI_DAILY_GENERATION_LIMIT"]);
      const { data } = await db.from("ai_generation_runs").select("fixture_id").gte("created_at", startOfUtcDay(new Date()));
      return new Set((data ?? []).map((r) => r.fixture_id)).size >= AI_DAILY_GENERATION_LIMIT;
    },
    generate: async (fixtureId) => {
      let outcome: { ok: true } | { ok: false; error: string; alreadyGenerated?: boolean } = { ok: false, error: "Génération non lancée" };
      await runJob(
        "on-demand-generation",
        async (ctx) => {
          const { count } = await ctx.db.from("match_contexts").select("id", { count: "exact", head: true }).eq("fixture_id", fixtureId);
          if ((count ?? 0) === 0) await buildMatchContext(ctx.db, ctx.api, fixtureId);
          const result = await generateForFixture(ctx.db, fixtureId, {
            mode: "initial",
            onStage: (name) => setStage(name),
          });
          if (result.ok) {
            outcome = { ok: true };
            ctx.processed(1);
          } else {
            const error = [result.error, ...result.errors].join(" ; ");
            outcome = { ok: false, error, alreadyGenerated: error.includes("already_has_predictions") };
            ctx.error(error);
          }
        },
        { db, timeBudgetMs: 100_000 },
      ).catch((error: Error) => {
        outcome = { ok: false, error: error.message };
      });
      return outcome;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };

  return runGeneration(deps, id.data);
}
