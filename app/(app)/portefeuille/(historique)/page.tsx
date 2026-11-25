import type { Metadata } from "next";
import Link from "next/link";
import { CoinsIcon, GiftIcon, LockOpenIcon, RotateCcwIcon, SlidersHorizontalIcon, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { parseTransactionFilter, TRANSACTION_FILTERS, type TransactionFilter } from "@/lib/credits/filters";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { parsePage } from "@/lib/credits/pagination";
import { getWalletBalance, getWalletSummary, listTransactions } from "@/lib/credits/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Portefeuille · PRONEX" };

/** Icône de chaque type de mouvement (le type « bonus » ne concerne que l'historique). */
const TYPE_ICONS: Record<string, LucideIcon> = {
  topup: CoinsIcon,
  unlock: LockOpenIcon,
  refund: RotateCcwIcon,
  admin_adjustment: SlidersHorizontalIcon,
  bonus: GiftIcon,
};

function pageHref(filter: TransactionFilter, page = 1): string {
  const params = new URLSearchParams();
  if (filter !== "tous") params.set("filtre", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/portefeuille?${query}` : "/portefeuille";
}

export default async function PortefeuillePage({ searchParams }: PageProps<"/portefeuille">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const params = await searchParams;
  const page = parsePage(params.page);
  const filter = parseTransactionFilter(params.filtre);

  const [balance, summary, history] = await Promise.all([
    getWalletBalance(user.id),
    getWalletSummary(),
    listTransactions(user.id, page, filter),
  ]);

  const totals = [
    { label: "Crédits reçus", value: summary?.received, hint: "Recharges et ajustements" },
    { label: "Crédits consommés", value: summary?.consumed, hint: "Déblocages, débits de l'administration" },
    { label: "Crédits remboursés", value: summary?.refunded, hint: "Matchs annulés ou reportés" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Portefeuille" description="Votre solde de crédits et l'historique de vos mouvements." />

      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-pronex-pink/20 via-card to-pronex-violet/25 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Solde actuel</p>
          <p className="font-heading text-4xl font-extrabold tabular-nums">{formatCredits(balance ?? 0)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/recharger?next=/portefeuille"
            className="inline-flex h-9 items-center rounded-lg bg-linear-to-r from-pronex-pink to-pronex-violet px-4 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Acheter des crédits
          </Link>
          <Link href="/portefeuille/recus" className={buttonVariants({ variant: "outline" })}>
            Mes reçus
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <Card key={t.label} size="sm">
            <CardHeader>
              <CardDescription>{t.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{t.value === undefined ? "—" : formatCredits(t.value)}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>
            {history.total} mouvement{history.total > 1 ? "s" : ""}
          </CardDescription>
          <nav className="flex flex-wrap gap-1 pt-2" aria-label="Filtrer l'historique">
            {TRANSACTION_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={pageHref(f.value)}
                aria-current={f.value === filter ? "page" : undefined}
                className={cn(
                  "rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  f.value === filter && "border-transparent bg-linear-to-r from-pronex-pink to-pronex-violet text-white",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {history.rows.length === 0 ? (
            <EmptyState title={page > 1 ? "Aucun mouvement sur cette page." : "Aucun mouvement pour le moment."} />
          ) : (
            <ul className="divide-y divide-white/5">
              {history.rows.map((tx) => {
                const Icon = TYPE_ICONS[tx.type] ?? CoinsIcon;
                return (
                  <li key={tx.id} className="flex items-start gap-3 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                        tx.amount > 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-pronex-pink/15 text-pronex-pink",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{transactionTypeLabel(tx.type)}</p>
                      <p className="text-sm break-words text-muted-foreground">
                        {tx.description}
                        {tx.type === "topup" && tx.reference_type === "topup" && tx.reference_id ? (
                          <>
                            {" "}
                            <Link href={`/portefeuille/recus/${tx.reference_id}`} className="font-medium text-pronex-pink hover:underline">
                              Reçu
                            </Link>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(tx.created_at, timezone)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("font-semibold tabular-nums", tx.amount > 0 ? "text-emerald-300" : "text-pronex-pink")}>
                        {formatSignedAmount(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">Solde {tx.balance_after}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {history.pageCount > 1 ? (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Link href={pageHref(filter, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {Math.min(page, history.pageCount)} sur {history.pageCount}
              </span>
              {page < history.pageCount ? (
                <Link href={pageHref(filter, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Suivant
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
