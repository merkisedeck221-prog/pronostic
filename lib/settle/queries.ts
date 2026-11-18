import "server-only";

import { createClient } from "@/lib/supabase/server";
import { myPredictionsSchema, performanceStatsSchema, type MyPrediction, type PerformanceStats } from "./schemas";

/** Pronostics débloqués de l'utilisateur connecté (session ; jamais mis en cache). */
export async function getMyPredictions(limit = 200): Promise<MyPrediction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_predictions", { p_limit: limit });
  if (error) throw new Error(`Mes pronostics indisponibles : ${error.message}`);
  const parsed = myPredictionsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Réponse get_my_predictions invalide.");
  return parsed.data;
}

/** Statistiques publiques (fonctionne sans session). */
export async function getPerformanceStats(): Promise<PerformanceStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_performance_stats");
  if (error) throw new Error(`Performances indisponibles : ${error.message}`);
  const parsed = performanceStatsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Réponse get_performance_stats invalide.");
  return parsed.data;
}
