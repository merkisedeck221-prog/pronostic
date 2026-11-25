import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPerformanceStats } from "@/lib/settle/queries";

/**
 * Données RÉELLES de la page d'accueil (lecture publique, RLS) : types de
 * pronostics actifs, plus petit pack, performances. Chaque bloc est
 * facultatif : en cas d'erreur, la page affiche un état neutre, jamais un
 * chiffre inventé.
 */
export type LandingData = {
  markets: { code: string; label: string; description: string | null }[];
  cheapestPack: { credits: number; price_xof: number } | null;
  performance: { won: number; lost: number } | null;
};

export async function getLandingData(): Promise<LandingData> {
  const supabase = await createClient();
  const [markets, packs, performance] = await Promise.all([
    supabase.from("markets").select("code, label, description").eq("is_active", true).order("sort_order"),
    supabase.from("credit_packs").select("credits, price_xof").eq("is_active", true).order("price_xof").limit(1),
    getPerformanceStats().catch(() => null),
  ]);
  return {
    markets: markets.data ?? [],
    cheapestPack: packs.data?.[0] ?? null,
    performance: performance ? { won: performance.global.won, lost: performance.global.lost } : null,
  };
}
