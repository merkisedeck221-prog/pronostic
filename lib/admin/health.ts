import { z } from "zod";

/** Rapport de surveillance (table health_reports). */
export const healthAnomalySchema = z.object({
  type: z.string(),
  severity: z.enum(["error", "warning"]),
  count: z.number(),
  message: z.string(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type HealthAnomaly = z.infer<typeof healthAnomalySchema>;

export function parseAnomalies(value: unknown): HealthAnomaly[] {
  const parsed = z.array(healthAnomalySchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Lien utile pour chaque type d'anomalie. */
export function anomalyLink(type: string): { href: string; label: string } | null {
  switch (type) {
    case "failed_jobs":
    case "no_recent_sync":
    case "low_quota":
      return { href: "/admin/synchronisation", label: "Synchronisation" };
    case "fixtures_without_prediction":
      return { href: "/admin/matchs?periode=48h&pronostic=sans", label: "Matchs sans pronostic" };
    case "balance_mismatch":
      return { href: "/admin/transactions?controle=1", label: "Contrôle de cohérence" };
    default:
      return null;
  }
}

/** Un rapport de plus de 26 h signale que la tâche quotidienne ne tourne plus. */
export function isReportStale(createdAt: string | null, now: Date = new Date()): boolean {
  if (!createdAt) return true;
  return now.getTime() - new Date(createdAt).getTime() > 26 * 3600 * 1000;
}
