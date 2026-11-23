import { describe, expect, it } from "vitest";
import { friendlySummary, solidSummary, validOutput } from "./test-helpers";
import { findForbiddenWords, normalize1x2, validatePrediction } from "./validate";

const errorsOf = (raw: unknown, summary = solidSummary) => {
  const result = validatePrediction(raw, summary);
  return result.ok ? [] : result.errors;
};

describe("cas valides", () => {
  it("accepte une réponse cohérente", () => {
    const result = validatePrediction(validOutput(), solidSummary);
    expect(result.ok).toBe(true);
  });

  it("normalise un 1N2 à 99 ou 101 pour obtenir exactement 100", () => {
    const out = validOutput();
    out.markets.MATCH_RESULT.probabilities = { home: 52, draw: 26, away: 21 }; // 99
    const result = validatePrediction(out, solidSummary);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.markets.MATCH_RESULT.probabilities).toEqual({ home: 53, draw: 26, away: 21 });
    expect(normalize1x2({ home: 30, draw: 31, away: 40 })).toEqual({ home: 30, draw: 31, away: 39 });
  });

  it("accepte un nul cohérent (1-1, N, UNDER, YES)", () => {
    const out = validOutput();
    out.markets.MATCH_RESULT.selection = "N";
    out.markets.MATCH_RESULT.probabilities = { home: 32, draw: 38, away: 30 };
    out.markets.EXACT_SCORE.selection = "1-1";
    out.markets.OVER_UNDER_2_5 = { ...out.markets.OVER_UNDER_2_5, selection: "UNDER" };
    out.markets.HT_FT.selection = "N/N";
    out.markets.HANDICAP.probability = 70;
    expect(validatePrediction(out, solidSummary).ok).toBe(true);
  });

  it("autorise « high » sur un match bien documenté", () => {
    const out = validOutput();
    out.markets.MATCH_RESULT.confidence = "high";
    expect(validatePrediction(out, solidSummary).ok).toBe(true);
  });
});

describe("cas invalides", () => {
  it("refuse un format non conforme (champ manquant, probabilité hors bornes, décimale)", () => {
    const missing = validOutput() as unknown as { markets: Record<string, unknown> };
    delete missing.markets.BTTS;
    expect(errorsOf(missing).join()).toMatch(/markets\.BTTS/);

    const outOfRange = validOutput();
    outOfRange.markets.OVER_UNDER_2_5.probability = 120;
    expect(errorsOf(outOfRange).join()).toMatch(/OVER_UNDER_2_5\.probability/);

    const decimal = validOutput();
    decimal.markets.BTTS.probability = 55.5;
    expect(errorsOf(decimal).join()).toMatch(/BTTS\.probability/);
  });

  it("refuse un 1N2 dont la somme s'écarte de plus de 1 de 100", () => {
    const out = validOutput();
    out.markets.MATCH_RESULT.probabilities = { home: 50, draw: 26, away: 21 }; // 97
    expect(errorsOf(out)).toContain("MATCH_RESULT : la somme des probabilités vaut 97, elle doit valoir 100.");
  });

  it("refuse une sélection 1N2 qui n'est pas l'issue la plus probable", () => {
    const out = validOutput();
    out.markets.MATCH_RESULT.selection = "2";
    expect(errorsOf(out).join()).toMatch(/n'est pas l'issue la plus probable/);
  });

  it("refuse un score exact incohérent avec OVER_UNDER, BTTS et le 1N2", () => {
    const out = validOutput();
    out.markets.EXACT_SCORE.selection = "1-0"; // implique UNDER, NO, « 1 »
    const errors = errorsOf(out);
    expect(errors).toContain("Incohérence : le score exact 1-0 (1 buts) implique UNDER pour OVER_UNDER_2_5, pas OVER.");
    expect(errors).toContain("Incohérence : le score exact 1-0 implique NO pour BTTS, pas YES.");

    const away = validOutput();
    away.markets.EXACT_SCORE.selection = "1-2";
    expect(errorsOf(away).join()).toMatch(/implique « 2 » pour MATCH_RESULT/);
  });

  it("refuse une probabilité de sélection binaire inférieure à 50", () => {
    const out = validOutput();
    out.markets.BTTS.probability = 45;
    expect(errorsOf(out).join()).toMatch(/BTTS : la probabilité de la sélection choisie \(45\)/);
  });

  it("interdit la confiance « high » pour un match amical", () => {
    const out = validOutput();
    out.markets.OVER_UNDER_2_5.confidence = "high";
    expect(errorsOf(out, friendlySummary)).toContain("OVER_UNDER_2_5 : la confiance « high » est interdite (match amical).");
  });

  it("interdit la confiance « high » si l'historique est mince", () => {
    const thin = { ...solidSummary, data_quality: { has_standings: false, h2h_count: 1, is_friendly: false } };
    const out = validOutput();
    out.markets.MATCH_RESULT.confidence = "high";
    expect(errorsOf(out, thin)).toContain("MATCH_RESULT : la confiance « high » est interdite (historique trop mince).");
  });

  it("refuse les mots interdits partout (sûr, garanti, certain et variantes)", () => {
    const out = validOutput();
    out.summary = "Une victoire sûre pour Arsenal.";
    out.key_factors[1] = "Succès garanti à domicile";
    out.markets.BTTS.reasoning = "Il est certain que Chelsea marquera. C'est une certitude.";
    const errors = errorsOf(out).join("\n");
    expect(errors).toMatch(/summary : mots interdits \(sûre\)/);
    expect(errors).toMatch(/key_factors\[1\] : mots interdits \(garanti\)/);
    expect(errors).toMatch(/BTTS\.reasoning : mots interdits \(certain, certitude\)/);
  });
});

describe("findForbiddenWords", () => {
  it("détecte les mots entiers, sans faux positif sur les mots voisins", () => {
    expect(findForbiddenWords("Sûrement le favori, assurément.")).toEqual(["sûrement", "assurément"]);
    expect(findForbiddenWords("Il faut assurer le résultat ; la sureté défensive.")).toEqual([]);
    expect(findForbiddenWords("Une garantie ? Certaines équipes…")).toEqual(["garantie", "certaines"]);
  });
});

describe("marchés du prompt v2", () => {
  const errorsOf = (out: ReturnType<typeof validOutput>) => {
    const r = validatePrediction(out, solidSummary);
    return r.ok ? [] : r.errors;
  };

  it("double chance : doit exclure l'issue la moins probable ; probabilité recalculée", () => {
    const out = validOutput();
    out.markets.DOUBLE_CHANCE.probability = 60;
    const r = validatePrediction(out, solidSummary);
    expect(r.ok && r.data.markets.DOUBLE_CHANCE.probability).toBe(78);
    out.markets.DOUBLE_CHANCE.selection = "N2";
    expect(errorsOf(out).some((e) => e.startsWith("DOUBLE_CHANCE"))).toBe(true);
  });

  it("mi-temps : somme 100 et sélection la plus probable", () => {
    const out = validOutput();
    out.markets.HT_RESULT.probabilities = { home: 50, draw: 40, away: 30 };
    expect(errorsOf(out).some((e) => e.includes("HT_RESULT : la somme"))).toBe(true);
    const out2 = validOutput();
    out2.markets.HT_RESULT.selection = "1";
    expect(errorsOf(out2).some((e) => e.includes("HT_RESULT : la sélection"))).toBe(true);
  });

  it("mi-temps / fin de match : cohérent avec les deux résultats et pas plus probable qu'eux", () => {
    const out = validOutput();
    out.markets.HT_FT.selection = "1/1";
    expect(errorsOf(out).some((e) => e.includes("HT_FT « 1/1 »"))).toBe(true);
    const out2 = validOutput();
    out2.markets.HT_FT.probability = 50;
    expect(errorsOf(out2).some((e) => e.startsWith("HT_FT : la probabilité"))).toBe(true);
  });

  it("handicap : cohérent avec le 1N2", () => {
    const out = validOutput();
    out.markets.HANDICAP = { ...out.markets.HANDICAP, selection: "HOME_-1.5", probability: 55 };
    expect(errorsOf(out).some((e) => e.startsWith("HANDICAP"))).toBe(true); // 55 ≥ victoire domicile (52)
    out.markets.HANDICAP.probability = 50;
    expect(errorsOf(out).filter((e) => e.startsWith("HANDICAP"))).toEqual([]);
    const out2 = validOutput();
    out2.markets.HANDICAP.probability = 40;
    expect(errorsOf(out2).some((e) => e.startsWith("HANDICAP"))).toBe(true);
  });

  it("lignes de buts : la probabilité de « plus de » décroît de 1,5 à 3,5", () => {
    const out = validOutput();
    out.markets.OVER_UNDER_3_5 = { ...out.markets.OVER_UNDER_3_5, selection: "OVER", probability: 65 };
    expect(errorsOf(out).some((e) => e.includes("lignes de buts"))).toBe(true);
  });

  it("marchés binaires v2 : au moins 50 % ; confiance « high » interdite sur un amical", () => {
    const out = validOutput();
    out.markets.OVER_UNDER_1_5.probability = 45;
    expect(errorsOf(out).some((e) => e.startsWith("OVER_UNDER_1_5 : la probabilité"))).toBe(true);
    const friendly = validOutput();
    friendly.markets.HT_FT.confidence = "high";
    const r = validatePrediction(friendly, friendlySummary);
    expect(!r.ok && r.errors.some((e) => e.startsWith("HT_FT : la confiance"))).toBe(true);
  });

  it("mots interdits détectés dans les explications des nouveaux marchés", () => {
    const out = validOutput();
    out.markets.HANDICAP.reasoning = "Chelsea ne perdra sûrement pas largement.";
    expect(errorsOf(out).some((e) => e.startsWith("HANDICAP.reasoning"))).toBe(true);
  });
});
