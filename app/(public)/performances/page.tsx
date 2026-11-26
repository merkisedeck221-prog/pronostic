import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3Icon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedNav } from "@/components/layout/segmented-nav";
import { StatCard } from "@/components/layout/stat-card";
import { RateBars, WeeklyChart } from "@/components/performance/charts";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { formatRate, isSmallSample } from "@/lib/settle/labels";
import { getPerformanceStats } from "@/lib/settle/queries";
import type { Counts } from "@/lib/settle/schemas";
import { formatNumericDate, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "Performances de l'IA · PRONEX",
  description: "Taux de réussite des pronostics de l'IA : global, par type de pronostic, par compétition et sur 30 jours.",
};

/** Page PUBLIQUE (sans compte). Chiffres sur TOUS les pronostics publiés, achetés ou non (RG-F8-1). */
async function loadStats() {
  try {
    return await getPerformanceStats();
  } catch (error) {
    console.error("[performances]", (error as Error).message);
    return null;
  }
}

export default async function PerformancesPage({ searchParams }: PageProps<"/performances">) {
  const [stats, user, params] = await Promise.all([loadStats(), getCurrentUser(), searchParams]);
  const period = params.periode === "30-jours" ? "30-jours" : "tout";
  if (!stats) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <PageHeader title="Performances de l'IA" />
        <EmptyState title="Les statistiques sont momentanément indisponibles. Réessayez dans quelques instants." />
      </main>
    );
  }
  const timezone = resolveTimezone(user?.profile.timezone);
  const { global } = stats;
  const resolved = global.won + global.lost;
  const shown: Counts = period === "30-jours" ? stats.last_30_days : global;
  const shownResolved = shown.won + shown.lost;
  const weeksWithData = stats.by_week.some((w) => w.won + w.lost + w.void > 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader
        title="Performances de l'IA"
        description="Taux de réussite = pronostics gagnés / (gagnés + perdus), hors matchs annulés. Calculé sur tous les pronostics publiés, achetés ou non."
      />

      {resolved === 0 ? (
        <EmptyState icon={BarChart3Icon} title="Aucun pronostic n'est encore terminé.">
          Les statistiques apparaîtront ici après les premiers matchs analysés. Elles sont calculées sur tous les pronostics publiés,
          achetés ou non : aucun chiffre n&apos;est affiché avant d&apos;être réel.
        </EmptyState>
      ) : (
        <>
          {isSmallSample(global.won, global.lost) ? (
            <p className="rounded-xl border border-pronex-violet/40 bg-pronex-violet/10 p-3 text-sm" role="note">
              Échantillon encore faible : {resolved} pronostic{resolved > 1 ? "s" : ""} résolu{resolved > 1 ? "s" : ""} seulement.
              Ces chiffres peuvent beaucoup varier et ne permettent pas encore de juger la fiabilité de l&apos;IA.
            </p>
          ) : null}

          <SegmentedNav
            label="Période"
            items={[
              { href: "/performances", label: "Depuis le début", active: period === "tout" },
              { href: "/performances?periode=30-jours", label: "30 derniers jours", active: period === "30-jours" },
            ]}
          />

          <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Taux de réussite"
              value={formatRate(shown.won, shown.lost)}
              hint={shownResolved > 0 ? `Sur ${shownResolved} pronostic${shownResolved > 1 ? "s" : ""} décidé${shownResolved > 1 ? "s" : ""}` : "Aucun pronostic décidé"}
              tone="violet"
            />
            <StatCard label="Gagnés" value={shown.won} tone="success" />
            <StatCard label="Perdus" value={shown.lost} tone="danger" />
            <StatCard label="Annulés" value={shown.void} hint="Exclus du taux de réussite" />
          </section>

          {weeksWithData ? (
            <Card>
              <CardHeader>
                <CardTitle>Évolution sur 12 semaines</CardTitle>
                <CardDescription>Pronostics résolus chaque semaine, selon la date du match.</CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyChart weeks={stats.by_week} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Par type de pronostic</CardTitle>
                <CardDescription>Depuis le début · trié par nombre de pronostics.</CardDescription>
              </CardHeader>
              <CardContent>
                <RateBars emptyLabel="Aucun type de pronostic résolu." rows={stats.by_market.map((m) => ({ ...m, key: m.code, name: m.label }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Par compétition</CardTitle>
                <CardDescription>Depuis le début · trié par nombre de pronostics.</CardDescription>
              </CardHeader>
              <CardContent>
                <RateBars emptyLabel="Aucune compétition résolue." rows={stats.by_competition.map((c) => ({ ...c, key: String(c.id), name: c.name }))} />
              </CardContent>
            </Card>
          </div>

          {stats.reveal_after_match ? (
            <Card>
              <CardHeader>
                <CardTitle>Derniers pronostics résolus</CardTitle>
                <CardDescription>Les 20 plus récents, gagnés ou perdus.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun pour le moment.</p>
                ) : (
                  <ul className="divide-y divide-white/5 text-sm">
                    {stats.recent.map((p) => (
                      <li key={`${p.fixture_id}-${p.market_code}`} className="space-y-1 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {user ? (
                              <Link href={`/matchs/${p.fixture_id}`} className="underline-offset-4 hover:underline">
                                {p.home_name} – {p.away_name}
                              </Link>
                            ) : (
                              <>
                                {p.home_name} – {p.away_name}
                              </>
                            )}
                            {p.ft_home !== null && p.ft_away !== null ? (
                              <span className="ml-2 tabular-nums text-muted-foreground">
                                {p.ft_home} – {p.ft_away}
                              </span>
                            ) : null}
                          </span>
                          <PredictionResultBadge result={p.result} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.competition_name} · {formatNumericDate(p.kickoff_at, timezone)} · {p.market_label} : {p.selection_label}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Les performances passées ne garantissent pas les résultats futurs. Les pronostics sont des estimations, sans garantie.
      </p>
    </main>
  );
}
