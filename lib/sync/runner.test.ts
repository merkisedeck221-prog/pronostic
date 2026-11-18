import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runJob, type DB } from "./runner";

/**
 * Robustesse des tâches planifiées (phase 11) : API-Football en panne ou en
 * erreur, quota atteint, tâche relancée. Base simulée en mémoire (sync_runs).
 */

type Run = Record<string, unknown> & { id: number };

function fakeDb() {
  const runs: Run[] = [];
  const db = {
    from(table: string) {
      if (table !== "sync_runs") throw new Error(`table inattendue : ${table}`);
      return {
        insert(row: Record<string, unknown>) {
          const run = { id: runs.length + 1, api_calls: 0, ...row };
          runs.push(run);
          return { select: () => ({ single: async () => ({ data: { id: run.id }, error: null }) }) };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async (_col: string, id: number) => {
              Object.assign(runs.find((r) => r.id === id)!, values);
              return { error: null };
            },
          };
        },
        select() {
          return {
            gte: async () => ({ data: runs.map((r) => ({ api_calls: (r.api_calls as number) ?? 0 })), error: null }),
          };
        },
      };
    },
  };
  return { db: db as unknown as DB, runs };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-ratelimit-requests-remaining": "42" } });

describe("runJob : robustesse", () => {
  it("API-Football injoignable : la tâche se termine (failed), l'erreur est journalisée, rien ne plante", async () => {
    const { db, runs } = fakeDb();
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const summary = await runJob(
      "test-down",
      async (ctx) => {
        await ctx.api.get("/status", {}, z.unknown());
      },
      { db, apiKey: "k", dailyBudget: 90, fetchImpl, timeBudgetMs: 30_000 },
    );
    expect(summary.status).toBe("failed");
    expect(summary.errors.join(" ")).toMatch(/fetch failed|réseau|API-Football/i);
    expect(runs[0]).toMatchObject({ status: "failed" });
    expect(String(runs[0].error)).not.toBe("");
    expect(summary.apiCalls).toBe(3); // 1 appel + 2 nouvelles tentatives, toutes comptées
  }, 20_000);

  it("API-Football répond une erreur : partial si une partie a été traitée, le lot continue", async () => {
    const { db } = fakeDb();
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      return call === 1 ? json({ response: [], errors: [], results: 0 }) : json({ response: [], errors: { token: "Clé invalide" }, results: 0 });
    }) as typeof fetch;
    const summary = await runJob(
      "test-error",
      async (ctx) => {
        for (const league of [1, 2]) {
          try {
            await ctx.api.get("/fixtures", { league }, z.array(z.unknown()));
            ctx.processed(1);
          } catch (error) {
            ctx.error(`Ligue ${league} : ${(error as Error).message}`);
          }
        }
      },
      { db, apiKey: "k", dailyBudget: 90, fetchImpl },
    );
    expect(summary.status).toBe("partial");
    expect(summary.itemsProcessed).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.quotaRemaining).toBe(42);
  });

  it("quota atteint : arrêt propre avant tout appel (BudgetExceededError journalisée)", async () => {
    const { db, runs } = fakeDb();
    runs.push({ id: 99, api_calls: 90, status: "success" }); // 90 appels déjà faits aujourd'hui
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return json({ response: [] });
    }) as typeof fetch;
    const summary = await runJob(
      "test-budget",
      async (ctx) => {
        await ctx.api.get("/fixtures", {}, z.array(z.unknown()));
      },
      { db, apiKey: "k", dailyBudget: 90, fetchImpl },
    );
    expect(called).toBe(false);
    expect(summary.status).toBe("failed");
    expect(summary.errors.join(" ")).toMatch(/Budget quotidien/);
  });

  it("une exception inattendue dans la tâche est capturée et journalisée", async () => {
    const { db, runs } = fakeDb();
    const summary = await runJob(
      "test-crash",
      async () => {
        throw new Error("panne inattendue");
      },
      { db, apiKey: "k", dailyBudget: 90 },
    );
    expect(summary.status).toBe("failed");
    expect(runs[0].error).toBe("panne inattendue");
    expect(runs[0].finished_at).toBeTruthy();
  });

  it("deux exécutions successives : deux journaux distincts, aucun état partagé", async () => {
    const { db, runs } = fakeDb();
    const job = async (ctx: { processed: (n: number) => void }) => ctx.processed(2);
    const a = await runJob("test-twice", job, { db, apiKey: "k", dailyBudget: 90 });
    const b = await runJob("test-twice", job, { db, apiKey: "k", dailyBudget: 90 });
    expect([a.status, b.status]).toEqual(["success", "success"]);
    expect([a.itemsProcessed, b.itemsProcessed]).toEqual([2, 2]);
    expect(runs).toHaveLength(2);
  });
});
