import { isInsufficientData, isThinHistory, isThinMatchStats, type MatchSummary } from "./context/summarize";
import { MARKET_CODES, predictionOutputSchema, type PredictionOutput } from "./schema";

/**
 * Validation d'une réponse de l'IA (section 8, « Règles de cohérence vérifiées
 * par le code », étendues au prompt v2). Renvoie la réponse normalisée (1N2 ramené à 100) ou la liste
 * des erreurs, formulées pour être renvoyées telles quelles à l'IA.
 */

/**
 * `adjustments` : corrections automatiques sans nouvel appel à l'IA (confiance
 * abaissée pour rester cohérente avec la probabilité ou la qualité des données).
 * Elles ne rendent jamais un pronostic plus affirmatif.
 */
export type ValidationResult = { ok: true; data: PredictionOutput; adjustments: string[] } | { ok: false; errors: string[] };

type Confidence = "low" | "medium" | "high";
const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Probabilité minimale (en %) de la sélection pour chaque niveau de confiance.
 * En dessous, la confiance est abaissée : une estimation faible ne peut pas être
 * présentée comme fiable. Seuils adaptés à la nature du marché (un score exact à
 * 20 % est déjà une estimation forte ; une double chance à 70 % ne l'est pas).
 */
export const CONFIDENCE_FLOORS: Record<(typeof MARKET_CODES)[number], { high: number; medium: number }> = {
  MATCH_RESULT: { high: 60, medium: 45 },
  HT_RESULT: { high: 55, medium: 40 },
  DOUBLE_CHANCE: { high: 80, medium: 65 },
  OVER_UNDER_1_5: { high: 70, medium: 57 },
  OVER_UNDER_2_5: { high: 70, medium: 57 },
  OVER_UNDER_3_5: { high: 70, medium: 57 },
  BTTS: { high: 70, medium: 57 },
  HANDICAP: { high: 70, medium: 57 },
  CORNERS_OVER_UNDER_9_5: { high: 70, medium: 57 },
  CARDS_OVER_UNDER_4_5: { high: 70, medium: 57 },
  EXACT_SCORE: { high: 25, medium: 14 },
  HT_FT: { high: 40, medium: 25 },
  COMBO: { high: 55, medium: 40 },
};

/** Confiance maximale autorisée pour une probabilité donnée sur un marché. */
export function maxConfidenceFor(code: (typeof MARKET_CODES)[number], probability: number): Confidence {
  const floor = CONFIDENCE_FLOORS[code];
  return probability >= floor.high ? "high" : probability >= floor.medium ? "medium" : "low";
}

/** Longueurs attendues des textes : une explication doit expliquer, sans devenir un roman. */
export const REASONING_MIN = 40;
export const REASONING_MAX = 1000;

/** Mots interdits (et variantes), en mots entiers, insensible à la casse et aux lettres accentuées voisines. */
const FORBIDDEN = /(?<!\p{L})(s[uû]r(?:e|s|es)?|s[uû]rement|garanti(?:e|s|es)?|garantir|certain(?:e|s|es)?|certainement|certitude|assur[ée]ment|infaillible(?:s)?|imparable(?:s)?|immanquable(?:s)?)(?!\p{L})/iu;

/** Expressions de promesse ou de certitude (en plus des mots interdits). */
const FORBIDDEN_PHRASES = /(100\s?%|sans (?:aucun )?risque|gain(?:s)? assur[ée]s?|argent facile|à tous les coups|les yeux fermés)/giu;

export function findForbiddenWords(text: string): string[] {
  const found = new Set<string>();
  const global = new RegExp(FORBIDDEN.source, "giu");
  for (const match of text.matchAll(global)) found.add(match[1].toLowerCase());
  for (const match of text.matchAll(FORBIDDEN_PHRASES)) found.add(match[1].toLowerCase());
  return [...found];
}

function parseScore(selection: string): { home: number; away: number } | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(selection);
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

/** Ramène home + draw + away à exactement 100 (écart de ±1 corrigé sur la plus forte valeur). */
export function normalize1x2(p: { home: number; draw: number; away: number }) {
  const diff = 100 - (p.home + p.draw + p.away);
  if (diff === 0) return { ...p };
  const key = (["home", "draw", "away"] as const).reduce((best, k) => (p[k] > p[best] ? k : best), "home" as "home" | "draw" | "away");
  return { ...p, [key]: p[key] + diff };
}

export function validatePrediction(raw: unknown, summary: MatchSummary): ValidationResult {
  const parsed = predictionOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 10).map((issue) => `Champ ${issue.path.join(".") || "(racine)"} : ${issue.message}`),
    };
  }
  const out = structuredClone(parsed.data);
  const errors: string[] = [];
  const m = out.markets;

  // 1N2 : somme = 100 à ±1, puis normalisée.
  const p = m.MATCH_RESULT.probabilities;
  const sum = p.home + p.draw + p.away;
  if (Math.abs(sum - 100) > 1) {
    errors.push(`MATCH_RESULT : la somme des probabilités vaut ${sum}, elle doit valoir 100.`);
  } else {
    m.MATCH_RESULT.probabilities = normalize1x2(p);
  }

  // 1N2 : sélection = issue la plus probable.
  const np = m.MATCH_RESULT.probabilities;
  const max = Math.max(np.home, np.draw, np.away);
  const bySelection = { "1": np.home, N: np.draw, "2": np.away } as const;
  if (bySelection[m.MATCH_RESULT.selection] !== max) {
    errors.push(
      `MATCH_RESULT : la sélection « ${m.MATCH_RESULT.selection} » n'est pas l'issue la plus probable (home ${np.home}, draw ${np.draw}, away ${np.away}).`,
    );
  }

  // Double chance (v2) : exclut l'issue la moins probable du 1N2 ; probabilité = somme des deux issues.
  const pairs = { "1N": np.home + np.draw, "12": np.home + np.away, N2: np.draw + np.away } as const;
  const bestPair = Math.max(pairs["1N"], pairs["12"], pairs.N2);
  if (pairs[m.DOUBLE_CHANCE.selection] !== bestPair) {
    errors.push(
      `DOUBLE_CHANCE : la sélection « ${m.DOUBLE_CHANCE.selection} » doit exclure l'issue la moins probable du 1N2 (1N ${pairs["1N"]}, 12 ${pairs["12"]}, N2 ${pairs.N2}).`,
    );
  } else {
    m.DOUBLE_CHANCE.probability = pairs[m.DOUBLE_CHANCE.selection];
  }

  // Mi-temps (v2) : somme = 100 à ±1, normalisée ; sélection = issue la plus probable.
  const ht = m.HT_RESULT.probabilities;
  const htSum = ht.home + ht.draw + ht.away;
  if (Math.abs(htSum - 100) > 1) {
    errors.push(`HT_RESULT : la somme des probabilités vaut ${htSum}, elle doit valoir 100.`);
  } else {
    m.HT_RESULT.probabilities = normalize1x2(ht);
  }
  const nht = m.HT_RESULT.probabilities;
  const htBySelection = { "1": nht.home, N: nht.draw, "2": nht.away } as const;
  if (htBySelection[m.HT_RESULT.selection] !== Math.max(nht.home, nht.draw, nht.away)) {
    errors.push(`HT_RESULT : la sélection « ${m.HT_RESULT.selection} » n'est pas l'issue la plus probable à la mi-temps.`);
  }

  // Mi-temps / fin de match (v2) : cohérent avec HT_RESULT et MATCH_RESULT, et pas plus probable qu'eux.
  const [htPart, ftPart] = m.HT_FT.selection.split("/") as ["1" | "N" | "2", "1" | "N" | "2"];
  if (htPart !== m.HT_RESULT.selection || ftPart !== m.MATCH_RESULT.selection) {
    errors.push(
      `Incohérence : HT_FT « ${m.HT_FT.selection} » doit reprendre HT_RESULT (« ${m.HT_RESULT.selection} ») puis MATCH_RESULT (« ${m.MATCH_RESULT.selection} »).`,
    );
  } else if (m.HT_FT.probability > Math.min(htBySelection[htPart], bySelection[ftPart])) {
    errors.push(`HT_FT : la probabilité (${m.HT_FT.probability}) ne peut pas dépasser celle de chacune de ses deux parties.`);
  }

  // Handicap (v2) : cohérent avec le 1N2.
  const hcp = m.HANDICAP;
  const hcpChecks: Record<typeof hcp.selection, [boolean, string]> = {
    "HOME_-1.5": [hcp.probability < np.home, `inférieure à la victoire domicile (${np.home})`],
    "AWAY_-1.5": [hcp.probability < np.away, `inférieure à la victoire extérieur (${np.away})`],
    "HOME_+1.5": [hcp.probability >= np.home + np.draw, `au moins égale à « domicile ou nul » (${np.home + np.draw})`],
    "AWAY_+1.5": [hcp.probability >= np.draw + np.away, `au moins égale à « nul ou extérieur » (${np.draw + np.away})`],
  };
  const [hcpOk, hcpRule] = hcpChecks[hcp.selection];
  if (!hcpOk) errors.push(`HANDICAP : la probabilité de « ${hcp.selection} » (${hcp.probability}) doit être ${hcpRule}.`);

  // Lignes de buts (v2) : P(plus de 1,5) ≥ P(plus de 2,5) ≥ P(plus de 3,5).
  const pOver = (x: { selection: "OVER" | "UNDER"; probability: number }) => (x.selection === "OVER" ? x.probability : 100 - x.probability);
  const o15 = pOver(m.OVER_UNDER_1_5);
  const o25 = pOver(m.OVER_UNDER_2_5);
  const o35 = pOver(m.OVER_UNDER_3_5);
  if (!(o15 >= o25 && o25 >= o35)) {
    errors.push(
      `Incohérence des lignes de buts : la probabilité de « plus de » doit décroître (1,5 : ${o15} %, 2,5 : ${o25} %, 3,5 : ${o35} %).`,
    );
  }

  // Combiné (v3) : 2 ou 3 de TES sélections, sur des marchés distincts et non redondants,
  // et jamais plus probable que la moins probable de ses sélections.
  const legProbability: Record<(typeof m.COMBO.legs)[number]["market"], { selection: string; probability: number }> = {
    MATCH_RESULT: { selection: m.MATCH_RESULT.selection, probability: bySelection[m.MATCH_RESULT.selection] },
    DOUBLE_CHANCE: m.DOUBLE_CHANCE,
    OVER_UNDER_1_5: m.OVER_UNDER_1_5,
    OVER_UNDER_2_5: m.OVER_UNDER_2_5,
    OVER_UNDER_3_5: m.OVER_UNDER_3_5,
    BTTS: m.BTTS,
  };
  const legs = m.COMBO.legs;
  const legMarkets = legs.map((leg) => leg.market);
  if (new Set(legMarkets).size !== legMarkets.length) {
    errors.push("COMBO : chaque sélection du combiné doit porter sur un marché différent.");
  } else if (legMarkets.includes("MATCH_RESULT") && legMarkets.includes("DOUBLE_CHANCE")) {
    errors.push("COMBO : ne combine pas MATCH_RESULT et DOUBLE_CHANCE (sélections redondantes).");
  } else if (legMarkets.filter((code) => code.startsWith("OVER_UNDER_")).length > 1) {
    errors.push("COMBO : une seule ligne de buts (OVER_UNDER_1_5, OVER_UNDER_2_5 ou OVER_UNDER_3_5) par combiné.");
  } else {
    const mismatch = legs.find((leg) => leg.selection !== legProbability[leg.market].selection);
    if (mismatch) {
      errors.push(
        `COMBO : la sélection « ${mismatch.selection} » pour ${mismatch.market} doit reprendre ta sélection de ce marché (« ${legProbability[mismatch.market].selection} »).`,
      );
    } else {
      const minLeg = Math.min(...legs.map((leg) => legProbability[leg.market].probability));
      if (m.COMBO.probability > minLeg) {
        errors.push(`COMBO : la probabilité (${m.COMBO.probability}) ne peut pas dépasser celle de la moins probable de ses sélections (${minLeg}).`);
      }
    }
  }

  // Marchés binaires : la sélection doit avoir au moins 50 % de probabilité.
  for (const code of ["OVER_UNDER_2_5", "BTTS", "OVER_UNDER_1_5", "OVER_UNDER_3_5", "HANDICAP", "CORNERS_OVER_UNDER_9_5", "CARDS_OVER_UNDER_4_5"] as const) {
    if (m[code].probability < 50) {
      errors.push(`${code} : la probabilité de la sélection choisie (${m[code].probability}) doit être d'au moins 50.`);
    }
  }

  // Score exact cohérent avec les autres marchés.
  const score = parseScore(m.EXACT_SCORE.selection);
  if (!score) {
    errors.push(`EXACT_SCORE : sélection « ${m.EXACT_SCORE.selection} » invalide (format attendu « 2-1 »).`);
  } else {
    const total = score.home + score.away;
    const expectedOU = total >= 3 ? "OVER" : "UNDER";
    if (m.OVER_UNDER_2_5.selection !== expectedOU) {
      errors.push(`Incohérence : le score exact ${m.EXACT_SCORE.selection} (${total} buts) implique ${expectedOU} pour OVER_UNDER_2_5, pas ${m.OVER_UNDER_2_5.selection}.`);
    }
    const expectedBTTS = score.home > 0 && score.away > 0 ? "YES" : "NO";
    if (m.BTTS.selection !== expectedBTTS) {
      errors.push(`Incohérence : le score exact ${m.EXACT_SCORE.selection} implique ${expectedBTTS} pour BTTS, pas ${m.BTTS.selection}.`);
    }
    const expected1x2 = score.home > score.away ? "1" : score.home === score.away ? "N" : "2";
    if (m.MATCH_RESULT.selection !== expected1x2) {
      errors.push(`Incohérence : le score exact ${m.EXACT_SCORE.selection} implique « ${expected1x2} » pour MATCH_RESULT, pas « ${m.MATCH_RESULT.selection} ».`);
    }
  }

  // « Les deux équipes marquent » implique au moins 2 buts : P(BTTS oui) ≤ P(plus de 1,5 but).
  const pBttsYes = m.BTTS.selection === "YES" ? m.BTTS.probability : 100 - m.BTTS.probability;
  if (pBttsYes > o15) {
    errors.push(`Incohérence : la probabilité que les deux équipes marquent (${pBttsYes} %) ne peut pas dépasser celle de plus de 1,5 but (${o15} %).`);
  }

  // Aucune certitude : chaque probabilité reste strictement entre 0 et 100 %.
  const certainty: string[] = [];
  for (const code of MARKET_CODES) {
    const market = m[code] as { probability?: number; probabilities?: { home: number; draw: number; away: number } };
    const values = market.probabilities ? Object.values(market.probabilities) : [market.probability ?? 50];
    if (values.some((v) => v <= 0 || v >= 100)) certainty.push(code);
  }
  if (certainty.length) {
    errors.push(`${certainty.join(", ")} : une probabilité de 0 % ou de 100 % présente une estimation comme une certitude ; donne une valeur entre 1 et 99.`);
  }

  // Explications : ni vides de sens, ni démesurées.
  for (const code of MARKET_CODES) {
    const length = m[code].reasoning.trim().length;
    if (length < REASONING_MIN) errors.push(`${code}.reasoning : explication trop courte (${length} caractères, ${REASONING_MIN} au moins). Explique avec les données du dossier.`);
    if (length > REASONING_MAX) errors.push(`${code}.reasoning : explication trop longue (${length} caractères, ${REASONING_MAX} au plus).`);
  }

  // Confiance « high » interdite pour un amical ou un historique mince.
  const highForbidden = summary.data_quality.is_friendly || isThinHistory(summary);
  if (highForbidden) {
    const reason = summary.data_quality.is_friendly ? "match amical" : "historique trop mince";
    for (const code of MARKET_CODES) {
      if (m[code].confidence === "high") errors.push(`${code} : la confiance « high » est interdite (${reason}).`);
    }
  }

  // Corners / cartons (lot B, décision 3) : statistiques minces → confiance « low » imposée (pas d'erreur).
  if (isThinMatchStats(summary)) {
    m.CORNERS_OVER_UNDER_9_5.confidence = "low";
    m.CARDS_OVER_UNDER_4_5.confidence = "low";
  }

  // Confiance cohérente avec la probabilité (v4) : abaissée si la probabilité est trop faible.
  const adjustments: string[] = [];
  const selectedProbability = (code: (typeof MARKET_CODES)[number]): number => {
    if (code === "MATCH_RESULT") return bySelection[m.MATCH_RESULT.selection];
    if (code === "HT_RESULT") return htBySelection[m.HT_RESULT.selection];
    return (m[code] as { probability: number }).probability;
  };
  for (const code of MARKET_CODES) {
    const allowed = maxConfidenceFor(code, selectedProbability(code));
    if (CONFIDENCE_RANK[m[code].confidence] > CONFIDENCE_RANK[allowed]) {
      adjustments.push(`${code} : confiance « ${m[code].confidence} » abaissée à « ${allowed} » (probabilité ${selectedProbability(code)} %).`);
      m[code].confidence = allowed;
    }
  }

  // Données insuffisantes (ni forme, ni classement, ni confrontation) : confiance « low » partout.
  if (isInsufficientData(summary)) {
    for (const code of MARKET_CODES) {
      if (m[code].confidence !== "low") {
        adjustments.push(`${code} : confiance abaissée à « low » (données insuffisantes).`);
        m[code].confidence = "low";
      }
    }
  }

  // Mots interdits dans tous les textes.
  const texts: [string, string][] = [
    ["summary", out.summary],
    ...out.key_factors.map((f, i): [string, string] => [`key_factors[${i}]`, f]),
    ...MARKET_CODES.map((code): [string, string] => [`${code}.reasoning`, m[code].reasoning]),
  ];
  for (const [field, text] of texts) {
    const words = findForbiddenWords(text);
    if (words.length) errors.push(`${field} : mots interdits (${words.join(", ")}). Reformule sans promesse ni certitude.`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, data: out, adjustments };
}
