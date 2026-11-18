import { describe, expect, it } from "vitest";
import { finalScoreLabel, formatRate, isSmallSample, isUpcomingPrediction, resultLabel } from "./labels";
import { myPredictionsSchema, performanceStatsSchema } from "./schemas";

describe("libellés de suivi", () => {
  it("statuts", () => {
    expect(resultLabel("pending")).toBe("En attente");
    expect(resultLabel("won")).toBe("Gagné");
    expect(resultLabel("lost")).toBe("Perdu");
    expect(resultLabel("void")).toBe("Annulé");
    expect(resultLabel("void", true)).toBe("Annulé et remboursé");
  });

  it("taux et échantillon", () => {
    expect(formatRate(2, 1).replace(/\s/g, " ")).toBe("66,7 %");
    expect(formatRate(0, 0)).toBe("—");
    expect(isSmallSample(30, 19)).toBe(true);
    expect(isSmallSample(30, 20)).toBe(false);
    expect(isUpcomingPrediction({ result: "pending" })).toBe(true);
    expect(isUpcomingPrediction({ result: "void" })).toBe(false);
  });

  it("score final : temps réglementaire, puis prolongation", () => {
    const base = { goals_home: null, goals_away: null };
    expect(finalScoreLabel({ status_short: "FT", ft_home: 2, ft_away: 1, ...base })).toBe("2 – 1");
    expect(finalScoreLabel({ status_short: "AET", ft_home: 1, ft_away: 1, goals_home: 2, goals_away: 1 })).toBe("1 – 1 (2 – 1 a.p.)");
    expect(finalScoreLabel({ status_short: "PEN", ft_home: 0, ft_away: 0, goals_home: 0, goals_away: 0 })).toBe("0 – 0 (t.a.b.)");
    expect(finalScoreLabel({ status_short: "NS", ft_home: null, ft_away: null, ...base })).toBeNull();
    expect(finalScoreLabel({ status_short: "FT", ft_home: null, ft_away: 1, ...base })).toBeNull();
  });
});

describe("schémas des réponses SQL", () => {
  it("valident les formats attendus", () => {
    expect(
      myPredictionsSchema.safeParse([
        {
          prediction_id: 1, fixture_id: 2, market_code: "BTTS", market_label: "Les deux équipes marquent", selection_label: "Oui",
          result: "won", refunded: false, kickoff_at: "2026-11-18T15:00:00+00:00", status_short: "FT", ft_home: 1, ft_away: 1,
          goals_home: 1, goals_away: 1, home_name: "A", away_name: "B", competition_name: "C", market_order: 4, unlocked_at: "x",
        },
      ]).success,
    ).toBe(true);
    const counts = { won: 1, lost: 1, void: 0 };
    expect(
      performanceStatsSchema.safeParse({
        reveal_after_match: false, global: counts, last_30_days: counts, by_market: [], by_competition: [], recent: [],
      }).success,
    ).toBe(true);
    expect(performanceStatsSchema.safeParse({ global: counts }).success).toBe(false);
  });
});
