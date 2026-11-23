import "server-only";

import { getUnlockPrice } from "@/lib/credits/queries";
import { createClient } from "@/lib/supabase/server";

export type GenerationOption = { marketCode: string | null; label: string; price: number };

export type GenerationOffer = {
  /** Activée, dans la fenêtre avant le coup d'envoi, et au moins un type d'analyse a un prix. */
  available: boolean;
  enabled: boolean;
  windowHours: number;
  options: GenerationOption[];
  /** Demande en cours de l'utilisateur pour ce match (reprise après rechargement). */
  activeRequestId: string | null;
};

/**
 * Offre de génération à la demande pour un match sans pronostic : types
 * d'analyse actifs et prix CALCULÉS PAR LA BASE (affichage seulement ; le prix
 * est recalculé au moment de la réservation). Lectures avec la session (RLS).
 */
export async function getGenerationOffer(userId: string, fixtureId: number, kickoffAt: string): Promise<GenerationOffer> {
  const supabase = await createClient();
  const [{ data: settings }, { data: markets }, { data: active }] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["on_demand_generation_enabled", "on_demand_window_hours"]),
    supabase.from("markets").select("code, label").eq("is_active", true).order("sort_order"),
    supabase
      .from("generation_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("fixture_id", fixtureId)
      .in("status", ["reserved", "running"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const setting = (key: string) => settings?.find((s) => s.key === key)?.value;
  const enabled = setting("on_demand_generation_enabled") !== false;
  const windowValue = Number(setting("on_demand_window_hours"));
  const windowHours = Number.isInteger(windowValue) && windowValue > 0 ? windowValue : 168;

  const candidates: { marketCode: string | null; label: string }[] = [
    { marketCode: null, label: "Analyse complète du match" },
    ...(markets ?? []).map((m) => ({ marketCode: m.code, label: m.label })),
  ];
  const prices = await Promise.all(candidates.map((c) => getUnlockPrice(fixtureId, c.marketCode)));
  const options: GenerationOption[] = [];
  candidates.forEach((c, i) => {
    const p = prices[i];
    if (p.ok) options.push({ ...c, price: p.price });
  });

  // Indicatif : la base revérifie la fenêtre au moment de la réservation.
  const withinWindow = new Date(kickoffAt).getTime() - Date.now() <= windowHours * 3_600_000;
  return {
    available: enabled && withinWindow && options.length > 0,
    enabled,
    windowHours,
    options,
    activeRequestId: active?.[0]?.id ?? null,
  };
}
