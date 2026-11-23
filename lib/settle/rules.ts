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

/** Double chance : « 1N » (domicile ou nul), « 12 » (pas de nul), « N2 » (nul ou extérieur). */
export function settleDoubleChance(selection: string, score: RegulationScore): SettledResult {
  if (selection === "1N") return outcome(score.home >= score.away);
  if (selection === "12") return outcome(score.home !== score.away);
  if (selection === "N2") return outcome(score.away >= score.home);
  throw new InvalidSelectionError("DOUBLE_CHANCE", selection);
}

/** Plus / moins de N,5 buts (1,5 ou 3,5) : OVER si total ≥ N + 1, UNDER si total ≤ N. */
function overUnder(market: string, line: number) {
  return (selection: string, score: RegulationScore): SettledResult => {
    const total = score.home + score.away;
    if (selection === "OVER") return outcome(total > line);
    if (selection === "UNDER") return outcome(total < line);
    throw new InvalidSelectionError(market, selection);
  };
}
export const settleOverUnder15 = overUnder("OVER_UNDER_1_5", 1.5);
export const settleOverUnder35 = overUnder("OVER_UNDER_3_5", 3.5);

/**
 * Handicap européen à ±1,5 (jamais de remboursement) :
 * HOME_-1.5 gagne si domicile gagne de 2 buts ou plus ; AWAY_+1.5 si
 * domicile ne gagne pas de 2 buts ou plus ; symétrique pour l'extérieur.
 */
export function settleHandicap(selection: string, score: RegulationScore): SettledResult {
  const diff = score.home - score.away;
  if (selection === "HOME_-1.5") return outcome(diff >= 2);
  if (selection === "AWAY_+1.5") return outcome(diff <= 1);
  if (selection === "HOME_+1.5") return outcome(diff >= -1);
  if (selection === "AWAY_-1.5") return outcome(diff <= -2);
  throw new InvalidSelectionError("HANDICAP", selection);
}

/** Marchés résolus sur le score du temps réglementaire uniquement. */
const SETTLERS: Record<string, (selection: string, score: RegulationScore) => SettledResult> = {
  MATCH_RESULT: settleMatchResult,
  EXACT_SCORE: settleExactScore,
  OVER_UNDER_2_5: settleOverUnder25,
  BTTS: settleBtts,
  DOUBLE_CHANCE: settleDoubleChance,
  OVER_UNDER_1_5: settleOverUnder15,
  OVER_UNDER_3_5: settleOverUnder35,
  HANDICAP: settleHandicap,
};

/** Marchés qui ont besoin du score à la mi-temps. */
export const HALF_TIME_MARKETS = ["HT_RESULT", "HT_FT"] as const;

export class MissingHalfTimeScoreError extends Error {
  constructor(market: string) {
    super(`Score à la mi-temps indisponible pour ${market}`);
    this.name = "MissingHalfTimeScoreError";
  }
}

/** Résultat à la mi-temps (« 1 », « N », « 2 ») sur le score de la mi-temps. */
export function settleHalfTimeResult(selection: string, halfTime: RegulationScore): SettledResult {
  if (selection !== "1" && selection !== "N" && selection !== "2") throw new InvalidSelectionError("HT_RESULT", selection);
  return settleMatchResult(selection, halfTime);
}

/** Mi-temps / fin de match, ex. « N/1 » : nul à la pause, victoire domicile au temps réglementaire. */
export function settleHalfTimeFullTime(selection: string, score: RegulationScore, halfTime: RegulationScore): SettledResult {
  const match = /^([1N2])\/([1N2])$/.exec(selection);
  if (!match) throw new InvalidSelectionError("HT_FT", selection);
  return outcome(settleMatchResult(match[1], halfTime) === "won" && settleMatchResult(match[2], score) === "won");
}

/**
 * Résultat d'un pronostic ; lève une erreur pour un marché inconnu, une
 * sélection invalide, ou un score de mi-temps manquant (marchés mi-temps).
 */
export function settlePrediction(
  market: string,
  selection: string,
  score: RegulationScore,
  halfTime: RegulationScore | null = null,
): SettledResult {
  if (market === "HT_RESULT" || market === "HT_FT") {
    if (!halfTime) throw new MissingHalfTimeScoreError(market);
    return market === "HT_RESULT" ? settleHalfTimeResult(selection, halfTime) : settleHalfTimeFullTime(selection, score, halfTime);
  }
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
