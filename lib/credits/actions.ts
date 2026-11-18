"use server";

import { requireAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { creditFailure } from "./errors";
import { parseAdjustResult, parseUnlockResult, type AdjustOutcome, type UnlockOutcome } from "./parse";
import { unlockInputSchema } from "./schemas";
import { z } from "zod";

/**
 * Déblocage d'un marché (marketCode) ou du match complet (marketCode null).
 * - Session vérifiée côté serveur ; la fonction SQL revérifie tout (auth.uid()).
 * - Le prix n'est JAMAIS reçu du navigateur : il est calculé par unlock_prediction.
 */
export async function unlockPredictionAction(fixtureId: number, marketCode: string | null): Promise<UnlockOutcome> {
  const user = await requireUser({ allowBanned: true });
  if (user.profile.is_banned) return creditFailure("BANNED");

  const input = unlockInputSchema.safeParse({ fixtureId, marketCode });
  if (!input.success) return creditFailure("INVALID_INPUT");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_prediction", {
    p_fixture_id: input.data.fixtureId,
    p_market_code: input.data.marketCode ?? "",
  });
  if (error) {
    // Ex. course gérée par la contrainte d'unicité (transaction annulée, aucun débit).
    if (error.message.includes("ALREADY_UNLOCKED")) return creditFailure("ALREADY_UNLOCKED");
    console.error("[credits] unlock_prediction :", error.message);
    return creditFailure("UNKNOWN");
  }
  return parseUnlockResult(data);
}

const adjustInputSchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().refine((n) => n !== 0, "Le montant doit être différent de 0."),
  reason: z.string().trim().min(3, "Un motif est obligatoire.").max(500),
});

/** Ajustement manuel du solde (admin). Branché à /admin/utilisateurs en phase 10. */
export async function adminAdjustBalanceAction(userId: string, amount: number, reason: string): Promise<AdjustOutcome> {
  await requireAdmin();
  const input = adjustInputSchema.safeParse({ userId, amount, reason });
  if (!input.success) return creditFailure("INVALID_INPUT", input.error.issues[0]?.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_balance", {
    p_user_id: input.data.userId,
    p_amount: input.data.amount,
    p_reason: input.data.reason,
  });
  if (error) {
    console.error("[credits] admin_adjust_balance :", error.message);
    return creditFailure("UNKNOWN");
  }
  return parseAdjustResult(data);
}
