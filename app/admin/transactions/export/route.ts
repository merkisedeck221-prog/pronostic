import { TOPUP_CSV_COLUMNS, TRANSACTION_CSV_COLUMNS, toCsv } from "@/lib/admin/csv";
import { CSV_EXPORT_LIMIT, parseTransactionFilters, queryTopups, queryTransactions } from "@/lib/admin/transactions";
import { requireAdmin } from "@/lib/auth/session";

/** Export CSV de la vue filtrée de /admin/transactions (admin uniquement, jamais mis en cache). */
export async function GET(request: Request) {
  await requireAdmin();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseTransactionFilters(params);
  const range = { from: 0, to: CSV_EXPORT_LIMIT - 1 };
  const body =
    filters.view === "recharges"
      ? toCsv(TOPUP_CSV_COLUMNS, (await queryTopups(filters, range)).rows)
      : toCsv(TRANSACTION_CSV_COLUMNS, (await queryTransactions(filters, range)).rows);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filters.view}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
