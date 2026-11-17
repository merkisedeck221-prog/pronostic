import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Promotion ADMIN_EMAILS : le client Supabase administrateur est simulé pour
 * vérifier la logique (e-mail listé, rôle « user » seulement, journal d'audit).
 */

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
let currentRole: string = "user";

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  calls.push(call);
  const api = {
    select: () => api,
    update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), api),
    insert: (payload: unknown) => {
      call.op = "insert";
      call.payload = payload;
      return Promise.resolve({ error: null });
    },
    eq: (column: string, value: unknown) => (call.filters.push([column, value]), api),
    single: () => Promise.resolve({ data: { role: currentRole }, error: null }),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: call.op === "update" ? [{ id: "u1" }] : null, error: null }),
  };
  return api;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}));

const { promoteIfAdminEmail } = await import("./admin-promotion");

beforeEach(() => {
  calls.length = 0;
  currentRole = "user";
  process.env.ADMIN_EMAILS = "boss@example.com, Second@Example.com";
});

describe("promoteIfAdminEmail", () => {
  it("ignore une adresse absente de ADMIN_EMAILS", async () => {
    expect(await promoteIfAdminEmail("u1", "someone@example.com")).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("promeut une adresse listée (casse ignorée) et journalise l'action", async () => {
    expect(await promoteIfAdminEmail("u1", "second@example.com")).toBe(true);
    const update = calls.find((c) => c.op === "update");
    expect(update).toMatchObject({ table: "profiles", payload: { role: "admin" } });
    expect(update?.filters).toEqual(expect.arrayContaining([["id", "u1"], ["role", "user"]]));
    const audit = calls.find((c) => c.table === "admin_audit_log");
    expect(audit).toMatchObject({
      op: "insert",
      payload: { action: "promote_admin", entity: "profiles", entity_id: "u1", before: { role: "user" }, after: { role: "admin" } },
    });
  });

  it("ne fait rien si le compte est déjà admin", async () => {
    currentRole = "admin";
    expect(await promoteIfAdminEmail("u1", "boss@example.com")).toBe(false);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });
});
