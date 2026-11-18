import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TopupCsvRow, TransactionCsvRow } from "./csv";
import { first, parseEnumParam, parseTextParam, periodStart, PERIODS, type Period, type SearchParams } from "./params";

/** Filtres communs à la page /admin/transactions et à son export CSV. */

export const TRANSACTION_TYPES = ["tous", "topup", "unlock", "bonus", "refund", "admin_adjustment"] as const;
export const TOPUP_STATUSES = ["tous", "pending", "succeeded", "failed", "cancelled"] as const;
export const VIEWS = ["mouvements", "recharges"] as const;

export type TransactionFilters = {
  view: (typeof VIEWS)[number];
  type: (typeof TRANSACTION_TYPES)[number];
  topupStatus: (typeof TOPUP_STATUSES)[number];
  period: Period;
  user: string;
};

export function parseTransactionFilters(params: SearchParams): TransactionFilters {
  return {
    view: parseEnumParam(params.vue, VIEWS, "mouvements"),
    type: parseEnumParam(params.type, TRANSACTION_TYPES, "tous"),
    topupStatus: parseEnumParam(params.statut, TOPUP_STATUSES, "tous"),
    period: parseEnumParam(params.periode, PERIODS, "30j"),
    user: parseTextParam(first(params.utilisateur), 120),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Utilisateur : identifiant exact, sinon recherche par e-mail ou nom (50 comptes au plus). null = pas de filtre. */
async function resolveUserIds(user: string): Promise<string[] | null> {
  if (!user) return null;
  if (UUID.test(user)) return [user.toLowerCase()];
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", { p_search: user, p_limit: 50, p_offset: 0 });
  const rows = ((data as { rows?: Array<{ id: string }> } | null)?.rows ?? []).map((r) => r.id);
  return rows;
}

export async function queryTransactions(filters: TransactionFilters, range: { from: number; to: number }) {
  const supabase = await createClient();
  const userIds = await resolveUserIds(filters.user);
  if (userIds && userIds.length === 0) return { rows: [] as TransactionCsvRow[], total: 0 };
  let q = supabase
    .from("credit_transactions")
    .select("id, created_at, user_id, type, amount, balance_after, description, reference_type, reference_id, profile:profiles!credit_transactions_user_id_fkey(display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (filters.type !== "tous") q = q.eq("type", filters.type);
  const start = periodStart(filters.period);
  if (start) q = q.gte("created_at", start.toISOString());
  if (userIds) q = q.in("user_id", userIds);
  const { data, count, error } = await q.range(range.from, range.to);
  if (error) throw new Error(`transactions : ${error.message}`);
  const rows: TransactionCsvRow[] = (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    display_name: r.profile?.display_name ?? null,
    type: r.type,
    amount: r.amount,
    balance_after: r.balance_after,
    description: r.description,
    reference_type: r.reference_type,
    reference_id: r.reference_id,
  }));
  return { rows, total: count ?? 0 };
}

export async function queryTopups(filters: TransactionFilters, range: { from: number; to: number }) {
  const supabase = await createClient();
  const userIds = await resolveUserIds(filters.user);
  if (userIds && userIds.length === 0) return { rows: [] as TopupCsvRow[], total: 0 };
  let q = supabase
    .from("topups")
    .select("id, created_at, user_id, credits, bonus_credits, amount_xof, provider, provider_ref, status, completed_at, pack:credit_packs(name), profile:profiles!topups_user_id_fkey(display_name)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (filters.topupStatus !== "tous") q = q.eq("status", filters.topupStatus);
  const start = periodStart(filters.period);
  if (start) q = q.gte("created_at", start.toISOString());
  if (userIds) q = q.in("user_id", userIds);
  const { data, count, error } = await q.range(range.from, range.to);
  if (error) throw new Error(`recharges : ${error.message}`);
  const rows: TopupCsvRow[] = (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    display_name: r.profile?.display_name ?? null,
    pack: r.pack?.name ?? null,
    credits: r.credits,
    bonus_credits: r.bonus_credits,
    amount_xof: r.amount_xof,
    provider: r.provider,
    provider_ref: r.provider_ref,
    status: r.status,
    completed_at: r.completed_at,
  }));
  return { rows, total: count ?? 0 };
}

/** Limite de l'export CSV (vue filtrée). */
export const CSV_EXPORT_LIMIT = 10_000;
