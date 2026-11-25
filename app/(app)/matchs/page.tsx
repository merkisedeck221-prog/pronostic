import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FixtureRow } from "@/components/matches/fixture-row";
import { TeamLogo } from "@/components/matches/team-logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getCompetitionsOverview, getPredictionFlags, listFixtures, type FixtureListItem } from "@/lib/catalog/queries";
import { cn } from "@/lib/utils";
import { clampWindowDays, parsePeriod, periodOptions, periodRange, resolveTimezone, type Period } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Matchs à venir · PRONEX",
  description: "Matchs d'aujourd'hui, de demain et des 7 prochains jours, avec les pronostics de l'IA disponibles.",
};

function buildHref(period: Period, competition?: string) {
  const params = new URLSearchParams({ periode: period });
  if (competition) params.set("competition", competition);
  return `/matchs?${params.toString()}`;
}

export default async function FixturesPage({ searchParams }: PageProps<"/matchs">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const params = await searchParams;
  const period = parsePeriod(params.periode);
  const competitionSlug = typeof params.competition === "string" ? params.competition : undefined;

  // Fenêtre par défaut paramétrable (RG-F2-4) : app_settings.fixtures_window_days.
  const supabase = await createClient();
  const [competitions, { data: windowSetting }] = await Promise.all([
    getCompetitionsOverview(),
    supabase.from("app_settings").select("value").eq("key", "fixtures_window_days").maybeSingle(),
  ]);
  const windowDays = clampWindowDays(windowSetting?.value);
  const selected = competitionSlug ? competitions.find((c) => c.slug === competitionSlug) : undefined;

  const fixtures = await listFixtures(periodRange(period, timezone, new Date(), windowDays), selected?.id);
  const flags = await getPredictionFlags(fixtures.map((fixture) => fixture.id));

  // Groupes par compétition (ordre d'affichage de l'admin), puis par heure.
  const groups = new Map<number, { competition: FixtureListItem["competition"]; items: FixtureListItem[] }>();
  for (const fixture of fixtures) {
    const group = groups.get(fixture.competition.id);
    if (group) group.items.push(fixture);
    else groups.set(fixture.competition.id, { competition: fixture.competition, items: [fixture] });
  }
  const orderedGroups = [...groups.values()].sort(
    (a, b) => a.competition.sort_order - b.competition.sort_order || a.competition.name.localeCompare(b.competition.name, "fr"),
  );
  const showDate = period === "7-jours";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Matchs à venir" description={`Heures affichées dans votre fuseau (${timezone}).`} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <nav aria-label="Période" className="inline-flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {periodOptions(windowDays).map((option) => (
            <Link
              key={option.value}
              href={buildHref(option.value, selected?.slug)}
              aria-current={option.value === period ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                option.value === period && "bg-linear-to-r from-pronex-pink/85 to-pronex-violet text-white",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <form action="/matchs" method="get" className="flex items-end gap-2">
          <input type="hidden" name="periode" value={period} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Compétition</span>
            <select
              name="competition"
              defaultValue={selected?.slug ?? ""}
              className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
            >
              <option value="">Toutes</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.slug}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" size="sm">
            Filtrer
          </Button>
        </form>
      </div>

      {orderedGroups.length === 0 ? (
        <EmptyState title="Aucun match sur cette période.">
          {selected ? (
            <>
              Essayez une autre période ou{" "}
              <Link href={buildHref(period)} className="underline underline-offset-4">
                toutes les compétitions
              </Link>
              .
            </>
          ) : (
            "Essayez une autre période. Les compétitions de sélections ne jouent que pendant les fenêtres internationales."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {orderedGroups.map(({ competition, items }) => (
            <section key={competition.id} className="space-y-1" aria-labelledby={`competition-${competition.id}`}>
              <h2 id={`competition-${competition.id}`} className="flex items-center gap-2 px-1 pb-1 text-sm font-semibold">
                <TeamLogo name={competition.name} src={competition.logo_url} size={18} />
                <Link href={`/competitions/${competition.slug}`} className={cn("underline-offset-4 hover:underline")}>
                  {competition.name}
                </Link>
                <span className="text-muted-foreground">· {items.length}</span>
              </h2>
              <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-card">
                {items.map((fixture) => (
                  <FixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    timezone={timezone}
                    hasPrediction={flags.has(fixture.id)}
                    showDate={showDate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {fixtures.length === 300 ? (
        <p className="text-xs text-muted-foreground">Affichage limité aux 300 premiers matchs : filtrez par compétition.</p>
      ) : null}
    </main>
  );
}
