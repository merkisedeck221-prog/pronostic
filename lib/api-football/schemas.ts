import { z } from "zod";

/**
 * Schémas Zod des réponses API-Football v3 utilisées par l'application.
 * Seuls les champs exploités sont validés ; les autres sont ignorés.
 * Les champs souvent absents ou nuls dans l'API sont déclarés nullish.
 */

/**
 * Enveloppe commune. `errors` vaut [] quand tout va bien, ou un objet
 * { champ: message } quand l'API répond 200 avec une erreur (clé invalide,
 * saison non couverte par le forfait, quota dépassé…).
 */
export const envelopeSchema = z.object({
  get: z.string().optional(),
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  results: z.number().optional(),
  paging: z.object({ current: z.number(), total: z.number() }).partial().optional(),
  response: z.unknown(),
});

const nullableString = z.string().nullish();
const nullableNumber = z.number().nullish();

// ----------------------------------------------------------------------------
// /leagues
// ----------------------------------------------------------------------------
export const coverageSchema = z
  .object({
    fixtures: z
      .object({
        events: z.boolean().optional(),
        lineups: z.boolean().optional(),
        statistics_fixtures: z.boolean().optional(),
        statistics_players: z.boolean().optional(),
      })
      .partial()
      .optional(),
    standings: z.boolean().optional(),
    players: z.boolean().optional(),
    top_scorers: z.boolean().optional(),
    predictions: z.boolean().optional(),
    odds: z.boolean().optional(),
    injuries: z.boolean().optional(),
  })
  .partial();

export const leagueItemSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(), // "League" | "Cup"
    logo: nullableString,
  }),
  country: z.object({ name: nullableString, code: nullableString, flag: nullableString }).partial(),
  seasons: z
    .array(
      z.object({
        year: z.number(),
        start: nullableString,
        end: nullableString,
        current: z.boolean(),
        coverage: coverageSchema.nullish(),
      }),
    )
    .default([]),
});
export type LeagueItem = z.infer<typeof leagueItemSchema>;
export type Coverage = z.infer<typeof coverageSchema>;

// ----------------------------------------------------------------------------
// /teams
// ----------------------------------------------------------------------------
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: nullableString,
  country: nullableString,
  national: z.boolean().nullish(),
  logo: nullableString,
});

export const teamItemSchema = z.object({ team: teamSchema });
export type TeamItem = z.infer<typeof teamItemSchema>;

// ----------------------------------------------------------------------------
// /fixtures
// ----------------------------------------------------------------------------
const scorePairSchema = z.object({ home: nullableNumber, away: nullableNumber });

export const fixtureItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(), // ISO 8601, en UTC avec timezone=UTC
    timestamp: z.number().optional(),
    venue: z.object({ name: nullableString, city: nullableString }).partial().nullish(),
    status: z.object({ long: nullableString, short: z.string(), elapsed: nullableNumber }),
  }),
  league: z.object({ id: z.number(), season: z.number(), round: nullableString }),
  teams: z.object({
    home: z.object({ id: z.number(), name: z.string(), logo: nullableString }),
    away: z.object({ id: z.number(), name: z.string(), logo: nullableString }),
  }),
  goals: scorePairSchema,
  score: z
    .object({
      halftime: scorePairSchema.nullish(),
      fulltime: scorePairSchema.nullish(), // score à la fin du temps réglementaire
      extratime: scorePairSchema.nullish(),
      penalty: scorePairSchema.nullish(),
    })
    .partial(),
});
export type FixtureItem = z.infer<typeof fixtureItemSchema>;

// ----------------------------------------------------------------------------
// /standings
// ----------------------------------------------------------------------------
const standingStatsSchema = z.object({
  played: nullableNumber,
  win: nullableNumber,
  draw: nullableNumber,
  lose: nullableNumber,
  goals: z.object({ for: nullableNumber, against: nullableNumber }).partial().nullish(),
});

export const standingRowSchema = z.object({
  rank: z.number(),
  team: z.object({ id: z.number(), name: z.string(), logo: nullableString }),
  points: nullableNumber,
  goalsDiff: nullableNumber,
  group: nullableString,
  form: nullableString,
  all: standingStatsSchema,
});
export type StandingRow = z.infer<typeof standingRowSchema>;

export const standingsItemSchema = z.object({
  league: z.object({
    id: z.number(),
    season: z.number(),
    standings: z.array(z.array(standingRowSchema)).default([]),
  }),
});
export type StandingsItem = z.infer<typeof standingsItemSchema>;

// ----------------------------------------------------------------------------
// /status
// ----------------------------------------------------------------------------
export const statusSchema = z.object({
  subscription: z.object({ plan: nullableString, end: nullableString, active: z.boolean().nullish() }).partial().nullish(),
  requests: z.object({ current: z.number(), limit_day: z.number() }),
});
export type StatusResponse = z.infer<typeof statusSchema>;
