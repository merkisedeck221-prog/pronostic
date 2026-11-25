import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { confidenceLabel } from "@/lib/credits/labels";
import { finalScoreLabel, formatRate, isUpcomingPrediction } from "@/lib/settle/labels";
import { getMyPredictions } from "@/lib/settle/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes pronostics · PRONEX" };

const FILTERS = [
  { value: "a-venir", label: "À venir" },
  { value: "termines", label: "Terminés" },
] as const;

export default async function MesPronosticsPage({ searchParams }: PageProps<"/mes-pronostics">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const raw = (await searchParams).filtre;
  const filter = raw === "termines" ? "termines" : "a-venir";

  const all = await getMyPredictions();
  const won = all.filter((p) => p.result === "won").length;
  const lost = all.filter((p) => p.result === "lost").length;
  const upcoming = all.filter(isUpcomingPrediction);
  const finished = all.filter((p) => !isUpcomingPrediction(p));
  const rows = filter === "a-venir" ? [...upcoming].reverse() : finished;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Mes pronostics" description="Les pronostics que vous avez débloqués et leur résultat." />

      <section className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-linear-to-br from-pronex-pink/15 via-card to-pronex-violet/20 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Mon taux de réussite</p>
          <p className="bg-linear-to-r from-pronex-pink/85 to-pronex-violet bg-clip-text font-heading text-4xl font-extrabold text-transparent tabular-nums">
            {formatRate(won, lost)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground sm:text-right">
          {won + lost === 0
            ? "Aucun de vos pronostics n'est encore terminé."
            : `${won} gagné${won > 1 ? "s" : ""} et ${lost} perdu${lost > 1 ? "s" : ""} sur vos pronostics terminés (hors annulés).`}
        </p>
      </section>

      <nav aria-label="Filtre" className="inline-flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/mes-pronostics?filtre=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              filter === f.value && "bg-linear-to-r from-pronex-pink/85 to-pronex-violet text-white",
            )}
          >
            {f.label} ({f.value === "a-venir" ? upcoming.length : finished.length})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={filter === "a-venir" ? "Aucun pronostic en attente." : "Aucun pronostic terminé pour le moment."}>
          <Link href="/matchs" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            Voir les matchs à venir
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const score = finalScoreLabel(p);
            return (
              <li key={p.prediction_id}>
                <Link
                  href={`/matchs/${p.fixture_id}`}
                  className="block space-y-2 rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-pronex-pink/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {p.home_name} – {p.away_name}
                    </span>
                    <PredictionResultBadge result={p.result} refunded={p.refunded} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.competition_name} · {formatDateTime(p.kickoff_at, timezone)}
                    {score ? ` · Score final : ${score}` : ""}
                  </p>
                  <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">{p.market_label}</p>
                    <p className="font-heading font-bold">{p.selection_label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[
                      p.probability != null ? `Probabilité estimée : ${p.probability} %` : null,
                      p.confidence ? `confiance : ${confidenceLabel(p.confidence).toLowerCase()}` : null,
                      p.ht_home != null && p.ht_away != null ? `mi-temps ${p.ht_home} – ${p.ht_away}` : null,
                      p.credits_spent != null
                        ? p.via_bundle
                          ? `inclus dans le match complet (${formatCredits(p.credits_spent)})`
                          : formatCredits(p.credits_spent)
                        : null,
                      p.unlocked_at ? `débloqué le ${formatDateTime(p.unlocked_at, timezone)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
