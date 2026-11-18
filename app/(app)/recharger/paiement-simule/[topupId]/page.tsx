import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TestPaymentBanner } from "@/components/payments/test-payment-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { requireUser } from "@/lib/auth/session";
import { isMockPaymentAllowed } from "@/lib/payments";
import { simulateMockPaymentAction } from "@/lib/payments/actions";
import { getOwnTopup } from "@/lib/payments/queries";
import { topupIdSchema } from "@/lib/payments/schemas";
import { formatCredits, formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Paiement simulé · Pronostics IA", robots: { index: false } };

export default async function MockPaymentPage({ params, searchParams }: PageProps<"/recharger/paiement-simule/[topupId]">) {
  const user = await requireUser();
  const { topupId } = await params;
  const id = topupIdSchema.safeParse(topupId);
  if (!id.success || !isMockPaymentAllowed()) notFound();

  const topup = await getOwnTopup(user.id, id.data);
  if (!topup || topup.provider !== "mock") notFound();

  const back = safeNextPath((await searchParams).retour, `/recharger/resultat?topup=${topup.id}`);
  if (topup.status !== "pending") redirect(back);

  const simulate = simulateMockPaymentAction.bind(null, topup.id);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-8">
      <TestPaymentBanner />
      <Card>
        <CardHeader>
          <CardDescription>Paiement simulé</CardDescription>
          <CardTitle>
            <h1 className="text-xl font-semibold">Pack {topup.pack?.name ?? ""}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt>Montant</dt>
            <dd className="text-right font-semibold tabular-nums">{formatXof(topup.amount_xof)}</dd>
            <dt>Crédits</dt>
            <dd className="text-right tabular-nums">{formatCredits(topup.credits)}</dd>
            {topup.bonus_credits > 0 ? (
              <>
                <dt>Bonus</dt>
                <dd className="text-right tabular-nums">{formatCredits(topup.bonus_credits)}</dd>
              </>
            ) : null}
          </dl>
          <div className="grid gap-2">
            <form action={simulate.bind(null, "succeeded", back)}>
              <Button type="submit" className="w-full">
                Simuler un paiement réussi
              </Button>
            </form>
            <form action={simulate.bind(null, "failed", back)}>
              <Button type="submit" variant="outline" className="w-full">
                Simuler un échec
              </Button>
            </form>
            <form action={simulate.bind(null, "cancelled", back)}>
              <Button type="submit" variant="ghost" className="w-full">
                Annuler
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
