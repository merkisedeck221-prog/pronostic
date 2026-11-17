import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/empty-state";
import { FixtureRow } from "@/components/matches/fixture-row";
import { StandingsTable } from "@/components/matches/standings-table";
import { TeamLogo } from "@/components/matches/team-logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth/session";
import {
  getCompetitionBySlug,
  getCompetitionResults,
  getCompetitionUpcoming,
  getPredictionFlags,
  getStandings,
} from "@/lib/catalog/queries";
import { dayHeading, groupByDay, resolveTimezone } from "@/lib/utils/dates";

export async function generateMetadata({ params }: PageProps<"/competitions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return { title: "Compétition introuvable · Pronostics IA" };
  return {
    title: `${competition.name} · Pronostics IA`,
    description: `${competition.name} : matchs à venir, classement et derniers résultats, avec les pronostics de l'IA.`,
  };
}

export default async function CompetitionPage({ params }: PageProps<"/competitions/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);

  // RLS : une compétition inactive est invisible → 404.
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const coverage = (competition.coverage ?? {}) as { standings?: boolean };
  const hasStandings = competition.type === "league" || coverage.standings === true;

  const [upcoming, results, standings] = await Promise.all([
    getCompetitionUpcoming(competition.id),
    getCompetitionResults(competition.id),
    hasStandings ? getStandings(competition.id, competition.current_season) : Promise.resolve([]),
  ]);
  const flags = await getPredictionFlags(upcoming.map((fixture) => fixture.id));
  const days = groupByDay(upcoming, (fixture) => fixture.kickoff_at, timezone);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/competitions" className="underline-offset-4 hover:underline">
          Compétitions
        </Link>{" "}
        / {competition.name}
      </nav>
      <div className="flex items-center gap-3">
        <TeamLogo name={competition.name} src={competition.logo_url} size={44} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{competition.name}</h1>
          <p className="text-sm text-muted-foreground">
            {competition.country ?? "International"}
            {competition.current_season ? ` · saison ${competition.current_season}` : ""}
          </p>
        </div>
      </div>

      <Tabs defaultValue="matchs">
        <TabsList>
          <TabsTrigger value="matchs">Matchs à venir</TabsTrigger>
          {hasStandings ? <TabsTrigger value="classement">Classement</TabsTrigger> : null}
          <TabsTrigger value="resultats">Résultats</TabsTrigger>
        </TabsList>

        <TabsContent value="matchs" className="pt-4">
          {days.length === 0 ? (
            <EmptyState title="Aucun match à venir pour le moment.">
              Les matchs apparaissent environ deux semaines avant leur date.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {days.map((day) => (
                <section key={day.key} className="space-y-1">
                  <h2 className="px-2 text-sm font-medium capitalize text-muted-foreground">
                    {dayHeading(day.items[0].kickoff_at, timezone)}
                  </h2>
                  <div className="divide-y rounded-xl border">
                    {day.items.map((fixture) => (
                      <FixtureRow key={fixture.id} fixture={fixture} timezone={timezone} hasPrediction={flags.has(fixture.id)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        {hasStandings ? (
          <TabsContent value="classement" className="pt-4">
            {standings.length === 0 ? (
              <EmptyState title="Classement indisponible pour le moment." />
            ) : (
              <StandingsTable rows={standings} />
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="resultats" className="pt-4">
          {results.length === 0 ? (
            <EmptyState title="Aucun résultat récent." />
          ) : (
            <div className="divide-y rounded-xl border">
              {results.map((fixture) => (
                <FixtureRow key={fixture.id} fixture={fixture} timezone={timezone} hasPrediction={false} showDate />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
