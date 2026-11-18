import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { TestPaymentBanner } from "@/components/payments/test-payment-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { requireUser } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/credits/queries";
import { getPaymentProvider } from "@/lib/payments";
import { isMaintenanceMode, listActivePacks } from "@/lib/payments/queries";
import { bonusLabel } from "@/lib/payments/schemas";
import { formatCredits, formatXof } from "@/lib/utils/format";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Recharger mon compte · Pronostics IA" };

function currentProvider() {
  try {
    return getPaymentProvider();
  } catch {
    return null;
  }
}

export default async function RechargerPage({ searchParams }: PageProps<"/recharger">) {
  const user = await requireUser();
  const next = safeNextPath((await searchParams).next, "/portefeuille");
  const [packs, balance, maintenance] = await Promise.all([listActivePacks(), getWalletBalance(user.id), isMaintenanceMode()]);
  const provider = currentProvider();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Recharger mon compte" description={`Solde actuel : ${formatCredits(balance ?? 0)}`} />

      {provider?.isTest ? <TestPaymentBanner /> : null}

      {maintenance ? (
        <p className="rounded-md border p-3 text-sm" role="alert">
          Les recharges sont momentanément suspendues pour maintenance. Réessayez plus tard.
        </p>
      ) : null}
      {!provider ? (
        <p className="rounded-md border p-3 text-sm" role="alert">
          Le paiement est momentanément indisponible.
        </p>
      ) : null}

      {packs.length === 0 ? (
        <EmptyState title="Aucun pack de recharge n'est disponible pour le moment." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => {
            const bonus = bonusLabel(pack.bonus_credits);
            return (
              <Card key={pack.id}>
                <CardHeader>
                  <CardDescription>{pack.name}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatCredits(pack.credits)}</CardTitle>
                  {bonus ? <Badge className="w-fit">{bonus}</Badge> : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-lg font-semibold tabular-nums">{formatXof(pack.price_xof)}</p>
                  {pack.bonus_credits > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Total crédité : {formatCredits(pack.credits + pack.bonus_credits)}
                    </p>
                  ) : null}
                  <TopupForm packId={pack.id} next={next} label="Choisir ce pack" disabled={maintenance || !provider} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Les crédits servent uniquement à débloquer des pronostics. Ils ne sont ni remboursables en argent ni convertibles.
      </p>
    </main>
  );
}
