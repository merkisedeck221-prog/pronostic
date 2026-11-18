import { z } from "zod";

/** Entrée de la création d'une recharge : UNIQUEMENT le pack choisi (montants lus en base). */
export const startTopupSchema = z.object({
  packId: z.coerce.number().int().positive(),
});

export const topupIdSchema = z.uuid();

export const mockOutcomeSchema = z.enum(["succeeded", "failed", "cancelled"]);

export const createTopupResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    topup_id: z.uuid(),
    pack_name: z.string(),
    credits: z.number().int().positive(),
    bonus_credits: z.number().int().nonnegative(),
    amount_xof: z.number().int().positive(),
  }),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string().optional() }),
]);

const TOPUP_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Connectez-vous pour recharger votre compte.",
  BANNED: "Votre compte est suspendu : les recharges sont impossibles.",
  MAINTENANCE: "Les recharges sont momentanément suspendues pour maintenance. Réessayez plus tard.",
  NOT_AVAILABLE: "Ce pack n'est plus disponible.",
  TOO_MANY_PENDING: "Trop de recharges en attente. Réessayez dans une heure.",
};

export function topupErrorMessage(code: string | undefined): string {
  return (code && TOPUP_ERRORS[code]) || "Impossible de créer la recharge. Aucun montant n'a été débité. Réessayez.";
}

/** « +3 crédits offerts » ; null sans bonus. */
export function bonusLabel(bonus: number): string | null {
  if (bonus <= 0) return null;
  return `+${bonus} crédit${bonus > 1 ? "s" : ""} offert${bonus > 1 ? "s" : ""}`;
}
