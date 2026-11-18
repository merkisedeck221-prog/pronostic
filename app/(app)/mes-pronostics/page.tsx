import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { finalScoreLabel, formatRate, isUpcomingPrediction } from "@/lib/settle/labels";
import { getMyPredictions } from "@/lib/settle/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes pronostics · Pronostics IA" };

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

      <Card>
        <CardHeader>
          <CardDescription>Mon taux de réussite</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatRate(won, lost)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {won + lost === 0
            ? "Aucun de vos pronostics n'est encore terminé."
            : `${won} gagné${won > 1 ? "s" : ""} et ${lost} perdu${lost > 1 ? "s" : ""} sur vos pronostics terminés (hors annulés).`}
        </CardContent>
      </Card>

      <nav aria-label="Filtre" className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/mes-pronostics?filtre=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={buttonVariants({ variant: filter === f.value ? "default" : "outline", size: "sm" })}
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
        <ul className="divide-y rounded-lg border">
          {rows.map((p) => {
            const score = finalScoreLabel(p);
            return (
              <li key={p.prediction_id}>
                <Link href={`/matchs/${p.fixture_id}`} className="block space-y-1 px-4 py-3 hover:bg-muted/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {p.home_name} – {p.away_name}
                    </span>
                    <PredictionResultBadge result={p.result} refunded={p.refunded} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.competition_name} · {formatDateTime(p.kickoff_at, timezone)}
                    {score ? ` · Score final : ${score}` : ""}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{p.market_label} : </span>
                    {p.selection_label}
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
