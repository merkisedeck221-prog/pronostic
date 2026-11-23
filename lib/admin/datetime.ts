import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";

/** Fuseau de saisie des dates dans l'administration (cahier des charges : Porto-Novo). */
export const ADMIN_TIMEZONE = "Africa/Porto-Novo";

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Valeur d'un <input type="datetime-local"> (heure de Porto-Novo) → ISO UTC.
 * Vide → null. Valeur mal formée → undefined (à refuser).
 */
export function localInputToUtc(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (v === "") return null;
  if (!LOCAL_DATETIME.test(v)) return undefined;
  const date = fromZonedTime(`${v}:00`, ADMIN_TIMEZONE);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** ISO UTC → valeur d'un <input type="datetime-local"> en heure de Porto-Novo ("" si vide). */
export function utcToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

/** Schéma Zod d'un champ date facultatif de formulaire admin. */
export const optionalLocalDateTime = z.unknown().transform((value, ctx) => {
  const iso = localInputToUtc(value);
  if (iso === undefined) {
    ctx.addIssue({ code: "custom", message: "Date invalide." });
    return z.NEVER;
  }
  return iso;
});

/** Période cohérente : fin strictement après début (si les deux sont renseignés). */
export function isValidPeriod(start: string | null, end: string | null): boolean {
  return !start || !end || new Date(end).getTime() > new Date(start).getTime();
}
