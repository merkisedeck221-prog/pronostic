import { createServerClient } from "@supabase/ssr";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, SUPABASE_URL, type TestUser } from "./helpers";

/**
 * Protection des pages, testée de bout en bout contre l'application démarrée
 * (voir global-setup.ts) avec une VRAIE session Supabase dans les cookies.
 */

const BASE_URL = process.env.APP_BASE_URL ?? `http://localhost:${process.env.TEST_APP_PORT ?? "3210"}`;

/** Ouvre une session comme le ferait le navigateur et renvoie l'en-tête Cookie correspondant. */
async function sessionCookie(user: TestUser): Promise<string> {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Connexion impossible : ${error.message}`);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function get(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
}

let member: TestUser | undefined;
let memberCookie = "";

beforeAll(async () => {
  member = await createTestUser("member", { display_name: "Membre", country: "BJ", terms_accepted: true });
  memberCookie = await sessionCookie(member);
});

afterAll(async () => {
  await deleteTestUser(member);
});

describe("Visiteur non connecté", () => {
  it("est redirigé vers /connexion avec la page demandée", async () => {
    const response = await get("/tableau-de-bord");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(/\/connexion\?next=%2Ftableau-de-bord$/);
  });

  it("reçoit une 404 sur /admin", async () => {
    expect((await get("/admin")).status).toBe(404);
  });
});

describe("Utilisateur connecté, rôle user", () => {
  it("accède à son tableau de bord (contrôle : la session est valide)", async () => {
    const response = await get("/tableau-de-bord", memberCookie);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Bonjour Membre");
  });

  it("reçoit une 404 sur /admin", async () => {
    const response = await get("/admin", memberCookie);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Espace administrateur");
  });

  it("est redirigé de la page d'accueil vers son tableau de bord", async () => {
    const response = await get("/", memberCookie);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(/\/tableau-de-bord$/);
  });
});

describe("Changements de rôle et suspension (appliqués côté serveur)", () => {
  it("un admin accède à /admin", async () => {
    await serviceClient.from("profiles").update({ role: "admin" }).eq("id", member!.id);
    try {
      const response = await get("/admin", memberCookie);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Espace administrateur");
    } finally {
      await serviceClient.from("profiles").update({ role: "user" }).eq("id", member!.id);
    }
  });

  it("un compte suspendu voit le message de suspension et pas l'espace membre", async () => {
    await serviceClient.from("profiles").update({ is_banned: true }).eq("id", member!.id);
    try {
      const html = await (await get("/tableau-de-bord", memberCookie)).text();
      expect(html).toContain("Compte suspendu");
      expect(html).not.toContain("Bonjour Membre");
    } finally {
      await serviceClient.from("profiles").update({ is_banned: false }).eq("id", member!.id);
    }
  });

  it("un admin suspendu reçoit une 404 sur /admin", async () => {
    await serviceClient.from("profiles").update({ role: "admin", is_banned: true }).eq("id", member!.id);
    try {
      expect((await get("/admin", memberCookie)).status).toBe(404);
    } finally {
      await serviceClient.from("profiles").update({ role: "user", is_banned: false }).eq("id", member!.id);
    }
  });
});
