import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPerformanceStats } from "@/lib/settle/queries";
import type { PerformanceStats } from "@/lib/settle/schemas";

/**
 * Données RÉELLES de la page d'accueil (lecture publique, RLS) : types de
 * pronostics actifs, packs, performances, aperçu des prochains matchs analysés.
 * Chaque bloc est facultatif : en cas d'erreur ou d'absence de données, la page
 * affiche un état neutre ou masque la section, jamais un chiffre inventé.
 */
export type LandingFixture = {
  id: number;
  kickoff_at: string;
  competition: string;
  home: { name: string; logo_url: string | null };
  away: { name: string; logo_url: string | null };
};

export type LandingData = {
  markets: { code: string; label: string; description: string | null }[];
  packs: { id: number; name: string; credits: number; price_xof: number; is_featured: boolean }[];
  /** Réponse complète de get_performance_stats() : même source que la page /performances. */
  performance: PerformanceStats | null;
  fixtures: LandingFixture[];
  /** Nombre réel de compétitions actives (couverture). */
  competitionCount: number;
};

const PREVIEW_HOURS = 72;
const PREVIEW_MAX = 4;

async function upcomingAnalysedFixtures(): Promise<LandingFixture[]> {
  const supabase = await createClient();
  const now = new Date();
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "id, kickoff_at, competition:competitions!inner(name), home:teams!fixtures_home_team_id_fkey(name, logo_url), away:teams!fixtures_away_team_id_fkey(name, logo_url)",
    )
    .in("status_short", ["NS", "TBD"])
    .gte("kickoff_at", now.toISOString())
    .lt("kickoff_at", new Date(now.getTime() + PREVIEW_HOURS * 3600 * 1000).toISOString())
    .order("kickoff_at")
    .limit(60);
  if (error || !data?.length) return [];
  // Uniquement les matchs qui ont réellement un pronostic publié (booléen, aucun contenu).
  const { data: flags } = await supabase.rpc("fixtures_with_prediction_flag", { p_fixture_ids: data.map((f) => f.id) });
  const withPrediction = new Set((flags ?? []).filter((row) => row.has_prediction).map((row) => row.fixture_id));
  return data
    .filter((f) => withPrediction.has(f.id))
    .slice(0, PREVIEW_MAX)
    .map((f) => ({ id: f.id, kickoff_at: f.kickoff_at, competition: f.competition.name, home: f.home, away: f.away }));
}

export async function getLandingData(): Promise<LandingData> {
  const supabase = await createClient();
  const [markets, packs, performance, fixtures, competitions] = await Promise.all([
    supabase.from("markets").select("code, label, description").eq("is_active", true).order("sort_order"),
    supabase.from("credit_packs").select("id, name, credits, price_xof, is_featured").eq("is_active", true).order("sort_order"),
    getPerformanceStats().catch(() => null),
    upcomingAnalysedFixtures().catch(() => []),
    supabase.from("competitions").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return {
    markets: markets.data ?? [],
    packs: packs.data ?? [],
    performance: performance ?? null,
    fixtures,
    competitionCount: competitions.error ? 0 : (competitions.count ?? 0),
  };
}
