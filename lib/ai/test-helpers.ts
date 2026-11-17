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
  home: { name: "Arsenal", rank: 2, points: 27, played: 12, goals_for: 24, goals_against: 9, last5: "WWDWL", home_record: { w: 5, d: 1, l: 0 }, avg_goals_for: 2, avg_goals_against: 0.75, absences: [] },
  away: { name: "Chelsea", rank: 6, points: 20, played: 12, goals_for: 18, goals_against: 14, last5: "WLDWW", away_record: { w: 2, d: 2, l: 2 }, avg_goals_for: 1.5, avg_goals_against: 1.17, absences: [] },
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
    },
  };
}
