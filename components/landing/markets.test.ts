import { describe, expect, it } from "vitest";
import { MARKET_CARDS } from "./markets";

/** Les 13 marchés de PRONEX (table `markets`, prompt v3/v4) : aucun ajout, aucun oubli. */
const PRONEX_MARKETS = [
  "MATCH_RESULT",
  "DOUBLE_CHANCE",
  "HANDICAP",
  "OVER_UNDER_1_5",
  "OVER_UNDER_2_5",
  "OVER_UNDER_3_5",
  "BTTS",
  "EXACT_SCORE",
  "HT_RESULT",
  "HT_FT",
  "CORNERS_OVER_UNDER_9_5",
  "CARDS_OVER_UNDER_4_5",
  "COMBO",
];

describe("landing : les 13 types de pronostics", () => {
  it("présente exactement les 13 marchés, dans l'ordre du brief, sans doublon", () => {
    expect(MARKET_CARDS.map((card) => card.code)).toEqual(PRONEX_MARKETS);
  });

  it("présente le Combiné IA comme portant sur un seul match", () => {
    const combo = MARKET_CARDS.find((card) => card.code === "COMBO");
    expect(combo?.text).toMatch(/même match/);
    expect(combo?.text).toMatch(/pas un ticket multi-matchs/);
  });
});
