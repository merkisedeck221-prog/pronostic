import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { matchStatus } from "@/lib/utils/match-status";

/**
 * Statut du match en clair (RG-F2-3). Rien n'est affiché pour un match simplement
 * « à venir ». En cours : vert avec point animé ; reporté / annulé : orange (attention).
 */
export function StatusBadge({ status, showUpcoming = false }: { status: string | null; showUpcoming?: boolean }) {
  const info = matchStatus(status);
  if (info.phase === "upcoming" && !showUpcoming && info.code === "NS") return null;
  return (
    <Badge
      variant={info.phase === "finished" ? "secondary" : "outline"}
      className={cn(
        info.phase === "live" && "gap-1.5 border-success/40 bg-success/10 text-success",
        info.phase === "cancelled" && "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {info.phase === "live" ? <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" /> : null}
      {info.label}
    </Badge>
  );
}
