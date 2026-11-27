import type { Metadata } from "next";
import { TestPaymentBanner } from "@/components/payments/test-payment-banner";
import { safeNextPath } from "@/lib/auth/redirect";
import { requireUser } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/credits/queries";
import { getPaymentProvider } from "@/lib/payments";
import { isMaintenanceMode, listActivePacks } from "@/lib/payments/queries";
import { cn } from "@/lib/utils";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatCredits, formatXof } from "@/lib/utils/format";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Acheter des crédits · PRONEX" };

function currentProvider() {
  try {
    return getPaymentProvider();
  } catch {
    return null;
  }
}

/**
 * Page d'achat de crédits PRONEX : packs fixes, chaque pack crédite EXACTEMENT
 * le nombre de crédits affiché (aucun bonus). Prix et crédits lus en base.
 */
export default async function RechargerPage({ searchParams }: PageProps<"/recharger">) {
  const user = await requireUser();
  const next = safeNextPath((await searchParams).next, "/portefeuille");
  const [packs, balance, maintenance] = await Promise.all([listActivePacks(), getWalletBalance(user.id), isMaintenanceMode()]);
  const provider = currentProvider();
  const timezone = resolveTimezone(user.profile.timezone);

  return (
    <main className="w-full flex-1">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.3em] text-pronex-pink">PRONEX</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Acheter des crédits</h1>
            <p className="max-w-md text-sm text-pronex-gray">
              Choisissez un pack : vous recevez exactement le nombre de crédits indiqué.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-pronex-gray">Votre solde</p>
            <p className="text-2xl font-bold tabular-nums">{formatCredits(balance ?? 0)}</p>
          </div>
        </header>

        {provider?.isTest ? <TestPaymentBanner /> : null}

        {maintenance ? (
          <p className="rounded-lg border border-pronex-pink/40 bg-pronex-pink/10 p-3 text-sm" role="alert">
            Les achats sont momentanément suspendus pour maintenance. Réessayez plus tard.
          </p>
        ) : null}
        {!provider ? (
          <p className="rounded-lg border border-pronex-pink/40 bg-pronex-pink/10 p-3 text-sm" role="alert">
            Le paiement est momentanément indisponible.
          </p>
        ) : null}

        {packs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-pronex-gray">
            Aucun pack n&apos;est disponible pour le moment.
          </p>
        ) : (
          <ul className="pronex-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <li
                key={pack.id}
                className={cn(
                  "pronex-lift relative rounded-[20px] p-[2px]",
                  pack.is_featured ? "bg-[#c9f13e]" : "bg-white/10",
                )}
              >
                <article className="flex h-full flex-col gap-5 rounded-[18px] bg-pronex-night p-6">
                  <div className="flex min-h-7 items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold tracking-[0.2em] uppercase">{pack.name}</h2>
                    {pack.is_featured ? (
                      <span className="rounded-full bg-[#c9f13e] px-3 py-1 text-xs font-semibold text-[#000]">
                        Recommandé
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-4xl font-bold tabular-nums">{pack.credits}</p>
                    <p className="text-sm text-pronex-gray">crédits</p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{formatXof(pack.price_xof)}</p>
                  {pack.description ? <p className="text-sm text-pronex-gray">{pack.description}</p> : null}
                  {pack.available_until ? (
                    <p className="text-xs text-pronex-gray">Offre valable jusqu&apos;au {formatDateTime(pack.available_until, timezone)}</p>
                  ) : null}
                  <div className="mt-auto">
                    <TopupForm
                      packId={pack.id}
                      next={next}
                      label={`Acheter ${pack.credits} crédits`}
                      disabled={maintenance || !provider}
                      featured={pack.is_featured}
                    />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-pronex-gray">
          Paiement confirmé par le prestataire avant tout crédit. Les crédits servent uniquement à débloquer des pronostics :
          ils ne sont ni remboursables en argent ni convertibles, et n&apos;expirent pas.
        </p>
      </div>
    </main>
  );
}
