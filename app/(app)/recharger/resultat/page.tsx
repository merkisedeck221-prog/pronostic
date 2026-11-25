import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckIcon, CircleSlashIcon, CircleXIcon, LoaderCircleIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { TestPaymentBanner } from "@/components/payments/test-payment-banner";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { requireUser } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/credits/queries";
import { getOwnTopup } from "@/lib/payments/queries";
import { topupIdSchema } from "@/lib/payments/schemas";
import { formatCredits } from "@/lib/utils/format";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Résultat de la recharge · PRONEX", robots: { index: false } };

const TITLES = {
  succeeded: "Recharge réussie",
  failed: "Paiement échoué",
  cancelled: "Paiement annulé",
  pending: "Paiement en attente",
} as const;

const STATUS_ICONS = {
  succeeded: { icon: CircleCheckIcon, className: "bg-emerald-400/15 text-emerald-300" },
  failed: { icon: CircleXIcon, className: "bg-red-400/15 text-red-300" },
  cancelled: { icon: CircleSlashIcon, className: "bg-white/10 text-muted-foreground" },
  pending: { icon: LoaderCircleIcon, className: "bg-pronex-violet/15 text-violet-200 [&_svg]:animate-spin" },
} as const;

function StatusIcon({ status }: { status: keyof typeof STATUS_ICONS }) {
  const { icon: Icon, className } = STATUS_ICONS[status];
  return (
    <span className={`mx-auto mb-2 flex size-14 items-center justify-center rounded-full ${className}`}>
      <Icon className="size-7" aria-hidden />
    </span>
  );
}

export default async function TopupResultPage({ searchParams }: PageProps<"/recharger/resultat">) {
  const user = await requireUser();
  const query = await searchParams;
  const id = topupIdSchema.safeParse(Array.isArray(query.topup) ? query.topup[0] : query.topup);
  if (!id.success) notFound();

  const [topup, balance] = await Promise.all([getOwnTopup(user.id, id.data), getWalletBalance(user.id)]);
  if (!topup) notFound();

  const next = safeNextPath(query.next, "/portefeuille");

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-8">
      {topup.provider === "mock" ? <TestPaymentBanner /> : null}
      <Card>
        <CardHeader className="items-center text-center">
          <StatusIcon status={topup.status} />
          <CardDescription>Pack {topup.pack?.name ?? ""}</CardDescription>
          <CardTitle>
            <h1 className="text-2xl font-bold">{TITLES[topup.status]}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {topup.status === "succeeded" ? (
            <p>{formatCredits(topup.credits)} ont été ajoutés à votre compte.</p>
          ) : topup.status === "failed" ? (
            <p>Le paiement n&apos;a pas abouti. Aucun crédit n&apos;a été ajouté.</p>
          ) : topup.status === "cancelled" ? (
            <p>Vous avez annulé le paiement. Aucun crédit n&apos;a été ajouté.</p>
          ) : (
            <AutoRefresh />
          )}
          <p>
            Solde actuel : <span className="font-semibold tabular-nums">{formatCredits(balance ?? 0)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={next} className={buttonVariants()}>
              {next.startsWith("/matchs/") ? "Retour au match" : "Continuer"}
            </Link>
            {topup.status === "failed" || topup.status === "cancelled" ? (
              <Link href={`/recharger?next=${encodeURIComponent(next)}`} className={buttonVariants({ variant: "outline" })}>
                Réessayer
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
