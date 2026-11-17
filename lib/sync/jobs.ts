import "server-only";

import { z } from "zod";
import {
  chunk,
  dateWindow,
  FINISHED_STATUSES,
  fixtureResultUpdate,
  fixtureToRow,
  leagueToCompetitionUpdate,
  NOT_PLAYED_STATUSES,
  standingToRow,
  teamToRow,
} from "@/lib/api-football/convert";
import { fixtureItemSchema, leagueItemSchema, standingsItemSchema, teamItemSchema } from "@/lib/api-football/schemas";
import type { Tables } from "@/types/database";
import { MIN_TIME_FOR_CALL_MS, type SyncContext } from "./runner";
import { ensureTeams } from "./teams";

/**
 * Tâches de synchronisation (cahier des charges, section 7). Toutes sont
 * idempotentes (upsert sur les identifiants API) et s'arrêtent proprement
 * avant la limite de temps ou quand le budget quotidien est atteint.
 */

type Competition = Tables<"competitions">;

async function activeCompetitions(ctx: SyncContext): Promise<Competition[]> {
  const { data, error } = await ctx.db
    .from("competitions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`competitions : ${error.message}`);
  return data ?? [];
}

function hasStandings(competition: Competition): boolean {
  const coverage = (competition.coverage ?? {}) as { standings?: boolean };
  return competition.type === "league" || coverage.standings === true;
}

function outOfTime(ctx: SyncContext, label: string): boolean {
  if (ctx.timeLeft() >= MIN_TIME_FOR_CALL_MS) return false;
  ctx.error(`Temps limite atteint : ${label} reporté à la prochaine exécution.`);
  return true;
}

// ----------------------------------------------------------------------------
// sync-competitions : saison en cours, couverture et équipes (~2 appels / compétition)
// ----------------------------------------------------------------------------
export async function syncCompetitions(ctx: SyncContext): Promise<void> {
  for (const competition of await activeCompetitions(ctx)) {
    if (outOfTime(ctx, competition.name)) break;
    try {
      const leagues = await ctx.api.get("/leagues", { id: competition.api_league_id, current: "true" }, z.array(leagueItemSchema));
      const item = leagues.data[0];
      if (!item) {
        ctx.error(`${competition.name} : aucune saison en cours renvoyée par /leagues.`);
        continue;
      }
      const update = leagueToCompetitionUpdate(item);
      const { error } = await ctx.db
        .from("competitions")
        .update({ logo_url: update.logo_url, current_season: update.current_season, coverage: update.coverage, country: update.country, type: update.type })
        .eq("id", competition.id);
      if (error) throw new Error(`mise à jour : ${error.message}`);
      ctx.processed(1);

      if (!update.current_season) continue;
      if (outOfTime(ctx, `équipes de ${competition.name}`)) break;

      const teams = await ctx.api.get("/teams", { league: competition.api_league_id, season: update.current_season }, z.array(teamItemSchema));
      const rows = teams.data.map((team) => teamToRow(team, competition.category === "international"));
      if (rows.length > 0) {
        const { error: teamError } = await ctx.db.from("teams").upsert(rows, { onConflict: "api_team_id" });
        if (teamError) throw new Error(`équipes : ${teamError.message}`);
      }
      ctx.processed(rows.length);
    } catch (error) {
      if ((error as Error).name === "BudgetExceededError") throw error;
      ctx.error(`${competition.name} : ${(error as Error).message}`);
    }
  }
}

// ----------------------------------------------------------------------------
// sync-fixtures : matchs des 14 prochains jours et des 3 derniers (1 appel / compétition)
// ----------------------------------------------------------------------------
export async function syncFixtures(ctx: SyncContext): Promise<void> {
  const window = dateWindow(ctx.now, 3, 14);
  const upcomingByCompetition: Record<string, number> = {};

  for (const competition of await activeCompetitions(ctx)) {
    if (!competition.current_season) {
      ctx.error(`${competition.name} : saison en cours inconnue (lancer sync-competitions).`);
      continue;
    }
    if (outOfTime(ctx, competition.name)) break;
    try {
      const result = await ctx.api.get(
        "/fixtures",
        { league: competition.api_league_id, season: competition.current_season, from: window.from, to: window.to },
        z.array(fixtureItemSchema),
      );
      const items = result.data;
      if (items.length === 0) {
        upcomingByCompetition[competition.name] = 0;
        continue;
      }

      const isNational = competition.category === "international";
      const teamIds = await ensureTeams(ctx.db, items.flatMap((i) => [i.teams.home, i.teams.away]), isNational);

      const { data: existing, error: readError } = await ctx.db
        .from("fixtures")
        .select("api_fixture_id, original_kickoff_at")
        .in("api_fixture_id", items.map((i) => i.fixture.id));
      if (readError) throw new Error(`lecture des matchs : ${readError.message}`);
      const originalKickoff = new Map((existing ?? []).map((row) => [row.api_fixture_id, row.original_kickoff_at]));

      const rows = items.flatMap((item) => {
        const homeTeamId = teamIds.get(item.teams.home.id);
        const awayTeamId = teamIds.get(item.teams.away.id);
        if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
          ctx.error(`Match ${item.fixture.id} ignoré : équipes introuvables.`);
          return [];
        }
        return [fixtureToRow(item, { competitionId: competition.id, homeTeamId, awayTeamId }, originalKickoff.get(item.fixture.id), ctx.now)];
      });

      for (const batch of chunk(rows, 200)) {
        const { error } = await ctx.db.from("fixtures").upsert(batch, { onConflict: "api_fixture_id" });
        if (error) throw new Error(`enregistrement des matchs : ${error.message}`);
      }
      ctx.processed(rows.length);
      upcomingByCompetition[competition.name] = rows.filter((row) => row.kickoff_at > ctx.now.toISOString()).length;
    } catch (error) {
      if ((error as Error).name === "BudgetExceededError") throw error;
      ctx.error(`${competition.name} : ${(error as Error).message}`);
    }
  }
  ctx.details.upcomingByCompetition = upcomingByCompetition;
}

// ----------------------------------------------------------------------------
// sync-standings : classements (1 appel / compétition qui en a un)
// ----------------------------------------------------------------------------
export async function syncStandings(ctx: SyncContext): Promise<void> {
  for (const competition of await activeCompetitions(ctx)) {
    if (!competition.current_season || !hasStandings(competition)) continue;
    if (outOfTime(ctx, competition.name)) break;
    try {
      const result = await ctx.api.get(
        "/standings",
        { league: competition.api_league_id, season: competition.current_season },
        z.array(standingsItemSchema),
      );
      const rows = result.data.flatMap((item) => item.league.standings.flat());
      if (rows.length === 0) continue;

      const teamIds = await ensureTeams(ctx.db, rows.map((row) => row.team), competition.category === "international");
      const records = rows.flatMap((row) => {
        const teamId = teamIds.get(row.team.id);
        if (!teamId) return [];
        return [standingToRow(row, { competitionId: competition.id, teamId, season: competition.current_season!, groupName: row.group ?? "" })];
      });

      const { error } = await ctx.db
        .from("standings")
        .upsert(records, { onConflict: "competition_id,season,group_name,team_id" });
      if (error) throw new Error(`enregistrement : ${error.message}`);
      ctx.processed(records.length);
    } catch (error) {
      if ((error as Error).name === "BudgetExceededError") throw error;
      ctx.error(`${competition.name} : ${(error as Error).message}`);
    }
  }
}

// ----------------------------------------------------------------------------
// sync-results : matchs commencés depuis moins de 4 h et non terminés (1 appel / 20 matchs)
// ----------------------------------------------------------------------------
export const RESULTS_LOOKBACK_HOURS = 4;
export const RESULTS_BATCH_SIZE = 20;

export async function syncResults(ctx: SyncContext): Promise<void> {
  const since = new Date(ctx.now.getTime() - RESULTS_LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const finalStatuses = [...FINISHED_STATUSES, ...NOT_PLAYED_STATUSES];

  const { data: fixtures, error } = await ctx.db
    .from("fixtures")
    .select("id, api_fixture_id")
    .gte("kickoff_at", since)
    .lte("kickoff_at", ctx.now.toISOString())
    .not("status_short", "in", `(${finalStatuses.join(",")})`);
  if (error) throw new Error(`lecture des matchs en cours : ${error.message}`);

  ctx.details.inProgress = fixtures?.length ?? 0;
  // Aucun match en cours : sortie immédiate, sans aucun appel API.
  if (!fixtures || fixtures.length === 0) return;

  for (const batch of chunk(fixtures.map((f) => f.api_fixture_id), RESULTS_BATCH_SIZE)) {
    if (outOfTime(ctx, `${batch.length} matchs`)) break;
    try {
      const result = await ctx.api.get("/fixtures", { ids: batch.join("-") }, z.array(fixtureItemSchema));
      for (const item of result.data) {
        const { error: updateError } = await ctx.db
          .from("fixtures")
          .update(fixtureResultUpdate(item, ctx.now))
          .eq("api_fixture_id", item.fixture.id);
        if (updateError) ctx.error(`Match ${item.fixture.id} : ${updateError.message}`);
        else ctx.processed(1);
      }
    } catch (error) {
      if ((error as Error).name === "BudgetExceededError") throw error;
      ctx.error(`Lot ${batch[0]}… : ${(error as Error).message}`);
    }
  }
}
