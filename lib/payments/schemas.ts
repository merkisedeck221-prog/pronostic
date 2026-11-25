import { z } from "zod";

/**
 * Entrée de la création d'une recharge : UNIQUEMENT le pack choisi. Le prix et
 * les crédits sont lus en base (packs fixes PRONEX, aucun bonus) ; tout autre
 * champ envoyé par le navigateur (montant, crédits, code promo) est ignoré.
 */
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
  PROMO_DISABLED: "Les codes promo ne sont plus proposés.",
  PAYMENT_DISABLED: "Ce moyen de paiement est momentanément désactivé.",
};

export function topupErrorMessage(code: string | undefined): string {
  return (code && TOPUP_ERRORS[code]) || "Impossible de créer la recharge. Aucun montant n'a été débité. Réessayez.";
}
