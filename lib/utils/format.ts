/** Formatage pour l'interface (français). */

const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 1 crédit », « 25 crédits ». */
export function formatCredits(amount: number): string {
  return `${integerFormatter.format(amount)} ${Math.abs(amount) <= 1 ? "crédit" : "crédits"}`;
}

/** « 2 500 F CFA ». */
export function formatXof(amount: number): string {
  return `${integerFormatter.format(amount)} F CFA`;
}
