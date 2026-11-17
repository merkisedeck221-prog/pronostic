import { z } from "zod";

/**
 * Schémas Zod des réponses API-Football /predictions et /injuries
 * (champs utilisés pour le dossier de match uniquement).
 */

const num = z.union([z.number(), z.string()]).nullish();
const homeAwayTotal = z.object({ home: num, away: num, total: num }).partial().nullish();

const teamLeagueStatsSchema = z
  .object({
    form: z.string().nullish(),
    fixtures: z
      .object({ played: homeAwayTotal, wins: homeAwayTotal, draws: homeAwayTotal, loses: homeAwayTotal })
      .partial()
      .nullish(),
    goals: z
      .object({
        for: z.object({ total: homeAwayTotal, average: homeAwayTotal }).partial().nullish(),
        against: z.object({ total: homeAwayTotal, average: homeAwayTotal }).partial().nullish(),
      })
      .partial()
      .nullish(),
  })
  .partial();

const predictionTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  league: teamLeagueStatsSchema.nullish(),
});

const h2hItemSchema = z.object({
  fixture: z.object({ id: z.number(), date: z.string(), status: z.object({ short: z.string() }).partial().nullish() }),
  teams: z.object({ home: z.object({ id: z.number(), name: z.string() }), away: z.object({ id: z.number(), name: z.string() }) }),
  goals: z.object({ home: z.number().nullish(), away: z.number().nullish() }),
});

export const predictionsItemSchema = z.object({
  predictions: z
    .object({
      advice: z.string().nullish(),
      under_over: z.string().nullish(),
      percent: z.object({ home: z.string().nullish(), draw: z.string().nullish(), away: z.string().nullish() }).partial().nullish(),
    })
    .partial()
    .nullish(),
  teams: z.object({ home: predictionTeamSchema, away: predictionTeamSchema }),
  h2h: z.array(h2hItemSchema).default([]),
});
export type PredictionsItem = z.infer<typeof predictionsItemSchema>;

export const injuryItemSchema = z.object({
  player: z.object({ id: z.number().nullish(), name: z.string(), type: z.string().nullish(), reason: z.string().nullish() }),
  team: z.object({ id: z.number(), name: z.string().nullish() }),
});
export type InjuryItem = z.infer<typeof injuryItemSchema>;
