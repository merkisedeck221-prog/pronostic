import { z } from "zod";

/** Réponses des fonctions SQL de suivi (get_my_predictions, get_performance_stats). */

const resultSchema = z.enum(["pending", "won", "lost", "void"]);
const nullableInt = z.number().int().nullable();

export const myPredictionSchema = z.object({
  prediction_id: z.number().int(),
  fixture_id: z.number().int(),
  market_code: z.string(),
  market_label: z.string(),
  selection_label: z.string(),
  result: resultSchema,
  refunded: z.boolean(),
  kickoff_at: z.string(),
  status_short: z.string(),
  ft_home: nullableInt,
  ft_away: nullableInt,
  goals_home: nullableInt,
  goals_away: nullableInt,
  home_name: z.string(),
  away_name: z.string(),
  competition_name: z.string(),
  // Historique détaillé (lot 5) : facultatifs pour rester compatibles avec l'ancienne fonction SQL.
  probability: z.number().int().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  prompt_version: z.string().nullable().optional(),
  credits_spent: z.number().int().nullable().optional(),
  unlocked_at: z.string().nullable().optional(),
  via_bundle: z.boolean().nullable().optional(),
  ht_home: nullableInt.optional(),
  ht_away: nullableInt.optional(),
});
export type MyPrediction = z.infer<typeof myPredictionSchema>;
export const myPredictionsSchema = z.array(myPredictionSchema);

const countsSchema = z.object({ won: z.number().int(), lost: z.number().int(), void: z.number().int() });
export type Counts = z.infer<typeof countsSchema>;

export const performanceStatsSchema = z.object({
  reveal_after_match: z.boolean(),
  global: countsSchema,
  last_30_days: countsSchema,
  by_market: z.array(countsSchema.extend({ code: z.string(), label: z.string() })),
  by_competition: z.array(countsSchema.extend({ id: z.number().int(), name: z.string(), slug: z.string() })),
  recent: z.array(
    z.object({
      fixture_id: z.number().int(),
      kickoff_at: z.string(),
      home_name: z.string(),
      away_name: z.string(),
      competition_name: z.string(),
      market_code: z.string(),
      market_label: z.string(),
      selection_label: z.string(),
      result: z.enum(["won", "lost"]),
      ft_home: nullableInt,
      ft_away: nullableInt,
    }),
  ),
});
export type PerformanceStats = z.infer<typeof performanceStatsSchema>;
