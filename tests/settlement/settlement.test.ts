import { afterAll, beforeAll, describe, expect, it } from "vitest";
import shared from "@/tests/fixtures/settlement-cases.json";
import { settlePrediction } from "@/lib/settle/rules";
import { anonClient, createTestUser, deleteTestUser, fakeApiId, serviceClient, type TestUser } from "../security/helpers";

/**
 * Tests d'intégration de la phase 9, contre la base de DÉVELOPPEMENT :
 * test croisé TypeScript ↔ SQL, résolution, remboursement, performances.
 */

type Json = Record<string, unknown>;
const MARKETS = [
  ["MATCH_RESULT", "1"],
  ["EXACT_SCORE", "2-1"],
  ["OVER_UNDER_2_5", "OVER"],
  ["BTTS", "YES"],
] as const;

let competitionId: number;
let teamIds: [number, number];
const fixtureIds: number[] = [];
const users: TestUser[] = [];

async function createFixture(): Promise<number> {
  const kickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data, error } = await serviceClient
    .from("fixtures")
    .insert({
      api_fixture_id: fakeApiId(),
      competition_id: competitionId,
      season: 2026,
      kickoff_at: kickoff,
      original_kickoff_at: kickoff,
      home_team_id: teamIds[0],
      away_team_id: teamIds[1],
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`fixtures : ${error?.message}`);
  fixtureIds.push(data.id);
  const { error: e2 } = await serviceClient.from("predictions").insert(
    MARKETS.map(([market, selection]) => ({
      fixture_id: data.id,
      market_code: market,
      selection,
      selection_label: `Sélection ${market}`,
      probability: 55,
      probabilities: market === "MATCH_RESULT" ? { home: 55, draw: 25, away: 20 } : null,
      confidence: "medium" as const,
      reasoning: "Test",
      prompt_version: "test",
    })),
  );
  if (e2) throw new Error(`predictions : ${e2.message}`);
  return data.id;
}

async function results(fixtureId: number): Promise<Record<string, string>> {
  const { data } = await serviceClient.from("predictions").select("market_code, result, settled_at").eq("fixture_id", fixtureId);
  return Object.fromEntries((data ?? []).map((p) => [p.market_code, p.result]));
}

async function balanceOf(userId: string): Promise<number> {
  const { data } = await serviceClient.from("wallets").select("balance").eq("user_id", userId).single();
  return data!.balance;
}

beforeAll(async () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const { data: c, error } = await serviceClient
    .from("competitions")
    .insert({ api_league_id: fakeApiId(), name: `Test résolution ${suffix}`, slug: `test-resolution-${suffix}`, category: "club_league", type: "league", is_active: true })
    .select("id")
    .single();
  if (error || !c) throw new Error(`competitions : ${error?.message}`);
  competitionId = c.id;
  const { data: teams } = await serviceClient
    .from("teams")
    .insert([
      { api_team_id: fakeApiId(), name: `Domicile ${suffix}` },
      { api_team_id: fakeApiId(), name: `Extérieur ${suffix}` },
    ])
    .select("id");
  teamIds = [teams![0].id, teams![1].id];
});

afterAll(async () => {
  for (const u of users) await deleteTestUser(u);
  if (fixtureIds.length) {
    await serviceClient.from("unlocks").delete().in("fixture_id", fixtureIds);
    await serviceClient.from("fixtures").delete().in("id", fixtureIds);
  }
  if (teamIds) await serviceClient.from("teams").delete().in("id", teamIds);
  if (competitionId) await serviceClient.from("competitions").delete().eq("id", competitionId);
});

describe("test croisé TypeScript ↔ SQL", () => {
  it("settle_outcome donne le même résultat que lib/settle/rules.ts sur toute la table de cas", async () => {
    for (const c of shared.cases) {
      const { data, error } = await serviceClient.rpc("settle_outcome", {
        p_market: c.market,
        p_selection: c.selection,
        p_home: c.home,
        p_away: c.away,
      });
      expect(error).toBeNull();
      expect(data, `${c.market} ${c.selection} ${c.home}-${c.away}`).toBe(settlePrediction(c.market, c.selection, { home: c.home, away: c.away }));
      expect(data).toBe(c.expected);
    }
  });
});

describe("settle_fixture", () => {
  it("résout un match terminé (statuts corrects) et se rejoue sans effet", async () => {
    const id = await createFixture();

    // Pas encore terminé : refus.
    const early = await serviceClient.rpc("settle_fixture", { p_fixture_id: id });
    expect(early.data).toMatchObject({ ok: false, code: "NOT_FINISHED" });

    await serviceClient
      .from("fixtures")
      .update({ status_short: "FT", kickoff_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), ft_home: 2, ft_away: 1, goals_home: 2, goals_away: 1 })
      .eq("id", id);
    const first = await serviceClient.rpc("settle_fixture", { p_fixture_id: id });
    expect(first.data).toMatchObject({ ok: true, settled: 4 });
    expect(await results(id)).toEqual({ MATCH_RESULT: "won", EXACT_SCORE: "won", OVER_UNDER_2_5: "won", BTTS: "won" });

    const { data: before } = await serviceClient.from("predictions").select("id, settled_at").eq("fixture_id", id).order("id");
    const again = await serviceClient.rpc("settle_fixture", { p_fixture_id: id });
    expect(again.data).toMatchObject({ ok: true, settled: 0 });
    const { data: after } = await serviceClient.from("predictions").select("id, settled_at").eq("fixture_id", id).order("id");
    expect(after).toEqual(before);
  });

  it("match AET : score au temps réglementaire, jamais après prolongation", async () => {
    const id = await createFixture();
    await serviceClient
      .from("fixtures")
      .update({ status_short: "AET", kickoff_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), ft_home: 1, ft_away: 1, goals_home: 2, goals_away: 1 })
      .eq("id", id);
    await serviceClient.rpc("settle_fixture", { p_fixture_id: id });
    expect(await results(id)).toEqual({ MATCH_RESULT: "lost", EXACT_SCORE: "lost", OVER_UNDER_2_5: "lost", BTTS: "won" });
  });

  it("refusée avec la clé publique", async () => {
    const id = await createFixture();
    const anon = await anonClient().rpc("settle_fixture", { p_fixture_id: id });
    expect(anon.error).not.toBeNull();
    const u = await createTestUser("settle-user");
    users.push(u);
    const asUser = await u.client.rpc("refund_fixture", { p_fixture_id: id });
    expect(asUser.error).not.toBeNull();
  });
});

describe("refund_fixture", () => {
  it("rembourse un match annulé (solde rendu, pronostics void) et se rejoue sans effet", async () => {
    const id = await createFixture();
    const u = await createTestUser("refund");
    users.push(u);
    await serviceClient.rpc("admin_adjust_balance", { p_user_id: u.id, p_amount: 20, p_reason: "Crédits de test (résolution)" });

    const a = await u.client.rpc("unlock_prediction", { p_fixture_id: id, p_market_code: "BTTS" });
    const b = await u.client.rpc("unlock_prediction", { p_fixture_id: id, p_market_code: "" });
    expect(a.data).toMatchObject({ ok: true });
    expect(b.data).toMatchObject({ ok: true });
    const spent = 20 - (await balanceOf(u.id));
    expect(spent).toBeGreaterThan(0);

    // Non éligible tant que le match n'est pas annulé.
    const early = await serviceClient.rpc("refund_fixture", { p_fixture_id: id });
    expect(early.data).toMatchObject({ ok: false, code: "NOT_ELIGIBLE" });

    await serviceClient.from("fixtures").update({ status_short: "CANC" }).eq("id", id);
    const first = await serviceClient.rpc("refund_fixture", { p_fixture_id: id });
    expect(first.data).toMatchObject({ ok: true, refunded_unlocks: 2, refunded_credits: spent, voided: 4 });
    expect(await balanceOf(u.id)).toBe(20);
    expect(Object.values(await results(id))).toEqual(["void", "void", "void", "void"]);

    const { data: refunds } = await serviceClient.from("credit_transactions").select("amount, type").eq("user_id", u.id).eq("type", "refund");
    expect((refunds ?? []).reduce((sum, t) => sum + t.amount, 0)).toBe(spent);

    const again = await serviceClient.rpc("refund_fixture", { p_fixture_id: id });
    expect(again.data).toMatchObject({ ok: true, refunded_unlocks: 0, refunded_credits: 0, voided: 0 });
    expect(await balanceOf(u.id)).toBe(20);

    // Mes pronostics : « Annulé et remboursé ».
    const { data: mine } = await u.client.rpc("get_my_predictions", {});
    const rows = (mine as Json[]).filter((r) => r.fixture_id === id);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.result === "void" && r.refunded === true)).toBe(true);
  });

  it("report : remboursé au-delà de 48 h, pas en deçà", async () => {
    const shortId = await createFixture();
    const longId = await createFixture();
    const { data: rows } = await serviceClient.from("fixtures").select("id, original_kickoff_at").in("id", [shortId, longId]);
    const original = new Map((rows ?? []).map((r) => [r.id, new Date(r.original_kickoff_at!).getTime()]));
    await serviceClient.from("fixtures").update({ status_short: "PST", kickoff_at: new Date(original.get(shortId)! + 24 * 3600 * 1000).toISOString() }).eq("id", shortId);
    await serviceClient.from("fixtures").update({ status_short: "PST", kickoff_at: new Date(original.get(longId)! + 72 * 3600 * 1000).toISOString() }).eq("id", longId);

    expect((await serviceClient.rpc("refund_fixture", { p_fixture_id: shortId })).data).toMatchObject({ ok: false, code: "NOT_ELIGIBLE" });
    expect((await serviceClient.rpc("refund_fixture", { p_fixture_id: longId })).data).toMatchObject({ ok: true, reason: "match reporté" });
  });
});

describe("get_performance_stats", () => {
  it("calcule les taux sur un jeu de données connu, pour un visiteur anonyme", async () => {
    const before = (await anonClient().rpc("get_performance_stats")).data as { global: { won: number; lost: number; void: number } };

    // 2 matchs : 2-1 (4 gagnés) et 0-0 (1N2 « 1 » perdu, 2-1 perdu, OVER perdu, BTTS YES perdu).
    const winId = await createFixture();
    const loseId = await createFixture();
    const past = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    await serviceClient.from("fixtures").update({ status_short: "FT", kickoff_at: past, ft_home: 2, ft_away: 1 }).eq("id", winId);
    await serviceClient.from("fixtures").update({ status_short: "FT", kickoff_at: past, ft_home: 0, ft_away: 0 }).eq("id", loseId);
    // Un pronostic masqué ne compte pas (seuls les pronostics publiés).
    await serviceClient.from("predictions").update({ status: "hidden" }).eq("fixture_id", loseId).eq("market_code", "BTTS");
    await serviceClient.rpc("settle_fixture", { p_fixture_id: winId });
    await serviceClient.rpc("settle_fixture", { p_fixture_id: loseId });

    const { data, error } = await anonClient().rpc("get_performance_stats");
    expect(error).toBeNull();
    const stats = data as {
      global: { won: number; lost: number };
      by_competition: Array<{ id: number; won: number; lost: number }>;
      recent: unknown[];
    };
    expect(stats.global.won - before.global.won).toBe(4);
    expect(stats.global.lost - before.global.lost).toBe(3);
    const mine = stats.by_competition.find((c) => c.id === competitionId);
    expect(mine).toMatchObject({ won: 4, lost: 3 });
    expect(Array.isArray(stats.recent)).toBe(true);
    expect(stats.recent.length).toBeLessThanOrEqual(20);
  });
});
