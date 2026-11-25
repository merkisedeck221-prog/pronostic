import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { formatRate, isSmallSample } from "@/lib/settle/labels";
import { getPerformanceStats } from "@/lib/settle/queries";
import type { Counts } from "@/lib/settle/schemas";
import { formatNumericDate, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "Performances de l'IA · PRONEX",
  description: "Taux de réussite des pronostics de l'IA : global, par type de pronostic, par compétition et sur 30 jours.",
};

function RateCard({ title, counts }: { title: string; counts: Counts }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{formatRate(counts.won, counts.lost)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {counts.won} gagnés · {counts.lost} perdus{counts.void > 0 ? ` · ${counts.void} annulés` : ""}
      </CardContent>
    </Card>
  );
}

function BreakdownTable({ rows, label }: { rows: Array<Counts & { key: string; name: string }>; label: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Gagnés</TableHead>
          <TableHead className="text-right">Perdus</TableHead>
          <TableHead className="text-right">Réussite</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="whitespace-normal">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.won}</TableCell>
            <TableCell className="text-right tabular-nums">{row.lost}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatRate(row.won, row.lost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Page PUBLIQUE (sans compte). Chiffres sur TOUS les pronostics publiés, achetés ou non (RG-F8-1). */
async function loadStats() {
  try {
    return await getPerformanceStats();
  } catch (error) {
    console.error("[performances]", (error as Error).message);
    return null;
  }
}

export default async function PerformancesPage() {
  const [stats, user] = await Promise.all([loadStats(), getCurrentUser()]);
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

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <PageHeader
        title="Performances de l'IA"
        description="Taux de réussite = pronostics gagnés / (gagnés + perdus), hors matchs annulés. Calculé sur tous les pronostics publiés, achetés ou non."
      />

      {resolved === 0 ? (
        <EmptyState title="Aucun pronostic n'est encore terminé : les statistiques apparaîtront après les premiers matchs." />
      ) : (
        <>
          {isSmallSample(global.won, global.lost) ? (
            <p className="rounded-md border p-3 text-sm" role="note">
              Échantillon encore faible : {resolved} pronostic{resolved > 1 ? "s" : ""} résolu{resolved > 1 ? "s" : ""} seulement.
              Ces chiffres peuvent beaucoup varier et ne permettent pas encore de juger la fiabilité de l&apos;IA.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <RateCard title={`Global · ${resolved} pronostics résolus`} counts={global} />
            <RateCard title="30 derniers jours" counts={stats.last_30_days} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Par type de pronostic</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <BreakdownTable label="Type" rows={stats.by_market.map((m) => ({ ...m, key: m.code, name: m.label }))} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Par compétition</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <BreakdownTable label="Compétition" rows={stats.by_competition.map((c) => ({ ...c, key: String(c.id), name: c.name }))} />
            </CardContent>
          </Card>

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
                  <ul className="divide-y text-sm">
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
