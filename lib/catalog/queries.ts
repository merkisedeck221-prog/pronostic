import "server-only";

import { cache } from "react";
import { FINISHED_STATUSES, NOT_PLAYED_STATUSES } from "@/lib/api-football/convert";
import { createClient } from "@/lib/supabase/server";
import { fixtureContextSchema, type FixtureContext } from "./context";

/**
 * Lectures du catalogue (compétitions, matchs, classements).
 * Toujours avec le client de l'utilisateur : la RLS ne laisse voir que les
 * compétitions actives et les matchs publiés (RG-F2-1). Aucune requête N+1 :
 * jointures PostgREST + un seul appel pour les pastilles « Pronostic disponible ».
 * Les pages ne contactent jamais API-Football.
 */

const FINAL_STATUSES = [...FINISHED_STATUSES, ...NOT_PLAYED_STATUSES] as const;
const notIn = (values: readonly string[]) => `(${values.join(",")})`;

/** Colonnes d'une ligne de match avec compétition et équipes (jointures). */
const FIXTURE_LIST_COLUMNS = `
  id, kickoff_at, status_short, round, goals_home, goals_away, ht_home, ht_away, venue,
  competition:competitions!inner(id, name, slug, logo_url, category, country, sort_order),
  home:teams!fixtures_home_team_id_fkey(id, name, logo_url),
  away:teams!fixtures_away_team_id_fkey(id, name, logo_url)
` as const;

export type CompetitionSummary = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  country: string | null;
  category: "club_league" | "international";
  type: string;
  current_season: number | null;
  coverage: unknown;
  upcomingCount: number;
};

/** Compétitions actives et nombre de matchs à venir sur 7 jours (2 requêtes). */
export async function getCompetitionsOverview(now: Date = new Date()): Promise<CompetitionSummary[]> {
  const supabase = await createClient();
  const in7days = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const [competitions, fixtures] = await Promise.all([
    supabase
      .from("competitions")
      .select("id, name, slug, logo_url, country, category, type, current_season, coverage")
      .order("sort_order")
      .order("name"),
    supabase
      .from("fixtures")
      .select("competition_id")
      .gte("kickoff_at", now.toISOString())
      .lt("kickoff_at", in7days)
      .not("status_short", "in", notIn(FINAL_STATUSES))
      .limit(5000),
  ]);
  if (competitions.error) throw new Error(`competitions : ${competitions.error.message}`);
  if (fixtures.error) throw new Error(`fixtures : ${fixtures.error.message}`);

  const counts = new Map<number, number>();
  for (const row of fixtures.data ?? []) counts.set(row.competition_id, (counts.get(row.competition_id) ?? 0) + 1);

  return (competitions.data ?? []).map((c) => ({ ...c, upcomingCount: counts.get(c.id) ?? 0 }));
}

/** Mis en cache pour la durée d'UNE requête (mise en page + page + métadonnées). */
export const getCompetitionBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, name, slug, logo_url, country, category, type, current_season, coverage")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`competition : ${error.message}`);
  return data; // null si inexistante ou inactive (RLS)
});

/** Matchs d'une compétition à venir ou en cours (60 au plus). */
export async function getCompetitionUpcoming(competitionId: number, now: Date = new Date()) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_LIST_COLUMNS)
    .eq("competition_id", competitionId)
    .gte("kickoff_at", new Date(now.getTime() - 3 * 3600 * 1000).toISOString())
    .not("status_short", "in", notIn(FINISHED_STATUSES))
    .order("kickoff_at")
    .limit(60);
  if (error) throw new Error(`fixtures : ${error.message}`);
  return data ?? [];
}

/** 10 derniers résultats d'une compétition. */
export async function getCompetitionResults(competitionId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_LIST_COLUMNS)
    .eq("competition_id", competitionId)
    .in("status_short", [...FINISHED_STATUSES])
    .order("kickoff_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(`résultats : ${error.message}`);
  return data ?? [];
}

/** Classement (saison en cours), groupé par poule. */
export async function getStandings(competitionId: number, season: number | null) {
  if (!season) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("standings")
    .select("id, group_name, rank, points, played, won, drawn, lost, goals_for, goals_against, form, team:teams!inner(id, name, logo_url)")
    .eq("competition_id", competitionId)
    .eq("season", season)
    .order("group_name")
    .order("rank")
    .limit(300);
  if (error) throw new Error(`classement : ${error.message}`);
  return data ?? [];
}

/** Matchs d'une période, éventuellement filtrés par compétition (300 au plus). */
export async function listFixtures(range: { from: Date; to: Date }, competitionId?: number) {
  const supabase = await createClient();
  let query = supabase
    .from("fixtures")
    .select(FIXTURE_LIST_COLUMNS)
    .gte("kickoff_at", range.from.toISOString())
    .lt("kickoff_at", range.to.toISOString())
    .order("kickoff_at")
    .limit(300);
  if (competitionId) query = query.eq("competition_id", competitionId);
  const { data, error } = await query;
  if (error) throw new Error(`matchs : ${error.message}`);
  return data ?? [];
}

export type FixtureListItem = Awaited<ReturnType<typeof listFixtures>>[number];

/**
 * Pastille « Pronostic disponible » : un seul appel pour toute la liste.
 * La fonction SQL ne renvoie qu'un booléen par match (aucun contenu).
 */
export async function getPredictionFlags(fixtureIds: number[]): Promise<Set<number>> {
  if (fixtureIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fixtures_with_prediction_flag", { p_fixture_ids: fixtureIds.slice(0, 500) });
  if (error) {
    console.error("[catalogue] pastilles indisponibles :", error.message);
    return new Set();
  }
  return new Set((data ?? []).filter((row) => row.has_prediction).map((row) => row.fixture_id));
}

/** Fiche match (null si inexistant, non publié ou compétition inactive → 404). */
export const getFixture = cache(async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(`${FIXTURE_LIST_COLUMNS}, status_long, season`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`match : ${error.message}`);
  return data;
});

/** Partie gratuite : forme, classement, confrontations (fonction SQL, jamais de pronostic). */
export async function getFixtureContext(id: number): Promise<FixtureContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_fixture_public_context", { p_fixture_id: id });
  if (error) {
    console.error("[catalogue] contexte indisponible :", error.message);
    return null;
  }
  if (!data) return null;
  const parsed = fixtureContextSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[catalogue] contexte illisible :", parsed.error.issues[0]?.message);
    return null;
  }
  return parsed.data;
}
