import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/payments/print-button";
import { TestPaymentBanner } from "@/components/payments/test-payment-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { receiptNumber } from "@/lib/credits/filters";
import { getReceipt } from "@/lib/credits/queries";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits, formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Reçu de paiement · PRONEX" };

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Paiement simulé (test)",
  fedapay: "FedaPay",
  kkiapay: "KkiaPay",
};

/** Reçu d'une recharge réussie. Uniquement le propriétaire (filtre + RLS), sinon 404. */
export default async function RecuPage({ params }: PageProps<"/portefeuille/recus/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await getReceipt(user.id, id);
  if (!receipt) notFound();

  const timezone = resolveTimezone(user.profile.timezone);
  const paidAt = receipt.completed_at ?? receipt.created_at;
  const lines: [string, string][] = [
    ["Numéro de reçu", receiptNumber(receipt.id, paidAt)],
    ["Date du paiement", formatDateTime(paidAt, timezone)],
    ["Client", user.profile.display_name],
    ["Adresse e-mail", user.email ?? "—"],
    ["Pack", receipt.pack_name ?? "—"],
    ["Crédits", formatCredits(receipt.credits)],
    // Historique uniquement : les packs PRONEX actuels n'ont aucun bonus.
    ...(receipt.bonus_credits > 0
      ? ([
          ["Bonus (ancienne offre)", formatCredits(receipt.bonus_credits)],
          ["Total crédité", formatCredits(receipt.credits + receipt.bonus_credits)],
        ] as [string, string][])
      : []),
    ["Moyen de paiement", PROVIDER_LABELS[receipt.provider] ?? receipt.provider],
    ["Référence du paiement", receipt.provider_ref ?? receipt.id],
  ];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-8">
      <p className="text-sm print:hidden">
        <Link href="/portefeuille/recus" className="underline underline-offset-4">
          ← Mes reçus
        </Link>
      </p>
      {receipt.provider === "mock" ? <TestPaymentBanner /> : null}
      <Card>
        <CardHeader>
          <CardDescription>PRONEX</CardDescription>
          <CardTitle>
            <h1 className="text-xl font-semibold">Reçu de paiement</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="divide-y text-sm">
            {lines.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Montant payé</span>
            <span className="text-xl font-semibold tabular-nums">{formatXof(receipt.amount_xof)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Les crédits sont valables sans limite de durée et ne sont pas remboursables en argent.
          </p>
          <PrintButton />
        </CardContent>
      </Card>
    </main>
  );
}
