import { CREDIT_ERROR_CODES, type CreditErrorCode } from "./schemas";

/** Messages français des codes d'erreur des fonctions SQL de crédits. */
const MESSAGES: Record<CreditErrorCode, string> = {
  NOT_AUTHENTICATED: "Connectez-vous pour débloquer un pronostic.",
  BANNED: "Votre compte est suspendu : les déblocages sont impossibles.",
  MAINTENANCE: "Les déblocages sont momentanément suspendus pour maintenance. Réessayez plus tard.",
  NOT_AVAILABLE: "Ce pronostic n'est pas disponible.",
  MATCH_STARTED: "Le match a commencé : les déblocages sont fermés pour ce match.",
  ALREADY_UNLOCKED: "Vous avez déjà débloqué ce pronostic.",
  INSUFFICIENT_BALANCE: "Solde insuffisant : rechargez votre compte pour débloquer ce pronostic.",
  FORBIDDEN: "Action réservée aux administrateurs.",
  INVALID_INPUT: "Demande invalide.",
  UNKNOWN: "Une erreur est survenue. Aucun crédit n'a été débité. Réessayez.",
};

export function toCreditErrorCode(code: string | null | undefined): CreditErrorCode {
  return (CREDIT_ERROR_CODES as readonly string[]).includes(code ?? "") ? (code as CreditErrorCode) : "UNKNOWN";
}

/**
 * Message français pour un code. Pour NOT_AVAILABLE et INVALID_INPUT, le
 * message précis de la fonction SQL (déjà en français) est conservé.
 */
export function creditErrorMessage(code: string | null | undefined, sqlMessage?: string): string {
  const known = toCreditErrorCode(code);
  if ((known === "NOT_AVAILABLE" || known === "INVALID_INPUT") && sqlMessage) return sqlMessage;
  return MESSAGES[known];
}

export type CreditFailure = { ok: false; code: CreditErrorCode; message: string };

export function creditFailure(code: string | null | undefined, sqlMessage?: string): CreditFailure {
  return { ok: false, code: toCreditErrorCode(code), message: creditErrorMessage(code, sqlMessage) };
}
