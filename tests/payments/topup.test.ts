import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSignedMockWebhook, mockProviderRef } from "@/lib/payments/mock";
import { processPaymentWebhook } from "@/lib/payments/webhook";
import { anonClient, createTestUser, deleteTestUser, serviceClient, type TestUser } from "../security/helpers";

/**
 * Tests d'intégration OBLIGATOIRES de la phase 8, contre la base de DÉVELOPPEMENT.
 * Le webhook est appelé avec le traitement réel de /api/payments/webhook/mock
 * (signature HMAC, recherche de la recharge, apply_topup avec la clé secrète).
 */

type Pack = { id: number; credits: number; bonus_credits: number; price_xof: number };

let pack: Pack;
const users: TestUser[] = [];

async function user(label: string): Promise<TestUser> {
  const u = await createTestUser(`topup-${label}`);
  users.push(u);
  return u;
}

/** Recharge créée comme le fait /recharger : create_topup (session) puis provider_ref (serveur). */
async function createTopup(u: TestUser): Promise<{ id: string; ref: string }> {
  const { data, error } = await u.client.rpc("create_topup", { p_pack_id: pack.id, p_provider: "mock" });
  const created = data as { ok: boolean; topup_id: string; amount_xof: number; credits: number; bonus_credits: number };
  if (error || !created?.ok) throw new Error(`create_topup : ${error?.message ?? JSON.stringify(data)}`);
  expect(created).toMatchObject({ amount_xof: pack.price_xof, credits: pack.credits, bonus_credits: pack.bonus_credits });
  const ref = mockProviderRef(created.topup_id);
  const { error: e2 } = await serviceClient.from("topups").update({ provider_ref: ref }).eq("id", created.topup_id);
  if (e2) throw new Error(e2.message);
  return { id: created.topup_id, ref };
}

async function balanceOf(userId: string): Promise<number> {
  const { data } = await serviceClient.from("wallets").select("balance").eq("user_id", userId).single();
  return data!.balance;
}

async function topupTransactions(userId: string) {
  const { data } = await serviceClient.from("credit_transactions").select("amount, balance_after, reference_id").eq("user_id", userId).eq("type", "topup");
  return data ?? [];
}

async function statusOf(topupId: string) {
  const { data } = await serviceClient.from("topups").select("status, completed_at").eq("id", topupId).single();
  return data!;
}

beforeAll(async () => {
  const { data, error } = await serviceClient
    .from("credit_packs")
    .select("id, credits, bonus_credits, price_xof")
    .eq("is_active", true)
    .gt("bonus_credits", 0)
    .order("sort_order")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Aucun pack actif avec bonus : ${error?.message}`);
  pack = data;
});

afterAll(async () => {
  for (const u of users) await deleteTestUser(u);
});

describe("recharge simulée", () => {
  it("1. recharge réussie : solde + crédits + bonus", async () => {
    const u = await user("ok");
    const { id, ref } = await createTopup(u);

    const response = await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "succeeded"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "succeeded", alreadyProcessed: false });

    const total = pack.credits + pack.bonus_credits;
    expect(await balanceOf(u.id)).toBe(total);
    expect(await topupTransactions(u.id)).toEqual([{ amount: total, balance_after: total, reference_id: id }]);
    const st = await statusOf(id);
    expect(st.status).toBe("succeeded");
    expect(st.completed_at).not.toBeNull();
  });

  it("2. même webhook reçu deux fois (et en parallèle) : un seul crédit, 200 à chaque fois", async () => {
    const u = await user("twice");
    const { ref } = await createTopup(u);

    const first = await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "succeeded"));
    const second = await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "succeeded"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, alreadyProcessed: true });

    // Rafale simultanée sur une autre recharge.
    const other = await createTopup(u);
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => processPaymentWebhook("mock", buildSignedMockWebhook(other.ref, "succeeded"))),
    );
    expect(burst.every((r) => r.status === 200)).toBe(true);

    const total = pack.credits + pack.bonus_credits;
    expect(await balanceOf(u.id)).toBe(2 * total);
    expect(await topupTransactions(u.id)).toHaveLength(2);
  });

  it("3. échec : aucun crédit, et un succès reçu ensuite est ignoré", async () => {
    const u = await user("failed");
    const { id, ref } = await createTopup(u);

    const failed = await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "failed"));
    expect(failed.status).toBe(200);
    expect((await statusOf(id)).status).toBe("failed");

    const late = await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "succeeded"));
    expect(late.status).toBe(200);
    expect(await late.json()).toMatchObject({ alreadyProcessed: true, status: "failed" });

    const cancelled = await createTopup(u);
    await processPaymentWebhook("mock", buildSignedMockWebhook(cancelled.ref, "cancelled"));
    expect((await statusOf(cancelled.id)).status).toBe("cancelled");

    expect(await balanceOf(u.id)).toBe(0);
    expect(await topupTransactions(u.id)).toHaveLength(0);
  });

  it("4. tentative de forcer un montant depuis le client : ignorée", async () => {
    const u = await user("cheat");

    // a. Paramètre de montant ajouté à l'appel : aucune fonction ne l'accepte, rien n'est créé.
    const forged = await u.client.rpc("create_topup" as never, { p_pack_id: pack.id, p_provider: "mock", p_amount_xof: 1, p_credits: 99999 } as never);
    expect(forged.error).not.toBeNull();

    // b. Insertion directe dans topups : refusée.
    const insert = await u.client.from("topups").insert({ user_id: u.id, credits: 99999, amount_xof: 1, provider: "mock", status: "succeeded" });
    expect(insert.error).not.toBeNull();

    // c. Modification directe du montant / des crédits / du statut : aucune ligne modifiée.
    const { id, ref } = await createTopup(u);
    await u.client.from("topups").update({ credits: 99999, amount_xof: 1, status: "succeeded" }).eq("id", id);
    const { data: row } = await serviceClient.from("topups").select("credits, amount_xof, status").eq("id", id).single();
    expect(row).toEqual({ credits: pack.credits, amount_xof: pack.price_xof, status: "pending" });

    // d. Le crédit final correspond au pack en base.
    await processPaymentWebhook("mock", buildSignedMockWebhook(ref, "succeeded"));
    expect(await balanceOf(u.id)).toBe(pack.credits + pack.bonus_credits);
    const { count } = await serviceClient.from("topups").select("id", { count: "exact", head: true }).eq("user_id", u.id);
    expect(count).toBe(1);
  });

  it("5. apply_topup appelé avec la clé publique : refus", async () => {
    const u = await user("apply");
    const { id } = await createTopup(u);

    const asUser = await u.client.rpc("apply_topup", { p_topup_id: id, p_status: "succeeded" });
    expect(asUser.error).not.toBeNull();
    const asAnon = await anonClient().rpc("apply_topup", { p_topup_id: id, p_status: "succeeded" });
    expect(asAnon.error).not.toBeNull();

    expect((await statusOf(id)).status).toBe("pending");
    expect(await balanceOf(u.id)).toBe(0);
  });

  it("webhook non authentique ou inconnu : refusé, aucun crédit", async () => {
    const u = await user("forged");
    const { id, ref } = await createTopup(u);

    const unsigned = new Request("http://internal/api/payments/webhook/mock", {
      method: "POST",
      body: JSON.stringify({ providerRef: ref, status: "succeeded" }),
    });
    expect((await processPaymentWebhook("mock", unsigned)).status).toBe(401);

    const signed = buildSignedMockWebhook(ref, "succeeded");
    const tampered = new Request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: JSON.stringify({ providerRef: ref, status: "failed" }),
    });
    expect((await processPaymentWebhook("mock", tampered)).status).toBe(401);

    const unknown = buildSignedMockWebhook(mockProviderRef("00000000-0000-4000-8000-000000000000"), "succeeded");
    expect((await processPaymentWebhook("mock", unknown)).status).toBe(404);
    expect((await processPaymentWebhook("paypal", buildSignedMockWebhook(ref, "succeeded"))).status).toBe(404);

    expect((await statusOf(id)).status).toBe("pending");
    expect(await balanceOf(u.id)).toBe(0);
  });
});
