import { creditFailure, type CreditFailure } from "./errors";
import {
  adjustResultSchema,
  fixturePredictionsSchema,
  priceResultSchema,
  unlockResultSchema,
  type FixturePredictions,
} from "./schemas";

/**
 * Traduction PURE des réponses JSON des fonctions SQL en résultats typés
 * (testée sans base). Toute réponse au format inattendu devient UNKNOWN.
 */

export type UnlockSuccess = { ok: true; newBalance: number; creditsSpent: number };
export type UnlockOutcome = UnlockSuccess | (CreditFailure & { price?: number; balance?: number });

export function parseUnlockResult(data: unknown): UnlockOutcome {
  const parsed = unlockResultSchema.safeParse(data);
  if (!parsed.success) return creditFailure("UNKNOWN");
  if (parsed.data.ok) return { ok: true, newBalance: parsed.data.new_balance, creditsSpent: parsed.data.credits_spent };
  const { code, message, price, balance } = parsed.data;
  return { ...creditFailure(code, message), price, balance };
}

export type PriceOutcome = { ok: true; price: number; basePrice: number; deduction: number } | CreditFailure;

export function parsePriceResult(data: unknown): PriceOutcome {
  const parsed = priceResultSchema.safeParse(data);
  if (!parsed.success) return creditFailure("UNKNOWN");
  if (!parsed.data.ok) return creditFailure(parsed.data.code, parsed.data.message);
  return { ok: true, price: parsed.data.price, basePrice: parsed.data.base_price, deduction: parsed.data.deduction };
}

export type AdjustOutcome = { ok: true; newBalance: number; transactionId: number } | CreditFailure;

export function parseAdjustResult(data: unknown): AdjustOutcome {
  const parsed = adjustResultSchema.safeParse(data);
  if (!parsed.success) return creditFailure("UNKNOWN");
  if (!parsed.data.ok) return creditFailure(parsed.data.code, parsed.data.message);
  return { ok: true, newBalance: parsed.data.new_balance, transactionId: parsed.data.transaction_id };
}

/** null = match invisible ou réponse invalide. */
export function parseFixturePredictions(data: unknown): FixturePredictions | null {
  if (data === null || data === undefined) return null;
  const parsed = fixturePredictionsSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[credits] Réponse get_fixture_predictions invalide :", parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data;
}
