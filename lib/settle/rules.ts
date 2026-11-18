/**
 * Résolution des pronostics (section 5, F4 et F7). Fonctions PURES.
 *
 * Le score utilisé est TOUJOURS celui du temps réglementaire (90 min + temps
 * additionnel), c'est-à-dire fixtures.ft_home / ft_away : prolongations et tirs
 * au but sont exclus (RG-F4-1). La même logique existe en SQL
 * (public.settle_outcome) ; tests/fixtures/settlement-cases.json sert aux deux.
 */

export type SettledResult = "won" | "lost";
export type RegulationScore = { home: number; away: number };

export const SETTLEABLE_STATUSES = ["FT", "AET", "PEN"] as const;
export const REFUNDABLE_STATUSES = ["CANC", "ABD"] as const;

export class InvalidSelectionError extends Error {
  constructor(market: string, selection: string) {
    super(`Sélection invalide pour ${market} : « ${selection} »`);
    this.name = "InvalidSelectionError";
  }
}

function outcome(won: boolean): SettledResult {
  return won ? "won" : "lost";
}

/** 1N2 : « 1 » domicile, « N » nul, « 2 » extérieur. */
export function settleMatchResult(selection: string, score: RegulationScore): SettledResult {
  const actual = score.home > score.away ? "1" : score.home < score.away ? "2" : "N";
  if (selection !== "1" && selection !== "N" && selection !== "2") throw new InvalidSelectionError("MATCH_RESULT", selection);
  return outcome(selection === actual);
}

/** Score exact « domicile-extérieur », ex. « 2-1 ». */
export function settleExactScore(selection: string, score: RegulationScore): SettledResult {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(selection);
  if (!match) throw new InvalidSelectionError("EXACT_SCORE", selection);
  return outcome(Number(match[1]) === score.home && Number(match[2]) === score.away);
}

/** Plus / moins de 2,5 buts : OVER si total ≥ 3, UNDER si total ≤ 2. */
export function settleOverUnder25(selection: string, score: RegulationScore): SettledResult {
  const total = score.home + score.away;
  if (selection === "OVER") return outcome(total >= 3);
  if (selection === "UNDER") return outcome(total <= 2);
  throw new InvalidSelectionError("OVER_UNDER_2_5", selection);
}

/** Les deux équipes marquent : YES si chacune a marqué au moins un but. */
export function settleBtts(selection: string, score: RegulationScore): SettledResult {
  const both = score.home > 0 && score.away > 0;
  if (selection === "YES") return outcome(both);
  if (selection === "NO") return outcome(!both);
  throw new InvalidSelectionError("BTTS", selection);
}

const SETTLERS: Record<string, (selection: string, score: RegulationScore) => SettledResult> = {
  MATCH_RESULT: settleMatchResult,
  EXACT_SCORE: settleExactScore,
  OVER_UNDER_2_5: settleOverUnder25,
  BTTS: settleBtts,
};

/** Résultat d'un pronostic ; lève une erreur pour un marché inconnu ou une sélection invalide. */
export function settlePrediction(market: string, selection: string, score: RegulationScore): SettledResult {
  const settle = SETTLERS[market];
  if (!settle) throw new Error(`Marché inconnu : ${market}`);
  return settle(selection, score);
}

/** Score réglementaire d'un match terminé ; null si le match n'est pas résoluble (RG-F7-1). */
export function regulationScore(fixture: {
  status_short: string;
  ft_home: number | null;
  ft_away: number | null;
}): RegulationScore | null {
  if (!(SETTLEABLE_STATUSES as readonly string[]).includes(fixture.status_short)) return null;
  if (fixture.ft_home === null || fixture.ft_away === null) return null;
  return { home: fixture.ft_home, away: fixture.ft_away };
}

/** Taux de réussite (RG-F8-1) : gagnés / (gagnés + perdus), hors void ; null si aucun. */
export function successRate(won: number, lost: number): number | null {
  const decided = won + lost;
  return decided === 0 ? null : Math.round((won / decided) * 1000) / 10;
}
