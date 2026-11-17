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
  }
}

/** Lignes prêtes à enregistrer (une par marché). */
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
    ...(["EXACT_SCORE", "OVER_UNDER_2_5", "BTTS"] as const).map((code) => ({
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
