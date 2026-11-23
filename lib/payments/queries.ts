import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Lectures liées aux recharges, avec la session de l'utilisateur (RLS : ses lignes uniquement). */

/** Packs actifs ET dans leur période d'offre (la base le revérifie à l'achat). */
export async function listActivePacks() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("credit_packs")
    .select("id, name, description, credits, bonus_credits, price_xof, available_until")
    .eq("is_active", true)
    .or(`available_from.is.null,available_from.lte."${now}"`)
    .or(`available_until.is.null,available_until.gt."${now}"`)
    .order("sort_order")
    .order("price_xof");
  if (error) throw new Error(`Packs indisponibles : ${error.message}`);
  return data ?? [];
}

export async function isMaintenanceMode(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
  return data?.value === true;
}

export async function getOwnTopup(userId: string, topupId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("topups")
    .select("id, status, provider, provider_ref, credits, bonus_credits, amount_xof, created_at, completed_at, pack:credit_packs(name)")
    .eq("id", topupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
