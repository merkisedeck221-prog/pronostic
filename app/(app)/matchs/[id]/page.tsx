import type { Metadata } from "next";
import { GeneratePanel } from "@/components/predictions/generate-panel";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { FormBadges } from "@/components/matches/form-badges";
import { PredictionsBlock } from "@/components/predictions/predictions-block";
import { StatusBadge } from "@/components/matches/status-badge";
import { TeamLogo } from "@/components/matches/team-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formResults, type FixtureContext } from "@/lib/catalog/context";
import { getFixture, getFixtureContext } from "@/lib/catalog/queries";
import { getFixturePredictions, getWalletBalance } from "@/lib/credits/queries";
import { getGenerationOffer } from "@/lib/generation/queries";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, formatNumericDate, formatTime, resolveTimezone } from "@/lib/utils/dates";
import { matchStatus } from "@/lib/utils/match-status";

export async function generateMetadata({ params }: PageProps<"/matchs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const fixture = /^\d{1,12}$/.test(id) ? await getFixture(Number(id)) : null;
  if (!fixture) return { title: "Match introuvable · Pronostics IA" };
  const title = `${fixture.home.name} – ${fixture.away.name}`;
  return {
    title: `${title} · ${fixture.competition.name} · Pronostics IA`,
    description: `${title} (${fixture.competition.name}) : forme des équipes, classement, confrontations directes et pronostics de l'IA.`,
  };
}

async function predictionWindowHours(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "prediction_window_hours").maybeSingle();
  const hours = typeof data?.value === "number" ? data.value : Number(data?.value);
  return Number.isFinite(hours) && hours > 0 ? hours : 48;
}

function SideForm({ name, side }: { name: string; side: FixtureContext["home"] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <FormBadges results={formResults(side)} />
    </div>
  );
}

/** Génération IA à la demande : jusqu'à 2 minutes (attente d'une génération mutualisée comprise). */
export const maxDuration = 120;

export default async function FixturePage({ params }: PageProps<"/matchs/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);

  // Existence et visibilité déjà vérifiées par la mise en page (404) ; lecture en cache.
  const fixture = (await getFixture(Number(id)))!;
  // Pronostics : rendu dynamique, propre à l'utilisateur, jamais mis en cache (section 11).
  const [context, predictions, balance, windowHours] = await Promise.all([
    getFixtureContext(fixture.id),
    getFixturePredictions(fixture.id),
    getWalletBalance(user.id),
    predictionWindowHours(),
  ]);

  const status = matchStatus(fixture.status_short);
  const started = status.phase === "live" || status.phase === "finished";
  // Génération à la demande (lot 3) : seulement pour un match à venir sans pronostic publié.
  const offer =
    status.phase === "upcoming" && !(predictions && predictions.markets.length > 0) ? await getGenerationOffer(user.id, fixture.id, fixture.kickoff_at) : null;
  const homeStanding = context?.home.standing ?? null;
  const awayStanding = context?.away.standing ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/matchs" className="underline-offset-4 hover:underline">
          Matchs
        </Link>{" "}
        /{" "}
        <Link href={`/competitions/${fixture.competition.slug}`} className="underline-offset-4 hover:underline">
          {fixture.competition.name}
        </Link>
      </nav>

      {/* En-tête du match */}
      <Card>
        <CardHeader className="text-center">
          <CardDescription>
            {fixture.competition.name}
            {fixture.round ? ` · ${fixture.round}` : ""}
          </CardDescription>
          <CardDescription className="capitalize">
            {formatLongDate(fixture.kickoff_at, timezone)} à {formatTime(fixture.kickoff_at, timezone)}
            {fixture.venue ? ` · ${fixture.venue}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamLogo name={fixture.home.name} src={fixture.home.logo_url} size={48} />
              <h1 className="text-base font-semibold sm:text-lg">{fixture.home.name}</h1>
            </div>
            <div className="text-center">
              {started && fixture.goals_home !== null && fixture.goals_away !== null ? (
                <p className="text-3xl font-semibold tabular-nums">
                  {fixture.goals_home} – {fixture.goals_away}
                </p>
              ) : (
                <p className="text-xl font-semibold tabular-nums">{formatTime(fixture.kickoff_at, timezone)}</p>
              )}
              {started && fixture.ht_home !== null && fixture.ht_away !== null ? (
                <p className="text-xs text-muted-foreground">
                  Mi-temps : {fixture.ht_home} – {fixture.ht_away}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamLogo name={fixture.away.name} src={fixture.away.logo_url} size={48} />
              <p className="text-base font-semibold sm:text-lg">{fixture.away.name}</p>
            </div>
          </div>
          <div className="flex justify-center">
            <StatusBadge status={fixture.status_short} showUpcoming />
          </div>
          {status.phase === "cancelled" ? (
            <p className="text-center text-sm text-muted-foreground">
              Ce match est {status.label.toLowerCase()}. Les crédits dépensés seront remboursés s&apos;il est annulé ou
              reporté de plus de 48 h.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Pronostics IA (phase 7) : contenu fourni par get_fixture_predictions UNIQUEMENT si débloqué */}
      {predictions && predictions.markets.length > 0 ? (
        <PredictionsBlock
          fixtureId={fixture.id}
          homeName={fixture.home.name}
          awayName={fixture.away.name}
          data={predictions}
          balance={balance ?? 0}
          upcoming={status.phase === "upcoming"}
        />
      ) : offer && offer.available ? (
        <GeneratePanel fixtureId={fixture.id} options={offer.options} balance={balance ?? 0} activeRequestId={offer.activeRequestId} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pronostics IA</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {status.phase === "upcoming" ? (
              <p>Les pronostics seront disponibles environ {windowHours} h avant le coup d&apos;envoi.</p>
            ) : (
              <p>Aucun pronostic n&apos;a été publié pour ce match.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Forme */}
      <Card>
        <CardHeader>
          <CardTitle>Forme</CardTitle>
          <CardDescription>5 derniers matchs, du plus récent au plus ancien.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {context ? (
            <>
              <SideForm name={fixture.home.name} side={context.home} />
              <SideForm name={fixture.away.name} side={context.away} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Forme indisponible.</p>
          )}
        </CardContent>
      </Card>

      {/* Classement */}
      {homeStanding || awayStanding ? (
        <Card>
          <CardHeader>
            <CardTitle>Classement</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-right">Rang</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                  <TableHead className="text-right">J</TableHead>
                  <TableHead className="text-right">Diff.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: fixture.home.name, standing: homeStanding },
                  { name: fixture.away.name, standing: awayStanding },
                ].map(({ name, standing }) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.rank ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.points ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.played ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {standing ? `${standing.goal_diff > 0 ? "+" : ""}${standing.goal_diff}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Confrontations directes */}
      <Card>
        <CardHeader>
          <CardTitle>Confrontations directes</CardTitle>
          <CardDescription>5 dernières rencontres entre les deux équipes.</CardDescription>
        </CardHeader>
        <CardContent>
          {context && context.head_to_head.length > 0 ? (
            <ul className="divide-y text-sm">
              {context.head_to_head.map((match, index) => (
                <li key={match.fixture_id ?? `h2h-${index}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                    {match.date ? formatNumericDate(match.date, timezone) : "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {match.home} – {match.away}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {match.goals_home !== null && match.goals_home !== undefined && match.goals_away !== null && match.goals_away !== undefined
                      ? `${match.goals_home} – ${match.goals_away}`
                      : (match.score ?? "—")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucune confrontation récente connue." />
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Les pronostics sont des estimations, sans garantie de résultat. Réservé aux 18 ans et plus.
      </p>
    </main>
  );
}
