/**
 * Filtres de l'historique du portefeuille (module 1, plan crédits v2).
 * Les valeurs d'URL sont en français, comme les pages.
 */
export const TRANSACTION_FILTERS = [
  { value: "tous", label: "Tout" },
  { value: "recus", label: "Reçus" },
  { value: "consommes", label: "Consommés" },
  { value: "remboursements", label: "Remboursements" },
] as const;

export type TransactionFilter = (typeof TRANSACTION_FILTERS)[number]["value"];

/** Valeur de ?filtre= : un filtre connu, sinon « tous ». */
export function parseTransactionFilter(value: unknown): TransactionFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return TRANSACTION_FILTERS.some((f) => f.value === raw) ? (raw as TransactionFilter) : "tous";
}

/**
 * Condition équivalente côté base :
 * - reçus : montant positif, hors remboursement (recharges, bonus, ajustements +) ;
 * - consommés : montant négatif (déblocages, ajustements −) ;
 * - remboursements : type refund.
 */
export function matchesTransactionFilter(filter: TransactionFilter, tx: { type: string; amount: number }): boolean {
  switch (filter) {
    case "recus":
      return tx.amount > 0 && tx.type !== "refund";
    case "consommes":
      return tx.amount < 0;
    case "remboursements":
      return tx.type === "refund";
    default:
      return true;
  }
}

/** Numéro de reçu lisible et stable : « RC-AAAAMMJJ-XXXXXXXX ». */
export function receiptNumber(topupId: string, completedAt: string): string {
  const date = completedAt.slice(0, 10).replaceAll("-", "");
  return `RC-${date}-${topupId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
