import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, fakeApiId, serviceClient, SUPABASE_URL, type TestUser } from "./helpers";

/**
 * Catalogue (phase 5) : la partie gratuite d'une fiche match ne doit JAMAIS
 * exposer de contenu de pronostic, et un match invisible renvoie une 404.
 */

const BASE_URL = process.env.APP_BASE_URL ?? `http://localhost:${process.env.TEST_APP_PORT ?? "3210"}`;

/** Clés et valeurs qui ne doivent jamais apparaître dans la partie gratuite. */
const FORBIDDEN = [
  "provider_prediction",
  "advice",
  "percent",
  "selection",
  "selection_label",
  "probability",
  "probabilities",
  "confidence",
  "reasoning",
  "key_factors",
  "SECRET_REASONING",
  "SECRET_ADVICE",
  "SECRET_SUMMARY",
];

let user: TestUser | undefined;
const created = { competitions: [] as number[], teams: [] as number[], fixtures: [] as number[] };
let visibleFixtureId = 0;
let hiddenFixtureId = 0;
let inactiveFixtureId = 0;
let inactiveSlug = "";

async function insertOne<T extends { id: number }>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error || !data) throw new Error(error?.message ?? "insertion impossible");
  return data.id;
}

beforeAll(async () => {
  user = await createTestUser("catalog", { display_name: "Catalogue", terms_accepted: true });
  const suffix = randomUUID().slice(0, 8);
  inactiveSlug = `test-inactive-${suffix}`;

  const active = await insertOne(
    serviceClient
      .from("competitions")
      .insert({ api_league_id: fakeApiId(), name: "Test actif", slug: `test-actif-${suffix}`, category: "club_league", type: "league", is_active: true, current_season: 2026 })
      .select("id")
      .single(),
  );
  const inactive = await insertOne(
    serviceClient
      .from("competitions")
      .insert({ api_league_id: fakeApiId(), name: "Test inactif", slug: inactiveSlug, category: "club_league", type: "league", is_active: false, current_season: 2026 })
      .select("id")
      .single(),
  );
  created.competitions.push(active, inactive);

  const { data: teams, error } = await serviceClient
    .from("teams")
    .insert([
      { api_team_id: fakeApiId(), name: `Alpha ${suffix}` },
      { api_team_id: fakeApiId(), name: `Beta ${suffix}` },
    ])
    .select("id");
  if (error || !teams) throw new Error(error?.message);
  const [a, b] = teams.map((t) => t.id);
  created.teams.push(a, b);

  const day = 24 * 3600 * 1000;
  const fixture = (competition: number, offsetDays: number, extra: Record<string, unknown> = {}) =>
    insertOne(
      serviceClient
        .from("fixtures")
        .insert({
          api_fixture_id: fakeApiId(),
          competition_id: competition,
          season: 2026,
          kickoff_at: new Date(Date.now() + offsetDays * day).toISOString(),
          home_team_id: a,
          away_team_id: b,
          ...extra,
        })
        .select("id")
        .single(),
    );

  // Historique terminé (forme + confrontations), match à venir visible, caché, et compétition inactive.
  created.fixtures.push(await fixture(active, -10, { status_short: "FT", goals_home: 2, goals_away: 1 }));
  visibleFixtureId = await fixture(active, 1);
  hiddenFixtureId = await fixture(active, 2, { is_published: false });
  inactiveFixtureId = await fixture(inactive, 2);
  created.fixtures.push(visibleFixtureId, hiddenFixtureId, inactiveFixtureId);

  await serviceClient.from("standings").insert({ competition_id: active, season: 2026, team_id: a, rank: 1, points: 30, played: 12, form: "WWDWW" });
  await serviceClient.from("predictions").insert({
    fixture_id: visibleFixtureId,
    market_code: "MATCH_RESULT",
    selection: "1",
    selection_label: "Victoire de Alpha",
    probability: 52,
    probabilities: { home: 52, draw: 26, away: 22 },
    confidence: "medium",
    reasoning: "SECRET_REASONING",
    prompt_version: "test",
  });
  await serviceClient.from("prediction_analyses").insert({
    fixture_id: visibleFixtureId,
    summary: "SECRET_SUMMARY",
    key_factors: ["SECRET"],
    model: "test",
    prompt_version: "test",
  });
  await serviceClient.from("match_contexts").insert({
    fixture_id: visibleFixtureId,
    raw: { predictions: { advice: "SECRET_ADVICE" } },
    summary: {
      home: { last5: "WWDWL" },
      away: { last5: "LDWWL" },
      head_to_head: [{ date: "2024-04-12", home: "Beta", away: "Alpha", score: "1-1", advice: "SECRET_ADVICE" }],
      provider_prediction: { advice: "SECRET_ADVICE", percent: { home: "45%" } },
    },
  });
});

afterAll(async () => {
  if (created.fixtures.length) await serviceClient.from("fixtures").delete().in("id", created.fixtures);
  if (created.teams.length) await serviceClient.from("teams").delete().in("id", created.teams);
  if (created.competitions.length) await serviceClient.from("competitions").delete().in("id", created.competitions);
  await deleteTestUser(user);
});

describe("get_fixture_public_context", () => {
  it("renvoie la partie gratuite (forme, classement, confrontations)", async () => {
    const { data, error } = await user!.client.rpc("get_fixture_public_context", { p_fixture_id: visibleFixtureId });
    expect(error).toBeNull();
    const ctx = data as Record<string, unknown> & { home: { form: unknown[]; standing: { rank: number } }; head_to_head: unknown[] };
    expect(ctx.home.form.length).toBeGreaterThan(0);
    expect(ctx.home.standing.rank).toBe(1);
    expect(ctx.head_to_head.length).toBeGreaterThanOrEqual(1);
  });

  it("ne contient AUCUNE clé ni valeur de pronostic", async () => {
    const { data } = await user!.client.rpc("get_fixture_public_context", { p_fixture_id: visibleFixtureId });
    const text = JSON.stringify(data);
    for (const forbidden of FORBIDDEN) expect(text, forbidden).not.toContain(forbidden);
  });

  it("renvoie null pour un match non publié ou d'une compétition inactive", async () => {
    for (const id of [hiddenFixtureId, inactiveFixtureId]) {
      const { data, error } = await user!.client.rpc("get_fixture_public_context", { p_fixture_id: id });
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });
});

describe("fixtures_with_prediction_flag", () => {
  it("ne renvoie qu'un booléen, et seulement pour les matchs visibles", async () => {
    const { data, error } = await user!.client.rpc("fixtures_with_prediction_flag", {
      p_fixture_ids: [visibleFixtureId, hiddenFixtureId, inactiveFixtureId],
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ fixture_id: visibleFixtureId, has_prediction: true }]);
  });
});

describe("Pages du catalogue (application démarrée)", () => {
  let cookie = "";
  beforeAll(async () => {
    const jar = new Map<string, string>();
    const client = createServerClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    });
    await client.auth.signInWithPassword({ email: user!.email, password: user!.password });
    cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  });

  const get = (path: string) => fetch(`${BASE_URL}${path}`, { redirect: "manual", headers: { cookie } });

  it("fiche d'un match visible : 200, sans contenu de pronostic", async () => {
    const response = await get(`/matchs/${visibleFixtureId}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Pronostics IA");
    for (const secret of ["SECRET_REASONING", "SECRET_ADVICE", "SECRET_SUMMARY"]) expect(html).not.toContain(secret);
  });

  it("match non publié, de compétition inactive ou inexistant : 404", async () => {
    for (const path of [`/matchs/${hiddenFixtureId}`, `/matchs/${inactiveFixtureId}`, "/matchs/999999999", "/matchs/abc"]) {
      expect((await get(path)).status, path).toBe(404);
    }
  });

  it("compétition inactive : 404", async () => {
    expect((await get(`/competitions/${inactiveSlug}`)).status).toBe(404);
  });
});
