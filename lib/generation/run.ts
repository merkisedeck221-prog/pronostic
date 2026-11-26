import { finishGenerationResultSchema, startGenerationResultSchema, type GenerationOutcome } from "./schemas";

/**
 * Orchestration d'une demande de génération (lot 3), indépendante de Supabase
 * et d'OpenAI pour être testée : les dépendances sont injectées.
 *
 * 1. start_generation : « generate » (cette demande lance l'IA), « wait » (une
 *    autre demande du même match génère déjà : on attend son résultat
 *    mutualisé) ou « none » (déjà terminée).
 * 2. generate : limite quotidienne d'IA → dossier du match → IA → enregistrement.
 * 3. complete_generation si le résultat existe (accès donné, réservation
 *    définitive), sinon fail_generation (crédits rendus).
 * Toute erreur inattendue rend les crédits : jamais de débit sans résultat.
 */
export type GenerationDeps = {
  start: (requestId: string) => Promise<unknown>;
  complete: (requestId: string) => Promise<unknown>;
  fail: (requestId: string, error: string) => Promise<unknown>;
  /** Le match a-t-il déjà des pronostics publiés (pour cette demande) ? */
  hasResult: (fixtureId: number) => Promise<boolean>;
  /** Limite quotidienne de générations IA atteinte ? */
  dailyLimitReached: () => Promise<boolean>;
  /** Dossier + IA + enregistrement. `alreadyGenerated` : un autre traitement l'a fait entre-temps. */
  generate: (fixtureId: number) => Promise<{ ok: true } | { ok: false; error: string; alreadyGenerated?: boolean }>;
  sleep: (ms: number) => Promise<void>;
  /** Phase réelle en cours (animation) ; facultatif, jamais bloquant. */
  stage?: (requestId: string, stage: "starting" | "fixture" | "context" | "waiting") => Promise<unknown>;
};

export const WAIT_STEP_MS = 3_000;
export const WAIT_MAX_STEPS = 15;

const FAILED_MESSAGE = "L'analyse n'a pas pu être produite. Vos crédits ont été rendus.";

async function finish(deps: GenerationDeps, requestId: string): Promise<GenerationOutcome> {
  const done = finishGenerationResultSchema.safeParse(await deps.complete(requestId));
  if (done.success && done.data.status === "succeeded") return { status: "succeeded" };
  return { status: "failed", message: FAILED_MESSAGE };
}

export async function runGeneration(deps: GenerationDeps, requestId: string): Promise<GenerationOutcome> {
  const stage = async (name: "starting" | "fixture" | "context" | "waiting") => {
    try {
      await deps.stage?.(requestId, name);
    } catch {
      /* suivi d'affichage seulement : n'interrompt jamais la génération */
    }
  };
  try {
    await stage("starting");
    for (let step = 0; step <= WAIT_MAX_STEPS; step++) {
      const started = startGenerationResultSchema.safeParse(await deps.start(requestId));
      if (!started.success || !started.data.ok) return { status: "failed", message: "Demande introuvable." };
      const { action, status, fixture_id: fixtureId } = started.data;

      if (action === "none") {
        if (status === "succeeded") return { status: "succeeded" };
        if (status === "failed") return { status: "failed", message: FAILED_MESSAGE };
        return { status: "pending", message: "L'analyse est en cours. Revenez dans quelques minutes." };
      }
      if (fixtureId === undefined) return { status: "failed", message: "Demande invalide." };
      await stage(action === "wait" ? "waiting" : "fixture");

      if (action === "wait") {
        // Résultat mutualisé : un autre utilisateur a déjà lancé l'analyse de ce match.
        if (await deps.hasResult(fixtureId)) return finish(deps, requestId);
        await deps.sleep(WAIT_STEP_MS);
        continue;
      }

      // action === "generate"
      if (await deps.hasResult(fixtureId)) return finish(deps, requestId);
      if (await deps.dailyLimitReached()) {
        await deps.fail(requestId, "Limite quotidienne d'analyses IA atteinte");
        return { status: "failed", message: "La limite quotidienne d'analyses est atteinte. Vos crédits ont été rendus ; réessayez demain." };
      }
      await stage("context");
      const result = await deps.generate(fixtureId);
      if (result.ok || result.alreadyGenerated) return finish(deps, requestId);
      await deps.fail(requestId, result.error.slice(0, 1000));
      return { status: "failed", message: FAILED_MESSAGE };
    }
    return { status: "pending", message: "L'analyse est en cours. Revenez dans quelques minutes : vous serez notifié." };
  } catch (error) {
    // Échec inattendu : on rend les crédits (fail_generation est idempotente).
    try {
      await deps.fail(requestId, `Erreur inattendue : ${(error as Error).message}`.slice(0, 1000));
    } catch {
      /* le filet de sécurité Cron libérera la réservation */
    }
    return { status: "failed", message: FAILED_MESSAGE };
  }
}
