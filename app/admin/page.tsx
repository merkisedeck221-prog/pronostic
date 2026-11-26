import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ActivityIcon,
  BotIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleDashedIcon,
  ClockIcon,
  LockOpenIcon,
  ReceiptTextIcon,
  SparklesIcon,
  TrophyIcon,
  UserCheckIcon,
  CalendarXIcon,
  CoinsIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";
import { HealthPanel } from "@/components/admin/health-panel";
import { AdminPage, Stat } from "@/components/admin/table-tools";
import { getControlCenter, jobHealth } from "@/lib/admin/control-center";
import { parseAnomalies } from "@/lib/admin/health";
import { createClient } from "@/lib/supabase/server";
import { adminRpc, type AdminOverview } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Administration · PRONEX" };

const n = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

type CronJob = { jobname: string; active: boolean; last_status: string | null };
type SystemState = "ok" | "warning" | "error" | "unknown";

const STATE_LABEL: Record<SystemState, string> = { ok: "Opérationnel", warning: "À surveiller", error: "Erreur", unknown: "Aucune donnée" };

function StateDot({ state }: { state: SystemState }) {
  const Icon = state === "ok" ? CheckCircle2Icon : state === "error" ? CircleAlertIcon : state === "warning" ? ActivityIcon : CircleDashedIcon;
  const color = state === "ok" ? "text-success" : state === "error" ? "text-red-400" : state === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only sm:not-sr-only">{STATE_LABEL[state]}</span>
    </span>
  );
}

/** Carte d'état d'un système : pastille d'état, résumé, détail, lien. */
function SystemCard({
  icon: Icon,
  title,
  state,
  summary,
  link,
  children,
}: {
  icon: LucideIcon;
  title: string;
  state: SystemState;
  summary: string;
  link: { href: string; label: string };
  children: ReactNode;
}) {
  const border = state === "error" ? "border-destructive/50" : state === "warning" ? "border-warning/40" : "border-white/10";
  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-pronex-pink" aria-hidden />
          {title}
        </h3>
        <StateDot state={state} />
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
      <div className="flex-1">{children}</div>
      <Link href={link.href} className="tap-target text-xs font-semibold text-pronex-pink underline-offset-4 hover:underline">
        {link.label}
      </Link>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const supabase = await createClient();
  const [o, { data: report }, cc, cron] = await Promise.all([
    adminRpc<AdminOverview>("admin_overview"),
    supabase.from("health_reports").select("created_at, status, anomalies").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getControlCenter(),
    adminRpc<{ jobs: CronJob[] }>("admin_cron_status").catch(() => null),
  ]);
  const v = (value: number | null) => (value === null ? "—" : n(value));
  const cronJobs = cron?.jobs ?? [];
  const cronActive = cronJobs.filter((j) => j.active).length;
  const cronFailed = cronJobs.filter((j) => j.last_status && j.last_status !== "succeeded").length;
  const jobStates = cc.jobs.map((j) => ({ ...j, health: jobHealth(j) }));
  const syncErrors = jobStates.filter((j) => j.health === "error").length;

  return (
    <AdminPage title="Centre de contrôle" description="État de la plateforme en temps réel, calculé sur les données de la base.">
      <HealthPanel report={report} anomalies={parseAnomalies(report?.anomalies)} timezone={tz} />

      <section aria-labelledby="kpi-platform" className="space-y-3">
        <h2 id="kpi-platform" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Plateforme
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={UsersIcon} label="Utilisateurs" value={v(cc.users.total)} hint={`+${n(o.users_7d)} sur 7 jours · ${v(cc.users.banned)} suspendu(s)`} />
          <Stat icon={UserCheckIcon} label="Utilisateurs actifs (30 j)" value={v(cc.users.active30)} hint="Au moins un mouvement de crédits" />
          <Stat icon={TrophyIcon} label="Matchs en base" value={v(cc.fixtures.total)} hint={`${v(cc.fixtures.upcoming7)} à venir sur 7 jours · ${v(cc.fixtures.published)} publiés`} />
          <Stat icon={SparklesIcon} tone="violet" label="Pronostics générés" value={v(cc.predictions.generated)} hint={`${v(cc.predictions.fixturesWithPredictions)} match(s) couvert(s)`} />
          <Stat icon={LockOpenIcon} tone="pink" label="Pronostics débloqués" value={v(cc.predictions.unlocks)} hint={`${v(cc.predictions.unlocks30)} sur 30 jours`} />
          <Stat icon={ReceiptTextIcon} label="Transactions" value={v(cc.money.transactions)} hint={`${v(cc.money.transactions30)} sur 30 jours · ${v(cc.money.topupsPending)} recharge(s) en attente`} />
        </div>
      </section>

      <section aria-labelledby="systems" className="space-y-3">
        <h2 id="systems" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          État des systèmes
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <SystemCard
            icon={ClockIcon}
            title="Tâches automatiques"
            state={cron === null ? "unknown" : cronFailed > 0 ? "error" : cronActive === 0 ? "warning" : "ok"}
            summary={cron === null ? "État de Supabase Cron indisponible." : `${cronActive} tâche(s) active(s) sur ${cronJobs.length}${cronFailed > 0 ? ` · ${cronFailed} dernière(s) exécution(s) en échec` : ""}`}
            link={{ href: "/admin/synchronisation", label: "Voir les tâches" }}
          >
            <ul className="space-y-1.5">
              {cronJobs.slice(0, 6).map((j) => (
                <li key={j.jobname} className="flex items-center justify-between gap-2">
                  <span className="truncate">{j.jobname}</span>
                  <StateDot state={!j.active ? "warning" : j.last_status && j.last_status !== "succeeded" ? "error" : j.last_status ? "ok" : "unknown"} />
                </li>
              ))}
            </ul>
          </SystemCard>
          <SystemCard
            icon={RefreshCwIcon}
            title="Synchronisations"
            state={syncErrors > 0 ? "error" : jobStates.some((j) => j.health === "stale") ? "warning" : jobStates.every((j) => j.health === "never") ? "unknown" : "ok"}
            summary={`${o.api_calls_today} appel(s) API-Football aujourd'hui · quota restant ${o.quota_remaining === null ? "inconnu" : n(o.quota_remaining)}`}
            link={{ href: "/admin/synchronisation", label: "Voir l'historique" }}
          >
            <ul className="space-y-1.5">
              {jobStates.map((j) => (
                <li key={j.job} className="flex items-center justify-between gap-2">
                  <span className="truncate">{j.job}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {j.started_at ? formatDateTime(j.started_at, tz) : "jamais"}
                    <StateDot state={j.health === "ok" ? "ok" : j.health === "error" ? "error" : j.health === "stale" ? "warning" : "unknown"} />
                  </span>
                </li>
              ))}
            </ul>
          </SystemCard>
          <SystemCard
            icon={BotIcon}
            title="Moteur IA"
            state={(cc.ai.failed24h ?? 0) > 0 ? "error" : (cc.ai.onDemandFailed7d ?? 0) > 0 ? "warning" : cc.ai.lastRun ? "ok" : "unknown"}
            summary={cc.ai.lastRun ? `Dernière génération : ${formatDateTime(cc.ai.lastRun.created_at, tz)} (${cc.ai.lastRun.status})` : "Aucune génération enregistrée."}
            link={{ href: "/admin/ia", label: "Voir le suivi de l'IA" }}
          >
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs text-muted-foreground">Générations (24 h)</dt>
                <dd className="font-heading font-bold tabular-nums">{v(cc.ai.runs24h)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Échecs (24 h)</dt>
                <dd className="font-heading font-bold tabular-nums">{v(cc.ai.failed24h)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Durée moyenne</dt>
                <dd className="font-heading font-bold tabular-nums">{cc.ai.avgDurationMs === null ? "—" : `${(cc.ai.avgDurationMs / 1000).toFixed(1)} s`}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">À la demande</dt>
                <dd className="font-heading font-bold tabular-nums">
                  {v(cc.ai.onDemandPending)} <span className="text-xs font-normal text-muted-foreground">en cours</span>
                </dd>
                {(cc.ai.onDemandFailed7d ?? 0) > 0 ? (
                  <dd className="text-xs text-warning">{cc.ai.onDemandFailed7d} échec(s) sur 7 jours, crédits rendus</dd>
                ) : null}
              </div>
            </dl>
          </SystemCard>
        </div>
      </section>
      <section aria-labelledby="kpi-sales" className="space-y-3">
        <h2 id="kpi-sales" className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Revenus et crédits <span className="normal-case tracking-normal">(paiement simulé)</span>
        </h2>
        {o.stats_since ? (
          <p className="text-xs text-muted-foreground">
            Ventes comptées depuis le {formatDateTime(o.stats_since, tz)} (date de lancement, modifiable dans Paramètres). Les essais antérieurs restent dans Transactions.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={WalletIcon} tone="pink" label="Chiffre d'affaires simulé" value={formatXof(o.revenue_xof)} hint="Recharges réussies" />
          <Stat icon={ShoppingCartIcon} tone="violet" label="Crédits vendus" value={n(o.credits_sold)} hint="Crédits des packs payés" />
          <Stat icon={ZapIcon} label="Crédits dépensés" value={n(o.credits_spent)} hint={`${n(o.credits_refunded)} remboursés`} />
          <Stat icon={CoinsIcon} label="Crédits en circulation" value={n(o.credits_in_circulation)} hint="Somme des soldes" />
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
    <div className={`space-y-3 rounded-xl border p-4 text-sm ${count > 0 ? "border-warning/40 bg-warning/5" : "border-white/10 bg-card"}`}>
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className={count > 0 ? "size-4 text-warning" : "size-4 text-success"} aria-hidden />
        <span className="flex-1">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${count > 0 ? "bg-warning/15 text-warning" : "bg-success/10 text-success"}`}>
          {count > 0 ? count : "OK"}
        </span>
      </h3>
      {children}
      {link ? (
        <Link href={link.href} className="tap-target text-xs font-semibold text-pronex-pink underline-offset-4 hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
