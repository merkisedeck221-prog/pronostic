import { isThinHistory, type MatchSummary } from "./context/summarize";
import { MARKET_CODES, predictionOutputSchema, type PredictionOutput } from "./schema";

/**
 * Validation d'une réponse de l'IA (section 8, « Règles de cohérence vérifiées
 * par le code »). Renvoie la réponse normalisée (1N2 ramené à 100) ou la liste
 * des erreurs, formulées pour être renvoyées telles quelles à l'IA.
 */

export type ValidationResult = { ok: true; data: PredictionOutput } | { ok: false; errors: string[] };

/** Mots interdits (et variantes), en mots entiers, insensible à la casse et aux lettres accentuées voisines. */
const FORBIDDEN = /(?<!\p{L})(s[uû]r(?:e|s|es)?|s[uû]rement|garanti(?:e|s|es)?|garantir|certain(?:e|s|es)?|certainement|certitude|assur[ée]ment)(?!\p{L})/iu;

export function findForbiddenWords(text: string): string[] {
  const found = new Set<string>();
  const global = new RegExp(FORBIDDEN.source, "giu");
  for (const match of text.matchAll(global)) found.add(match[1].toLowerCase());
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

  // Marchés binaires : la sélection doit avoir au moins 50 % de probabilité.
  for (const code of ["OVER_UNDER_2_5", "BTTS"] as const) {
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

  // Confiance « high » interdite pour un amical ou un historique mince.
  const highForbidden = summary.data_quality.is_friendly || isThinHistory(summary);
  if (highForbidden) {
    const reason = summary.data_quality.is_friendly ? "match amical" : "historique trop mince";
    for (const code of MARKET_CODES) {
      if (m[code].confidence === "high") errors.push(`${code} : la confiance « high » est interdite (${reason}).`);
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

  return errors.length ? { ok: false, errors } : { ok: true, data: out };
}
