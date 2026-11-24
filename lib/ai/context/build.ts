import "server-only";

import { z } from "zod";
import type { ApiFootballClient } from "@/lib/api-football/client";
import type { DB } from "@/lib/sync/runner";
import type { Json } from "@/types/database";
import { injuryItemSchema, predictionsItemSchema, type InjuryItem, type PredictionsItem } from "./schemas";
import { summarizeMatchContext, type H2HInput, type MatchSummary, type RecentResult, type TeamStatsInput } from "./summarize";

/**
 * Constitution du dossier de match (section 8, étape 2) :
 *  - appels /predictions et /injuries (client API-Football + garde-fou budgétaire),
 *    seulement si la compétition les couvre ;
 *  - classement et derniers résultats lus en base ;
 *  - réponse brute dans match_contexts.raw, résumé compact dans match_contexts.summary.
 */

const FINISHED = ["FT", "AET", "PEN"];

type Coverage = { predictions?: boolean; injuries?: boolean };

export async function buildMatchContext(db: DB, api: ApiFootballClient, fixtureId: number): Promise<MatchSummary> {
  const { data: fixture, error } = await db
    .from("fixtures")
    .select(
      `id, api_fixture_id, competition_id, season, kickoff_at, round, venue, home_team_id, away_team_id,
       competition:competitions!inner(name, api_league_id, category, type, coverage),
       home:teams!fixtures_home_team_id_fkey(id, api_team_id, name),
       away:teams!fixtures_away_team_id_fkey(id, api_team_id, name)`,
    )
    .eq("id", fixtureId)
    .single();
  if (error || !fixture) throw new Error(`Match ${fixtureId} introuvable : ${error?.message}`);

  const teamIds = [fixture.home_team_id, fixture.away_team_id];

  const [standingsRes, recentRes, h2hRes] = await Promise.all([
    db
      .from("standings")
      .select("team_id, rank, points, played, goals_for, goals_against, form")
      .eq("competition_id", fixture.competition_id)
      .eq("season", fixture.season)
      .in("team_id", teamIds),
    db
      .from("fixtures")
      .select("kickoff_at, home_team_id, away_team_id, goals_home, goals_away, corners_home, corners_away, cards_home, cards_away")
      .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
      .in("status_short", FINISHED)
      .lt("kickoff_at", fixture.kickoff_at)
      .not("goals_home", "is", null)
      .order("kickoff_at", { ascending: false })
      .limit(40),
    db
      .from("fixtures")
      .select("kickoff_at, goals_home, goals_away, home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name)")
      .or(
        `and(home_team_id.eq.${fixture.home_team_id},away_team_id.eq.${fixture.away_team_id}),and(home_team_id.eq.${fixture.away_team_id},away_team_id.eq.${fixture.home_team_id})`,
      )
      .in("status_short", FINISHED)
      .lt("kickoff_at", fixture.kickoff_at)
      .order("kickoff_at", { ascending: false })
      .limit(5),
  ]);
  for (const res of [standingsRes, recentRes, h2hRes]) if (res.error) throw new Error(res.error.message);

  const standing = (teamId: number) => (standingsRes.data ?? []).find((s) => s.team_id === teamId) ?? null;
  const recentFor = (teamId: number): RecentResult[] =>
    (recentRes.data ?? [])
      .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
      .slice(0, 5)
      .map((m) => {
        const gf = m.home_team_id === teamId ? m.goals_home! : m.goals_away!;
        const ga = m.home_team_id === teamId ? m.goals_away! : m.goals_home!;
        return { date: m.kickoff_at, result: gf > ga ? "W" : gf === ga ? "D" : "L" };
      });
  // Corners / cartons (lot B) : derniers matchs dont les statistiques sont en base.
  const statsFor = (teamId: number): TeamStatsInput[] =>
    (recentRes.data ?? [])
      .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
      .map((m) => {
        const home = m.home_team_id === teamId;
        return {
          corners_for: home ? m.corners_home : m.corners_away,
          corners_against: home ? m.corners_away : m.corners_home,
          cards: home ? m.cards_home : m.cards_away,
        };
      })
      .filter((r) => r.corners_for !== null || r.cards !== null)
      .slice(0, 5);
  const h2hFromDb: H2HInput[] = (h2hRes.data ?? []).map((m) => ({
    date: m.kickoff_at,
    home: m.home.name,
    away: m.away.name,
    goals_home: m.goals_home ?? 0,
    goals_away: m.goals_away ?? 0,
  }));

  // Appels API-Football (comptés par le garde-fou budgétaire).
  const coverage = (fixture.competition.coverage ?? {}) as Coverage;
  const errors: string[] = [];
  let predictions: PredictionsItem | null = null;
  let injuries: InjuryItem[] = [];
  let rawPredictions: unknown = null;
  let rawInjuries: unknown = null;

  if (coverage.predictions !== false) {
    try {
      const result = await api.get("/predictions", { fixture: fixture.api_fixture_id }, z.array(predictionsItemSchema));
      predictions = result.data[0] ?? null;
      rawPredictions = result.data;
    } catch (e) {
      if ((e as Error).name === "BudgetExceededError") throw e;
      errors.push(`/predictions : ${(e as Error).message}`);
    }
  }
  if (coverage.injuries === true) {
    try {
      const result = await api.get("/injuries", { fixture: fixture.api_fixture_id }, z.array(injuryItemSchema));
      injuries = result.data;
      rawInjuries = result.data;
    } catch (e) {
      if ((e as Error).name === "BudgetExceededError") throw e;
      errors.push(`/injuries : ${(e as Error).message}`);
    }
  }

  const summary = summarizeMatchContext({
    fixture: { kickoff_at: fixture.kickoff_at, round: fixture.round, venue: fixture.venue, home: fixture.home, away: fixture.away },
    competition: {
      name: fixture.competition.name,
      api_league_id: fixture.competition.api_league_id,
      category: fixture.competition.category,
      type: fixture.competition.type,
    },
    standings: { home: standing(fixture.home_team_id), away: standing(fixture.away_team_id) },
    recent: { home: recentFor(fixture.home_team_id), away: recentFor(fixture.away_team_id) },
    h2hFromDb,
    predictions,
    injuries,
    matchStats: { home: statsFor(fixture.home_team_id), away: statsFor(fixture.away_team_id) },
  });

  const raw = { predictions: rawPredictions, injuries: rawInjuries, errors, fetched_at: new Date().toISOString() };
  const { error: saveError } = await db
    .from("match_contexts")
    .upsert(
      { fixture_id: fixture.id, raw: raw as unknown as Json, summary: summary as unknown as Json, fetched_at: raw.fetched_at },
      { onConflict: "fixture_id" },
    );
  if (saveError) throw new Error(`match_contexts : ${saveError.message}`);

  return summary;
}
