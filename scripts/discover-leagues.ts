/**
 * Découverte des compétitions API-Football (cahier des charges, section 7).
 *
 * Confirme les identifiants indicatifs, la saison en cours et la couverture
 * (fixtures, standings, predictions, injuries), recherche les qualifications à
 * la Coupe du monde par confédération, puis écrit docs/leagues.md et
 * docs/leagues.json. N'ÉCRIT RIEN dans les tables de données.
 *
 * Coût : 1 appel par compétition (12) + 1 recherche « World Cup » = 13 appels
 * (+ /status, qui ne compte pas dans le quota). Les appels sont journalisés
 * dans sync_runs (job « discover-leagues ») si la clé secrète Supabase est
 * disponible, sinon comptés en mémoire.
 *
 * Lancement : npm run discover:leagues   (variables : .env.local ou CI)
 * Option : SAVE_API_SAMPLES=dossier  → enregistre les réponses brutes.
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { ApiFootballClient, BudgetGuard, type BudgetStore } from "@/lib/api-football/client";
import { currentSeason } from "@/lib/api-football/convert";
import { leagueItemSchema, statusSchema, type LeagueItem } from "@/lib/api-football/schemas";
import type { Database } from "@/types/database";
import { loadDotEnvLocal, recordingFetch } from "./lib/script-env";

loadDotEnvLocal();

type Expected = { id: number; label: string; category: "club_league" | "international"; slug: string; note?: string };

/** Compétitions indicatives de la section 7. */
const EXPECTED: Expected[] = [
  { id: 39, label: "Premier League (Angleterre)", category: "club_league", slug: "premier-league" },
  { id: 140, label: "LaLiga (Espagne)", category: "club_league", slug: "laliga" },
  { id: 135, label: "Serie A (Italie)", category: "club_league", slug: "serie-a" },
  { id: 78, label: "Bundesliga (Allemagne)", category: "club_league", slug: "bundesliga" },
  { id: 61, label: "Ligue 1 (France)", category: "club_league", slug: "ligue-1" },
  { id: 5, label: "Ligue des nations UEFA", category: "international", slug: "ligue-des-nations" },
  { id: 6, label: "Coupe d'Afrique des nations (CAN)", category: "international", slug: "can" },
  { id: 36, label: "Qualifications CAN", category: "international", slug: "qualifications-can" },
  { id: 10, label: "Matchs amicaux internationaux", category: "international", slug: "amicaux-internationaux" },
  { id: 1, label: "Coupe du monde", category: "international", slug: "coupe-du-monde", note: "activée quand une édition approche" },
  { id: 4, label: "Euro", category: "international", slug: "euro", note: "activée quand une édition approche" },
  { id: 9, label: "Copa América", category: "international", slug: "copa-america", note: "activée quand une édition approche" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable ${name} manquante (.env.local ou secrets CI).`);
  return value;
}

async function createBudget(): Promise<{ store: BudgetStore & { calls: number }; finish: (summary: string) => Promise<void> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const { createDbBudgetStore } = await import("@/lib/sync/runner");
    const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
    const { data: run, error } = await db.from("sync_runs").insert({ job: "discover-leagues", status: "running" }).select("id").single();
    if (error || !run) throw new Error(`sync_runs : ${error?.message}`);
    const store = createDbBudgetStore(db, () => run.id, () => new Date());
    return {
      store,
      finish: async (summary) => {
        await db
          .from("sync_runs")
          .update({ status: "success", finished_at: new Date().toISOString(), api_calls: store.calls, items_processed: EXPECTED.length, error: summary })
          .eq("id", run.id);
      },
    };
  }
  console.warn("Clé secrète Supabase absente : appels comptés en mémoire seulement (pensez à les reporter dans sync_runs).");
  const store = {
    calls: 0,
    async usedToday() {
      return store.calls;
    },
    async record(calls: number) {
      store.calls += calls;
    },
  };
  return { store, finish: async () => {} };
}

const yes = (value: boolean | undefined) => (value ? "oui" : "non");

function describe(item: LeagueItem | undefined) {
  if (!item) return null;
  const season = currentSeason(item);
  const raw = item.seasons.find((s) => s.current);
  return {
    apiName: item.league.name,
    type: item.league.type,
    country: item.country?.name ?? "",
    logo: item.league.logo ?? null,
    season: season?.year ?? null,
    start: raw?.start ?? null,
    end: raw?.end ?? null,
    coverage: {
      fixtures: Boolean(season?.coverage.fixtures),
      standings: Boolean(season?.coverage.standings),
      predictions: Boolean(season?.coverage.predictions),
      injuries: Boolean(season?.coverage.injuries),
    },
  };
}

async function main() {
  const apiKey = requireEnv("API_FOOTBALL_KEY");
  const dailyBudget = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 90);
  const samples = process.env.SAVE_API_SAMPLES;
  const fetchImpl = samples ? recordingFetch(samples) : undefined;

  const { store, finish } = await createBudget();
  const api = new ApiFootballClient({ apiKey, budget: new BudgetGuard(store, dailyBudget), fetchImpl });

  // /status ne compte pas dans le quota quotidien d'API-Football.
  const statusResponse = await fetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": apiKey } });
  const statusBody = (await statusResponse.json()) as { response?: unknown };
  const status = statusSchema.safeParse(statusBody.response);
  const before = status.success ? status.data.requests : null;
  console.log(
    before
      ? `Quota API-Football avant découverte : ${before.current}/${before.limit_day} (forfait ${status.success ? status.data.subscription?.plan ?? "?" : "?"})`
      : "Quota API-Football : /status illisible",
  );

  const rows: Array<Expected & { found: ReturnType<typeof describe>; error?: string }> = [];
  for (const expected of EXPECTED) {
    try {
      const result = await api.get("/leagues", { id: expected.id }, z.array(leagueItemSchema));
      rows.push({ ...expected, found: describe(result.data[0]) });
    } catch (error) {
      rows.push({ ...expected, found: null, error: (error as Error).message });
    }
  }

  let worldCupQualifiers: Array<NonNullable<ReturnType<typeof describe>> & { id: number }> = [];
  try {
    const search = await api.get("/leagues", { search: "World Cup" }, z.array(leagueItemSchema));
    worldCupQualifiers = search.data
      .filter((item) => /qualification/i.test(item.league.name))
      .map((item) => ({ id: item.league.id, ...describe(item)! }))
      .sort((a, b) => a.apiName.localeCompare(b.apiName));
  } catch (error) {
    console.error("Recherche « World Cup » impossible :", (error as Error).message);
  }

  const quota = api.lastQuota;
  const today = new Date().toISOString().slice(0, 10);
  const md: string[] = [
    "# Compétitions API-Football — résultat de la découverte",
    "",
    `Généré par \`npm run discover:leagues\` le ${today}. Appels consommés : **${store.calls}**. Quota restant aujourd'hui selon API-Football : **${quota.dailyRemaining ?? "?"}**${quota.dailyLimit ? ` / ${quota.dailyLimit}` : ""}.`,
    "",
    "## Compétitions de la section 7",
    "",
    "| Compétition | ID | Nom API | Type | Pays | Saison en cours | Dates | Matchs | Classement | Predictions | Blessures | Remarque |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => {
      const f = row.found;
      if (!f) return `| ${row.label} | ${row.id} | **introuvable** | | | | | | | | | ${row.error ?? ""} |`;
      return `| ${row.label} | ${row.id} | ${f.apiName} | ${f.type} | ${f.country} | ${f.season ?? "—"} | ${f.start ?? "?"} → ${f.end ?? "?"} | ${yes(f.coverage.fixtures)} | ${yes(f.coverage.standings)} | ${yes(f.coverage.predictions)} | ${yes(f.coverage.injuries)} | ${row.note ?? ""} |`;
    }),
    "",
    "## Qualifications à la Coupe du monde (recherche « World Cup »)",
    "",
    "| ID | Nom API | Saison en cours | Dates | Matchs | Classement | Predictions | Blessures |",
    "|---|---|---|---|---|---|---|---|",
    ...worldCupQualifiers.map(
      (q) =>
        `| ${q.id} | ${q.apiName} | ${q.season ?? "—"} | ${q.start ?? "?"} → ${q.end ?? "?"} | ${yes(q.coverage.fixtures)} | ${yes(q.coverage.standings)} | ${yes(q.coverage.predictions)} | ${yes(q.coverage.injuries)} |`,
    ),
    "",
    "Les compétitions sont ensuite insérées dans `competitions` (voir docs/sync.md) : seules Premier League, Ligue 1 et Matchs amicaux internationaux sont actives tant que le forfait gratuit est utilisé.",
    "",
  ];

  writeFileSync("docs/leagues.md", md.join("\n"));
  writeFileSync("docs/leagues.json", JSON.stringify({ generatedAt: new Date().toISOString(), apiCalls: store.calls, quota, competitions: rows, worldCupQualifiers }, null, 2));
  await finish(`Découverte : ${rows.filter((r) => r.found).length}/${rows.length} compétitions confirmées, ${worldCupQualifiers.length} qualifications CM trouvées`);

  console.log(md.join("\n"));
  console.log(`\nAppels consommés : ${store.calls} — quota restant : ${quota.dailyRemaining ?? "?"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
