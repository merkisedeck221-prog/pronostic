import type { Database } from "@/types/database";

type TransactionType = Database["public"]["Enums"]["transaction_type"];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  topup: "Achat de crédits",
  unlock: "Déblocage",
  bonus: "Bonus (ancienne offre)",
  refund: "Remboursement",
  admin_adjustment: "Ajustement",
};

export function transactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

export const CONFIDENCE_LABELS = { low: "Faible", medium: "Moyen", high: "Élevé" } as const;

export function confidenceLabel(confidence: keyof typeof CONFIDENCE_LABELS): string {
  return CONFIDENCE_LABELS[confidence];
}

/** « +10 », « −2 » (vrai signe moins). */
export function formatSignedAmount(amount: number): string {
  const abs = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount > 0 ? `+${abs}` : amount < 0 ? `−${abs}` : "0";
}
