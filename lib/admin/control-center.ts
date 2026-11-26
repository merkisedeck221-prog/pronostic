import "server-only";

import { createClient } from "@/lib/supabase/server";
import { SYNC_JOBS } from "@/lib/sync";

/**
 * Centre de contrôle (tableau de bord admin) : chiffres RÉELS lus avec la
 * session de l'administrateur (RLS « admin »), aucune estimation. Chaque bloc
 * est indépendant : une lecture en échec donne null (affiché « — »), jamais un
 * chiffre inventé.
 */

export type JobState = { job: string; status: string | null; started_at: string | null; error: string | null };

export type ControlCenter = {
  users: { total: number | null; active30: number | null; banned: number | null };
  fixtures: { total: number | null; upcoming7: number | null; published: number | null };
  predictions: { generated: number | null; fixturesWithPredictions: number | null; unlocks: number | null; unlocks30: number | null };
  money: { transactions: number | null; transactions30: number | null; topupsPending: number | null };
  jobs: JobState[];
  ai: {
    runs24h: number | null;
    failed24h: number | null;
    lastRun: { status: string; created_at: string; duration_ms: number | null; error: string | null } | null;
    avgDurationMs: number | null;
    onDemandPending: number | null;
    onDemandFailed7d: number | null;
  };
};

const DAY = 24 * 3600 * 1000;

export async function getControlCenter(now: Date = new Date()): Promise<ControlCenter> {
  const supabase = await createClient();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const since24h = new Date(now.getTime() - DAY).toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const in7 = new Date(now.getTime() + 7 * DAY).toISOString();

  const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await query;
    return error ? null : (n ?? 0);
  };
  const head = { count: "exact" as const, head: true };

  const [
    usersTotal,
    usersBanned,
    fixturesTotal,
    fixturesUpcoming,
    fixturesPublished,
    predictionsTotal,
    unlocksTotal,
    unlocks30,
    txTotal,
    tx30,
    topupsPending,
    runs24h,
    failed24h,
    onDemandPending,
    onDemandFailed,
    activity,
    predictionFixtures,
    lastRuns,
    recentRuns,
    aiRecent,
  ] = await Promise.all([
    count(supabase.from("profiles").select("id", head)),
    count(supabase.from("profiles").select("id", head).eq("is_banned", true)),
    count(supabase.from("fixtures").select("id", head)),
    count(supabase.from("fixtures").select("id", head).gte("kickoff_at", now.toISOString()).lt("kickoff_at", in7).in("status_short", ["NS", "TBD"])),
    count(supabase.from("fixtures").select("id", head).eq("is_published", true)),
    count(supabase.from("predictions").select("id", head)),
    count(supabase.from("unlocks").select("id", head)),
    count(supabase.from("unlocks").select("id", head).gte("created_at", since30)),
    count(supabase.from("credit_transactions").select("id", head)),
    count(supabase.from("credit_transactions").select("id", head).gte("created_at", since30)),
    count(supabase.from("topups").select("id", head).eq("status", "pending")),
    count(supabase.from("ai_generation_runs").select("id", head).gte("created_at", since24h)),
    count(supabase.from("ai_generation_runs").select("id", head).gte("created_at", since24h).eq("status", "failed")),
    count(supabase.from("generation_requests").select("id", head).in("status", ["reserved", "running"])),
    count(supabase.from("generation_requests").select("id", head).gte("created_at", since7).eq("status", "failed")),
    // Utilisateurs actifs : au moins un mouvement de crédits (achat, déblocage…) sur 30 jours.
    supabase.from("credit_transactions").select("user_id").gte("created_at", since30).limit(10000),
    supabase.from("predictions").select("fixture_id").limit(10000),
    supabase.from("sync_runs").select("job, status, started_at, error").order("started_at", { ascending: false }).limit(300),
    supabase.from("ai_generation_runs").select("status, created_at, duration_ms, error").order("created_at", { ascending: false }).limit(1),
    supabase.from("ai_generation_runs").select("duration_ms").not("duration_ms", "is", null).order("created_at", { ascending: false }).limit(50),
  ]);

  // Dernière exécution de chaque tâche connue (ordre du registre des tâches).
  const latest = new Map<string, JobState>();
  for (const run of lastRuns.data ?? []) if (!latest.has(run.job)) latest.set(run.job, run);
  const jobs = Object.keys(SYNC_JOBS).map((job) => latest.get(job) ?? { job, status: null, started_at: null, error: null });

  const durations = (aiRecent.data ?? []).map((r) => r.duration_ms).filter((d): d is number => typeof d === "number");

  return {
    users: {
      total: usersTotal,
      active30: activity.error ? null : new Set((activity.data ?? []).map((r) => r.user_id)).size,
      banned: usersBanned,
    },
    fixtures: { total: fixturesTotal, upcoming7: fixturesUpcoming, published: fixturesPublished },
    predictions: {
      generated: predictionsTotal,
      fixturesWithPredictions: predictionFixtures.error ? null : new Set((predictionFixtures.data ?? []).map((r) => r.fixture_id)).size,
      unlocks: unlocksTotal,
      unlocks30,
    },
    money: { transactions: txTotal, transactions30: tx30, topupsPending },
    jobs,
    ai: {
      runs24h,
      failed24h,
      lastRun: recentRuns.data?.[0] ?? null,
      avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      onDemandPending,
      onDemandFailed7d: onDemandFailed,
    },
  };
}

/** État d'ensemble d'une tâche : ok, erreur, jamais lancée, ou en retard (plus de 26 h sans exécution). */
export function jobHealth(state: JobState, now: Date = new Date()): "ok" | "error" | "never" | "stale" {
  if (!state.started_at) return "never";
  if (state.status === "failed" || state.status === "partial") return "error";
  if (now.getTime() - new Date(state.started_at).getTime() > 26 * 3600 * 1000) return "stale";
  return "ok";
}
