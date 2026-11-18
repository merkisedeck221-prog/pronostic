import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { parseFixturePredictions, parsePriceResult, type PriceOutcome } from "./parse";
import type { FixturePredictions } from "./schemas";

/**
 * Lectures liées aux crédits, avec la session de l'utilisateur (RLS).
 * Rien n'est mis en cache côté serveur : le contenu dépend de l'utilisateur.
 */

/** Pronostics d'un match pour l'utilisateur courant (contenu seulement si débloqué). */
export async function getFixturePredictions(fixtureId: number): Promise<FixturePredictions | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_fixture_predictions", { p_fixture_id: fixtureId });
  if (error) {
    console.error("[credits] get_fixture_predictions :", error.message);
    return null;
  }
  return parseFixturePredictions(data);
}

/** Prix d'un marché, ou du match complet (marketCode null), calculé par la base. */
export async function getUnlockPrice(fixtureId: number, marketCode: string | null): Promise<PriceOutcome> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unlock_price", {
    p_fixture_id: fixtureId,
    p_market_code: marketCode ?? "",
  });
  return error ? parsePriceResult(null) : parsePriceResult(data);
}

/** Solde de l'utilisateur connecté (RLS : sa propre ligne uniquement). */
export async function getWalletBalance(userId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  return data?.balance ?? null;
}

export const TRANSACTIONS_PAGE_SIZE = 20;

export type TransactionRow = Pick<
  Tables<"credit_transactions">,
  "id" | "type" | "amount" | "balance_after" | "description" | "created_at"
>;

/** Historique paginé (page ≥ 1), du plus récent au plus ancien. */
export async function listTransactions(
  userId: string,
  page: number,
): Promise<{ rows: TransactionRow[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const from = (page - 1) * TRANSACTIONS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, balance_after, description, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);
  if (error) throw new Error(`Historique indisponible : ${error.message}`);
  const total = count ?? 0;
  return { rows: data ?? [], total, pageCount: Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE)) };
}
