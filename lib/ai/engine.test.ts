import { describe, expect, it, vi } from "vitest";
import { generatePrediction, supportsTemperature } from "./generate";
import { deName, selectionLabel, toPredictionRows } from "./labels";
import { estimateCostUsd, modelPricing } from "./pricing";
import { PROMPT_VERSION, SYSTEM_PROMPT_V1 } from "./prompts/v1";
import { toOpenAiJsonSchema } from "./schema";
import { solidSummary, validOutput } from "./test-helpers";

describe("JSON Schema strict dérivé du schéma Zod", () => {
  const schema = toOpenAiJsonSchema();

  it("rend toutes les propriétés obligatoires et interdit les propriétés supplémentaires", () => {
    const check = (node: unknown, path = "$"): void => {
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      if (obj.type === "object") {
        expect(obj.additionalProperties, path).toBe(false);
        expect(obj.required, path).toEqual(Object.keys(obj.properties as object));
      }
      for (const [key, value] of Object.entries(obj)) check(value, `${path}.${key}`);
    };
    check(schema);
  });

  it("ne contient aucun mot-clé non pris en charge par le mode strict", () => {
    const text = JSON.stringify(schema);
    for (const keyword of ["$schema", "minimum", "maximum", "minItems", "maxItems", "pattern", "minLength"]) {
      expect(text, keyword).not.toContain(`"${keyword}"`);
    }
  });

  it("décrit les 4 marchés", () => {
    const markets = (schema.properties as Record<string, { properties: Record<string, unknown> }>).markets;
    expect(Object.keys(markets.properties)).toEqual(["MATCH_RESULT", "EXACT_SCORE", "OVER_UNDER_2_5", "BTTS"]);
  });
});

describe("prompt v1", () => {
  it("porte la version v1 et les consignes clés de la section 8", () => {
    expect(PROMPT_VERSION).toBe("v1");
    for (const fragment of ["UNIQUEMENT sur les données du dossier", "is_neutral_venue", "friendly", "UN indice parmi d'autres", "« sûr », « garanti », « certain »"]) {
      expect(SYSTEM_PROMPT_V1).toContain(fragment);
    }
  });
});

describe("libellés français", () => {
  it("élision et sélections", () => {
    expect(deName("Arsenal")).toBe("d'Arsenal");
    expect(deName("Chelsea")).toBe("de Chelsea");
    const teams = { home: "Arsenal", away: "Chelsea" };
    expect(selectionLabel("MATCH_RESULT", "1", teams)).toBe("Victoire d'Arsenal");
    expect(selectionLabel("MATCH_RESULT", "2", teams)).toBe("Victoire de Chelsea");
    expect(selectionLabel("MATCH_RESULT", "N", teams)).toBe("Match nul");
    expect(selectionLabel("EXACT_SCORE", "2-1", teams)).toBe("Arsenal 2 – 1 Chelsea");
    expect(selectionLabel("OVER_UNDER_2_5", "OVER", teams)).toBe("Plus de 2,5 buts");
    expect(selectionLabel("BTTS", "NO", teams)).toBe("Au moins une équipe ne marque pas");
  });

  it("une ligne par marché, probabilité du 1N2 = celle de la sélection", () => {
    const rows = toPredictionRows(validOutput(), { home: "Arsenal", away: "Chelsea" });
    expect(rows.map((r) => r.market_code)).toEqual(["MATCH_RESULT", "EXACT_SCORE", "OVER_UNDER_2_5", "BTTS"]);
    expect(rows[0]).toMatchObject({ selection: "1", probability: 52, probabilities: { home: 52, draw: 26, away: 22 } });
    expect(rows[1].probabilities).toBeNull();
  });
});

describe("coût estimé", () => {
  it("calcule le coût en dollars d'après le tarif du modèle", () => {
    expect(estimateCostUsd("gpt-4o-mini", 2000, 800)).toBe(0.00078); // 2000×0,15 + 800×0,6 par million
    expect(modelPricing("gpt-4o-mini-2024-07-18")).toEqual({ input: 0.15, output: 0.6 });
    expect(estimateCostUsd("modele-inconnu", 1000, 1000, {})).toBeNull();
  });

  it("accepte des tarifs surchargés par variables d'environnement", () => {
    expect(estimateCostUsd("x", 1_000_000, 0, { OPENAI_PRICE_INPUT_PER_MTOK: "2", OPENAI_PRICE_OUTPUT_PER_MTOK: "8" })).toBe(2);
  });
});

describe("generatePrediction (OpenAI simulé)", () => {
  const completion = (content: string, prompt = 1500, output = 500) => ({
    choices: [{ message: { content, refusal: null }, finish_reason: "stop" }],
    usage: { prompt_tokens: prompt, completion_tokens: output },
  });

  function fakeClient(...contents: string[]) {
    const create = vi.fn();
    for (const content of contents) create.mockResolvedValueOnce(completion(content));
    return { client: { chat: { completions: { create } } } as never, create };
  }

  it("réussit du premier coup : tokens et coût renseignés, sortie structurée stricte", async () => {
    const { client, create } = fakeClient(JSON.stringify(validOutput()));
    const result = await generatePrediction(solidSummary, { apiKey: "k", model: "gpt-4o-mini", client });
    expect(result.ok).toBe(true);
    expect(result.metrics).toMatchObject({ inputTokens: 1500, outputTokens: 500, attempts: 1, promptVersion: "v1" });
    expect(result.metrics.costEstimateUsd).toBe(0.000525);
    const body = create.mock.calls[0][0];
    expect(body.temperature).toBe(0.3);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true, name: "match_prediction" } });
    expect(create.mock.calls[0][1].timeout).toBeLessThanOrEqual(60_000);
  });

  it("fait UN nouvel essai en renvoyant les erreurs, puis réussit", async () => {
    const bad = validOutput();
    bad.markets.EXACT_SCORE.selection = "1-0";
    const { client, create } = fakeClient(JSON.stringify(bad), JSON.stringify(validOutput()));
    const result = await generatePrediction(solidSummary, { apiKey: "k", model: "gpt-4o-mini", client });
    expect(result.ok).toBe(true);
    expect(result.metrics).toMatchObject({ attempts: 2, inputTokens: 3000, outputTokens: 1000 });
    const retryMessages = create.mock.calls[1][0].messages;
    expect(retryMessages.at(-1).content).toMatch(/Incohérence : le score exact 1-0/);
  });

  it("abandonne après deux réponses invalides (statut failed)", async () => {
    const bad = validOutput();
    bad.summary = "Une victoire garantie.";
    const { client, create } = fakeClient(JSON.stringify(bad), JSON.stringify(bad));
    const result = await generatePrediction(solidSummary, { apiKey: "k", model: "gpt-4o-mini", client });
    expect(result.ok).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
    if (!result.ok) expect(result.errors.join()).toMatch(/mots interdits/);
  });

  it("n'envoie pas de température aux modèles de raisonnement", async () => {
    expect(supportsTemperature("gpt-5-mini")).toBe(false);
    expect(supportsTemperature("o3-mini")).toBe(false);
    const { client, create } = fakeClient(JSON.stringify(validOutput()));
    await generatePrediction(solidSummary, { apiKey: "k", model: "gpt-5-mini", client });
    expect(create.mock.calls[0][0]).not.toHaveProperty("temperature");
  });

  it("signale une erreur d'OpenAI sans planter", async () => {
    const create = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await generatePrediction(solidSummary, { apiKey: "k", model: "gpt-4o-mini", client: { chat: { completions: { create } } } as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("OpenAI : timeout");
  });
});
