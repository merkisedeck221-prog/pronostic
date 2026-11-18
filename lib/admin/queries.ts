import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Appel d'une fonction SQL admin renvoyant du JSON ; lève une erreur lisible si refusée. */
export async function adminRpc<T>(fn: Parameters<Awaited<ReturnType<typeof createClient>>["rpc"]>[0], args?: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new Error(`${String(fn)} : ${error.message}`);
  const value = data as { ok?: boolean; code?: string } | null;
  if (!value || value.ok !== true) throw new Error(`${String(fn)} : ${value?.code ?? "réponse invalide"}`);
  return data as T;
}

export type AdminOverview = {
  users_total: number;
  users_7d: number;
  credits_sold: number;
  credits_spent: number;
  credits_refunded: number;
  credits_in_circulation: number;
  revenue_xof: number;
  upcoming_48h_with: number;
  upcoming_48h_without: number;
  today_without_prediction: Array<{ id: number; kickoff_at: string; home_name: string; away_name: string; competition_name: string }>;
  failed_jobs: Array<{ id: number; job: string; status: string; started_at: string; error: string | null }>;
  failed_ai: Array<{ id: number; fixture_id: number | null; model: string; prompt_version: string; created_at: string; error: string | null }>;
  quota_remaining: number | null;
  api_calls_today: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  role: "user" | "admin";
  is_banned: boolean;
  created_at: string;
  balance: number;
  unlocks: number;
  topups: number;
};
