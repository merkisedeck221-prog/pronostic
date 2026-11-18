import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { assertNotProduction } from "../guard";

/**
 * Outils des tests de sécurité.
 *
 * - `serviceClient` (clé secrète) sert UNIQUEMENT à préparer et nettoyer les
 *   données de test. Les vérifications se font avec la clé PUBLIQUE, comme le
 *   ferait n'importe quel navigateur.
 */

export type DB = SupabaseClient<Database>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Variable ${name} manquante : renseignez .env.local (projet Supabase de DÉVELOPPEMENT) avant npm run test:security.`,
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
assertNotProduction(SUPABASE_URL);
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Client « serveur » : contourne la RLS. Préparation et nettoyage uniquement. */
export const serviceClient: DB = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, noSession);

/** Client anonyme (visiteur), clé publique. */
export function anonClient(): DB {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, noSession);
}

export type TestUser = { id: string; email: string; password: string; client: DB };

/** Crée un utilisateur confirmé puis renvoie un client connecté avec la clé publique. */
export async function createTestUser(label: string, metadata: Record<string, unknown> = {}): Promise<TestUser> {
  const email = `security-test-${label}-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`Création de l'utilisateur de test impossible : ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Connexion de l'utilisateur de test impossible : ${signInError.message}`);

  return { id: data.user.id, email, password, client };
}

/** Supprime un utilisateur de test (profil, portefeuille et transactions suivent en cascade). */
export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await user.client.auth.signOut();
  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Suppression de l'utilisateur de test impossible : ${error.message}`);
}

/** Identifiant API-Football négatif et aléatoire : ne peut pas entrer en collision avec de vraies données. */
export function fakeApiId(): number {
  return -1 * (100_000_000 + Math.floor(Math.random() * 900_000_000));
}

export type TestFixture = { competitionId: number; teamIds: [number, number]; fixtureId: number };

/** Crée une compétition active, deux équipes, un match publié et un pronostic (via la clé secrète). */
export async function createFixtureWithPrediction(): Promise<TestFixture> {
  const suffix = randomUUID().slice(0, 8);

  const { data: competition, error: e1 } = await serviceClient
    .from("competitions")
    .insert({
      api_league_id: fakeApiId(),
      name: `Test sécurité ${suffix}`,
      slug: `test-securite-${suffix}`,
      category: "club_league",
      type: "league",
      is_active: true,
    })
    .select("id")
    .single();
  if (e1 || !competition) throw new Error(`competitions : ${e1?.message}`);

  const { data: teams, error: e2 } = await serviceClient
    .from("teams")
    .insert([
      { api_team_id: fakeApiId(), name: `Domicile ${suffix}` },
      { api_team_id: fakeApiId(), name: `Extérieur ${suffix}` },
    ])
    .select("id");
  if (e2 || !teams || teams.length !== 2) throw new Error(`teams : ${e2?.message}`);

  const { data: fixture, error: e3 } = await serviceClient
    .from("fixtures")
    .insert({
      api_fixture_id: fakeApiId(),
      competition_id: competition.id,
      season: 2026,
      kickoff_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      home_team_id: teams[0].id,
      away_team_id: teams[1].id,
      is_published: true,
    })
    .select("id")
    .single();
  if (e3 || !fixture) throw new Error(`fixtures : ${e3?.message}`);

  const { error: e4 } = await serviceClient.from("predictions").insert({
    fixture_id: fixture.id,
    market_code: "MATCH_RESULT",
    selection: "1",
    selection_label: "Victoire de Domicile",
    probability: 52,
    probabilities: { home: 52, draw: 26, away: 22 },
    confidence: "medium",
    reasoning: "Pronostic de test : ne doit jamais être lisible sans déblocage.",
    prompt_version: "test",
  });
  if (e4) throw new Error(`predictions : ${e4.message}`);

  const { error: e5 } = await serviceClient.from("prediction_analyses").insert({
    fixture_id: fixture.id,
    summary: "Analyse de test.",
    key_factors: ["facteur"],
    model: "test",
    prompt_version: "test",
  });
  if (e5) throw new Error(`prediction_analyses : ${e5.message}`);

  const { error: e6 } = await serviceClient
    .from("match_contexts")
    .insert({ fixture_id: fixture.id, raw: { secret: true }, summary: { secret: true } });
  if (e6) throw new Error(`match_contexts : ${e6.message}`);

  return { competitionId: competition.id, teamIds: [teams[0].id, teams[1].id], fixtureId: fixture.id };
}

/** Supprime le match de test (pronostics, analyse et dossier suivent en cascade), les équipes et la compétition. */
export async function deleteFixture(fx: TestFixture | undefined): Promise<void> {
  if (!fx) return;
  await serviceClient.from("fixtures").delete().eq("id", fx.fixtureId);
  await serviceClient.from("teams").delete().in("id", fx.teamIds);
  await serviceClient.from("competitions").delete().eq("id", fx.competitionId);
}

/**
 * Ajoute un mouvement de crédits cohérent (portefeuille + registre) via la clé
 * secrète, pour simuler ce que feront les fonctions SQL des phases 7 et 8.
 */
export async function seedCredits(userId: string, amount: number): Promise<void> {
  const { data: wallet, error: e1 } = await serviceClient
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();
  if (e1 || !wallet) throw new Error(`wallets : ${e1?.message}`);

  const balance = wallet.balance + amount;
  const { error: e2 } = await serviceClient.from("wallets").update({ balance }).eq("user_id", userId);
  if (e2) throw new Error(`wallets update : ${e2.message}`);

  const { error: e3 } = await serviceClient.from("credit_transactions").insert({
    user_id: userId,
    type: "bonus",
    amount,
    balance_after: balance,
    reference_type: "security_test",
    description: "Crédits de test",
  });
  if (e3) throw new Error(`credit_transactions : ${e3.message}`);
}
