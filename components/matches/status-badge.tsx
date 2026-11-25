import { Badge } from "@/components/ui/badge";
import { matchStatus } from "@/lib/utils/match-status";

/** Statut du match en clair (RG-F2-3). Rien n'est affiché pour un match simplement « à venir ». */
export function StatusBadge({ status, showUpcoming = false }: { status: string | null; showUpcoming?: boolean }) {
  const info = matchStatus(status);
  if (info.phase === "upcoming" && !showUpcoming && info.code === "NS") return null;
  const variant = info.phase === "live" ? "default" : info.phase === "cancelled" ? "destructive" : info.phase === "finished" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className={info.phase === "live" ? "gap-1.5" : undefined}>
      {info.phase === "live" ? <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
      {info.label}
    </Badge>
  );
}
