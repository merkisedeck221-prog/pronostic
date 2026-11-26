import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDaysIcon, ChevronDownIcon, SearchIcon, SearchXIcon, SlidersHorizontalIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedNav } from "@/components/layout/segmented-nav";
import { FixtureRow } from "@/components/matches/fixture-row";
import { TeamLogo } from "@/components/matches/team-logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import {
  matchesSearch,
  matchesStatusFilter,
  parseDay,
  parseSearch,
  parseStatusFilter,
  STATUS_FILTERS,
  type StatusFilter,
} from "@/lib/catalog/fixture-filters";
import { getCompetitionsOverview, getPredictionFlags, listFixtures, type FixtureListItem } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";
import {
  clampWindowDays,
  dayHeading,
  dayKey,
  groupByDay,
  parsePeriod,
  periodOptions,
  periodRange,
  resolveTimezone,
  shiftDayKey,
  startOfDayInTimezone,
  type Period,
} from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "Matchs · PRONEX",
  description: "Matchs à venir, en cours et terminés, avec les analyses de PRONEX AI disponibles.",
};

type Filters = { period: Period; day: string | null; competition?: string; status: StatusFilter; q: string };

function buildHref(f: Filters, change: Partial<Filters>): string {
  const next = { ...f, ...change };
  const params = new URLSearchParams();
  if (next.day) params.set("jour", next.day);
  else params.set("periode", next.period);
  if (next.competition) params.set("competition", next.competition);
  if (next.status !== "tous") params.set("statut", next.status);
  if (next.q) params.set("q", next.q);
  return `/matchs?${params.toString()}`;
}

const fieldClass =
  "h-10 w-full rounded-xl border border-white/10 bg-muted px-3 text-sm text-foreground outline-none transition focus-visible:border-pronex-pink/60 focus-visible:ring-2 focus-visible:ring-pronex-pink/25";

export default async function FixturesPage({ searchParams }: PageProps<"/matchs">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const params = await searchParams;
  const day = parseDay(params.jour);
  const filters: Filters = {
    period: parsePeriod(params.periode),
    day,
    competition: typeof params.competition === "string" && /^[a-z0-9-]{1,80}$/.test(params.competition) ? params.competition : undefined,
    status: parseStatusFilter(params.statut),
    q: parseSearch(params.q),
  };

  // Fenêtre par défaut paramétrable (RG-F2-4) : app_settings.fixtures_window_days.
  const supabase = await createClient();
  const [competitions, { data: windowSetting }] = await Promise.all([
    getCompetitionsOverview(),
    supabase.from("app_settings").select("value").eq("key", "fixtures_window_days").maybeSingle(),
  ]);
  const windowDays = clampWindowDays(windowSetting?.value);
  const selected = filters.competition ? competitions.find((c) => c.slug === filters.competition) : undefined;

  // Période : jour précis, sinon pastille. « Terminés » sur N jours regarde les N jours PASSÉS.
  const now = new Date();
  const range = day
    ? { from: startOfDayInTimezone(day, timezone), to: startOfDayInTimezone(shiftDayKey(day, 1), timezone) }
    : filters.status === "termines" && filters.period === "7-jours"
      ? { from: startOfDayInTimezone(shiftDayKey(dayKey(now, timezone), -windowDays), timezone), to: now }
      : periodRange(filters.period, timezone, now, windowDays);

  const all = await listFixtures(range, selected?.id);
  const fixtures = all.filter(
    (f) => matchesStatusFilter(filters.status, f.status_short) && matchesSearch(filters.q, [f.home.name, f.away.name, f.competition.name]),
  );
  if (filters.status === "termines" && !day) fixtures.reverse();
  const flags = await getPredictionFlags(fixtures.map((fixture) => fixture.id));
  const analysedCount = fixtures.filter((f) => flags.has(f.id)).length;
  const days = groupByDay(fixtures, (f) => f.kickoff_at, timezone);
  const filtered = Boolean(filters.q || filters.competition || filters.status !== "tous");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:py-8">
      <PageHeader title="Matchs" description={`Heures affichées dans votre fuseau (${timezone}).`} />

      <SegmentedNav
        label="Période"
        items={periodOptions(windowDays).map((option) => ({
          href: buildHref(filters, { period: option.value, day: null }),
          label: option.label,
          active: !day && option.value === filters.period,
        }))}
      />

      <form action="/matchs" method="get" className="space-y-3 rounded-2xl border border-white/8 bg-card p-4">
        {day ? null : <input type="hidden" name="periode" value={filters.period} />}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Rechercher une équipe ou une compétition</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" name="q" defaultValue={filters.q} placeholder="Rechercher une équipe" maxLength={60} className={`${fieldClass} pl-9`} />
          </label>
          <Button type="submit">Filtrer</Button>
        </div>
        <details className="group" open={Boolean(filters.competition || filters.status !== "tous" || day) || undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <SlidersHorizontalIcon className="size-4" aria-hidden />
            Compétition, statut et jour
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Compétition
              <select name="competition" defaultValue={selected?.slug ?? ""} className={fieldClass}>
                <option value="">Toutes</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.slug}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Statut
              <select name="statut" defaultValue={filters.status} className={fieldClass}>
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Jour précis
              <input type="date" name="jour" defaultValue={day ?? ""} className={`${fieldClass} [color-scheme:dark]`} />
            </label>
          </div>
        </details>
        {filtered || day ? (
          <Link href="/matchs" className="inline-block text-sm font-medium text-pronex-pink hover:underline">
            Effacer les filtres
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fixtures.length} match{fixtures.length > 1 ? "s" : ""}
        {analysedCount > 0 ? ` · ${analysedCount} avec analyse IA` : ""}
        {day ? ` · ${dayHeading(startOfDayInTimezone(day, timezone), timezone)}` : ""}
      </p>

      {fixtures.length === 0 ? (
        all.length === 0 && !filtered ? (
          <EmptyState title="Aucun match sur cette période." icon={CalendarDaysIcon}>
            Les matchs apparaissent dès qu&apos;ils sont synchronisés depuis le fournisseur de données football. Essayez une autre
            période ; les compétitions de sélections ne jouent que pendant les fenêtres internationales.
          </EmptyState>
        ) : (
          <EmptyState title="Aucun match ne correspond à vos filtres." icon={SearchXIcon}>
            <Link href={buildHref(filters, { q: "", competition: undefined, status: "tous" })} className="font-medium text-pronex-pink underline-offset-4 hover:underline">
              Effacer la recherche et les filtres
            </Link>
          </EmptyState>
        )
      ) : (
        <div className="space-y-6">
          {days.map(({ key, items }) => (
            <section key={key} className="space-y-2" aria-labelledby={`jour-${key}`}>
              <h2 id={`jour-${key}`} className="px-1 text-sm font-semibold text-muted-foreground">
                {dayHeading(items[0].kickoff_at, timezone)}
              </h2>
              <DayCompetitions items={items} flags={flags} timezone={timezone} />
            </section>
          ))}
        </div>
      )}

      {all.length === 300 ? (
        <p className="text-xs text-muted-foreground">Affichage limité aux 300 premiers matchs : précisez la compétition ou le jour.</p>
      ) : null}
    </main>
  );
}

/** Matchs d'un jour, groupés par compétition (ordre de l'administration). */
function DayCompetitions({ items, flags, timezone }: { items: FixtureListItem[]; flags: Set<number>; timezone: string }) {
  const groups = new Map<number, { competition: FixtureListItem["competition"]; items: FixtureListItem[] }>();
  for (const fixture of items) {
    const group = groups.get(fixture.competition.id);
    if (group) group.items.push(fixture);
    else groups.set(fixture.competition.id, { competition: fixture.competition, items: [fixture] });
  }
  const ordered = [...groups.values()].sort(
    (a, b) => a.competition.sort_order - b.competition.sort_order || a.competition.name.localeCompare(b.competition.name, "fr"),
  );
  return (
    <div className="space-y-3">
      {ordered.map(({ competition, items: rows }) => (
        <div key={competition.id} className="overflow-hidden rounded-2xl border border-white/8 bg-card">
          <Link
            href={`/competitions/${competition.slug}`}
            className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/[0.03]"
          >
            <TeamLogo name={competition.name} src={competition.logo_url} size={18} />
            {competition.name}
            <span className="font-normal text-muted-foreground">· {rows.length}</span>
          </Link>
          <div className="divide-y divide-white/5">
            {rows.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} timezone={timezone} hasPrediction={flags.has(fixture.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
