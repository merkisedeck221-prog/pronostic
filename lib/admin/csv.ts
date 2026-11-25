/** Export CSV (séparateur « ; » pour Excel en français, BOM UTF-8). Fonctions pures. */

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | boolean | null | undefined };

export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Neutralise les formules (injection CSV) : =, +, -, @ en tête de cellule texte.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((c) => csvEscape(c.header)).join(";")];
  for (const row of rows) lines.push(columns.map((c) => csvEscape(c.value(row))).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export type TransactionCsvRow = {
  id: number;
  created_at: string;
  user_id: string;
  display_name: string | null;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
};

export const TRANSACTION_CSV_COLUMNS: readonly CsvColumn<TransactionCsvRow>[] = [
  { header: "id", value: (r) => r.id },
  { header: "date_utc", value: (r) => r.created_at },
  { header: "utilisateur_id", value: (r) => r.user_id },
  { header: "utilisateur", value: (r) => r.display_name },
  { header: "type", value: (r) => r.type },
  { header: "montant", value: (r) => r.amount },
  { header: "solde_apres", value: (r) => r.balance_after },
  { header: "libelle", value: (r) => r.description },
  { header: "reference_type", value: (r) => r.reference_type },
  { header: "reference_id", value: (r) => r.reference_id },
];

export type TopupCsvRow = {
  id: string;
  created_at: string;
  user_id: string;
  display_name: string | null;
  pack: string | null;
  credits: number;
  /** Crédits réellement versés (égal à credits ; ancien bonus inclus pour l'historique). */
  credited: number;
  amount_xof: number;
  provider: string;
  provider_ref: string | null;
  status: string;
  completed_at: string | null;
};

export const TOPUP_CSV_COLUMNS: readonly CsvColumn<TopupCsvRow>[] = [
  { header: "id", value: (r) => r.id },
  { header: "date_utc", value: (r) => r.created_at },
  { header: "utilisateur_id", value: (r) => r.user_id },
  { header: "utilisateur", value: (r) => r.display_name },
  { header: "pack", value: (r) => r.pack },
  { header: "credits", value: (r) => r.credits },
  { header: "credits_verses", value: (r) => r.credited },
  { header: "montant_xof", value: (r) => r.amount_xof },
  { header: "fournisseur", value: (r) => r.provider },
  { header: "reference", value: (r) => r.provider_ref },
  { header: "statut", value: (r) => r.status },
  { header: "termine_le_utc", value: (r) => r.completed_at },
];
