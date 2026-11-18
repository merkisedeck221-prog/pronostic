import { Badge } from "@/components/ui/badge";
import { resultLabel, type PredictionResult } from "@/lib/settle/labels";

/** Statut d'un pronostic : En attente, Gagné, Perdu, Annulé (et remboursé). */
export function PredictionResultBadge({ result, refunded = false }: { result: PredictionResult; refunded?: boolean }) {
  const variant = result === "won" ? "default" : result === "lost" ? "destructive" : result === "void" ? "outline" : "secondary";
  return <Badge variant={variant}>{resultLabel(result, refunded)}</Badge>;
}
