import { describe, expect, it } from "vitest";
import { z } from "zod";
import recorded from "@/tests/fixtures/api-football/fixture-statistics.json";
import { fixtureStatisticsItemSchema } from "./schemas";
import { fixtureStatsUpdate } from "./statistics";

const items = z.array(fixtureStatisticsItemSchema).parse(recorded.response);
const teams = { homeApiId: 463, awayApiId: 442 };

describe("fixtureStatsUpdate", () => {
  it("réponse enregistrée : corners et cartons (jaunes + rouges, null = 0)", () => {
    expect(fixtureStatsUpdate(items, teams)).toEqual({ corners_home: 3, corners_away: 5, cards_home: 6, cards_away: 1 });
  });

  it("rattache les équipes par identifiant, pas par ordre", () => {
    expect(fixtureStatsUpdate([...items].reverse(), teams)).toEqual({ corners_home: 3, corners_away: 5, cards_home: 6, cards_away: 1 });
    expect(fixtureStatsUpdate(items, { homeApiId: 442, awayApiId: 463 })).toEqual({ corners_home: 5, corners_away: 3, cards_home: 1, cards_away: 6 });
  });

  it("statistiques pas encore publiées ou équipe inconnue : null", () => {
    expect(fixtureStatsUpdate([], teams)).toBeNull();
    expect(fixtureStatsUpdate(items.map((i) => ({ ...i, statistics: [] })), teams)).toBeNull();
    expect(fixtureStatsUpdate(items, { homeApiId: 1, awayApiId: 442 })).toBeNull();
  });

  it("statistique absente pour une équipe : marché inconnu, l'autre conservé", () => {
    const noCorners = items.map((i, n) => (n === 1 ? { ...i, statistics: i.statistics.filter((s) => s.type !== "Corner Kicks") } : i));
    expect(fixtureStatsUpdate(noCorners, teams)).toEqual({ corners_home: null, corners_away: null, cards_home: 6, cards_away: 1 });
  });

  it("valeurs en texte acceptées, valeurs aberrantes refusées", () => {
    const text = items.map((i) => ({ ...i, statistics: i.statistics.map((s) => (s.type === "Corner Kicks" ? { ...s, value: "7" } : s)) }));
    expect(fixtureStatsUpdate(text, teams)?.corners_home).toBe(7);
    const bad = items.map((i) => ({ ...i, statistics: i.statistics.map((s) => (s.type === "Yellow Cards" ? { ...s, value: "abc" } : s)) }));
    expect(fixtureStatsUpdate(bad, teams)).toEqual({ corners_home: 3, corners_away: 5, cards_home: null, cards_away: null });
  });
});
