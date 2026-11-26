import { z } from "zod";

/**
 * Schéma de la réponse de get_fixture_public_context (partie gratuite).
 * Toute clé inattendue est ignorée : seules ces données atteignent l'interface.
 */

const formEntrySchema = z.object({
  fixture_id: z.number().nullish(),
  date: z.string(),
  venue: z.enum(["home", "away"]),
  opponent: z.string(),
  opponent_logo: z.string().nullish(),
  goals_for: z.number(),
  goals_against: z.number(),
  result: z.enum(["W", "D", "L"]),
});

const standingSchema = z.object({
  rank: z.number(),
  points: z.number(),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  goal_diff: z.number(),
  group_name: z.string().nullish(),
  form: z.string().nullish(),
});

/** Moyennes sur les derniers matchs terminés qui ont des statistiques (5 au plus). */
const teamStatsSchema = z.object({
  matches: z.number(),
  corners_for: z.number().nullish(),
  corners_against: z.number().nullish(),
  cards: z.number().nullish(),
});

const sideSchema = z.object({
  team_id: z.number(),
  form: z.array(formEntrySchema).default([]),
  form_string: z.string().nullish(),
  standing: standingSchema.nullish(),
  stats: teamStatsSchema.nullish(),
  /** null : absences inconnues (pas de dossier) ; [] : aucune absence signalée. */
  absences: z.array(z.string()).nullish(),
});

const h2hSchema = z.object({
  fixture_id: z.number().nullish(),
  date: z.string().nullish(),
  home: z.string().nullish(),
  away: z.string().nullish(),
  goals_home: z.number().nullish(),
  goals_away: z.number().nullish(),
  score: z.string().nullish(),
});

export const fixtureContextSchema = z.object({
  fixture_id: z.number(),
  home: sideSchema,
  away: sideSchema,
  head_to_head: z.array(h2hSchema).default([]),
  has_standings: z.boolean().default(false),
});

export type FixtureContext = z.infer<typeof fixtureContextSchema>;
export type FormEntry = z.infer<typeof formEntrySchema>;
export type HeadToHead = z.infer<typeof h2hSchema>;
export type TeamStats = z.infer<typeof teamStatsSchema>;

/** Moyennes de buts marqués / encaissés sur la forme récente (null si aucun match). */
export function formAverages(side: { form: FormEntry[] }): { scored: number; conceded: number; matches: number } | null {
  if (side.form.length === 0) return null;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const scored = side.form.reduce((sum, m) => sum + m.goals_for, 0) / side.form.length;
  const conceded = side.form.reduce((sum, m) => sum + m.goals_against, 0) / side.form.length;
  return { scored: round1(scored), conceded: round1(conceded), matches: side.form.length };
}
export type ContextStanding = z.infer<typeof standingSchema>;

/** Résultats V/N/D à afficher : matchs en base, sinon la chaîne de forme (« WDLWW »). */
export function formResults(side: FixtureContext["home"]): ("W" | "D" | "L")[] {
  if (side.form.length > 0) return side.form.map((entry) => entry.result);
  return (side.form_string ?? "").split("").filter((c): c is "W" | "D" | "L" => c === "W" || c === "D" || c === "L");
}
