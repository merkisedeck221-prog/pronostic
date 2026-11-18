/** Filtres des matchs (admin) : statuts API-Football regroupés. */
export const FIXTURE_STATUS_GROUPS = {
  "a-venir": ["NS", "TBD"],
  "en-cours": ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"],
  termine: ["FT", "AET", "PEN"],
  annule: ["PST", "CANC", "ABD", "AWD", "WO"],
} as const;

export type FixtureStatusGroup = keyof typeof FIXTURE_STATUS_GROUPS | "tous";
export const FIXTURE_STATUS_FILTERS = ["tous", "a-venir", "en-cours", "termine", "annule"] as const;
export const PREDICTION_FILTERS = ["tous", "avec", "sans"] as const;
export const PUBLISHED_FILTERS = ["tous", "publies", "masques"] as const;

export function statusesFor(group: FixtureStatusGroup): readonly string[] | null {
  return group === "tous" ? null : FIXTURE_STATUS_GROUPS[group];
}
