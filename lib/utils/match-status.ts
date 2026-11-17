/**
 * Statuts de match API-Football (fixture.status.short) → libellés français
 * et catégorie d'affichage (RG-F2-3 : un match reporté, annulé ou interrompu
 * affiche clairement son statut).
 */

export type MatchPhase = "upcoming" | "live" | "finished" | "cancelled";

type StatusInfo = { label: string; phase: MatchPhase };

const STATUSES: Record<string, StatusInfo> = {
  TBD: { label: "Horaire à confirmer", phase: "upcoming" },
  NS: { label: "À venir", phase: "upcoming" },
  "1H": { label: "1re mi-temps", phase: "live" },
  HT: { label: "Mi-temps", phase: "live" },
  "2H": { label: "2e mi-temps", phase: "live" },
  ET: { label: "Prolongations", phase: "live" },
  BT: { label: "Pause avant prolongations", phase: "live" },
  P: { label: "Tirs au but", phase: "live" },
  LIVE: { label: "En cours", phase: "live" },
  SUSP: { label: "Suspendu", phase: "live" },
  INT: { label: "Interrompu", phase: "live" },
  FT: { label: "Terminé", phase: "finished" },
  AET: { label: "Terminé après prolongations", phase: "finished" },
  PEN: { label: "Terminé aux tirs au but", phase: "finished" },
  PST: { label: "Reporté", phase: "cancelled" },
  CANC: { label: "Annulé", phase: "cancelled" },
  ABD: { label: "Abandonné", phase: "cancelled" },
  AWD: { label: "Sur tapis vert", phase: "finished" },
  WO: { label: "Forfait", phase: "finished" },
};

export const PHASE_LABELS: Record<MatchPhase, string> = {
  upcoming: "À venir",
  live: "En cours",
  finished: "Terminé",
  cancelled: "Annulé ou reporté",
};

export function matchStatus(statusShort: string | null | undefined): StatusInfo & { code: string } {
  const code = (statusShort ?? "NS").toUpperCase();
  return { code, ...(STATUSES[code] ?? { label: code, phase: "upcoming" }) };
}

export const isFinished = (status: string | null | undefined) => matchStatus(status).phase === "finished";
export const isLive = (status: string | null | undefined) => matchStatus(status).phase === "live";
export const isCancelledOrPostponed = (status: string | null | undefined) => matchStatus(status).phase === "cancelled";
export const isUpcoming = (status: string | null | undefined) => matchStatus(status).phase === "upcoming";
