import type { MarketCode, PredictionOutput } from "./schema";

/**
 * Libellés français clairs des sélections (predictions.selection_label),
 * ex. « Victoire d'Arsenal », « Plus de 2,5 buts ».
 */

/** « d'Arsenal », « de Chelsea », « du »… : élision devant voyelle ou h muet supposé. */
export function deName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüœ]/i.test(name.trim()) ? `d'${name}` : `de ${name}`;
}

export function selectionLabel(
  market: MarketCode,
  selection: string,
  teams: { home: string; away: string },
): string {
  switch (market) {
    case "MATCH_RESULT":
      if (selection === "1") return `Victoire ${deName(teams.home)}`;
      if (selection === "2") return `Victoire ${deName(teams.away)}`;
      return "Match nul";
    case "EXACT_SCORE": {
      const [h, a] = selection.split("-");
      return `${teams.home} ${h} – ${a} ${teams.away}`;
    }
    case "OVER_UNDER_2_5":
      return selection === "OVER" ? "Plus de 2,5 buts" : "Moins de 2,5 buts";
    case "BTTS":
      return selection === "YES" ? "Les deux équipes marquent" : "Au moins une équipe ne marque pas";
    case "DOUBLE_CHANCE":
      if (selection === "1N") return `Victoire ${deName(teams.home)} ou match nul`;
      if (selection === "N2") return `Match nul ou victoire ${deName(teams.away)}`;
      return `Victoire ${deName(teams.home)} ou ${deName(teams.away)} (pas de nul)`;
    case "HT_RESULT":
      return halfTimeLabel(selection, teams);
    case "HT_FT": {
      const [ht, ft] = selection.split("/");
      const end = selectionLabel("MATCH_RESULT", ft, teams);
      // Minuscule sur la première lettre seulement : les noms d'équipes gardent leur casse.
      return `${halfTimeLabel(ht, teams)}, puis ${end.charAt(0).toLowerCase()}${end.slice(1)} à la fin`;
    }
    case "HANDICAP":
      return {
        "HOME_-1.5": `${teams.home} gagne par 2 buts d'écart ou plus (−1,5)`,
        "AWAY_+1.5": `${teams.away} ne perd pas par 2 buts d'écart ou plus (+1,5)`,
        "HOME_+1.5": `${teams.home} ne perd pas par 2 buts d'écart ou plus (+1,5)`,
        "AWAY_-1.5": `${teams.away} gagne par 2 buts d'écart ou plus (−1,5)`,
      }[selection] ?? selection;
    case "OVER_UNDER_1_5":
      return selection === "OVER" ? "Plus de 1,5 but" : "Moins de 1,5 but";
    case "OVER_UNDER_3_5":
      return selection === "OVER" ? "Plus de 3,5 buts" : "Moins de 3,5 buts";
  }
}

/** « Arsenal mène à la mi-temps », « Égalité à la mi-temps ». */
function halfTimeLabel(selection: string, teams: { home: string; away: string }): string {
  if (selection === "1") return `${teams.home} mène à la mi-temps`;
  if (selection === "2") return `${teams.away} mène à la mi-temps`;
  return "Égalité à la mi-temps";
}

/** Lignes prêtes à enregistrer (une par marché ; les marchés inactifs sont ignorés par save_ai_generation). */
export function toPredictionRows(output: PredictionOutput, teams: { home: string; away: string }) {
  const m = output.markets;
  return [
    {
      market_code: "MATCH_RESULT",
      selection: m.MATCH_RESULT.selection,
      selection_label: selectionLabel("MATCH_RESULT", m.MATCH_RESULT.selection, teams),
      probability: { "1": m.MATCH_RESULT.probabilities.home, N: m.MATCH_RESULT.probabilities.draw, "2": m.MATCH_RESULT.probabilities.away }[
        m.MATCH_RESULT.selection
      ],
      probabilities: m.MATCH_RESULT.probabilities,
      confidence: m.MATCH_RESULT.confidence,
      reasoning: m.MATCH_RESULT.reasoning,
    },
    {
      market_code: "HT_RESULT",
      selection: m.HT_RESULT.selection,
      selection_label: selectionLabel("HT_RESULT", m.HT_RESULT.selection, teams),
      probability: { "1": m.HT_RESULT.probabilities.home, N: m.HT_RESULT.probabilities.draw, "2": m.HT_RESULT.probabilities.away }[
        m.HT_RESULT.selection
      ],
      probabilities: m.HT_RESULT.probabilities,
      confidence: m.HT_RESULT.confidence,
      reasoning: m.HT_RESULT.reasoning,
    },
    ...(
      ["EXACT_SCORE", "OVER_UNDER_2_5", "BTTS", "DOUBLE_CHANCE", "HT_FT", "HANDICAP", "OVER_UNDER_1_5", "OVER_UNDER_3_5"] as const
    ).map((code) => ({
      market_code: code,
      selection: m[code].selection,
      selection_label: selectionLabel(code, m[code].selection, teams),
      probability: m[code].probability,
      probabilities: null,
      confidence: m[code].confidence,
      reasoning: m[code].reasoning,
    })),
  ];
}
