import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createFixtureWithPrediction,
  createTestUser,
  deleteFixture,
  deleteTestUser,
  seedCredits,
  serviceClient,
  type TestFixture,
  type TestUser,
} from "./helpers";

/**
 * Tests de sécurité de la base (cahier des charges, sections 10 et 11).
 * Toutes les vérifications passent par la clé PUBLIQUE, comme un navigateur.
 */

let alice: TestUser | undefined;
let bob: TestUser | undefined;
let fixture: TestFixture | undefined;

const terms = "2026-11-17T10:00:00.000Z";

beforeAll(async () => {
  alice = await createTestUser("alice", { display_name: "Alice", country: "BJ", terms_accepted_at: terms });
  bob = await createTestUser("bob", { display_name: "Bob", country: "SN", terms_accepted_at: terms });
  await seedCredits(alice.id, 10);
  await seedCredits(bob.id, 20);
  fixture = await createFixtureWithPrediction();
});

afterAll(async () => {
  await deleteFixture(fixture);
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

function users() {
  if (!alice || !bob || !fixture) throw new Error("Préparation des tests incomplète");
  return { alice, bob, fixture };
}

describe("Déclencheur handle_new_user", () => {
  it("crée le profil avec les métadonnées d'inscription", async () => {
    const { alice } = users();
    const { data, error } = await serviceClient.from("profiles").select("*").eq("id", alice.id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      display_name: "Alice",
      country: "BJ",
      role: "user",
      is_banned: false,
      timezone: "Africa/Porto-Novo",
    });
    expect(new Date(data!.terms_accepted_at!).toISOString()).toBe(terms);
  });

  it("crée le portefeuille (solde initial 0, avant les crédits de test)", async () => {
    const { alice } = users();
    const { data } = await serviceClient
      .from("credit_transactions")
      .select("amount, balance_after")
      .eq("user_id", alice.id)
      .order("id");
    // Un seul mouvement : celui ajouté par le test (welcome_credits = 0 par défaut).
    expect(data).toEqual([{ amount: 10, balance_after: 10 }]);
    const { data: wallet } = await serviceClient.from("wallets").select("balance").eq("user_id", alice.id).single();
    expect(wallet?.balance).toBe(10);
  });
});

describe("Isolation des données personnelles", () => {
  it("un utilisateur ne lit que son propre profil", async () => {
    const { alice } = users();
    const { data, error } = await alice.client.from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: alice.id }]);
  });

  it("un utilisateur ne lit que son propre portefeuille", async () => {
    const { alice } = users();
    const { data, error } = await alice.client.from("wallets").select("user_id, balance");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: alice.id, balance: 10 }]);
  });

  it("un utilisateur ne lit que ses propres transactions", async () => {
    const { alice, bob } = users();
    const { data, error } = await alice.client.from("credit_transactions").select("user_id");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.user_id === alice.id)).toBe(true);

    const { data: bobRows } = await alice.client.from("credit_transactions").select("id").eq("user_id", bob.id);
    expect(bobRows).toEqual([]);
  });

  it("un utilisateur ne peut pas modifier le profil d'un autre", async () => {
    const { alice, bob } = users();
    await alice.client.from("profiles").update({ display_name: "Piraté" }).eq("id", bob.id);
    const { data } = await serviceClient.from("profiles").select("display_name").eq("id", bob.id).single();
    expect(data?.display_name).toBe("Bob");
  });
});

describe("Intégrité des crédits (aucune écriture directe)", () => {
  it("un utilisateur ne peut pas modifier son solde", async () => {
    const { alice } = users();
    const { error } = await alice.client.from("wallets").update({ balance: 1_000_000 }).eq("user_id", alice.id);
    expect(error).not.toBeNull();
    const { data } = await serviceClient.from("wallets").select("balance").eq("user_id", alice.id).single();
    expect(data?.balance).toBe(10);
  });

  it("un utilisateur ne peut pas insérer de transaction", async () => {
    const { alice } = users();
    const { error } = await alice.client.from("credit_transactions").insert({
      user_id: alice.id,
      type: "bonus",
      amount: 500,
      balance_after: 510,
      description: "Tentative de fraude",
    });
    expect(error).not.toBeNull();
    const { count } = await serviceClient
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", alice.id);
    expect(count).toBe(1);
  });

  it("un utilisateur ne peut pas s'accorder un déblocage", async () => {
    const { alice, fixture } = users();
    const { error } = await alice.client
      .from("unlocks")
      .insert({ user_id: alice.id, fixture_id: fixture.fixtureId, market_code: null, credits_spent: 0 });
    expect(error).not.toBeNull();
  });

  it("un utilisateur ne peut pas créer de recharge", async () => {
    const { alice } = users();
    const { error } = await alice.client
      .from("topups")
      .insert({ user_id: alice.id, credits: 60, amount_xof: 1, provider: "mock", status: "succeeded" });
    expect(error).not.toBeNull();
  });
});

describe("Rôle admin et suspension", () => {
  it("un utilisateur ne peut pas s'attribuer le rôle admin", async () => {
    const { alice } = users();
    const { error } = await alice.client.from("profiles").update({ role: "admin" }).eq("id", alice.id);
    expect(error).not.toBeNull();
    const { data } = await serviceClient.from("profiles").select("role").eq("id", alice.id).single();
    expect(data?.role).toBe("user");
  });

  it("un utilisateur ne peut pas modifier son statut de suspension", async () => {
    const { alice } = users();
    const { error } = await alice.client.from("profiles").update({ is_banned: true }).eq("id", alice.id);
    expect(error).not.toBeNull();
  });

  it("un utilisateur peut modifier son nom d'affichage", async () => {
    const { alice } = users();
    const { error } = await alice.client.from("profiles").update({ display_name: "Alice B." }).eq("id", alice.id);
    expect(error).toBeNull();
    const { data } = await serviceClient.from("profiles").select("display_name").eq("id", alice.id).single();
    expect(data?.display_name).toBe("Alice B.");
  });
});

describe("Pronostics : aucune lecture directe", () => {
  it("la ligne de pronostic existe bien en base (contrôle)", async () => {
    const { fixture } = users();
    const { count } = await serviceClient
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("fixture_id", fixture.fixtureId);
    expect(count).toBe(1);
  });

  it("un utilisateur connecté sans déblocage obtient une liste vide", async () => {
    const { alice, fixture } = users();
    const { data, error } = await alice.client.from("predictions").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: filtered } = await alice.client.from("predictions").select("*").eq("fixture_id", fixture.fixtureId);
    expect(filtered).toEqual([]);
  });

  it("un visiteur anonyme obtient une liste vide", async () => {
    const { data, error } = await anonClient().from("predictions").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("l'analyse globale et le dossier de match sont invisibles", async () => {
    const { alice } = users();
    for (const table of ["prediction_analyses", "match_contexts", "prediction_revisions", "ai_generation_runs"] as const) {
      const { data, error } = await alice.client.from(table).select("id");
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("le match lui-même reste visible (partie gratuite)", async () => {
    const { alice, fixture } = users();
    const { data } = await alice.client.from("fixtures").select("id").eq("id", fixture.fixtureId);
    expect(data).toEqual([{ id: fixture.fixtureId }]);
  });
});

describe("Visiteur anonyme", () => {
  it("lit les marchés actifs", async () => {
    const { data, error } = await anonClient().from("markets").select("code").order("sort_order");
    expect(error).toBeNull();
    expect(data?.map((m) => m.code)).toEqual(
      expect.arrayContaining(["MATCH_RESULT", "EXACT_SCORE", "OVER_UNDER_2_5", "BTTS"]),
    );
  });

  it("lit les packs de recharge actifs", async () => {
    const { data, error } = await anonClient().from("credit_packs").select("name");
    expect(error).toBeNull();
    expect(data?.map((p) => p.name)).toEqual(expect.arrayContaining(["Découverte", "Standard", "Premium"]));
  });

  it("ne lit ni les profils, ni les portefeuilles, ni les transactions", async () => {
    const client = anonClient();
    for (const table of ["profiles", "wallets", "credit_transactions", "unlocks", "topups"] as const) {
      const { data } = await client.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("ne peut rien écrire", async () => {
    const { error } = await anonClient().from("markets").insert({ code: "HACK", label: "Piratage" });
    expect(error).not.toBeNull();
  });
});
