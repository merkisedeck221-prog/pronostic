import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, type TestUser } from "../security/helpers";

/**
 * Tests d'intégration de la phase 10 (base de DÉVELOPPEMENT) : les fonctions
 * SQL d'administration refusent un non-admin ; l'ajustement de solde est
 * journalisé ; les écritures admin par la RLS sont refusées à un non-admin.
 */

let admin: TestUser;
let user: TestUser;

type Json = Record<string, unknown>;

beforeAll(async () => {
  admin = await createTestUser("admin-p10");
  user = await createTestUser("user-p10");
  // Promotion par la clé secrète (préparation uniquement).
  const { error } = await serviceClient.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  if (error) throw new Error(error.message);
});

afterAll(async () => {
  await serviceClient.from("admin_audit_log").delete().eq("admin_id", admin?.id ?? "");
  await deleteTestUser(user);
  await deleteTestUser(admin);
});

const ADMIN_CALLS: Array<[string, (u: TestUser) => Record<string, unknown>]> = [
  ["admin_overview", () => ({})],
  ["admin_list_users", () => ({ p_search: "" })],
  ["admin_get_user", (u) => ({ p_user_id: u.id })],
  ["admin_set_user_role", (u) => ({ p_user_id: u.id, p_role: "admin", p_reason: "auto-promotion" })],
  ["admin_set_user_banned", () => ({ p_user_id: "00000000-0000-4000-8000-000000000000", p_banned: true, p_reason: "test" })],
  ["admin_edit_prediction_text", () => ({ p_prediction_id: 1, p_reasoning: "Texte suffisamment long pour être valide.", p_reason: "test" })],
  ["admin_set_prediction_status", () => ({ p_prediction_id: 1, p_status: "hidden", p_reason: "test" })],
  ["admin_settle_fixture", () => ({ p_fixture_id: 1 })],
  ["admin_refund_fixture", () => ({ p_fixture_id: 1, p_reason: "test" })],
  ["admin_consistency_check", () => ({})],
  ["admin_cron_status", () => ({})],
  ["admin_ai_stats", () => ({})],
  ["admin_log_action", () => ({ p_action: "x", p_entity: "y", p_entity_id: "1", p_before: null, p_after: null })],
  ["admin_adjust_balance", (u) => ({ p_user_id: u.id, p_amount: 100, p_reason: "triche" })],
];

describe("fonctions SQL d'administration", () => {
  it("refusent un utilisateur connecté non admin (FORBIDDEN, aucun effet)", async () => {
    for (const [fn, args] of ADMIN_CALLS) {
      const { data, error } = await user.client.rpc(fn as never, args(user) as never);
      expect(error, fn).toBeNull();
      expect(data, fn).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
    const { data: profile } = await serviceClient.from("profiles").select("role").eq("id", user.id).single();
    expect(profile?.role).toBe("user");
    const { data: wallet } = await serviceClient.from("wallets").select("balance").eq("user_id", user.id).single();
    expect(wallet).toEqual({ balance: 0 });
  });

  it("ne sont pas exécutables par un visiteur anonyme", async () => {
    for (const [fn, args] of ADMIN_CALLS) {
      const { error } = await anonClient().rpc(fn as never, args(user) as never);
      expect(error, fn).not.toBeNull();
    }
  });

  it("l'ajustement de solde par un admin est journalisé (qui, quoi, avant, après, motif)", async () => {
    const { data, error } = await admin.client.rpc("admin_adjust_balance", { p_user_id: user.id, p_amount: 12, p_reason: "Geste commercial (test)" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, new_balance: 12 });

    const { data: log } = await serviceClient
      .from("admin_audit_log")
      .select("admin_id, action, entity, entity_id, before, after, reason")
      .eq("admin_id", admin.id)
      .eq("action", "adjust_balance")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(log).toMatchObject({
      admin_id: admin.id,
      action: "adjust_balance",
      entity: "wallets",
      entity_id: user.id,
      before: { balance: 0 },
      reason: "Geste commercial (test)",
    });
    expect((log?.after as Json).balance).toBe(12);
    expect((log?.after as Json).amount).toBe(12);

    const { data: tx } = await serviceClient.from("credit_transactions").select("type, amount, created_by").eq("user_id", user.id).single();
    expect(tx).toEqual({ type: "admin_adjustment", amount: 12, created_by: admin.id });
  });

  it("un admin ne peut ni se suspendre ni changer son propre rôle", async () => {
    const ban = await admin.client.rpc("admin_set_user_banned", { p_user_id: admin.id, p_banned: true, p_reason: "test" });
    expect(ban.data).toMatchObject({ ok: false, code: "SELF" });
    const role = await admin.client.rpc("admin_set_user_role", { p_user_id: admin.id, p_role: "user", p_reason: "test" });
    expect(role.data).toMatchObject({ ok: false, code: "SELF" });
  });

  it("la recherche d'utilisateurs par e-mail fonctionne pour l'admin", async () => {
    const { data } = await admin.client.rpc("admin_list_users", { p_search: user.email });
    expect(data).toMatchObject({ ok: true, total: 1 });
    expect(((data as { rows: Json[] }).rows[0] as Json).email).toBe(user.email);
  });
});

describe("écritures admin par la RLS", () => {
  it("refusées à un non-admin (paramètres, packs, tarifs, journal)", async () => {
    const { data: before } = await serviceClient.from("app_settings").select("value").eq("key", "maintenance_mode").single();
    await user.client.from("app_settings").update({ value: true }).eq("key", "maintenance_mode");
    const { data: after } = await serviceClient.from("app_settings").select("value").eq("key", "maintenance_mode").single();
    expect(after).toEqual(before);

    const pack = await user.client.from("credit_packs").insert({ name: "Pirate", credits: 9999, price_xof: 1 });
    expect(pack.error).not.toBeNull();
    const rule = await user.client.from("pricing_rules").insert({ scope: "match_bundle", credits: 0 });
    expect(rule.error).not.toBeNull();
    const audit = await user.client.from("admin_audit_log").insert({ action: "x", entity: "y" });
    expect(audit.error).not.toBeNull();
  });
});
