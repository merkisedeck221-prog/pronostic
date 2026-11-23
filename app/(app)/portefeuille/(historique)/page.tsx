import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { parseTransactionFilter, TRANSACTION_FILTERS, type TransactionFilter } from "@/lib/credits/filters";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { parsePage } from "@/lib/credits/pagination";
import { getWalletBalance, getWalletSummary, listTransactions } from "@/lib/credits/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Portefeuille · Pronostics IA" };

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
    { label: "Crédits reçus", value: summary?.received, hint: "Recharges, bonus, ajustements" },
    { label: "Crédits consommés", value: summary?.consumed, hint: "Déblocages, débits de l'administration" },
    { label: "Crédits remboursés", value: summary?.refunded, hint: "Matchs annulés ou reportés" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Portefeuille" description="Votre solde de crédits et l'historique de vos mouvements." />

      <Card>
        <CardHeader>
          <CardDescription>Solde actuel</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatCredits(balance ?? 0)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/recharger?next=/portefeuille" className={buttonVariants()}>
            Recharger
          </Link>
          <Link href="/portefeuille/recus" className={buttonVariants({ variant: "outline" })}>
            Mes reçus de paiement
          </Link>
        </CardContent>
      </Card>

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
          <nav className="flex flex-wrap gap-2 pt-2" aria-label="Filtrer l'historique">
            {TRANSACTION_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={pageHref(f.value)}
                aria-current={f.value === filter ? "page" : undefined}
                className={cn(buttonVariants({ variant: f.value === filter ? "default" : "outline", size: "sm" }))}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {history.rows.length === 0 ? (
            <EmptyState title={page > 1 ? "Aucun mouvement sur cette page." : "Aucun mouvement pour le moment."} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Solde après</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.rows.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(tx.created_at, timezone)}
                    </TableCell>
                    <TableCell>{transactionTypeLabel(tx.type)}</TableCell>
                    <TableCell className="min-w-48 whitespace-normal">
                      {tx.description}
                      {tx.type === "topup" && tx.reference_type === "topup" && tx.reference_id ? (
                        <>
                          {" "}
                          <Link href={`/portefeuille/recus/${tx.reference_id}`} className="underline underline-offset-4">
                            Reçu
                          </Link>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${tx.amount > 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}
                    >
                      {formatSignedAmount(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{tx.balance_after}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
