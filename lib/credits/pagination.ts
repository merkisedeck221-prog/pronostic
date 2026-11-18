/** Numéro de page depuis ?page= : entier ≥ 1, sinon 1. */
export function parsePage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 ? page : 1;
}
