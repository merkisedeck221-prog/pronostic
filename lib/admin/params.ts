/** Paramètres d'URL des tableaux admin (recherche, filtres, tri, pagination côté serveur). Fonctions pures. */

export type SearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_PAGE_SIZE = 25;

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = first(value);
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

export function parseEnumParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const raw = first(value);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseTextParam(value: string | string[] | undefined, max = 100): string {
  return (first(value) ?? "").trim().slice(0, max);
}

export function parseIntParam(value: string | string[] | undefined): number | null {
  const raw = first(value);
  return raw && /^-?\d{1,12}$/.test(raw) ? Number(raw) : null;
}

export const PERIODS = ["7j", "30j", "90j", "tout"] as const;
export type Period = (typeof PERIODS)[number];

/** Début de période (null = sans limite). */
export function periodStart(period: Period, now: Date = new Date()): Date | null {
  const days = period === "7j" ? 7 : period === "30j" ? 30 : period === "90j" ? 90 : null;
  return days === null ? null : new Date(now.getTime() - days * 24 * 3600 * 1000);
}

/** Fenêtre des matchs : passés ou à venir. */
export const FIXTURE_PERIODS = ["48h", "7j", "passes-7j", "tout"] as const;
export type FixturePeriod = (typeof FIXTURE_PERIODS)[number];

export function fixturePeriodRange(period: FixturePeriod, now: Date = new Date()): { from: Date | null; to: Date | null } {
  const h = 3600 * 1000;
  switch (period) {
    case "48h":
      return { from: now, to: new Date(now.getTime() + 48 * h) };
    case "7j":
      return { from: now, to: new Date(now.getTime() + 7 * 24 * h) };
    case "passes-7j":
      return { from: new Date(now.getTime() - 7 * 24 * h), to: now };
    default:
      return { from: null, to: null };
  }
}

/** Lien vers la même page avec des paramètres modifiés (null / "" = retiré). */
export function withParams(path: string, current: SearchParams, changes: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const v = first(value);
    if (v !== undefined && v !== "") params.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function pageCount(total: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageRange(page: number, pageSize = ADMIN_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
