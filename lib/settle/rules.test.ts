import { describe, expect, it } from "vitest";
import shared from "@/tests/fixtures/settlement-cases.json";
import {
  InvalidSelectionError,
  MissingHalfTimeScoreError,
  MissingStatisticsError,
  parseCombo,
  regulationScore,
  settleBtts,
  settleExactScore,
  settleMatchResult,
  settleOverUnder25,
  settlePrediction,
  successRate,
} from "./rules";

describe("table de cas partagée (TypeScript ↔ SQL)", () => {
  it.each(shared.cases)("$market $selection sur $home-$away → $expected", (c) => {
    const ht = "ht_home" in c && "ht_away" in c ? { home: Number(c.ht_home), away: Number(c.ht_away) } : null;
    const stats = "corners" in c && "cards" in c ? { corners: Number(c.corners), cards: Number(c.cards) } : null;
    expect(settlePrediction(c.market, c.selection, { home: c.home, away: c.away }, ht, stats)).toBe(c.expected);
  });

  it("corners et cartons : statistiques obligatoires", () => {
    const s = { home: 1, away: 0 };
    expect(() => settlePrediction("CORNERS_OVER_UNDER_9_5", "OVER", s)).toThrow(MissingStatisticsError);
    expect(() => settlePrediction("CARDS_OVER_UNDER_4_5", "UNDER", s, null, { corners: 10, cards: null })).toThrow(MissingStatisticsError);
    expect(() => settlePrediction("CORNERS_OVER_UNDER_9_5", "PLUS", s, null, { corners: 10, cards: 2 })).toThrow(InvalidSelectionError);
  });

  it("combiné : 2 ou 3 marchés distincts et autorisés, sélections valides", () => {
    const s = { home: 1, away: 0 };
    for (const sel of [
      "MATCH_RESULT:1",
      "MATCH_RESULT:1+BTTS:NO+OVER_UNDER_1_5:UNDER+DOUBLE_CHANCE:1N",
      "MATCH_RESULT:1+MATCH_RESULT:1",
      "EXACT_SCORE:1-0+BTTS:NO",
      "HT_RESULT:1+BTTS:NO",
      "MATCH_RESULT:X+BTTS:NO",
      "MATCH_RESULT:1+BTTS",
      "match_result:1+BTTS:NO",
      "",
    ]) {
      expect(() => settlePrediction("COMBO", sel, s), sel).toThrow(InvalidSelectionError);
    }
    expect(parseCombo("MATCH_RESULT:1+BTTS:NO")).toEqual([
      { market: "MATCH_RESULT", selection: "1" },
      { market: "BTTS", selection: "NO" },
    ]);
  });

  it("marchés mi-temps : score de la pause obligatoire", () => {
    expect(() => settlePrediction("HT_RESULT", "1", { home: 1, away: 0 })).toThrow(MissingHalfTimeScoreError);
    expect(() => settlePrediction("HT_FT", "1/1", { home: 1, away: 0 }, null)).toThrow(MissingHalfTimeScoreError);
  });

  it("sélections invalides des nouveaux marchés", () => {
    const s = { home: 1, away: 0 };
    for (const [m, sel] of [["DOUBLE_CHANCE", "1X"], ["OVER_UNDER_1_5", "PLUS"], ["OVER_UNDER_3_5", ""], ["HANDICAP", "HOME_-2.5"], ["HT_RESULT", "X"], ["HT_FT", "1-1"]]) {
      expect(() => settlePrediction(m, sel, s, s), `${m} ${sel}`).toThrow(InvalidSelectionError);
    }
  });
});

describe("règles par marché", () => {
  it("1N2", () => {
    expect(settleMatchResult("1", { home: 2, away: 1 })).toBe("won");
    expect(settleMatchResult("N", { home: 0, away: 0 })).toBe("won");
    expect(settleMatchResult("2", { home: 1, away: 2 })).toBe("won");
    expect(() => settleMatchResult("X", { home: 0, away: 0 })).toThrow(InvalidSelectionError);
  });

  it("score exact", () => {
    expect(settleExactScore("3-0", { home: 3, away: 0 })).toBe("won");
    expect(settleExactScore("0-3", { home: 3, away: 0 })).toBe("lost");
    expect(settleExactScore("10-0", { home: 10, away: 0 })).toBe("won");
    expect(() => settleExactScore("2:1", { home: 2, away: 1 })).toThrow(InvalidSelectionError);
  });

  it("plus / moins de 2,5 buts : limite à 3 buts", () => {
    expect(settleOverUnder25("OVER", { home: 2, away: 0 })).toBe("lost");
    expect(settleOverUnder25("OVER", { home: 2, away: 1 })).toBe("won");
    expect(settleOverUnder25("UNDER", { home: 1, away: 1 })).toBe("won");
    expect(() => settleOverUnder25("over", { home: 1, away: 1 })).toThrow(InvalidSelectionError);
  });

  it("les deux équipes marquent", () => {
    expect(settleBtts("YES", { home: 1, away: 0 })).toBe("lost");
    expect(settleBtts("NO", { home: 1, away: 0 })).toBe("won");
    expect(() => settleBtts("MAYBE", { home: 1, away: 1 })).toThrow(InvalidSelectionError);
  });

  it("marché inconnu", () => {
    expect(() => settlePrediction("CORNERS", "OVER", { home: 1, away: 1 })).toThrow(/Marché inconnu/);
  });
});

describe("score réglementaire (RG-F4-1, RG-F7-1)", () => {
  it("match AET : ft_home / ft_away, jamais le score après prolongation", () => {
    // 1-1 au temps réglementaire, 2-1 après prolongation (goals_home = 2 ignoré).
    const fixture = { status_short: "AET", ft_home: 1, ft_away: 1, goals_home: 2, goals_away: 1 };
    const score = regulationScore(fixture);
    expect(score).toEqual({ home: 1, away: 1 });
    expect(settlePrediction("MATCH_RESULT", "1", score!)).toBe("lost");
    expect(settlePrediction("MATCH_RESULT", "N", score!)).toBe("won");
  });

  it("tirs au but (PEN) : score réglementaire", () => {
    expect(regulationScore({ status_short: "PEN", ft_home: 0, ft_away: 0 })).toEqual({ home: 0, away: 0 });
  });

  it("non résoluble : statut non final ou score manquant", () => {
    expect(regulationScore({ status_short: "2H", ft_home: 1, ft_away: 0 })).toBeNull();
    expect(regulationScore({ status_short: "PST", ft_home: null, ft_away: null })).toBeNull();
    expect(regulationScore({ status_short: "FT", ft_home: null, ft_away: 1 })).toBeNull();
    expect(regulationScore({ status_short: "FT", ft_home: 2, ft_away: null })).toBeNull();
  });
});

describe("taux de réussite (RG-F8-1)", () => {
  it("gagnés / (gagnés + perdus), arrondi au dixième", () => {
    expect(successRate(2, 1)).toBe(66.7);
    expect(successRate(1, 0)).toBe(100);
    expect(successRate(0, 3)).toBe(0);
    expect(successRate(0, 0)).toBeNull();
  });
});
