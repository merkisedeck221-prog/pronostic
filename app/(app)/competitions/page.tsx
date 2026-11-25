import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TeamLogo } from "@/components/matches/team-logo";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getCompetitionsOverview, type CompetitionSummary } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Compétitions · PRONEX",
  description: "Championnats européens et compétitions internationales de sélections couverts par les pronostics IA.",
};

function CompetitionGrid({ title, competitions }: { title: string; competitions: CompetitionSummary[] }) {
  return (
    <section className="space-y-3" aria-labelledby={`section-${title}`}>
      <h2 id={`section-${title}`} className="text-lg font-semibold">
        {title}
      </h2>
      {competitions.length === 0 ? (
        <EmptyState title="Aucune compétition active pour le moment." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((competition) => (
            <li key={competition.id}>
              <Link href={`/competitions/${competition.slug}`} className="block rounded-xl focus-visible:outline-2">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardContent className="flex items-center gap-3">
                    <TeamLogo name={competition.name} src={competition.logo_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{competition.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{competition.country ?? "International"}</p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-muted-foreground">
                      <span className="block text-base font-semibold text-foreground tabular-nums">{competition.upcomingCount}</span>
                      {competition.upcomingCount > 1 ? "matchs" : "match"} · 7 j
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function CompetitionsPage() {
  await requireUser();
  const competitions = await getCompetitionsOverview();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
      <PageHeader title="Compétitions" description="Nombre de matchs à venir dans les 7 prochains jours." />
      <CompetitionGrid title="Championnats" competitions={competitions.filter((c) => c.category === "club_league")} />
      <CompetitionGrid
        title="International"
        competitions={competitions.filter((c) => c.category === "international")}
      />
      <p className="text-xs text-muted-foreground">
        Les compétitions de sélections se jouent par fenêtres (septembre, octobre, novembre, mars, juin) : il est normal
        qu&apos;elles n&apos;aient aucun match à venir pendant plusieurs semaines.
      </p>
    </main>
  );
}
