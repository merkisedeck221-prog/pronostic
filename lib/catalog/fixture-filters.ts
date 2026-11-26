import { matchStatus, type MatchPhase } from "@/lib/utils/match-status";

/**
 * Filtres de la liste des matchs (pures, testées). Valeurs d'URL en français.
 */
export const STATUS_FILTERS = [
  { value: "tous", label: "Tous" },
  { value: "a-venir", label: "À venir" },
  { value: "en-cours", label: "En cours" },
  { value: "termines", label: "Terminés" },
  { value: "reportes", label: "Reportés / annulés" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const PHASE_BY_FILTER: Record<Exclude<StatusFilter, "tous">, MatchPhase> = {
  "a-venir": "upcoming",
  "en-cours": "live",
  termines: "finished",
  reportes: "cancelled",
};

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

export function parseStatusFilter(value: unknown): StatusFilter {
  const raw = first(value);
  return STATUS_FILTERS.some((f) => f.value === raw) ? (raw as StatusFilter) : "tous";
}

export function matchesStatusFilter(filter: StatusFilter, statusShort: string | null | undefined): boolean {
  return filter === "tous" || matchStatus(statusShort).phase === PHASE_BY_FILTER[filter];
}

/** Minuscules, sans accents ni espaces superflus (recherche tolérante : « Etoile » trouve « Étoile »). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte de recherche nettoyé (60 caractères au plus), ou "" si absent. */
export function parseSearch(value: unknown): string {
  const raw = first(value);
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

/** Vrai si chaque mot recherché apparaît dans une équipe ou la compétition. */
export function matchesSearch(query: string, names: (string | null | undefined)[]): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(names.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}

/** Jour précis « AAAA-MM-JJ » (calendrier valide, entre 2000 et 2100), sinon null. */
export function parseDay(value: unknown): string | null {
  const raw = first(value);
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || y > 2100 || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return raw;
}
