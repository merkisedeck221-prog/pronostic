import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Chaque Server Action d'administration doit refuser un utilisateur non admin
 * AVANT toute lecture ou écriture. requireAdmin() est simulé comme pour un
 * non-admin (notFound) ; tout accès à Supabase, aux tâches ou à l'IA échoue
 * le test. La liste des actions est découverte automatiquement : une
 * nouvelle action exportée est testée sans modification de ce fichier.
 */

const touched = vi.hoisted(() => ({ calls: [] as string[] }));
const forbid = (name: string) => () => {
  touched.calls.push(name);
  throw new Error(`ACCÈS INTERDIT ATTEINT : ${name}`);
};

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn(async () => {
    throw new Error("NOT_ADMIN");
  }),
  requireUser: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000001", profile: { is_banned: false } })),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(forbid("createClient")) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(forbid("createAdminClient")) }));
vi.mock("@/lib/sync", () => ({ runSyncJob: vi.fn(forbid("runSyncJob")), SYNC_JOBS: {} }));
vi.mock("@/lib/sync/runner", () => ({ runJob: vi.fn(forbid("runJob")) }));
vi.mock("@/lib/ai/pipeline", () => ({ generateForFixture: vi.fn(forbid("generateForFixture")) }));
vi.mock("@/lib/ai/context/build", () => ({ buildMatchContext: vi.fn(forbid("buildMatchContext")) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const MODULES = {
  competitions: () => import("./competitions"),
  matches: () => import("./matches"),
  users: () => import("./users"),
  pricing: () => import("./pricing"),
  packs: () => import("./packs"),
  settings: () => import("./settings"),
  sync: () => import("./sync"),
  credits: () => import("@/lib/credits/actions"),
  syncLegacy: () => import("@/lib/sync/actions"),
  aiLegacy: () => import("@/lib/ai/actions"),
} as const;

/** Formulaire plausible et VALIDE : le refus doit venir du rôle, pas de la validation. */
function validForm(): FormData {
  const form = new FormData();
  const values: Record<string, string> = {
    id: "1",
    fixtureId: "1",
    predictionId: "1",
    userId: "00000000-0000-4000-8000-000000000002",
    active: "true",
    published: "false",
    banned: "true",
    role: "admin",
    confirm: "PROMOUVOIR",
    amount: "10",
    reason: "Motif de test",
    reasoning: "Explication suffisamment longue pour être valide.",
    status: "hidden",
    sort_order: "1",
    api_league_id: "39",
    category: "club_league",
    mode: "both",
    scope: "match_bundle",
    credits: "7",
    name: "Pack test",
    bonus_credits: "0",
    price_xof: "1000",
    key: "maintenance_mode",
    value: "false",
    code: "BTTS",
    job: "settle-predictions",
  };
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
}

const ARGS_BY_NAME: Record<string, () => unknown[]> = {
  adminAdjustBalanceAction: () => ["00000000-0000-4000-8000-000000000002", 10, "Motif de test"],
  runSyncJobAction: () => ["settle-predictions"],
  regeneratePredictions: () => [1, "Motif de test"],
};

type Action = (...args: unknown[]) => Promise<unknown>;

async function allActions(): Promise<Array<[string, Action]>> {
  const entries: Array<[string, Action]> = [];
  for (const [moduleName, load] of Object.entries(MODULES)) {
    const mod = (await load()) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== "function") continue;
      if (moduleName === "credits" && name !== "adminAdjustBalanceAction") continue; // unlockPredictionAction : utilisateur
      entries.push([`${moduleName}.${name}`, value as Action]);
    }
  }
  return entries;
}

beforeEach(() => {
  touched.calls = [];
});

describe("Server Actions admin : refus d'un utilisateur non admin", () => {
  it("découvre toutes les actions exportées", async () => {
    const actions = await allActions();
    expect(actions.length).toBeGreaterThanOrEqual(25);
  });

  it("chaque action rejette avant tout accès aux données", async () => {
    const actions = await allActions();
    for (const [name, action] of actions) {
      const short = name.split(".")[1];
      const args = ARGS_BY_NAME[short]?.() ?? [null, validForm()];
      await expect(action(...args), name).rejects.toThrow("NOT_ADMIN");
    }
    expect(touched.calls).toEqual([]);
  });
});
