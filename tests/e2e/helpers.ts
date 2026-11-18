import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

/** Outils des tests de bout en bout. La clé secrète ne sert qu'à préparer, contrôler et nettoyer. */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable ${name} manquante pour les tests de bout en bout (projet Supabase DEV).`);
  return value;
}

export const service = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function fakeApiId(): number {
  return -1 * (100_000_000 + Math.floor(Math.random() * 900_000_000));
}

export type E2eFixture = { competitionId: number; teamIds: [number, number]; fixtureId: number; home: string; away: string };

/** Compétition active + match publié dans 24 h avec les 4 marchés et l'analyse. */
export async function createE2eFixture(): Promise<E2eFixture> {
  const suffix = randomUUID().slice(0, 6);
  const home = `Lions E2E ${suffix}`;
  const away = `Aigles E2E ${suffix}`;
  const { data: c, error: e1 } = await service
    .from("competitions")
    .insert({ api_league_id: fakeApiId(), name: `Ligue E2E ${suffix}`, slug: `ligue-e2e-${suffix}`, category: "club_league", type: "league", is_active: true, sort_order: 0 })
    .select("id")
    .single();
  if (e1 || !c) throw new Error(`competitions : ${e1?.message}`);
  const { data: teams } = await service.from("teams").insert([{ api_team_id: fakeApiId(), name: home }, { api_team_id: fakeApiId(), name: away }]).select("id, name");
  const homeId = teams!.find((t) => t.name === home)!.id;
  const awayId = teams!.find((t) => t.name === away)!.id;
  const kickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: f, error: e2 } = await service
    .from("fixtures")
    .insert({ api_fixture_id: fakeApiId(), competition_id: c.id, season: 2026, kickoff_at: kickoff, original_kickoff_at: kickoff, home_team_id: homeId, away_team_id: awayId, is_published: true })
    .select("id")
    .single();
  if (e2 || !f) throw new Error(`fixtures : ${e2?.message}`);
  const predictions = [
    { market_code: "MATCH_RESULT", selection: "1", selection_label: `Victoire de ${home}`, probabilities: { home: 55, draw: 25, away: 20 } },
    { market_code: "EXACT_SCORE", selection: "2-1", selection_label: `${home} 2 – 1 ${away}`, probabilities: null },
    { market_code: "OVER_UNDER_2_5", selection: "OVER", selection_label: "Plus de 2,5 buts", probabilities: null },
    { market_code: "BTTS", selection: "YES", selection_label: "Les deux équipes marquent : oui", probabilities: null },
  ];
  const { error: e3 } = await service.from("predictions").insert(
    predictions.map((p) => ({ ...p, fixture_id: f.id, probability: 55, confidence: "medium" as const, reasoning: "Explication de test de bout en bout.", prompt_version: "e2e" })),
  );
  if (e3) throw new Error(`predictions : ${e3.message}`);
  await service.from("prediction_analyses").insert({ fixture_id: f.id, summary: "Analyse de test.", key_factors: ["Facteur 1", "Facteur 2", "Facteur 3"], model: "e2e", prompt_version: "e2e" });
  return { competitionId: c.id, teamIds: [homeId, awayId], fixtureId: f.id, home, away };
}

export async function deleteE2eFixture(fx: E2eFixture | undefined) {
  if (!fx) return;
  await service.from("unlocks").delete().eq("fixture_id", fx.fixtureId);
  await service.from("fixtures").delete().eq("id", fx.fixtureId);
  await service.from("teams").delete().in("id", fx.teamIds);
  await service.from("competitions").delete().eq("id", fx.competitionId);
}

export async function deleteUserByEmail(email: string) {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email === email);
  if (user) await service.auth.admin.deleteUser(user.id);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
}

export async function price(scope: "market" | "match_bundle", market?: string): Promise<number> {
  let q = service.from("pricing_rules").select("credits").eq("scope", scope).is("competition_id", null).eq("is_active", true);
  q = market ? q.eq("market_code", market) : q.is("market_code", null);
  const { data } = await q.single();
  return data!.credits;
}

/** Les erreurs de la console du navigateur sont relevées pour chaque test. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}
