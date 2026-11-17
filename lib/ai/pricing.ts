/**
 * Coût estimé d'une génération (affiché dans /admin/ia).
 * Tarifs en dollars US par MILLION de tokens (entrée, sortie). Valeurs
 * indicatives à vérifier sur la page de tarifs d'OpenAI ; surchargeables sans
 * redéploiement du code via OPENAI_PRICE_INPUT_PER_MTOK / OPENAI_PRICE_OUTPUT_PER_MTOK.
 */
export const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

export function modelPricing(model: string, env: Record<string, string | undefined> = process.env) {
  const input = Number(env.OPENAI_PRICE_INPUT_PER_MTOK);
  const output = Number(env.OPENAI_PRICE_OUTPUT_PER_MTOK);
  if (Number.isFinite(input) && input >= 0 && Number.isFinite(output) && output >= 0 && env.OPENAI_PRICE_INPUT_PER_MTOK) {
    return { input, output };
  }
  // Correspondance exacte, sinon par préfixe (ex. « gpt-4o-mini-2024-07-18 »).
  const key = Object.keys(MODEL_PRICING_USD_PER_MTOK)
    .sort((a, b) => b.length - a.length)
    .find((name) => model === name || model.startsWith(`${name}-`));
  return key ? MODEL_PRICING_USD_PER_MTOK[key] : null;
}

/** Coût estimé en dollars (6 décimales), null si le tarif du modèle est inconnu. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, env?: Record<string, string | undefined>): number | null {
  const pricing = modelPricing(model, env);
  if (!pricing) return null;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
