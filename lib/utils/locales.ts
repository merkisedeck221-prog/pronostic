/**
 * Pays et fuseaux horaires proposés dans les formulaires (inscription, profil).
 * Valeurs stockées : code ISO 3166-1 alpha-2 pour le pays, identifiant IANA pour le fuseau.
 */

export const DEFAULT_COUNTRY = "BJ";
export const DEFAULT_TIMEZONE = "Africa/Porto-Novo";

/** Pays proposés : Afrique francophone en tête, puis diaspora fréquente. */
export const COUNTRY_CODES = [
  "BJ", "BF", "CI", "CM", "CF", "CG", "CD", "GA", "GN", "ML", "MR", "NE", "SN", "TD", "TG",
  "MG", "KM", "DJ", "BI", "RW", "MA", "DZ", "TN", "GH", "NG", "GM", "GW", "LR", "SL", "CV",
  "FR", "BE", "CH", "LU", "CA", "US", "GB", "DE", "ES", "IT", "PT",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });

export function countryLabel(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Liste triée par libellé, Bénin en premier. */
export const COUNTRY_OPTIONS: { value: CountryCode; label: string }[] = [
  { value: "BJ" as CountryCode, label: countryLabel("BJ") },
  ...COUNTRY_CODES.filter((code) => code !== "BJ")
    .map((code) => ({ value: code, label: countryLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr")),
];

/** Fuseaux horaires proposés dans le profil. */
export const TIMEZONE_OPTIONS = [
  { value: "Africa/Porto-Novo", label: "Bénin (Porto-Novo) — UTC+1" },
  { value: "Africa/Lagos", label: "Afrique de l'Ouest et centrale (Lagos, Douala, Kinshasa) — UTC+1" },
  { value: "Africa/Abidjan", label: "Afrique de l'Ouest (Abidjan, Dakar, Lomé, Ouagadougou, Bamako) — UTC" },
  { value: "Africa/Casablanca", label: "Maroc (Casablanca)" },
  { value: "Africa/Algiers", label: "Algérie, Tunisie — UTC+1" },
  { value: "Africa/Maputo", label: "Afrique centrale et australe (Lubumbashi, Kigali, Bujumbura) — UTC+2" },
  { value: "Indian/Antananarivo", label: "Madagascar, Comores, Djibouti — UTC+3" },
  { value: "Europe/Paris", label: "France, Belgique, Suisse (Paris)" },
  { value: "Europe/London", label: "Royaume-Uni, Portugal (Londres)" },
  { value: "America/Toronto", label: "Canada, États-Unis (Est)" },
  { value: "UTC", label: "UTC" },
] as const;

export type TimezoneValue = (typeof TIMEZONE_OPTIONS)[number]["value"];

export const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((option) => option.value) as [
  TimezoneValue,
  ...TimezoneValue[],
];
