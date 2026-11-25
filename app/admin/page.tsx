import type { Metadata } from "next";
import Link from "next/link";
import { HealthPanel } from "@/components/admin/health-panel";
import { AdminPage, Stat } from "@/components/admin/table-tools";
import { parseAnomalies } from "@/lib/admin/health";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminRpc, type AdminOverview } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Administration · PRONEX" };

const n = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const supabase = await createClient();
  const [o, { data: report }] = await Promise.all([
    adminRpc<AdminOverview>("admin_overview"),
    supabase.from("health_reports").select("created_at, status, anomalies").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <AdminPage title="Vue d'ensemble">
      <HealthPanel report={report} anomalies={parseAnomalies(report?.anomalies)} timezone={tz} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inscrits" value={n(o.users_total)} hint={`+${n(o.users_7d)} sur 7 jours`} />
        <Stat label="Chiffre d'affaires simulé" value={formatXof(o.revenue_xof)} hint="Recharges réussies" />
        <Stat label="Crédits vendus" value={n(o.credits_sold)} hint="Crédits des packs payés" />
        <Stat label="Crédits dépensés" value={n(o.credits_spent)} hint={`${n(o.credits_refunded)} remboursés`} />
        <Stat label="Crédits en circulation" value={n(o.credits_in_circulation)} hint="Somme des soldes" />
        <Stat label="Matchs < 48 h avec pronostic" value={n(o.upcoming_48h_with)} />
        <Stat label="Matchs < 48 h sans pronostic" value={n(o.upcoming_48h_without)} />
        <Stat
          label="Quota API-Football restant"
          value={o.quota_remaining === null ? "—" : n(o.quota_remaining)}
          hint={`${n(o.api_calls_today)} appels aujourd'hui (UTC)`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>À surveiller</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 text-sm lg:grid-cols-3">
          <section className="space-y-2">
            <h2 className="font-medium">Matchs du jour sans pronostic ({o.today_without_prediction.length})</h2>
            {o.today_without_prediction.length === 0 ? (
              <p className="text-muted-foreground">Aucun.</p>
            ) : (
              <ul className="space-y-1">
                {o.today_without_prediction.map((f) => (
                  <li key={f.id}>
                    <Link href={`/admin/matchs/${f.id}`} className="underline-offset-4 hover:underline">
                      {f.home_name} – {f.away_name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {f.competition_name} · {formatDateTime(f.kickoff_at, tz)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <h2 className="font-medium">Dernières tâches en erreur</h2>
            {o.failed_jobs.length === 0 ? (
              <p className="text-muted-foreground">Aucune.</p>
            ) : (
              <ul className="space-y-1">
                {o.failed_jobs.map((j) => (
                  <li key={j.id}>
                    <span className="font-medium">{j.job}</span> · {j.status} · {formatDateTime(j.started_at, tz)}
                    {j.error ? <span className="block truncate text-xs text-muted-foreground">{j.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/synchronisation" className="text-xs underline-offset-4 hover:underline">
              Voir la synchronisation
            </Link>
          </section>
          <section className="space-y-2">
            <h2 className="font-medium">Générations IA en échec</h2>
            {o.failed_ai.length === 0 ? (
              <p className="text-muted-foreground">Aucune.</p>
            ) : (
              <ul className="space-y-1">
                {o.failed_ai.map((r) => (
                  <li key={r.id}>
                    {r.fixture_id ? (
                      <Link href={`/admin/matchs/${r.fixture_id}`} className="underline-offset-4 hover:underline">
                        Match {r.fixture_id}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    · {r.prompt_version} · {formatDateTime(r.created_at, tz)}
                    {r.error ? <span className="block truncate text-xs text-muted-foreground">{r.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/ia" className="text-xs underline-offset-4 hover:underline">
              Voir le suivi de l&apos;IA
            </Link>
          </section>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
