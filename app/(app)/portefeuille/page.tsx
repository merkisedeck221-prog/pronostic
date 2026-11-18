import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { parsePage } from "@/lib/credits/pagination";
import { getWalletBalance, listTransactions } from "@/lib/credits/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Portefeuille · Pronostics IA" };

export default async function PortefeuillePage({ searchParams }: PageProps<"/portefeuille">) {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const page = parsePage((await searchParams).page);

  const [balance, history] = await Promise.all([getWalletBalance(user.id), listTransactions(user.id, page)]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Portefeuille" description="Votre solde de crédits et l'historique de vos mouvements." />

      <Card>
        <CardHeader>
          <CardDescription>Solde actuel</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatCredits(balance ?? 0)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/recharger?next=/portefeuille" className={buttonVariants()}>
            Recharger
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>
            {history.total} mouvement{history.total > 1 ? "s" : ""}
          </CardDescription>
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
                    <TableCell className="min-w-48 whitespace-normal">{tx.description}</TableCell>
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
                <Link href={`/portefeuille?page=${page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {Math.min(page, history.pageCount)} sur {history.pageCount}
              </span>
              {page < history.pageCount ? (
                <Link href={`/portefeuille?page=${page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
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
