import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiFootballClient, ApiFootballError, BudgetExceededError, BudgetGuard, type BudgetStore } from "./client";
import { fixtureItemSchema, leagueItemSchema } from "./schemas";

const recorded = (file: string) => readFileSync(`tests/fixtures/api-football/${file}`, "utf8");

/** Budget en mémoire : `used` = appels déjà consommés aujourd'hui. */
function memoryStore(used = 0): BudgetStore & { used: number; recorded: number } {
  const store = {
    used,
    recorded: 0,
    async usedToday() {
      return store.used;
    },
    async record(calls: number) {
      store.used += calls;
      store.recorded += calls;
    },
  };
  return store;
}

function jsonResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

function makeClient(fetchImpl: typeof fetch, store: BudgetStore, limit = 90) {
  return new ApiFootballClient({
    apiKey: "test-key",
    budget: new BudgetGuard(store, limit),
    fetchImpl,
    sleep: async () => {},
  });
}

describe("garde-fou budgétaire", () => {
  it("refuse l'appel sans contacter l'API quand le budget du jour est atteint", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const store = memoryStore(90);
    const client = makeClient(fetchImpl, store, 90);

    await expect(client.get("/leagues", { id: 39 }, z.array(leagueItemSchema))).rejects.toBeInstanceOf(BudgetExceededError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(store.recorded).toBe(0);
  });

  it("autorise l'appel sous la limite et le comptabilise", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(recorded("leagues-premier-league.json")));
    const store = memoryStore(89);
    const client = makeClient(fetchImpl, store, 90);

    const result = await client.get("/leagues", { id: 39, current: "true" }, z.array(leagueItemSchema));
    expect(result.data[0].league.id).toBe(39);
    expect(store.used).toBe(90);
    expect(client.callCount).toBe(1);

    // Le budget est désormais atteint : l'appel suivant est refusé.
    await expect(client.get("/leagues", { id: 61 }, z.array(leagueItemSchema))).rejects.toBeInstanceOf(BudgetExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("compte chaque nouvelle tentative et s'arrête si le budget est atteint entre deux", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse("{}", 503));
    const store = memoryStore(88);
    const client = makeClient(fetchImpl, store, 90);

    await expect(client.get("/leagues", { id: 39 }, z.array(leagueItemSchema))).rejects.toBeInstanceOf(BudgetExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // 88 → 89 → 90, la 3e tentative est refusée
    expect(store.recorded).toBe(2);
  });
});

describe("appels et erreurs", () => {
  it("envoie la clé, ajoute timezone=UTC et lit le quota dans les en-têtes", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(recorded("fixtures-premier-league.json"), 200, {
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "83",
        "x-ratelimit-remaining": "9",
      }),
    );
    const client = makeClient(fetchImpl, memoryStore());

    const result = await client.get("/fixtures", { league: 39, season: 2026, from: "2026-11-14", to: "2026-12-01" }, z.array(fixtureItemSchema));
    expect(result.data).toHaveLength(4);
    expect(result.quota).toEqual({ dailyLimit: 100, dailyRemaining: 83, minuteRemaining: 9 });

    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://v3.football.api-sports.io/fixtures");
    expect(parsed.searchParams.get("timezone")).toBe("UTC");
    expect((init?.headers as Record<string, string>)["x-apisports-key"]).toBe("test-key");
  });

  it("traite une réponse 200 contenant des erreurs comme un échec, sans nouvelle tentative", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(recorded("error-free-plan-season.json")));
    const store = memoryStore();
    const client = makeClient(fetchImpl, store);

    const promise = client.get("/fixtures", { league: 39, season: 2026 }, z.array(fixtureItemSchema));
    await expect(promise).rejects.toBeInstanceOf(ApiFootballError);
    await expect(promise).rejects.toThrow(/Free plans do not have access to this season/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(store.recorded).toBe(1);
  });

  it("réessaie 2 fois après une erreur serveur puis réussit", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse("{}", 500))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(jsonResponse(recorded("leagues-premier-league.json")));
    const store = memoryStore();
    const client = new ApiFootballClient({ apiKey: "k", budget: new BudgetGuard(store, 90), fetchImpl, sleep });

    const result = await client.get("/leagues", { id: 39 }, z.array(leagueItemSchema));
    expect(result.data).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(store.recorded).toBe(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]); // attente progressive
  });

  it("abandonne après 3 échecs réseau", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("timeout");
    });
    const client = makeClient(fetchImpl, memoryStore());
    await expect(client.get("/leagues", { id: 39 }, z.array(leagueItemSchema))).rejects.toThrow(/Échec réseau/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("ne réessaie pas une erreur client (ex. 403)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse("{}", 403));
    const client = makeClient(fetchImpl, memoryStore());
    await expect(client.get("/leagues", { id: 39 }, z.array(leagueItemSchema))).rejects.toThrow(/HTTP 403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
