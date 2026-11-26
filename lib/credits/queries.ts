import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { TransactionFilter } from "./filters";
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
  "id" | "type" | "amount" | "balance_after" | "description" | "created_at" | "reference_type" | "reference_id"
>;

const walletSummarySchema = z.object({
  received: z.number().int(),
  consumed: z.number().int(),
  refunded: z.number().int(),
  count: z.number().int(),
});
export type WalletSummary = z.infer<typeof walletSummarySchema>;

/** Totaux reçus / consommés / remboursés de l'utilisateur connecté (calculés par la base, RLS). */
export async function getWalletSummary(): Promise<WalletSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_wallet_summary");
  if (error) {
    console.error("[credits] get_my_wallet_summary :", error.message);
    return null;
  }
  const parsed = walletSummarySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export type ReceiptRow = Pick<
  Tables<"topups">,
  "id" | "credits" | "bonus_credits" | "amount_xof" | "provider" | "provider_ref" | "completed_at" | "created_at"
> & { pack_name: string | null };

const RECEIPT_COLUMNS = "id, credits, bonus_credits, amount_xof, provider, provider_ref, completed_at, created_at, credit_packs(name)";

type ReceiptQueryRow = Omit<ReceiptRow, "pack_name"> & { credit_packs: { name: string } | null };

function toReceipt(row: ReceiptQueryRow): ReceiptRow {
  const { credit_packs, ...rest } = row;
  return { ...rest, pack_name: credit_packs?.name ?? null };
}

/** Recharges réussies de l'utilisateur (RLS : les siennes uniquement), plus récentes d'abord. */
export async function listReceipts(userId: string): Promise<ReceiptRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topups")
    .select(RECEIPT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .order("completed_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Reçus indisponibles : ${error.message}`);
  return (data ?? []).map(toReceipt);
}

/** Reçu d'une recharge réussie de l'utilisateur, sinon null (inconnue, d'un autre compte ou non payée). */
export async function getReceipt(userId: string, topupId: string): Promise<ReceiptRow | null> {
  if (!z.uuid().safeParse(topupId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("topups")
    .select(RECEIPT_COLUMNS)
    .eq("id", topupId)
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .maybeSingle();
  return data ? toReceipt(data) : null;
}

/** Historique paginé (page ≥ 1), du plus récent au plus ancien, éventuellement filtré. */
export async function listTransactions(
  userId: string,
  page: number,
  filter: TransactionFilter = "tous",
): Promise<{ rows: TransactionRow[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const from = (page - 1) * TRANSACTIONS_PAGE_SIZE;
  let query = supabase
    .from("credit_transactions")
    .select("id, type, amount, balance_after, description, created_at, reference_type, reference_id", {
      count: "exact",
    })
    .eq("user_id", userId);
  // Même règle que matchesTransactionFilter (lib/credits/filters.ts).
  if (filter === "achats") query = query.eq("type", "topup");
  else if (filter === "deblocages") query = query.eq("type", "unlock");
  else if (filter === "remboursements") query = query.eq("type", "refund");
  else if (filter === "ajustements") query = query.in("type", ["admin_adjustment", "bonus"]);
  else if (filter === "recus") query = query.gt("amount", 0).neq("type", "refund");
  else if (filter === "consommes") query = query.lt("amount", 0);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);
  if (error) throw new Error(`Historique indisponible : ${error.message}`);
  const total = count ?? 0;
  return { rows: data ?? [], total, pageCount: Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE)) };
}
