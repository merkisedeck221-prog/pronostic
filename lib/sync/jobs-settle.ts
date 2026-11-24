import "server-only";

import { REFUNDABLE_STATUSES, SETTLEABLE_STATUSES } from "@/lib/settle/rules";
import type { SyncContext } from "./runner";

/**
 * settle-predictions (toutes les 15 min, après sync-results). Aucun appel API.
 *  1. résout les matchs terminés (FT, AET, PEN) qui ont des pronostics pending
 *     → settle_fixture() (règles au temps réglementaire, idempotente) ;
 *  2. rembourse les matchs annulés ou reportés → refund_fixture() (la fonction
 *     SQL décide de l'éligibilité : report > 48 h ou sans nouvelle date).
 */

export const SETTLE_MAX_FIXTURES_PER_RUN = 200;
const REFUND_CANDIDATE_STATUSES = [...REFUNDABLE_STATUSES, "PST"] as const;

function unique(ids: number[]): number[] {
  return [...new Set(ids)];
}

export async function settlePredictions(ctx: SyncContext): Promise<void> {
  // 1. Matchs terminés avec des pronostics en attente.
  const { data: pending, error } = await ctx.db
    .from("predictions")
    .select("fixture_id, fixtures!inner(status_short, ft_home, ft_away)")
    .eq("result", "pending")
    .in("fixtures.status_short", [...SETTLEABLE_STATUSES])
    .not("fixtures.ft_home", "is", null)
    .not("fixtures.ft_away", "is", null)
    .limit(2000);
  if (error) throw new Error(`lecture des pronostics à résoudre : ${error.message}`);

  const toSettle = unique((pending ?? []).map((row) => row.fixture_id)).slice(0, SETTLE_MAX_FIXTURES_PER_RUN);
  let settled = 0;
  let voidedStats = 0;
  let waitingStats = 0;
  for (const fixtureId of toSettle) {
    const { data, error: rpcError } = await ctx.db.rpc("settle_fixture", { p_fixture_id: fixtureId });
    const result = data as { ok?: boolean; settled?: number; invalid?: number; voided?: number; waiting_stats?: number; code?: string } | null;
    if (rpcError || !result?.ok) {
      ctx.error(`Résolution du match ${fixtureId} : ${rpcError?.message ?? result?.code ?? "réponse invalide"}`);
      continue;
    }
    settled += result.settled ?? 0;
    // Corners / cartons : annulés et remboursés si prolongation ; en attente tant que les statistiques manquent.
    voidedStats += result.voided ?? 0;
    waitingStats += result.waiting_stats ?? 0;
    if ((result.invalid ?? 0) > 0) ctx.error(`Match ${fixtureId} : ${result.invalid} pronostic(s) à sélection invalide laissé(s) en attente`);
    ctx.processed(1);
  }

  // 2. Matchs annulés / reportés : pronostics en attente ou déblocages non remboursés.
  const [{ data: voidable, error: e1 }, { data: unrefunded, error: e2 }] = await Promise.all([
    ctx.db
      .from("predictions")
      .select("fixture_id, fixtures!inner(status_short)")
      .eq("result", "pending")
      .in("fixtures.status_short", [...REFUND_CANDIDATE_STATUSES])
      .limit(2000),
    ctx.db
      .from("unlocks")
      .select("fixture_id, fixtures!inner(status_short)")
      .is("refunded_at", null)
      .in("fixtures.status_short", [...REFUND_CANDIDATE_STATUSES])
      .limit(2000),
  ]);
  if (e1 || e2) throw new Error(`lecture des matchs annulés : ${(e1 ?? e2)!.message}`);

  const toRefund = unique([...(voidable ?? []), ...(unrefunded ?? [])].map((row) => row.fixture_id)).slice(0, SETTLE_MAX_FIXTURES_PER_RUN);
  let refunded = 0;
  let refundedCredits = 0;
  let notEligible = 0;
  for (const fixtureId of toRefund) {
    const { data, error: rpcError } = await ctx.db.rpc("refund_fixture", { p_fixture_id: fixtureId });
    const result = data as { ok?: boolean; code?: string; refunded_unlocks?: number; refunded_credits?: number } | null;
    if (rpcError) {
      ctx.error(`Remboursement du match ${fixtureId} : ${rpcError.message}`);
      continue;
    }
    if (!result?.ok) {
      // Reporté de moins de 48 h : rien à faire pour l'instant.
      if (result?.code === "NOT_ELIGIBLE") notEligible += 1;
      else ctx.error(`Remboursement du match ${fixtureId} : ${result?.code ?? "réponse invalide"}`);
      continue;
    }
    refunded += result.refunded_unlocks ?? 0;
    refundedCredits += result.refunded_credits ?? 0;
    ctx.processed(1);
  }

  Object.assign(ctx.details, {
    fixturesSettled: toSettle.length,
    predictionsSettled: settled,
    statsVoided: voidedStats,
    statsWaiting: waitingStats,
    fixturesRefundChecked: toRefund.length,
    unlocksRefunded: refunded,
    creditsRefunded: refundedCredits,
    postponedNotEligible: notEligible,
  });
}
