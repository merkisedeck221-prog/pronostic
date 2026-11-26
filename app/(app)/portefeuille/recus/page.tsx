import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { receiptNumber } from "@/lib/credits/filters";
import { listReceipts } from "@/lib/credits/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes reçus · PRONEX" };

export default async function RecusPage() {
  const user = await requireUser();
  const timezone = resolveTimezone(user.profile.timezone);
  const receipts = await listReceipts(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Mes reçus de paiement" description="Un reçu pour chaque recharge réussie." />
      <p className="text-sm">
        <Link href="/portefeuille" className="text-muted-foreground transition-colors hover:text-foreground">
          ← Retour au portefeuille
        </Link>
      </p>
      <Card>
        <CardContent>
          {receipts.length === 0 ? (
            <EmptyState title="Aucun reçu pour le moment." />
          ) : (
            <ul className="divide-y divide-white/5">
              {receipts.map((r) => (
                <li key={r.id}>
                  <Link href={`/portefeuille/recus/${r.id}`} className="flex items-center gap-3 py-3 transition-colors hover:text-pronex-pink">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <ReceiptIcon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{receiptNumber(r.id, r.completed_at ?? r.created_at)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(r.completed_at ?? r.created_at, timezone)} · Pack {r.pack_name ?? "—"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatXof(r.amount_xof)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
