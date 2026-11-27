import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon, CoinsIcon, GiftIcon, LockOpenIcon, ReceiptTextIcon, RotateCcwIcon, SlidersHorizontalIcon, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedNav } from "@/components/layout/segmented-nav";
import { StatCard } from "@/components/layout/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { DISPLAYED_TRANSACTION_FILTERS, parseTransactionFilter, receiptNumber, type TransactionFilter } from "@/lib/credits/filters";
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

function pageHref(filter: TransactionFilter, page = 1, before = false): string {
  const params = new URLSearchParams();
  if (before) params.set("periode", "avant");
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

  const [balance, summary] = await Promise.all([getWalletBalance(user.id), getWalletSummary()]);
  // Date de lancement : les totaux et l'historique courant partent de là ; avant, section à part.
  const since = summary?.since ?? null;
  const before = since !== null && params.periode === "avant";
  const history = await listTransactions(user.id, page, filter, { since, before });
  const sinceHint = since ? ` · depuis le ${formatDateTime(since, timezone)}` : "";

  const totals = [
    { label: "Crédits reçus", value: summary?.received, hint: `Achats et ajustements${sinceHint}` },
    { label: "Crédits consommés", value: summary?.consumed, hint: `Déblocages, débits de l'administration${sinceHint}` },
    { label: "Crédits remboursés", value: summary?.refunded, hint: `Matchs annulés ou reportés${sinceHint}` },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:py-8">
      <PageHeader title="Portefeuille" description="Votre solde de crédits et l'historique de vos mouvements." />

      <section className="flex flex-col gap-5 pxa-dark rounded-[20px] bg-[#042644] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="text-xs tracking-wider text-muted-foreground uppercase">Solde disponible</p>
          <p className="font-heading text-5xl font-extrabold tabular-nums">{balance ?? 0}</p>
          <p className="text-sm text-muted-foreground">crédit{Math.abs(balance ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/recharger?next=/portefeuille" className={buttonVariants({ variant: "hero" })}>
            <CoinsIcon aria-hidden />
            Acheter des crédits
          </Link>
          <Link href="/portefeuille/recus" className={buttonVariants({ variant: "outline" })}>
            <ReceiptTextIcon aria-hidden />
            Mes reçus
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <StatCard key={t.label} label={t.label} value={t.value === undefined ? "—" : t.value} hint={t.hint} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{before ? "Avant le lancement" : "Historique"}</CardTitle>
          <CardDescription>
            {history.total} mouvement{history.total > 1 ? "s" : ""}
            {before && since ? ` antérieur${history.total > 1 ? "s" : ""} au ${formatDateTime(since, timezone)} (essais), hors totaux` : ""}
          </CardDescription>
          {since && (before || (summary?.before_count ?? 0) > 0) ? (
            <SegmentedNav
              label="Période"
              className="pt-2"
              items={[
                { href: pageHref(filter), label: "Depuis le lancement", active: !before },
                { href: pageHref(filter, 1, true), label: "Avant le lancement", active: before, count: summary?.before_count },
              ]}
            />
          ) : null}
          <SegmentedNav
            label="Filtrer l'historique"
            className="pt-2"
            items={DISPLAYED_TRANSACTION_FILTERS.map((f) => ({ href: pageHref(f.value, 1, before), label: f.label, active: f.value === filter }))}
          />
        </CardHeader>
        <CardContent>
          {history.rows.length === 0 ? (
            <EmptyState title={page > 1 ? "Aucun mouvement sur cette page." : "Aucun mouvement pour le moment."} />
          ) : (
            <ul className="divide-y divide-white/5">
              {history.rows.map((tx) => {
                const Icon = TYPE_ICONS[tx.type] ?? CoinsIcon;
                return (
                  <li key={tx.id}>
                    <details className="group py-1">
                      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                        <span
                          className={cn(
                            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                            tx.amount > 0 ? "bg-success/15 text-success" : "bg-pronex-pink/15 text-pronex-pink",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="block text-sm font-medium">{transactionTypeLabel(tx.type)}</span>
                          <span className="block truncate text-sm text-muted-foreground">{tx.description}</span>
                          <span className="block text-xs text-muted-foreground">{formatDateTime(tx.created_at, timezone)}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={cn("block font-semibold tabular-nums", tx.amount > 0 ? "text-success" : "text-pronex-pink")}>
                            {formatSignedAmount(tx.amount)}
                          </span>
                          <span className="block text-xs text-muted-foreground tabular-nums">Solde {tx.balance_after}</span>
                        </span>
                        <ChevronDownIcon className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <dl className="mx-1 mt-1 mb-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-muted p-3 text-sm sm:ml-13">
                        <dt className="text-muted-foreground">Opération</dt>
                        <dd className="text-right tabular-nums">n° {tx.id}</dd>
                        <dt className="text-muted-foreground">Date</dt>
                        <dd className="text-right">{formatDateTime(tx.created_at, timezone)}</dd>
                        <dt className="text-muted-foreground">Type</dt>
                        <dd className="text-right">{transactionTypeLabel(tx.type)}</dd>
                        <dt className="text-muted-foreground">Montant</dt>
                        <dd className="text-right tabular-nums">{formatSignedAmount(tx.amount)} crédit{Math.abs(tx.amount) > 1 ? "s" : ""}</dd>
                        <dt className="text-muted-foreground">Solde après</dt>
                        <dd className="text-right tabular-nums">{formatCredits(tx.balance_after)}</dd>
                        <dt className="text-muted-foreground">Libellé</dt>
                        <dd className="text-right break-words">{tx.description ?? "—"}</dd>
                        {tx.type === "topup" && tx.reference_type === "topup" && tx.reference_id ? (
                          <>
                            <dt className="text-muted-foreground">Reçu</dt>
                            <dd className="text-right">
                              <Link href={`/portefeuille/recus/${tx.reference_id}`} className="font-medium text-pronex-pink hover:underline">
                                {receiptNumber(tx.reference_id, tx.created_at)}
                              </Link>
                            </dd>
                          </>
                        ) : null}
                      </dl>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          {history.pageCount > 1 ? (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? (
                <Link href={pageHref(filter, page - 1, before)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {Math.min(page, history.pageCount)} sur {history.pageCount}
              </span>
              {page < history.pageCount ? (
                <Link href={pageHref(filter, page + 1, before)} className={buttonVariants({ variant: "outline", size: "sm" })}>
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
