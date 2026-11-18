import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Lectures liées aux recharges, avec la session de l'utilisateur (RLS : ses lignes uniquement). */

export async function listActivePacks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_packs")
    .select("id, name, credits, bonus_credits, price_xof")
    .eq("is_active", true)
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
