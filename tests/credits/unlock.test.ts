import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, type TestUser } from "../security/helpers";
import {
  balanceOf,
  configuredPrice,
  createCompetitionAndTeams,
  createFixture,
  credit,
  deleteCreditFixture,
  SECRET_MARKER,
  unlocksOf,
  unlockTransactions,
  type CreditFixture,
} from "./helpers";

/**
 * Tests d'intégration OBLIGATOIRES de la phase 7, contre la base de DÉVELOPPEMENT.
 * Les appels se font avec la clé PUBLIQUE et la session de l'utilisateur, comme
 * depuis l'application ; la clé secrète ne sert qu'à préparer et vérifier.
 */

type Json = Record<string, unknown>;

let fx: CreditFixture | undefined;
let upcoming: number;
let started: number;
const users: TestUser[] = [];

async function user(label: string, credits: number): Promise<TestUser> {
  const u = await createTestUser(`credits-${label}`);
  users.push(u);
  if (credits > 0) await credit(u.id, credits);
  return u;
}

async function unlock(u: TestUser, fixtureId: number, market: string | null): Promise<Json> {
  const { data, error } = await u.client.rpc("unlock_prediction", { p_fixture_id: fixtureId, p_market_code: market ?? "" });
  if (error) return { ok: false, code: error.message.includes("ALREADY_UNLOCKED") ? "ALREADY_UNLOCKED" : `SQL:${error.message}` };
  return data as Json;
}

beforeAll(async () => {
  const base = await createCompetitionAndTeams();
  fx = { ...base, fixtureIds: [] };
  upcoming = await createFixture(base, 24);
  fx.fixtureIds.push(upcoming);
  started = await createFixture(base, -0.25, "1H");
  fx.fixtureIds.push(started);
});

afterAll(async () => {
  for (const u of users) await deleteTestUser(u);
  await deleteCreditFixture(fx);
});

describe("unlock_prediction", () => {
  it("1. déblocage normal : solde, transaction, unlock et is_locked", async () => {
    const price = await configuredPrice("MATCH_RESULT");
    const u = await user("normal", 10);

    const result = await unlock(u, upcoming, "MATCH_RESULT");
    expect(result).toMatchObject({ ok: true, new_balance: 10 - price, credits_spent: price });

    expect(await balanceOf(u.id)).toBe(10 - price);

    const txs = await unlockTransactions(u.id);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      type: "unlock",
      amount: -price,
      balance_after: 10 - price,
      reference_type: "fixture",
      reference_id: String(upcoming),
    });
    expect(txs[0].description).toMatch(/^Déblocage : Arsenal test .+ – Chelsea test .+, Résultat du match/);

    const unlocks = await unlocksOf(u.id, upcoming);
    expect(unlocks).toEqual([expect.objectContaining({ market_code: "MATCH_RESULT", credits_spent: price })]);
    expect(unlocks[0].transaction_id).not.toBeNull();

    const { data: preds } = await serviceClient.from("predictions").select("market_code, is_locked").eq("fixture_id", upcoming);
    const locked = Object.fromEntries((preds ?? []).map((p) => [p.market_code, p.is_locked]));
    expect(locked.MATCH_RESULT).toBe(true);

    // Le contenu est maintenant lisible par cet utilisateur, et seulement ce marché.
    const { data: view } = await u.client.rpc("get_fixture_predictions", { p_fixture_id: upcoming });
    const markets = (view as { markets: Json[] }).markets;
    expect(markets.find((m) => m.code === "MATCH_RESULT")).toMatchObject({ unlocked: true, revealed: true });
    expect(markets.find((m) => m.code === "BTTS")).not.toHaveProperty("selection_label");

    // Deuxième tentative : refus, aucun débit.
    expect(await unlock(u, upcoming, "MATCH_RESULT")).toMatchObject({ ok: false, code: "ALREADY_UNLOCKED" });
    expect(await balanceOf(u.id)).toBe(10 - price);
  });

  it("2. 5 appels simultanés au même déblocage : un seul débit", async () => {
    const price = await configuredPrice("BTTS");
    const u = await user("concurrent", 10);

    const results = await Promise.all(Array.from({ length: 5 }, () => unlock(u, upcoming, "BTTS")));
    const successes = results.filter((r) => r.ok === true);
    const refusals = results.filter((r) => r.ok === false);

    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(4);
    for (const r of refusals) expect(r.code).toBe("ALREADY_UNLOCKED");

    expect(await balanceOf(u.id)).toBe(10 - price);
    expect(await unlockTransactions(u.id)).toHaveLength(1);
    expect(await unlocksOf(u.id, upcoming)).toHaveLength(1);
  });

  it("3. solde insuffisant : refus et aucun changement", async () => {
    const price = await configuredPrice("EXACT_SCORE");
    const u = await user("poor", price - 1);

    const result = await unlock(u, upcoming, "EXACT_SCORE");
    expect(result).toMatchObject({ ok: false, code: "INSUFFICIENT_BALANCE", price, balance: price - 1 });

    expect(await balanceOf(u.id)).toBe(price - 1);
    expect(await unlockTransactions(u.id)).toHaveLength(0);
    expect(await unlocksOf(u.id, upcoming)).toHaveLength(0);
  });

  it("4. match commencé : refus", async () => {
    const u = await user("late", 20);

    expect(await unlock(u, started, "MATCH_RESULT")).toMatchObject({ ok: false, code: "MATCH_STARTED" });
    expect(await unlock(u, started, null)).toMatchObject({ ok: false, code: "MATCH_STARTED" });

    expect(await balanceOf(u.id)).toBe(20);
    expect(await unlockTransactions(u.id)).toHaveLength(0);
    expect(await unlocksOf(u.id, started)).toHaveLength(0);
  });

  it("5. match complet après un marché : prix réduit et correct", async () => {
    const marketPrice = await configuredPrice("OVER_UNDER_2_5");
    const bundlePrice = await configuredPrice(null);
    const expected = Math.max(bundlePrice - marketPrice, 0);
    const u = await user("bundle", 20);

    expect(await unlock(u, upcoming, "OVER_UNDER_2_5")).toMatchObject({ ok: true, credits_spent: marketPrice });

    const { data: price } = await u.client.rpc("get_unlock_price", { p_fixture_id: upcoming, p_market_code: "" });
    expect(price).toMatchObject({ ok: true, price: expected, base_price: bundlePrice, deduction: marketPrice });

    const result = await unlock(u, upcoming, null);
    expect(result).toMatchObject({ ok: true, credits_spent: expected, new_balance: 20 - marketPrice - expected });
    expect(await balanceOf(u.id)).toBe(20 - marketPrice - expected);

    // Un marché couvert par le match complet ne peut plus être acheté.
    expect(await unlock(u, upcoming, "EXACT_SCORE")).toMatchObject({ ok: false, code: "ALREADY_UNLOCKED" });
    expect(await unlock(u, upcoming, null)).toMatchObject({ ok: false, code: "ALREADY_UNLOCKED" });

    const { data: view } = await u.client.rpc("get_fixture_predictions", { p_fixture_id: upcoming });
    const v = view as { markets: Json[]; analysis: Json | null; match_bundle: Json };
    expect(v.markets.every((m) => m.revealed === true)).toBe(true);
    expect(v.analysis).not.toBeNull();
    expect(v.match_bundle).toMatchObject({ unlocked: true });
  });
});

describe("lecture des pronostics sans déblocage", () => {
  function expectNoLockedContent(view: unknown) {
    const v = view as { markets: Json[]; analysis: unknown; match_bundle: Json };
    expect(v.markets.length).toBe(4);
    for (const m of v.markets) {
      expect(m).toMatchObject({ unlocked: false, revealed: false });
      for (const key of ["selection", "selection_label", "probability", "probabilities", "confidence", "reasoning", "result"]) {
        expect(m).not.toHaveProperty(key);
      }
      expect(typeof m.price).toBe("number");
    }
    expect(v.analysis).toBeNull();
    expect(typeof v.match_bundle.price).toBe("number");
    expect(JSON.stringify(view)).not.toContain(SECRET_MARKER);
  }

  it("6a. get_fixture_predictions pour un utilisateur sans déblocage : aucun contenu verrouillé", async () => {
    const u = await user("viewer", 0);
    const { data, error } = await u.client.rpc("get_fixture_predictions", { p_fixture_id: upcoming });
    expect(error).toBeNull();
    expectNoLockedContent(data);
  });

  it("6b. get_fixture_predictions pour un visiteur anonyme : aucun contenu verrouillé", async () => {
    const { data, error } = await anonClient().rpc("get_fixture_predictions", { p_fixture_id: upcoming });
    expect(error).toBeNull();
    expectNoLockedContent(data);
  });

  it("7. lecture directe de predictions et prediction_analyses avec la clé publique : vide", async () => {
    const anon = anonClient();
    // Même un utilisateur qui a débloqué ne lit rien directement : seule la fonction SQL renvoie le contenu.
    const buyer = await user("direct", 10);
    expect(await unlock(buyer, upcoming, "MATCH_RESULT")).toMatchObject({ ok: true });

    for (const client of [anon, buyer.client]) {
      const p = await client.from("predictions").select("*").eq("fixture_id", upcoming);
      expect(p.data ?? []).toEqual([]);
      const a = await client.from("prediction_analyses").select("*").eq("fixture_id", upcoming);
      expect(a.data ?? []).toEqual([]);
    }
  });
});

describe("admin_adjust_balance", () => {
  it("8. appelé par un non-admin : refus, solde inchangé", async () => {
    const u = await user("cheater", 0);
    const { data, error } = await u.client.rpc("admin_adjust_balance", { p_user_id: u.id, p_amount: 1000, p_reason: "triche" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await balanceOf(u.id)).toBe(0);

    // Visiteur anonyme : la fonction n'est même pas exécutable.
    const anon = await anonClient().rpc("admin_adjust_balance", { p_user_id: u.id, p_amount: 1000, p_reason: "triche" });
    expect(anon.error).not.toBeNull();
    expect(await balanceOf(u.id)).toBe(0);
  });

  it("refuse un solde négatif et un motif vide (via le serveur)", async () => {
    const u = await user("adjust", 5);
    const negative = await serviceClient.rpc("admin_adjust_balance", { p_user_id: u.id, p_amount: -6, p_reason: "correction" });
    expect(negative.data).toMatchObject({ ok: false, code: "INSUFFICIENT_BALANCE" });
    const noReason = await serviceClient.rpc("admin_adjust_balance", { p_user_id: u.id, p_amount: 1, p_reason: "  " });
    expect(noReason.data).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await balanceOf(u.id)).toBe(5);
  });
});
