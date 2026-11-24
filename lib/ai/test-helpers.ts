import type { MatchSummary } from "./context/summarize";
import type { PredictionOutput } from "./schema";

/** Données de test partagées par les tests unitaires du moteur IA. */

export const solidSummary: MatchSummary = {
  match: {
    competition: "Premier League",
    round: "Journée 13",
    kickoff_utc: "2026-11-22T15:00:00Z",
    venue: "Emirates Stadium",
    is_neutral_venue: false,
    competition_type: "league",
  },
  home: { name: "Arsenal", rank: 2, points: 27, played: 12, goals_for: 24, goals_against: 9, last5: "WWDWL", home_record: { w: 5, d: 1, l: 0 }, avg_goals_for: 2, avg_goals_against: 0.75, absences: [], match_stats: { matches: 5, avg_corners_for: 6.2, avg_corners_against: 3.8, avg_cards: 1.6 } },
  away: { name: "Chelsea", rank: 6, points: 20, played: 12, goals_for: 18, goals_against: 14, last5: "WLDWW", away_record: { w: 2, d: 2, l: 2 }, avg_goals_for: 1.5, avg_goals_against: 1.17, absences: [], match_stats: { matches: 4, avg_corners_for: 4.5, avg_corners_against: 5.5, avg_cards: 2.1 } },
  head_to_head: [
    { date: "2026-04-12", home: "Chelsea", away: "Arsenal", score: "1-1" },
    { date: "2025-10-04", home: "Arsenal", away: "Chelsea", score: "2-0" },
  ],
  provider_prediction: { advice: "Arsenal", percent: { home: "45%", draw: "30%", away: "25%" }, under_over: "-3.5" },
  data_quality: { has_standings: true, h2h_count: 2, is_friendly: false },
};

export const friendlySummary: MatchSummary = {
  ...solidSummary,
  match: { ...solidSummary.match, competition: "Matchs amicaux internationaux", competition_type: "friendly" },
  data_quality: { has_standings: false, h2h_count: 0, is_friendly: true },
};

export function validOutput(): PredictionOutput {
  return {
    summary: "Arsenal reçoit Chelsea avec une meilleure forme et un bilan à domicile solide. Chelsea reste dangereux en contre.",
    key_factors: ["Arsenal invaincu à domicile", "Défense d'Arsenal solide", "Chelsea irrégulier à l'extérieur"],
    markets: {
      MATCH_RESULT: { selection: "1", probabilities: { home: 52, draw: 26, away: 22 }, confidence: "medium", reasoning: "Arsenal est invaincu à domicile. Chelsea perd souvent à l'extérieur." },
      EXACT_SCORE: { selection: "2-1", probability: 12, confidence: "low", reasoning: "Un score serré est probable. Les deux attaques sont efficaces." },
      OVER_UNDER_2_5: { selection: "OVER", probability: 58, confidence: "medium", reasoning: "Les deux équipes marquent beaucoup. La moyenne dépasse 3 buts." },
      BTTS: { selection: "YES", probability: 55, confidence: "low", reasoning: "Chelsea marque à l'extérieur. Arsenal encaisse peu mais pas zéro." },
      DOUBLE_CHANCE: { selection: "1N", probability: 78, confidence: "medium", reasoning: "Arsenal perd rarement à domicile. Le nul reste possible." },
      HT_RESULT: {
        selection: "N",
        probabilities: { home: 38, draw: 44, away: 18 },
        confidence: "low",
        reasoning: "Les débuts de match sont souvent fermés. Arsenal accélère en seconde période.",
      },
      HT_FT: { selection: "N/1", probability: 22, confidence: "low", reasoning: "Égalité probable à la pause. Arsenal finit fort à domicile." },
      HANDICAP: { selection: "AWAY_+1.5", probability: 66, confidence: "medium", reasoning: "Chelsea perd rarement largement. Un écart d'un but est le plus probable." },
      OVER_UNDER_1_5: { selection: "OVER", probability: 78, confidence: "medium", reasoning: "Les deux équipes marquent souvent. Au moins deux buts sont probables." },
      OVER_UNDER_3_5: { selection: "UNDER", probability: 68, confidence: "medium", reasoning: "Quatre buts ou plus restent rares entre ces équipes. Les défenses sont correctes." },
      CORNERS_OVER_UNDER_9_5: { selection: "OVER", probability: 57, confidence: "medium", reasoning: "Arsenal obtient beaucoup de corners à domicile. Chelsea concède souvent des corners." },
      CARDS_OVER_UNDER_4_5: { selection: "UNDER", probability: 60, confidence: "medium", reasoning: "Ces équipes reçoivent peu de cartons. L'arbitrage en championnat reste mesuré." },
      COMBO: {
        legs: [
          { market: "DOUBLE_CHANCE", selection: "1N" },
          { market: "OVER_UNDER_1_5", selection: "OVER" },
        ],
        probability: 62,
        confidence: "low",
        reasoning: "Arsenal perd rarement à domicile et les deux équipes marquent souvent. Les deux sélections vont dans le même sens.",
      },
    },
  };
}
