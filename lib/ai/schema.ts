import { z } from "zod";
import { COMBO_LEG_MARKETS } from "@/lib/settle/rules";

/**
 * Format de sortie imposé à l'IA (section 8 ; 10 marchés depuis le prompt v2, 13 depuis le v3). Source de vérité UNIQUE : ce
 * schéma Zod. Le JSON Schema strict envoyé à OpenAI (Structured Outputs) en
 * est dérivé par `toOpenAiJsonSchema()`.
 */

const probability = z.number().int().min(0).max(100);
const confidence = z.enum(["low", "medium", "high"]);
const reasoning = z.string().min(1).describe("Explication de 2 à 4 phrases, en français.");

export const predictionOutputSchema = z.object({
  summary: z.string().min(1).describe("Analyse globale du match en un paragraphe (français)."),
  key_factors: z.array(z.string().min(1)).min(3).max(5).describe("3 à 5 facteurs clés, en français."),
  markets: z.object({
    MATCH_RESULT: z.object({
      selection: z.enum(["1", "N", "2"]).describe("1 = domicile, N = nul, 2 = extérieur."),
      probabilities: z.object({ home: probability, draw: probability, away: probability }),
      confidence,
      reasoning,
    }),
    EXACT_SCORE: z.object({
      selection: z.string().regex(/^\d{1,2}-\d{1,2}$/).describe("Score au temps réglementaire, ex. « 2-1 » (domicile-extérieur)."),
      probability,
      confidence,
      reasoning,
    }),
    OVER_UNDER_2_5: z.object({
      selection: z.enum(["OVER", "UNDER"]),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    BTTS: z.object({
      selection: z.enum(["YES", "NO"]),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    // ---- Marchés ajoutés par le prompt v2 (lot 4) ----
    DOUBLE_CHANCE: z.object({
      selection: z.enum(["1N", "12", "N2"]).describe("1N = domicile ou nul, 12 = pas de nul, N2 = nul ou extérieur."),
      probability: probability.describe("Probabilité de la sélection : somme des deux issues du 1N2."),
      confidence,
      reasoning,
    }),
    HT_RESULT: z.object({
      selection: z.enum(["1", "N", "2"]).describe("Résultat à la mi-temps : 1 = domicile mène, N = égalité, 2 = extérieur mène."),
      probabilities: z.object({ home: probability, draw: probability, away: probability }),
      confidence,
      reasoning,
    }),
    HT_FT: z.object({
      selection: z
        .enum(["1/1", "1/N", "1/2", "N/1", "N/N", "N/2", "2/1", "2/N", "2/2"])
        .describe("Résultat à la mi-temps / au temps réglementaire, ex. « N/1 »."),
      probability: probability.describe("Probabilité de cette combinaison, en %."),
      confidence,
      reasoning,
    }),
    HANDICAP: z.object({
      selection: z
        .enum(["HOME_-1.5", "AWAY_+1.5", "HOME_+1.5", "AWAY_-1.5"])
        .describe("Handicap de 1,5 but appliqué à une équipe, au temps réglementaire."),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    OVER_UNDER_1_5: z.object({
      selection: z.enum(["OVER", "UNDER"]),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    OVER_UNDER_3_5: z.object({
      selection: z.enum(["OVER", "UNDER"]),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    // ---- Marchés ajoutés par le prompt v3 (lot B) ----
    CORNERS_OVER_UNDER_9_5: z.object({
      selection: z.enum(["OVER", "UNDER"]).describe("Total des corners des deux équipes : OVER = 10 ou plus, UNDER = 9 ou moins."),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    CARDS_OVER_UNDER_4_5: z.object({
      selection: z.enum(["OVER", "UNDER"]).describe("Total des cartons (jaunes + rouges) : OVER = 5 ou plus, UNDER = 4 ou moins."),
      probability: probability.describe("Probabilité de la sélection choisie, en %."),
      confidence,
      reasoning,
    }),
    COMBO: z.object({
      legs: z
        .array(
          z.object({
            market: z.enum(COMBO_LEG_MARKETS).describe("Marché déjà pronostiqué ci-dessus."),
            selection: z.string().min(1).describe("Ta sélection pour ce marché, identique à celle donnée plus haut."),
          }),
        )
        .min(2)
        .max(3)
        .describe("2 ou 3 sélections de CE match, sur des marchés distincts."),
      probability: probability.describe("Probabilité que TOUTES les sélections soient gagnantes, en %."),
      confidence,
      reasoning,
    }),
  }),
});

export type PredictionOutput = z.infer<typeof predictionOutputSchema>;
export type MarketCode = keyof PredictionOutput["markets"];
export const MARKET_CODES = [
  "MATCH_RESULT",
  "EXACT_SCORE",
  "OVER_UNDER_2_5",
  "BTTS",
  "DOUBLE_CHANCE",
  "HT_RESULT",
  "HT_FT",
  "HANDICAP",
  "OVER_UNDER_1_5",
  "OVER_UNDER_3_5",
  "CORNERS_OVER_UNDER_9_5",
  "CARDS_OVER_UNDER_4_5",
  "COMBO",
] as const satisfies readonly MarketCode[];

/** Mots-clés JSON Schema non garantis par le mode strict d'OpenAI : retirés (Zod les revérifie). */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
]);

type JsonSchema = { [key: string]: unknown };

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = strictify(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    // Mode strict : toutes les propriétés obligatoires, aucune propriété supplémentaire.
    out.required = Object.keys(out.properties as JsonSchema);
    out.additionalProperties = false;
  }
  return out;
}

/** JSON Schema strict pour `response_format: { type: "json_schema", strict: true }`. */
export function toOpenAiJsonSchema(): JsonSchema {
  return strictify(z.toJSONSchema(predictionOutputSchema, { target: "draft-7" })) as JsonSchema;
}
