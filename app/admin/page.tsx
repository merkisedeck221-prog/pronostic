import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  BotIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CoinsIcon,
  GaugeIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";
import { HealthPanel } from "@/components/admin/health-panel";
import { AdminPage, Stat } from "@/components/admin/table-tools";
import { parseAnomalies } from "@/lib/admin/health";
import { createClient } from "@/lib/supabase/server";
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
      <section aria-labelledby="kpi-sales" className="space-y-3">
        <h2 id="kpi-sales" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Ventes et crédits
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={WalletIcon} tone="pink" label="Chiffre d'affaires simulé" value={formatXof(o.revenue_xof)} hint="Recharges réussies" />
          <Stat icon={ShoppingCartIcon} tone="violet" label="Crédits vendus" value={n(o.credits_sold)} hint="Crédits des packs payés" />
          <Stat icon={ZapIcon} label="Crédits dépensés" value={n(o.credits_spent)} hint={`${n(o.credits_refunded)} remboursés`} />
          <Stat icon={CoinsIcon} label="Crédits en circulation" value={n(o.credits_in_circulation)} hint="Somme des soldes" />
        </div>
      </section>

      <section aria-labelledby="kpi-activity" className="space-y-3">
        <h2 id="kpi-activity" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Activité
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={UsersIcon} label="Inscrits" value={n(o.users_total)} hint={`+${n(o.users_7d)} sur 7 jours`} />
          <Stat icon={CalendarCheckIcon} label="Matchs < 48 h avec pronostic" value={n(o.upcoming_48h_with)} />
          <Stat
            icon={CalendarXIcon}
            tone={o.upcoming_48h_without > 0 ? "warning" : "default"}
            label="Matchs < 48 h sans pronostic"
            value={n(o.upcoming_48h_without)}
          />
          <Stat
            icon={GaugeIcon}
            label="Quota API-Football restant"
            value={o.quota_remaining === null ? "—" : n(o.quota_remaining)}
            hint={`${n(o.api_calls_today)} appels aujourd'hui (UTC)`}
          />
        </div>
      </section>

      <section aria-labelledby="watch" className="space-y-3">
        <h2 id="watch" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          À surveiller
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <WatchCard icon={CalendarXIcon} title="Matchs du jour sans pronostic" count={o.today_without_prediction.length}>
            {o.today_without_prediction.length === 0 ? (
              <p className="text-muted-foreground">Aucun.</p>
            ) : (
              <ul className="space-y-2">
                {o.today_without_prediction.map((f) => (
                  <li key={f.id}>
                    <Link href={`/admin/matchs/${f.id}`} className="font-medium underline-offset-4 hover:underline">
                      {f.home_name} – {f.away_name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {f.competition_name} · {formatDateTime(f.kickoff_at, tz)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </WatchCard>
          <WatchCard icon={RefreshCwIcon} title="Dernières tâches en erreur" count={o.failed_jobs.length} link={{ href: "/admin/synchronisation", label: "Voir la synchronisation" }}>
            {o.failed_jobs.length === 0 ? (
              <p className="text-muted-foreground">Aucune.</p>
            ) : (
              <ul className="space-y-2">
                {o.failed_jobs.map((j) => (
                  <li key={j.id}>
                    <span className="font-medium">{j.job}</span> · {j.status} · {formatDateTime(j.started_at, tz)}
                    {j.error ? <span className="block truncate text-xs text-muted-foreground">{j.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </WatchCard>
          <WatchCard icon={BotIcon} title="Générations IA en échec" count={o.failed_ai.length} link={{ href: "/admin/ia", label: "Voir le suivi de l'IA" }}>
            {o.failed_ai.length === 0 ? (
              <p className="text-muted-foreground">Aucune.</p>
            ) : (
              <ul className="space-y-2">
                {o.failed_ai.map((r) => (
                  <li key={r.id}>
                    {r.fixture_id ? (
                      <Link href={`/admin/matchs/${r.fixture_id}`} className="font-medium underline-offset-4 hover:underline">
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
          </WatchCard>
        </div>
      </section>
    </AdminPage>
  );
}

/** Encadré « À surveiller » : vert quand tout va bien, ambre dès qu'il y a un élément. */
function WatchCard({
  icon: Icon,
  title,
  count,
  link,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className={`space-y-3 rounded-xl border p-4 text-sm ${count > 0 ? "border-amber-400/40 bg-amber-400/5" : "border-white/10 bg-card"}`}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className={count > 0 ? "size-4 text-amber-300" : "size-4 text-emerald-300"} aria-hidden />
        <span className="flex-1">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${count > 0 ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/10 text-emerald-300"}`}>
          {count > 0 ? count : "OK"}
        </span>
      </h3>
      {children}
      {link ? (
        <Link href={link.href} className="inline-block text-xs font-semibold text-pronex-pink underline-offset-4 hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
