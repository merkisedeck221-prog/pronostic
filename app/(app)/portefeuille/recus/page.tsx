import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { receiptNumber } from "@/lib/credits/filters";
import { listReceipts } from "@/lib/credits/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes reçus · Pronostics IA" };

export default async function RecusPage() {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const receipts = await listReceipts(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Mes reçus de paiement" description="Un reçu pour chaque recharge réussie." />
      <p className="text-sm">
        <Link href="/portefeuille" className="underline underline-offset-4">
          ← Retour au portefeuille
        </Link>
      </p>
      <Card>
        <CardContent className="overflow-x-auto">
          {receipts.length === 0 ? (
            <EmptyState title="Aucun reçu pour le moment." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/portefeuille/recus/${r.id}`} className="font-medium underline underline-offset-4">
                        {receiptNumber(r.id, r.completed_at ?? r.created_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(r.completed_at ?? r.created_at, timezone)}
                    </TableCell>
                    <TableCell>{r.pack_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatXof(r.amount_xof)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
