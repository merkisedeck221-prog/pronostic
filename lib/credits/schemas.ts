import { z } from "zod";

/**
 * Schémas Zod des réponses des fonctions SQL de crédits (section 10).
 * Les réponses sont validées avant usage : un format inattendu = erreur, jamais une donnée devinée.
 */

export const CREDIT_ERROR_CODES = [
  "NOT_AUTHENTICATED",
  "BANNED",
  "MAINTENANCE",
  "NOT_AVAILABLE",
  "MATCH_STARTED",
  "ALREADY_UNLOCKED",
  "INSUFFICIENT_BALANCE",
  "FORBIDDEN",
  "INVALID_INPUT",
] as const;

export type CreditErrorCode = (typeof CREDIT_ERROR_CODES)[number] | "UNKNOWN";

export const marketCodeSchema = z.string().regex(/^[A-Z0-9_]{1,40}$/);

/** Entrée d'un déblocage : marché, ou null = match complet. Le prix n'en fait JAMAIS partie. */
export const unlockInputSchema = z.object({
  fixtureId: z.number().int().positive(),
  marketCode: marketCodeSchema.nullable(),
});
export type UnlockInput = z.infer<typeof unlockInputSchema>;

const errorSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string().optional(),
  price: z.number().int().optional(),
  balance: z.number().int().optional(),
});

export const unlockResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    new_balance: z.number().int().nonnegative(),
    credits_spent: z.number().int().nonnegative(),
    market_code: z.string().nullable().optional(),
  }),
  errorSchema,
]);

export const priceResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    price: z.number().int().nonnegative(),
    base_price: z.number().int().nonnegative(),
    deduction: z.number().int().nonnegative(),
  }),
  errorSchema,
]);

export const adjustResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), new_balance: z.number().int().nonnegative(), transaction_id: z.number().int() }),
  errorSchema,
]);

const probabilitiesSchema = z.object({ home: z.number(), draw: z.number(), away: z.number() });

export const marketViewSchema = z.object({
  code: z.string(),
  label: z.string(),
  unlocked: z.boolean(),
  price: z.number().int().nonnegative().nullable(),
  purchasable: z.boolean(),
  revealed: z.boolean(),
  // Présents UNIQUEMENT si revealed = true (contrôlé par la fonction SQL).
  selection: z.string().optional(),
  selection_label: z.string().optional(),
  probability: z.number().optional(),
  probabilities: probabilitiesSchema.nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  reasoning: z.string().optional(),
  result: z.enum(["pending", "won", "lost", "void"]).optional(),
});
export type MarketView = z.infer<typeof marketViewSchema>;

export const fixturePredictionsSchema = z.object({
  fixture_id: z.number().int(),
  is_finished: z.boolean(),
  unlocks_open: z.boolean(),
  pricing_mode: z.string(),
  match_bundle: z.object({
    unlocked: z.boolean(),
    offered: z.boolean(),
    price: z.number().int().nonnegative().nullable(),
    base_price: z.number().int().nonnegative().nullable(),
    purchasable: z.boolean(),
  }),
  markets: z.array(marketViewSchema),
  analysis: z
    .object({ summary: z.string(), key_factors: z.array(z.string()) })
    .nullable(),
});
export type FixturePredictions = z.infer<typeof fixturePredictionsSchema>;
