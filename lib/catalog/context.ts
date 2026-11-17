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

const sideSchema = z.object({
  team_id: z.number(),
  form: z.array(formEntrySchema).default([]),
  form_string: z.string().nullish(),
  standing: standingSchema.nullish(),
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
export type ContextStanding = z.infer<typeof standingSchema>;

/** Résultats V/N/D à afficher : matchs en base, sinon la chaîne de forme (« WDLWW »). */
export function formResults(side: FixtureContext["home"]): ("W" | "D" | "L")[] {
  if (side.form.length > 0) return side.form.map((entry) => entry.result);
  return (side.form_string ?? "").split("").filter((c): c is "W" | "D" | "L" => c === "W" || c === "D" || c === "L");
}
