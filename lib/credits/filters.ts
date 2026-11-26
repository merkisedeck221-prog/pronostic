/**
 * Filtres de l'historique du portefeuille (module 1, plan crédits v2).
 * Les valeurs d'URL sont en français, comme les pages.
 */
export const TRANSACTION_FILTERS = [
  { value: "tous", label: "Tout" },
  { value: "achats", label: "Achats" },
  { value: "deblocages", label: "Déblocages" },
  { value: "remboursements", label: "Remboursements" },
  { value: "ajustements", label: "Ajustements" },
  // Anciennes valeurs (liens existants) : toujours acceptées, plus affichées.
  { value: "recus", label: "Reçus" },
  { value: "consommes", label: "Consommés" },
] as const;

export type TransactionFilter = (typeof TRANSACTION_FILTERS)[number]["value"];

/** Filtres proposés à l'écran (par type de mouvement). */
export const DISPLAYED_TRANSACTION_FILTERS = TRANSACTION_FILTERS.filter((f) => f.value !== "recus" && f.value !== "consommes");

/** Valeur de ?filtre= : un filtre connu, sinon « tous ». */
export function parseTransactionFilter(value: unknown): TransactionFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return TRANSACTION_FILTERS.some((f) => f.value === raw) ? (raw as TransactionFilter) : "tous";
}

/**
 * Condition équivalente côté base (listTransactions) :
 * - achats : recharges (topup) ; déblocages : unlock ; remboursements : refund ;
 * - ajustements : corrections de l'administration et anciens bonus (historique) ;
 * - reçus / consommés (anciens filtres) : montant positif hors remboursement / négatif.
 */
export function matchesTransactionFilter(filter: TransactionFilter, tx: { type: string; amount: number }): boolean {
  switch (filter) {
    case "achats":
      return tx.type === "topup";
    case "deblocages":
      return tx.type === "unlock";
    case "remboursements":
      return tx.type === "refund";
    case "ajustements":
      return tx.type === "admin_adjustment" || tx.type === "bonus";
    case "recus":
      return tx.amount > 0 && tx.type !== "refund";
    case "consommes":
      return tx.amount < 0;
    default:
      return true;
  }
}

/** Numéro de reçu lisible et stable : « RC-AAAAMMJJ-XXXXXXXX ». */
export function receiptNumber(topupId: string, completedAt: string): string {
  const date = completedAt.slice(0, 10).replaceAll("-", "");
  return `RC-${date}-${topupId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
