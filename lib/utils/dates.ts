import { addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Dates de l'interface (RG-F2-2) : stockées en UTC, affichées dans le fuseau
 * de l'utilisateur (profiles.timezone), sinon DEFAULT_TIMEZONE (Africa/Porto-Novo).
 */

export const FALLBACK_TIMEZONE = "Africa/Porto-Novo";

/** Fuseau valide : celui du profil, sinon DEFAULT_TIMEZONE, sinon Africa/Porto-Novo. */
export function resolveTimezone(timezone?: string | null): string {
  for (const candidate of [timezone, process.env.DEFAULT_TIMEZONE, FALLBACK_TIMEZONE]) {
    if (candidate && isValidTimezone(candidate)) return candidate;
  }
  return FALLBACK_TIMEZONE;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

type DateInput = string | Date;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** Jour calendaire dans le fuseau : « 2026-11-22 ». */
export function dayKey(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "yyyy-MM-dd");
}

/** « 16:00 » */
export function formatTime(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "HH:mm");
}

/** « sam. 22 nov. » */
export function formatShortDate(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "EEE d MMM", { locale: fr });
}

/** « sam. 22 nov. à 16:00 » */
export function formatDateTime(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "EEE d MMM 'à' HH:mm", { locale: fr });
}

/** « samedi 22 novembre 2026 » */
export function formatLongDate(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "EEEE d MMMM yyyy", { locale: fr });
}

/** « 22/11/2026 » */
export function formatNumericDate(value: DateInput, timezone: string): string {
  return formatInTimeZone(toDate(value), timezone, "dd/MM/yyyy");
}

/** Clé du jour décalée de n jours (calcul sur le calendrier, à midi pour éviter les effets d'heure d'été). */
function shiftDayKey(key: string, days: number): string {
  const noon = new Date(`${key}T12:00:00Z`);
  return addDays(noon, days).toISOString().slice(0, 10);
}

/** « Aujourd'hui », « Demain », « Hier » ou null. */
export function relativeDayLabel(value: DateInput, timezone: string, now: Date = new Date()): string | null {
  const key = dayKey(value, timezone);
  const today = dayKey(now, timezone);
  if (key === today) return "Aujourd'hui";
  if (key === shiftDayKey(today, 1)) return "Demain";
  if (key === shiftDayKey(today, -1)) return "Hier";
  return null;
}

/** « Aujourd'hui à 16:00 », « Demain à 21:00 », sinon « sam. 22 nov. à 16:00 ». */
export function formatKickoff(value: DateInput, timezone: string, now: Date = new Date()): string {
  const relative = relativeDayLabel(value, timezone, now);
  return relative ? `${relative} à ${formatTime(value, timezone)}` : formatDateTime(value, timezone);
}

/** Titre d'un groupe de matchs par jour : « Aujourd'hui · sam. 22 nov. ». */
export function dayHeading(value: DateInput, timezone: string, now: Date = new Date()): string {
  const relative = relativeDayLabel(value, timezone, now);
  const date = formatShortDate(value, timezone);
  return relative ? `${relative} · ${date}` : date;
}

/** Instant UTC correspondant à minuit (début du jour `key`) dans le fuseau. */
export function startOfDayInTimezone(key: string, timezone: string): Date {
  return fromZonedTime(`${key}T00:00:00`, timezone);
}

export type Period = "aujourdhui" | "demain" | "7-jours";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "demain", label: "Demain" },
  { value: "7-jours", label: "7 jours" },
];

export function parsePeriod(value: unknown): Period {
  return value === "aujourdhui" || value === "demain" || value === "7-jours" ? value : "7-jours";
}

/**
 * Bornes UTC [from, to[ d'une période, calculées sur le calendrier de l'utilisateur :
 *  - aujourd'hui : de minuit à minuit (matchs déjà joués du jour compris) ;
 *  - demain : journée entière du lendemain ;
 *  - 7 jours : de maintenant à la fin du 7e jour (RG-F2-4).
 */
export function periodRange(period: Period, timezone: string, now: Date = new Date()): { from: Date; to: Date } {
  const today = dayKey(now, timezone);
  const startToday = startOfDayInTimezone(today, timezone);
  const startTomorrow = startOfDayInTimezone(shiftDayKey(today, 1), timezone);
  switch (period) {
    case "aujourdhui":
      return { from: startToday, to: startTomorrow };
    case "demain":
      return { from: startTomorrow, to: startOfDayInTimezone(shiftDayKey(today, 2), timezone) };
    case "7-jours":
      return { from: now, to: startOfDayInTimezone(shiftDayKey(today, 8), timezone) };
  }
}

/** Regroupe des éléments datés par jour calendaire (dans le fuseau), en conservant l'ordre. */
export function groupByDay<T>(items: T[], getDate: (item: T) => DateInput, timezone: string): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(getDate(item), timezone);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
}
