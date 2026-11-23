import { z } from "zod";

/**
 * Réponses des fonctions SQL de la génération à la demande (lot 3).
 * Entrée d'une demande : UNIQUEMENT le match, le type d'analyse et une clé
 * d'idempotence ; jamais de prix (calculé en base).
 */
export const generationInputSchema = z.object({
  fixtureId: z.number().int().positive(),
  marketCode: z
    .string()
    .regex(/^[A-Z0-9_]{2,40}$/)
    .nullable(),
  idempotencyKey: z.uuid(),
});

export const requestGenerationResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    request_id: z.uuid(),
    status: z.enum(["reserved", "running", "succeeded", "failed"]),
    price: z.number().int().nonnegative(),
    new_balance: z.number().int().optional(),
    replayed: z.boolean().optional(),
  }),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string().optional() }),
]);

export const startGenerationResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    action: z.enum(["generate", "wait", "none"]),
    status: z.string(),
    fixture_id: z.number().int().optional(),
  }),
  z.object({ ok: z.literal(false), code: z.string() }),
]);

export const finishGenerationResultSchema = z.object({
  ok: z.boolean(),
  status: z.string().optional(),
  code: z.string().optional(),
});

export type GenerationOutcome =
  | { status: "succeeded" }
  | { status: "failed"; message: string }
  | { status: "pending"; message: string };

const ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Connectez-vous pour demander une analyse.",
  BANNED: "Votre compte est suspendu.",
  MAINTENANCE: "Les analyses sont momentanément suspendues (maintenance).",
  NOT_AVAILABLE: "Cette analyse n'est pas disponible.",
  MATCH_STARTED: "Le match a commencé : il n'est plus possible de demander une analyse.",
  TOO_EARLY: "Il est trop tôt pour analyser ce match.",
  ALREADY_UNLOCKED: "Vous avez déjà accès à cette analyse.",
  ALREADY_AVAILABLE: "L'analyse est déjà disponible : débloquez-la directement.",
  RATE_LIMIT: "Trop de demandes. Réessayez dans quelques minutes.",
  INSUFFICIENT_BALANCE: "Solde insuffisant : rechargez votre compte.",
  INVALID_INPUT: "Requête invalide.",
};

export function generationErrorMessage(code: string | undefined, fallback?: string): string {
  return (code && ERRORS[code]) || fallback || "La demande n'a pas pu être enregistrée. Aucun crédit n'a été débité.";
}
