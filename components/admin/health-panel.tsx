import Link from "next/link";
import { AdminActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runHealthCheckAction } from "@/lib/admin/actions/health";
import { anomalyLink, isReportStale, type HealthAnomaly } from "@/lib/admin/health";
import { formatDateTime } from "@/lib/utils/dates";

/** Surveillance : dernier rapport quotidien, affiché en tête de /admin. */
export function HealthPanel({ report, anomalies, timezone }: { report: { created_at: string; status: string } | null; anomalies: HealthAnomaly[]; timezone: string }) {
  const stale = isReportStale(report?.created_at ?? null);
  return (
    <Card className={anomalies.length > 0 || stale ? "border-destructive" : undefined}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Surveillance
            <Badge variant={anomalies.length > 0 ? "destructive" : "default"}>{report ? (anomalies.length > 0 ? `${anomalies.length} anomalie(s)` : "Aucune anomalie") : "Jamais lancée"}</Badge>
          </CardTitle>
          <CardDescription>
            {report ? `Dernière vérification : ${formatDateTime(report.created_at, timezone)}` : "Aucun rapport."} Vérification automatique chaque jour à 7 h 07 (heure de Porto-Novo).
            {stale && report ? " ⚠ Le dernier rapport date de plus de 26 h : vérifier la tâche Supabase Cron « health-check »." : ""}
          </CardDescription>
        </div>
        <AdminActionForm action={runHealthCheckAction} submitLabel="Relancer la vérification" pendingLabel="Vérification…" variant="outline" />
      </CardHeader>
      {anomalies.length > 0 ? (
        <CardContent>
          <ul className="space-y-2 text-sm">
            {anomalies.map((a) => {
              const link = anomalyLink(a.type);
              return (
                <li key={a.type} className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.severity === "error" ? "destructive" : "secondary"}>{a.severity === "error" ? "Erreur" : "Attention"}</Badge>
                  <span>{a.message}</span>
                  {link ? (
                    <Link href={link.href} className="text-xs underline-offset-4 hover:underline">
                      {link.label}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
