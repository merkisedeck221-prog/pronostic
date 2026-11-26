import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyholeIcon, TargetIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedNav } from "@/components/layout/segmented-nav";
import { StatCard } from "@/components/layout/stat-card";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { confidenceLabel } from "@/lib/credits/labels";
import { finalScoreLabel, formatRate, isUpcomingPrediction } from "@/lib/settle/labels";
import { getMyPredictions } from "@/lib/settle/queries";
import type { MyPrediction } from "@/lib/settle/schemas";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes pronostics · PRONEX" };

type Filter = "a-venir" | "termines" | "tous";

const CONFIDENCE_CLASSES: Record<string, string> = {
  low: "border-white/15 bg-white/5 text-muted-foreground",
  medium: "border-pronex-violet/40 bg-pronex-violet/15 text-violet-200",
  high: "border-pronex-pink/40 bg-pronex-pink/15 text-pink-200",
};

function PredictionCard({ p, timezone }: { p: MyPrediction; timezone: string }) {
  const score = finalScoreLabel(p);
  const spent =
    p.credits_spent != null ? (p.via_bundle ? `${formatCredits(p.credits_spent)} (match complet)` : formatCredits(p.credits_spent)) : "—";
  return (
    <li>
      <Link
        href={`/matchs/${p.fixture_id}`}
        className="pronex-lift block space-y-3 rounded-2xl border border-white/8 bg-card p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {p.home_name} – {p.away_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {p.competition_name} · {formatDateTime(p.kickoff_at, timezone)}
            </p>
          </div>
          <PredictionResultBadge result={p.result} refunded={p.refunded} />
        </div>

        <div className="space-y-2 rounded-xl bg-muted p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{p.market_label}</p>
          <p className="font-heading text-lg leading-snug font-bold">{p.selection_label}</p>
          <div className="flex flex-wrap items-center gap-2">
            {p.confidence ? (
              <Badge variant="outline" className={CONFIDENCE_CLASSES[p.confidence]}>
                Confiance : {confidenceLabel(p.confidence)}
              </Badge>
            ) : null}
            {p.probability != null ? <span className="text-xs text-muted-foreground tabular-nums">Probabilité estimée : {p.probability} %</span> : null}
          </div>
          {p.probability != null ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="presentation">
              <div className="h-full rounded-full bg-pronex-violet" style={{ width: `${Math.max(0, Math.min(100, p.probability))}%` }} />
            </div>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Acheté le</dt>
            <dd className="tabular-nums">{p.unlocked_at ? formatDateTime(p.unlocked_at, timezone) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Crédits dépensés</dt>
            <dd className="tabular-nums">{spent}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Score final</dt>
            <dd className="tabular-nums">{score ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Mi-temps</dt>
            <dd className="tabular-nums">{p.ht_home != null && p.ht_away != null ? `${p.ht_home} – ${p.ht_away}` : "—"}</dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}

export default async function MesPronosticsPage({ searchParams }: PageProps<"/mes-pronostics">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const raw = (await searchParams).filtre;
  const filter: Filter = raw === "termines" || raw === "tous" ? raw : "a-venir";

  const all = await getMyPredictions();
  const won = all.filter((p) => p.result === "won").length;
  const lost = all.filter((p) => p.result === "lost").length;
  const voided = all.filter((p) => p.result === "void").length;
  // Crédits dépensés : un match complet compte une seule fois (même déblocage pour tous ses marchés).
  const spent = new Map<string, number>();
  for (const p of all) {
    if (p.credits_spent == null) continue;
    spent.set(p.via_bundle ? `bundle-${p.fixture_id}` : `market-${p.prediction_id}`, p.credits_spent);
  }
  const totalSpent = [...spent.values()].reduce((sum, v) => sum + v, 0);
  const upcoming = all.filter(isUpcomingPrediction);
  const finished = all.filter((p) => !isUpcomingPrediction(p));
  const rows = filter === "a-venir" ? [...upcoming].reverse() : filter === "termines" ? finished : all;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:py-8">
      <PageHeader title="Mes pronostics" description="Les pronostics que vous avez débloqués, leur détail et leur résultat." />

      <section aria-label="Mon historique" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Mon taux de réussite" value={formatRate(won, lost)} hint={won + lost === 0 ? "Aucun pronostic terminé" : `${won + lost} terminé${won + lost > 1 ? "s" : ""}, hors annulés`} />
        <StatCard label="Gagnés" value={won} tone="success" />
        <StatCard label="Perdus" value={lost} tone="danger" hint={voided > 0 ? `${voided} annulé${voided > 1 ? "s" : ""}` : undefined} />
        <StatCard label="Crédits dépensés" value={totalSpent} hint={`${all.length} pronostic${all.length > 1 ? "s" : ""} débloqué${all.length > 1 ? "s" : ""}`} />
      </section>

      <SegmentedNav
        label="Filtre"
        items={[
          { href: "/mes-pronostics?filtre=a-venir", label: "À venir", active: filter === "a-venir", count: upcoming.length },
          { href: "/mes-pronostics?filtre=termines", label: "Terminés", active: filter === "termines", count: finished.length },
          { href: "/mes-pronostics?filtre=tous", label: "Tous", active: filter === "tous", count: all.length },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title={filter === "a-venir" ? "Aucun pronostic en attente." : filter === "termines" ? "Aucun pronostic terminé pour le moment." : "Vous n'avez encore débloqué aucun pronostic."}
        >
          <Link href="/matchs" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
            Voir les matchs
          </Link>
        </EmptyState>
      ) : (
        <ul className="pronex-stagger space-y-3">
          {rows.map((p) => (
            <PredictionCard key={p.prediction_id} p={p} timezone={timezone} />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Un pronostic acheté est figé : sa sélection et sa probabilité ne changent plus après la vente.
      </p>
    </main>
  );
}
