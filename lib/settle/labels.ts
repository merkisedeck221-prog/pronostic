import { SETTLEABLE_STATUSES, successRate } from "./rules";

export type PredictionResult = "pending" | "won" | "lost" | "void";

/** Libellé d'un statut ; « Annulé et remboursé » si le déblocage a été remboursé. */
export function resultLabel(result: PredictionResult, refunded = false): string {
  switch (result) {
    case "won":
      return "Gagné";
    case "lost":
      return "Perdu";
    case "void":
      return refunded ? "Annulé et remboursé" : "Annulé";
    default:
      return "En attente";
  }
}

/** « 62,5 % » ; « — » si aucun pronostic décidé. */
export function formatRate(won: number, lost: number): string {
  const rate = successRate(won, lost);
  return rate === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(rate)} %`;
}

/** Seuil sous lequel l'échantillon est signalé comme trop faible. */
export const SMALL_SAMPLE_THRESHOLD = 50;

export function isSmallSample(won: number, lost: number): boolean {
  return won + lost < SMALL_SAMPLE_THRESHOLD;
}

/** Score affiché : temps réglementaire, + score final si prolongation / tirs au but. */
export function finalScoreLabel(p: {
  status_short: string;
  ft_home: number | null;
  ft_away: number | null;
  goals_home: number | null;
  goals_away: number | null;
}): string | null {
  if (!(SETTLEABLE_STATUSES as readonly string[]).includes(p.status_short)) return null;
  if (p.ft_home === null || p.ft_away === null) return null;
  const regulation = `${p.ft_home} – ${p.ft_away}`;
  if (p.status_short === "FT") return regulation;
  const after = p.goals_home !== null && p.goals_away !== null ? `${p.goals_home} – ${p.goals_away}` : null;
  const suffix = p.status_short === "AET" ? "a.p." : "t.a.b.";
  return after && after !== regulation ? `${regulation} (${after} ${suffix})` : `${regulation} (${suffix})`;
}

/** À venir : pronostic encore en attente sur un match non terminé. */
export function isUpcomingPrediction(p: { result: PredictionResult }): boolean {
  return p.result === "pending";
}
