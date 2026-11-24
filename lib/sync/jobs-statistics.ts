import "server-only";

import { z } from "zod";
import { FINISHED_STATUSES } from "@/lib/api-football/convert";
import { fixtureStatisticsItemSchema } from "@/lib/api-football/schemas";
import { fixtureStatsUpdate } from "@/lib/api-football/statistics";
import { MIN_TIME_FOR_CALL_MS, type SyncContext } from "./runner";

/**
 * sync-statistics (lot B) : corners et cartons des matchs terminés, pour
 * résoudre les pronostics corners / cartons et nourrir les moyennes envoyées
 * à l'IA. 1 appel API par match, au plus STATS_MAX_PER_RUN par exécution ;
 * un match sans statistiques est réessayé jusqu'à STATS_MAX_ATTEMPTS fois.
 */
export const STATS_LOOKBACK_DAYS = 14;
export const STATS_MAX_PER_RUN = 15;
export const STATS_MAX_ATTEMPTS = 6;

type Coverage = { fixtures?: { statistics_fixtures?: boolean } };

export async function syncStatistics(ctx: SyncContext): Promise<void> {
  const since = new Date(ctx.now.getTime() - STATS_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: fixtures, error } = await ctx.db
    .from("fixtures")
    .select(
      `id, api_fixture_id, stats_attempts,
       competition:competitions!inner(is_active, coverage),
       home:teams!fixtures_home_team_id_fkey(api_team_id),
       away:teams!fixtures_away_team_id_fkey(api_team_id)`,
    )
    .in("status_short", [...FINISHED_STATUSES])
    .is("stats_synced_at", null)
    .lt("stats_attempts", STATS_MAX_ATTEMPTS)
    .gte("kickoff_at", since)
    .eq("competition.is_active", true)
    .order("kickoff_at", { ascending: false })
    .limit(STATS_MAX_PER_RUN * 4);
  if (error) throw new Error(`lecture des matchs sans statistiques : ${error.message}`);

  // Compétitions sans statistiques de match chez API-Football : aucun appel.
  const queue = (fixtures ?? [])
    .filter((f) => (f.competition.coverage as Coverage | null)?.fixtures?.statistics_fixtures !== false)
    .slice(0, STATS_MAX_PER_RUN);
  ctx.details.pending = queue.length;
  if (queue.length === 0) return;

  let synced = 0;
  for (const fixture of queue) {
    if (ctx.timeLeft() < MIN_TIME_FOR_CALL_MS) {
      ctx.error("Temps limite atteint : statistiques reportées à la prochaine exécution.");
      break;
    }
    try {
      const result = await ctx.api.get("/fixtures/statistics", { fixture: fixture.api_fixture_id }, z.array(fixtureStatisticsItemSchema));
      const update = fixtureStatsUpdate(result.data, { homeApiId: fixture.home.api_team_id, awayApiId: fixture.away.api_team_id });
      const { error: updateError } = await ctx.db
        .from("fixtures")
        .update(
          update
            ? { ...update, stats_synced_at: ctx.now.toISOString(), stats_attempts: fixture.stats_attempts + 1 }
            : { stats_attempts: fixture.stats_attempts + 1 },
        )
        .eq("id", fixture.id);
      if (updateError) throw new Error(updateError.message);
      if (update) synced += 1;
      ctx.processed(1);
    } catch (e) {
      if ((e as Error).name === "BudgetExceededError") throw e;
      ctx.error(`Statistiques du match ${fixture.api_fixture_id} : ${(e as Error).message}`);
    }
  }
  ctx.details.synced = synced;
}
