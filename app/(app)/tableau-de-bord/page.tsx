import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { FixtureRow } from "@/components/matches/fixture-row";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getPredictionFlags, listFixtures } from "@/lib/catalog/queries";
import { getWalletBalance } from "@/lib/credits/queries";
import { getMyPredictions } from "@/lib/settle/queries";
import { formatShortDate, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Tableau de bord · PRONEX" };

const UPCOMING_WINDOW_HOURS = 48;
const UPCOMING_MAX = 8;
const RECENT_PREDICTIONS = 5;

export default async function DashboardPage() {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const now = new Date();

  const [balance, fixtures, myPredictions] = await Promise.all([
    getWalletBalance(user.id),
    listFixtures({ from: now, to: new Date(now.getTime() + UPCOMING_WINDOW_HOURS * 3600 * 1000) }),
    getMyPredictions(RECENT_PREDICTIONS),
  ]);
  const notStarted = fixtures.filter((f) => f.status_short === "NS" || f.status_short === "TBD");
  const flags = await getPredictionFlags(notStarted.map((f) => f.id));
  const upcoming = notStarted.filter((f) => flags.has(f.id)).slice(0, UPCOMING_MAX);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.profile.display_name}</h1>

      <Card>
        <CardHeader>
          <CardDescription>Votre solde</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{balance !== null ? formatCredits(balance) : "—"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/recharger?next=/tableau-de-bord" className={buttonVariants()}>
            Recharger
          </Link>
          <Link href="/portefeuille" className={buttonVariants({ variant: "outline" })}>
            Historique
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matchs à venir avec pronostic</CardTitle>
            <CardDescription>Dans les {UPCOMING_WINDOW_HOURS} prochaines heures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState title="Aucun pronostic disponible dans les 48 prochaines heures." />
            ) : (
              <div className="-mx-2">
                {upcoming.map((fixture) => (
                  <FixtureRow key={fixture.id} fixture={fixture} timezone={timezone} hasPrediction showDate />
                ))}
              </div>
            )}
            <Link href="/matchs" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Tous les matchs
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes derniers pronostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myPredictions.length === 0 ? (
              <EmptyState title="Vous n'avez encore débloqué aucun pronostic." />
            ) : (
              <ul className="divide-y text-sm">
                {myPredictions.map((p) => (
                  <li key={p.prediction_id}>
                    <Link href={`/matchs/${p.fixture_id}`} className="flex items-center justify-between gap-3 py-2 hover:underline">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {p.home_name} – {p.away_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatShortDate(p.kickoff_at, timezone)} · {p.market_label} : {p.selection_label}
                        </span>
                      </span>
                      <PredictionResultBadge result={p.result} refunded={p.refunded} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/mes-pronostics" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Tous mes pronostics
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performances de l&apos;IA</CardTitle>
          <CardDescription>Taux de réussite public, calculé sur tous les pronostics publiés.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/performances" className={buttonVariants({ variant: "outline" })}>
            Voir les performances
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
