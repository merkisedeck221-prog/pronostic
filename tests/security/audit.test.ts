import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createFixtureWithPrediction,
  createTestUser,
  deleteFixture,
  deleteTestUser,
  seedCredits,
  serviceClient,
  type DB,
  type TestFixture,
  type TestUser,
} from "./helpers";

/**
 * Audit de sécurité de la phase 11 (docs/SECURITE.md) : un attaquant qui ne
 * dispose QUE de la clé publique (anonyme, puis connecté avec son propre
 * compte) essaie de lire, d'écrire et d'appeler les fonctions SQL avec des
 * paramètres hostiles. Aucune tentative ne doit aboutir.
 */

let victim: TestUser;
let attacker: TestUser;
let fx: TestFixture;

const SENSITIVE_TABLES = [
  "predictions",
  "prediction_analyses",
  "match_contexts",
  "ai_generation_runs",
  "admin_audit_log",
  "sync_runs",
  "prediction_revisions",
] as const;

beforeAll(async () => {
  victim = await createTestUser("audit-victim");
  attacker = await createTestUser("audit-attacker");
  fx = await createFixtureWithPrediction();
  await seedCredits(victim.id, 10);
  const unlock = await victim.client.rpc("unlock_prediction", { p_fixture_id: fx.fixtureId, p_market_code: "MATCH_RESULT" });
  if ((unlock.data as { ok?: boolean } | null)?.ok !== true) throw new Error(`préparation : ${JSON.stringify(unlock.data ?? unlock.error)}`);
  await serviceClient.from("sync_runs").insert({ job: "audit-test", status: "success" });
  await serviceClient.from("ai_generation_runs").insert({ fixture_id: fx.fixtureId, model: "test", prompt_version: "test", status: "success" });
});

afterAll(async () => {
  await serviceClient.from("sync_runs").delete().eq("job", "audit-test");
  await serviceClient.from("unlocks").delete().eq("fixture_id", fx?.fixtureId ?? -1);
  await deleteTestUser(victim);
  await deleteTestUser(attacker);
  await deleteFixture(fx);
});

function clients(): Array<[string, DB]> {
  return [
    ["anonyme", anonClient()],
    ["connecté", attacker.client],
  ];
}

describe("lecture avec la clé publique", () => {
  it.each(SENSITIVE_TABLES)("%s : vide pour un anonyme et pour un utilisateur connecté", async (table) => {
    for (const [who, client] of clients()) {
      const { data } = await client.from(table).select("*").limit(5);
      expect(data ?? [], `${who} lit ${table}`).toEqual([]);
    }
  });

  it("profils, portefeuilles, transactions, déblocages et recharges d'un autre utilisateur : invisibles", async () => {
    for (const [who, client] of clients()) {
      for (const [table, column] of [
        ["profiles", "id"],
        ["wallets", "user_id"],
        ["credit_transactions", "user_id"],
        ["unlocks", "user_id"],
        ["topups", "user_id"],
      ] as const) {
        const { data } = await client.from(table as "wallets").select("*").eq(column as "user_id", victim.id);
        expect(data ?? [], `${who} lit ${table} de la victime`).toEqual([]);
      }
    }
  });
});

describe("écriture avec la clé publique", () => {
  it("wallets, credit_transactions, unlocks, topups : aucune écriture", async () => {
    const c = attacker.client;
    await c.from("wallets").update({ balance: 9999 }).eq("user_id", attacker.id);
    expect((await serviceClient.from("wallets").select("balance").eq("user_id", attacker.id).single()).data?.balance).toBe(0);
    expect((await c.from("credit_transactions").insert({ user_id: attacker.id, type: "bonus", amount: 999, balance_after: 999, description: "x" })).error).not.toBeNull();
    expect((await c.from("unlocks").insert({ user_id: attacker.id, fixture_id: fx.fixtureId, market_code: "MATCH_RESULT", credits_spent: 0 })).error).not.toBeNull();
    expect((await c.from("topups").insert({ user_id: attacker.id, credits: 999, amount_xof: 1, provider: "mock", status: "succeeded" })).error).not.toBeNull();
    await c.from("credit_transactions").delete().eq("user_id", victim.id);
    expect((await serviceClient.from("credit_transactions").select("id").eq("user_id", victim.id)).data?.length).toBeGreaterThan(0);
  });

  it("pricing_rules et app_settings : aucune modification", async () => {
    const before = (await serviceClient.from("pricing_rules").select("id, credits").order("id")).data;
    await attacker.client.from("pricing_rules").update({ credits: 0 }).gte("id", 0);
    expect((await attacker.client.from("pricing_rules").insert({ scope: "match_bundle", credits: 0, competition_id: fx.competitionId })).error).not.toBeNull();
    expect((await serviceClient.from("pricing_rules").select("id, credits").order("id")).data).toEqual(before);

    const setting = (await serviceClient.from("app_settings").select("value").eq("key", "maintenance_mode").single()).data;
    await attacker.client.from("app_settings").update({ value: true }).eq("key", "maintenance_mode");
    expect((await serviceClient.from("app_settings").select("value").eq("key", "maintenance_mode").single()).data).toEqual(setting);
  });

  it("role, is_banned, terms_accepted_at et created_at de son propre profil : protégés", async () => {
    const c = attacker.client;
    expect((await c.from("profiles").update({ role: "admin" }).eq("id", attacker.id)).error).not.toBeNull();
    expect((await c.from("profiles").update({ is_banned: true }).eq("id", attacker.id)).error).not.toBeNull();
    expect((await c.from("profiles").update({ terms_accepted_at: null }).eq("id", attacker.id)).error).not.toBeNull();
    expect((await c.from("profiles").update({ created_at: "2000-01-01T00:00:00Z" }).eq("id", attacker.id)).error).not.toBeNull();
    expect((await c.from("profiles").update({ timezone: "x".repeat(100) }).eq("id", attacker.id)).error).not.toBeNull();
    const { data } = await serviceClient.from("profiles").select("role, is_banned").eq("id", attacker.id).single();
    expect(data).toEqual({ role: "user", is_banned: false });
  });
});

describe("fonctions SQL avec des paramètres hostiles", () => {
  it("unlock_prediction : marché inexistant, injection, match inconnu, solde nul", async () => {
    const call = (fixture: number, market: string) =>
      attacker.client.rpc("unlock_prediction", { p_fixture_id: fixture, p_market_code: market }).then((r) => r.data as { code?: string });
    expect((await call(fx.fixtureId, "CORNERS")).code).toBe("NOT_AVAILABLE");
    expect((await call(fx.fixtureId, "MATCH_RESULT'; drop table public.wallets;--")).code).toBe("NOT_AVAILABLE");
    expect((await call(-1, "")).code).toBe("NOT_AVAILABLE");
    expect((await call(fx.fixtureId, "MATCH_RESULT")).code).toBe("INSUFFICIENT_BALANCE");
  });

  it("match commencé : refus", async () => {
    await serviceClient.from("fixtures").update({ status_short: "1H", kickoff_at: new Date(Date.now() - 600_000).toISOString() }).eq("id", fx.fixtureId);
    await seedCredits(attacker.id, 10);
    const { data } = await attacker.client.rpc("unlock_prediction", { p_fixture_id: fx.fixtureId, p_market_code: "MATCH_RESULT" });
    expect(data).toMatchObject({ ok: false, code: "MATCH_STARTED" });
    await serviceClient.from("fixtures").update({ status_short: "NS", kickoff_at: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", fx.fixtureId);
  });

  it("montants négatifs et identifiants d'autres utilisateurs : refusés", async () => {
    const adjust = await attacker.client.rpc("admin_adjust_balance", { p_user_id: attacker.id, p_amount: -5, p_reason: "x" });
    expect(adjust.data).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const other = await attacker.client.rpc("admin_get_user", { p_user_id: victim.id });
    expect(other.data).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const topup = await attacker.client.rpc("create_topup", { p_pack_id: -1, p_provider: "mock" });
    expect(topup.data).toMatchObject({ ok: false, code: "NOT_AVAILABLE" });
  });

  it("fonctions serveur (apply_topup, settle_fixture, refund_fixture, save_ai_generation, settle_outcome) : non exécutables", async () => {
    for (const [fn, args] of [
      ["apply_topup", { p_topup_id: "00000000-0000-4000-8000-000000000000", p_status: "succeeded" }],
      ["settle_fixture", { p_fixture_id: fx.fixtureId }],
      ["refund_fixture", { p_fixture_id: fx.fixtureId }],
      ["settle_outcome", { p_market: "BTTS", p_selection: "YES", p_home: 1, p_away: 1 }],
      ["save_ai_generation", { p_fixture_id: fx.fixtureId, p_mode: "initial", p_analysis: {}, p_predictions: [], p_run: {} }],
    ] as const) {
      for (const [who, client] of clients()) {
        const { error } = await client.rpc(fn as never, args as never);
        expect(error, `${who} appelle ${fn}`).not.toBeNull();
      }
    }
  });

  it("get_fixture_predictions et get_my_predictions : rien de la victime", async () => {
    const view = await attacker.client.rpc("get_fixture_predictions", { p_fixture_id: fx.fixtureId });
    expect(JSON.stringify(view.data)).not.toContain("ne doit jamais être lisible");
    const mine = await attacker.client.rpc("get_my_predictions", {});
    expect(mine.data).toEqual([]);
  });
});
