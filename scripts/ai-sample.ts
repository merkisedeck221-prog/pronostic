/**
 * Génération réelle de pronostics sur quelques matchs à venir (contrôle qualité
 * du prompt). Choisit jusqu'à N matchs publiés, non commencés, SANS pronostic,
 * de compétitions différentes si possible ; construit leur dossier (appels
 * API-Football comptés dans sync_runs) ; génère et enregistre les pronostics.
 * Affiche pour chacun le JSON obtenu, les tokens et le coût estimé.
 *
 *   npm run ai:sample            (3 matchs)
 *   npm run ai:sample -- 5
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildMatchContext } from "@/lib/ai/context/build";
import { generateForFixture, type PipelineResult } from "@/lib/ai/pipeline";
import { runJob } from "@/lib/sync/runner";
import type { Database } from "@/types/database";
import { loadDotEnvLocal } from "./lib/script-env";

loadDotEnvLocal();

async function main() {
  const count = Math.min(Math.max(Number(process.argv[2] ?? 3) || 3, 1), 10);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  const { data: upcoming, error } = await db
    .from("fixtures")
    .select("id, kickoff_at, competition_id, home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name), competitions!inner(name, is_active)")
    .eq("is_published", true)
    .eq("competitions.is_active", true)
    .in("status_short", ["NS", "TBD"])
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at")
    .limit(200);
  if (error) throw new Error(error.message);

  const { data: withPredictions } = await db
    .from("predictions")
    .select("fixture_id")
    .in("fixture_id", (upcoming ?? []).map((f) => f.id));
  const done = new Set((withPredictions ?? []).map((p) => p.fixture_id));
  const candidates = (upcoming ?? []).filter((f) => !done.has(f.id));

  // Compétitions différentes d'abord, puis compléter.
  const picked: typeof candidates = [];
  const seen = new Set<number>();
  for (const f of candidates) {
    if (picked.length < count && !seen.has(f.competition_id)) {
      picked.push(f);
      seen.add(f.competition_id);
    }
  }
  for (const f of candidates) if (picked.length < count && !picked.includes(f)) picked.push(f);
  if (picked.length === 0) throw new Error("Aucun match à venir sans pronostic : lancer d'abord la synchronisation.");

  const results: Array<{ fixture: string; competition: string; kickoff: string; result: PipelineResult }> = [];
  const summary = await runJob(
    "ai-sample",
    async (ctx) => {
      for (const f of picked) {
        const label = `${f.home.name} – ${f.away.name}`;
        console.log(`\n▶ ${label} (${f.competitions.name}, ${f.kickoff_at})`);
        try {
          await buildMatchContext(ctx.db, ctx.api, f.id);
          const result = await generateForFixture(ctx.db, f.id, { mode: "initial" });
          results.push({ fixture: label, competition: f.competitions.name, kickoff: f.kickoff_at, result });
          if (result.ok) ctx.processed(1);
          else ctx.error(`${label} : ${result.error}`);
          console.log(JSON.stringify(result, null, 2));
        } catch (e) {
          if ((e as Error).name === "BudgetExceededError") throw e;
          ctx.error(`${label} : ${(e as Error).message}`);
        }
      }
    },
    { db, timeBudgetMs: 15 * 60_000 },
  );

  const report = {
    apiFootballCalls: summary.apiCalls,
    quotaRemaining: summary.quotaRemaining,
    totalTokens: results.reduce((sum, r) => sum + (r.result.metrics ? r.result.metrics.inputTokens + r.result.metrics.outputTokens : 0), 0),
    totalCostUsd: Number(results.reduce((sum, r) => sum + (r.result.metrics?.costEstimateUsd ?? 0), 0).toFixed(6)),
    matches: results.map((r) => ({
      fixture: r.fixture,
      competition: r.competition,
      kickoff: r.kickoff,
      ok: r.result.ok,
      metrics: r.result.metrics,
      output: r.result.ok ? r.result.output : null,
      error: r.result.ok ? null : r.result.error,
      errors: r.result.ok ? [] : r.result.errors,
      raw: r.result.ok ? undefined : r.result.raw,
    })),
  };
  writeFileSync("ai-sample-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== Résumé ===");
  const brief = report.matches.map((m) => ({ fixture: m.fixture, competition: m.competition, ok: m.ok, metrics: m.metrics, error: m.error }));
  console.log(JSON.stringify({ ...report, matches: brief }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
