import type { FixtureStatisticsItem } from "./schemas";

/**
 * Conversion de /fixtures/statistics en colonnes de fixtures (lot B).
 * Fonction PURE. Conventions d'API-Football : une valeur null pour une
 * statistique présente vaut 0 (ex. aucun carton rouge) ; une statistique
 * absente est inconnue (null).
 */

export type FixtureStatsUpdate = {
  corners_home: number | null;
  corners_away: number | null;
  cards_home: number | null;
  cards_away: number | null;
};

function statValue(item: FixtureStatisticsItem, type: string): number | null | undefined {
  const stat = item.statistics.find((s) => s.type.toLowerCase() === type.toLowerCase());
  if (!stat) return undefined;
  if (stat.value === null || stat.value === undefined) return 0;
  const n = typeof stat.value === "number" ? stat.value : Number.parseInt(stat.value, 10);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

function teamStats(item: FixtureStatisticsItem | undefined) {
  if (!item || item.statistics.length === 0) return { corners: null, cards: null };
  const corners = statValue(item, "Corner Kicks");
  const yellow = statValue(item, "Yellow Cards");
  const red = statValue(item, "Red Cards");
  const cards = yellow === undefined || yellow === null || red === null ? null : yellow + (red ?? 0);
  return { corners: corners ?? null, cards };
}

/** Statistiques des deux équipes, rattachées par identifiant API ; null si rien d'exploitable. */
export function fixtureStatsUpdate(
  items: FixtureStatisticsItem[],
  teams: { homeApiId: number; awayApiId: number },
): FixtureStatsUpdate | null {
  const home = teamStats(items.find((i) => i.team.id === teams.homeApiId));
  const away = teamStats(items.find((i) => i.team.id === teams.awayApiId));
  const update = {
    corners_home: home.corners !== null && away.corners !== null ? home.corners : null,
    corners_away: home.corners !== null && away.corners !== null ? away.corners : null,
    cards_home: home.cards !== null && away.cards !== null ? home.cards : null,
    cards_away: home.cards !== null && away.cards !== null ? away.cards : null,
  };
  return update.corners_home === null && update.cards_home === null ? null : update;
}
