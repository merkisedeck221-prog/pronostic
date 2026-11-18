import { randomUUID } from "node:crypto";
import { fakeApiId, serviceClient } from "../security/helpers";

/**
 * Données de test des déblocages : une compétition active, deux équipes, un
 * match publié avec les 4 marchés et une analyse. Tout est créé avec la clé
 * secrète (préparation uniquement) puis supprimé.
 */

export const SECRET_MARKER = "CONTENU-SECRET-TEST";
export const MARKETS = ["MATCH_RESULT", "EXACT_SCORE", "OVER_UNDER_2_5", "BTTS"] as const;

export type CreditFixture = { competitionId: number; teamIds: [number, number]; fixtureIds: number[] };

export async function createCompetitionAndTeams(): Promise<Omit<CreditFixture, "fixtureIds">> {
  const suffix = randomUUID().slice(0, 8);
  const { data: competition, error: e1 } = await serviceClient
    .from("competitions")
    .insert({
      api_league_id: fakeApiId(),
      name: `Test crédits ${suffix}`,
      slug: `test-credits-${suffix}`,
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
      { api_team_id: fakeApiId(), name: `Arsenal test ${suffix}` },
      { api_team_id: fakeApiId(), name: `Chelsea test ${suffix}` },
    ])
    .select("id");
  if (e2 || !teams || teams.length !== 2) throw new Error(`teams : ${e2?.message}`);
  return { competitionId: competition.id, teamIds: [teams[0].id, teams[1].id] };
}

/** Match publié + 4 pronostics publiés + analyse. kickoffOffsetHours < 0 = match commencé. */
export async function createFixture(
  base: Omit<CreditFixture, "fixtureIds">,
  kickoffOffsetHours: number,
  statusShort = "NS",
): Promise<number> {
  const { data: fixture, error } = await serviceClient
    .from("fixtures")
    .insert({
      api_fixture_id: fakeApiId(),
      competition_id: base.competitionId,
      season: 2026,
      kickoff_at: new Date(Date.now() + kickoffOffsetHours * 3600 * 1000).toISOString(),
      status_short: statusShort,
      home_team_id: base.teamIds[0],
      away_team_id: base.teamIds[1],
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !fixture) throw new Error(`fixtures : ${error?.message}`);

  const rows = MARKETS.map((market) => ({
    fixture_id: fixture.id,
    market_code: market,
    selection: market === "MATCH_RESULT" ? "1" : market === "EXACT_SCORE" ? "2-1" : market === "BTTS" ? "yes" : "over",
    selection_label: `${SECRET_MARKER} sélection ${market}`,
    probability: 55,
    probabilities: market === "MATCH_RESULT" ? { home: 55, draw: 25, away: 20 } : null,
    confidence: "medium" as const,
    reasoning: `${SECRET_MARKER} explication ${market}`,
    prompt_version: "test",
  }));
  const { error: e2 } = await serviceClient.from("predictions").insert(rows);
  if (e2) throw new Error(`predictions : ${e2.message}`);

  const { error: e3 } = await serviceClient.from("prediction_analyses").insert({
    fixture_id: fixture.id,
    summary: `${SECRET_MARKER} analyse`,
    key_factors: [`${SECRET_MARKER} facteur`],
    model: "test",
    prompt_version: "test",
  });
  if (e3) throw new Error(`prediction_analyses : ${e3.message}`);
  return fixture.id;
}

export async function deleteCreditFixture(fx: CreditFixture | undefined): Promise<void> {
  if (!fx) return;
  if (fx.fixtureIds.length > 0) {
    await serviceClient.from("unlocks").delete().in("fixture_id", fx.fixtureIds);
    await serviceClient.from("fixtures").delete().in("id", fx.fixtureIds);
  }
  await serviceClient.from("teams").delete().in("id", fx.teamIds);
  await serviceClient.from("competitions").delete().eq("id", fx.competitionId);
}

/** Crédite un compte de test via admin_adjust_balance appelé avec la clé secrète (service_role). */
export async function credit(userId: string, amount: number): Promise<void> {
  const { data, error } = await serviceClient.rpc("admin_adjust_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: "Crédits de test (tests/credits)",
  });
  if (error || (data as { ok?: boolean } | null)?.ok !== true) {
    throw new Error(`admin_adjust_balance : ${error?.message ?? JSON.stringify(data)}`);
  }
}

export async function balanceOf(userId: string): Promise<number> {
  const { data, error } = await serviceClient.from("wallets").select("balance").eq("user_id", userId).single();
  if (error || !data) throw new Error(`wallets : ${error?.message}`);
  return data.balance;
}

export async function unlockTransactions(userId: string) {
  const { data, error } = await serviceClient
    .from("credit_transactions")
    .select("type, amount, balance_after, reference_type, reference_id, description")
    .eq("user_id", userId)
    .eq("type", "unlock")
    .order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function unlocksOf(userId: string, fixtureId: number) {
  const { data, error } = await serviceClient
    .from("unlocks")
    .select("market_code, credits_spent, transaction_id")
    .eq("user_id", userId)
    .eq("fixture_id", fixtureId)
    .order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Prix configuré (règle générale) d'un marché ou du match complet (null). */
export async function configuredPrice(market: string | null): Promise<number> {
  let query = serviceClient
    .from("pricing_rules")
    .select("credits")
    .eq("is_active", true)
    .is("competition_id", null)
    .eq("scope", market === null ? "match_bundle" : "market");
  query = market === null ? query.is("market_code", null) : query.eq("market_code", market);
  const { data, error } = await query.single();
  if (error || !data) throw new Error(`pricing_rules : ${error?.message}`);
  return data.credits;
}
