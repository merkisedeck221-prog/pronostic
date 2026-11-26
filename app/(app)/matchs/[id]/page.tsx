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
import { LockIcon, UnlockIcon, UserXIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formAverages, formResults, type FixtureContext } from "@/lib/catalog/context";
import { getPublicFlags } from "@/lib/catalog/settings";
import { getFixture, getFixtureContext } from "@/lib/catalog/queries";
import { getFixturePredictions, getWalletBalance } from "@/lib/credits/queries";
import { getGenerationOffer } from "@/lib/generation/queries";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, formatNumericDate, formatTime, resolveTimezone } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import { matchStatus } from "@/lib/utils/match-status";

export async function generateMetadata({ params }: PageProps<"/matchs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const fixture = /^\d{1,12}$/.test(id) ? await getFixture(Number(id)) : null;
  if (!fixture) return { title: "Match introuvable · PRONEX" };
  const title = `${fixture.home.name} – ${fixture.away.name}`;
  return {
    title: `${title} · ${fixture.competition.name} · PRONEX`,
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
  const averages = formAverages(side);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <FormBadges results={formResults(side)} />
      {averages ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {averages.scored} but{averages.scored > 1 ? "s" : ""} marqué{averages.scored > 1 ? "s" : ""} et {averages.conceded} encaissé
          {averages.conceded > 1 ? "s" : ""} en moyenne ({averages.matches} match{averages.matches > 1 ? "s" : ""})
        </p>
      ) : null}
    </div>
  );
}

/** Pastille qui distingue le contenu gratuit du contenu payant. */
function AccessTag({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-pronex-pink/15 px-2.5 py-1 text-xs font-semibold text-pink-200">
      <LockIcon className="size-3" aria-hidden />
      Contenu payant
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <UnlockIcon className="size-3" aria-hidden />
      Accès libre
    </span>
  );
}

/** Ligne de comparaison « valeur domicile · libellé · valeur extérieur ». */
function CompareRow({ label, home, away }: { label: string; home: number | null | undefined; away: number | null | undefined }) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v));
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 py-2 text-sm">
      <span className="font-heading font-bold tabular-nums">{fmt(home)}</span>
      <span className="text-center text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-heading font-bold tabular-nums">{fmt(away)}</span>
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
  const { refundOnCancel } = await getPublicFlags();

  const status = matchStatus(fixture.status_short);
  const started = status.phase === "live" || status.phase === "finished";
  // Génération à la demande (lot 3) : seulement pour un match à venir sans pronostic publié.
  const offer =
    status.phase === "upcoming" && !(predictions && predictions.markets.length > 0) ? await getGenerationOffer(user.id, fixture.id, fixture.kickoff_at) : null;
  const homeStanding = context?.home.standing ?? null;
  const awayStanding = context?.away.standing ?? null;
  const hasStandings = Boolean(homeStanding || awayStanding);

  const statChips = started
    ? [
        fixture.ht_home !== null && fixture.ht_away !== null ? `Mi-temps ${fixture.ht_home} – ${fixture.ht_away}` : null,
        fixture.corners_home !== null && fixture.corners_away !== null ? `Corners ${fixture.corners_home} – ${fixture.corners_away}` : null,
        fixture.cards_home !== null && fixture.cards_away !== null ? `Cartons ${fixture.cards_home} – ${fixture.cards_away}` : null,
      ].filter((chip): chip is string => chip !== null)
    : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-6 sm:py-8">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <Link href="/matchs" className="transition-colors hover:text-foreground">
          Matchs
        </Link>{" "}
        /{" "}
        <Link href={`/competitions/${fixture.competition.slug}`} className="transition-colors hover:text-foreground">
          {fixture.competition.name}
        </Link>
      </nav>

      {/* En-tête du match */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-pronex-pink/15 via-card to-pronex-violet/20 px-4 py-6 sm:px-8 sm:py-8">
        <div className="space-y-1 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold">
            <TeamLogo name={fixture.competition.name} src={fixture.competition.logo_url} size={16} />
            {fixture.competition.name}
            {fixture.round ? ` · ${fixture.round}` : ""}
          </p>
          <p className="text-sm text-muted-foreground capitalize">
            {formatLongDate(fixture.kickoff_at, timezone)} à {formatTime(fixture.kickoff_at, timezone)}
            {fixture.venue ? ` · ${fixture.venue}` : ""}
          </p>
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <TeamLogo name={fixture.home.name} src={fixture.home.logo_url} size={64} className="drop-shadow-[0_0_12px_rgb(255_20_147_/_0.35)]" />
            <h1 className="text-base leading-tight font-bold sm:text-xl">{fixture.home.name}</h1>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            {started && fixture.goals_home !== null && fixture.goals_away !== null ? (
              <p className="font-heading text-4xl font-extrabold tabular-nums sm:text-5xl">
                {fixture.goals_home} – {fixture.goals_away}
              </p>
            ) : (
              <p className="font-heading text-3xl font-extrabold tabular-nums sm:text-4xl">{formatTime(fixture.kickoff_at, timezone)}</p>
            )}
            <StatusBadge status={fixture.status_short} showUpcoming />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <TeamLogo name={fixture.away.name} src={fixture.away.logo_url} size={64} className="drop-shadow-[0_0_12px_rgb(160_0_255_/_0.35)]" />
            <p className="text-base leading-tight font-bold sm:text-xl">{fixture.away.name}</p>
          </div>
        </div>
        {statChips.length > 0 ? (
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {statChips.map((chip) => (
              <li key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tabular-nums">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        {status.phase === "cancelled" ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ce match est {status.label.toLowerCase()}.{" "}
            {refundOnCancel
              ? "Les crédits dépensés seront remboursés s'il est annulé ou reporté de plus de 48 h."
              : "Les pronostics de ce match seront annulés s'il est annulé ou reporté de plus de 48 h."}
          </p>
        ) : null}
      </section>

      {/* Pronostics IA (phase 7) : contenu fourni par get_fixture_predictions UNIQUEMENT si débloqué */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Analyse PRONEX AI</p>
        {status.phase === "upcoming" || status.phase === "live" ? <AccessTag paid /> : null}
      </div>
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

      <div className="flex items-center justify-between gap-3 pt-2">
        <h2 className="text-xl font-bold">Données du match</h2>
        <AccessTag paid={false} />
      </div>
      <div className={cn("grid gap-4", hasStandings && "md:grid-cols-2")}>
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
            <CardDescription>Saison en cours de la compétition.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-right">Rang</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                  <TableHead className="text-right">J</TableHead>
                  <TableHead className="text-right">G-N-P</TableHead>
                  <TableHead className="text-right">Diff.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: fixture.home.name, standing: homeStanding },
                  { name: fixture.away.name, standing: awayStanding },
                ].map(({ name, standing }) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.rank ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.points ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{standing?.played ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {standing ? `${standing.won}-${standing.drawn}-${standing.lost}` : "—"}
                    </TableCell>
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
      </div>

      {/* Statistiques : corners et cartons moyens (matchs terminés en base) */}
      {context && (context.home.stats || context.away.stats) ? (
        <Card>
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
            <CardDescription>
              Moyennes par match sur les derniers matchs terminés de chaque équipe ({context.home.stats?.matches ?? 0} pour{" "}
              {fixture.home.name}, {context.away.stats?.matches ?? 0} pour {fixture.away.name}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[3rem_1fr_3rem] gap-2 pb-1 text-xs font-semibold text-muted-foreground">
              <span className="truncate">{fixture.home.name}</span>
              <span />
              <span className="truncate text-right">{fixture.away.name}</span>
            </div>
            <div className="divide-y divide-white/5">
              <CompareRow label="Corners obtenus" home={context.home.stats?.corners_for} away={context.away.stats?.corners_for} />
              <CompareRow label="Corners concédés" home={context.home.stats?.corners_against} away={context.away.stats?.corners_against} />
              <CompareRow label="Cartons reçus" home={context.home.stats?.cards} away={context.away.stats?.cards} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Absences : uniquement lorsqu'elles sont connues (dossier du match) */}
      {context && (context.home.absences || context.away.absences) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserXIcon className="size-4 text-warning" aria-hidden />
              Absences
            </CardTitle>
            <CardDescription>Joueurs blessés, suspendus ou incertains signalés par le fournisseur de données.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              { name: fixture.home.name, list: context.home.absences },
              { name: fixture.away.name, list: context.away.absences },
            ].map(({ name, list }) => (
              <div key={name} className="space-y-2">
                <p className="text-sm font-medium">{name}</p>
                {list && list.length > 0 ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {list.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{list ? "Aucune absence signalée." : "Information non disponible."}</p>
                )}
              </div>
            ))}
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
            <ul className="divide-y divide-white/5 text-sm">
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
    </main>
  );
}
