import { Badge } from "@/components/ui/badge";
import { resultLabel, type PredictionResult } from "@/lib/settle/labels";
import { cn } from "@/lib/utils";

/** Couleurs des résultats : vert gagné, rouge perdu, gris annulé, violet en attente. */
export const RESULT_BADGE_CLASSES: Record<PredictionResult, string> = {
  won: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
  lost: "border-red-400/40 bg-red-400/15 text-red-300",
  void: "border-white/15 bg-white/5 text-muted-foreground",
  pending: "border-pronex-violet/40 bg-pronex-violet/15 text-violet-200",
};

/** Statut d'un pronostic : En attente, Gagné, Perdu, Annulé (et remboursé). */
export function PredictionResultBadge({ result, refunded = false }: { result: PredictionResult; refunded?: boolean }) {
  return (
    <Badge variant="outline" className={cn(RESULT_BADGE_CLASSES[result])}>
      {resultLabel(result, refunded)}
    </Badge>
  );
}
