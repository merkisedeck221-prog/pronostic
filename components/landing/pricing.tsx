import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  CrownIcon,
  SparklesIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { buttonVariants } from "@/components/ui/button";
import type { LandingData } from "@/lib/catalog/landing";
import { cn } from "@/lib/utils";
import { formatXof } from "@/lib/utils/format";

/**
 * Tarifs et crédits (brief, partie 11). Packs lus en base (`credit_packs`
 * actifs) : prix et crédits exacts, AUCUN bonus ; le pack mis en avant est celui
 * marqué `is_featured` (PREMIUM). Prix des pronostics lus dans `pricing_rules`.
 * Le prix par crédit est un simple calcul à partir des prix réels.
 */
type Pack = LandingData["packs"][number];

const FORMAT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function LandingPricing({
  packs,
  pricing,
}: {
  packs: Pack[];
  pricing: LandingData["pricing"];
}) {
  if (packs.length === 0) return null;

  return (
    <section
      id="tarifs"
      aria-labelledby="tarifs-titre"
      className="scroll-mt-16 border-y border-white/5 bg-white/[0.015]"
    >
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:py-20">
        <Reveal>
          <SectionHeading
            id="tarifs-titre"
            eyebrow="Tarifs et crédits"
            title="Choisissez votre pack et accédez aux analyses"
            description="Achetez des crédits une fois, utilisez-les quand vous voulez. Pas d'abonnement, pas de frais cachés."
          />
        </Reveal>

        {pricing ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card px-4 py-2">
              <CoinsIcon
                className="size-4 shrink-0 text-pronex-pink"
                aria-hidden
              />
              <span>
                Un pronostic :{" "}
                <strong className="font-semibold">
                  {pricing.marketMin === pricing.marketMax
                    ? pricing.marketMin
                    : `${pricing.marketMin} ou ${pricing.marketMax}`}{" "}
                  crédits
                </strong>{" "}
                selon le type
              </span>
            </span>
            {pricing.bundle ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card px-4 py-2">
                <SparklesIcon
                  className="size-4 shrink-0 text-pronex-violet"
                  aria-hidden
                />
                <span>
                  Match complet :{" "}
                  <strong className="font-semibold">
                    {pricing.bundle} crédits
                  </strong>
                  , moins ce que vous avez déjà payé sur ce match
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {packs.map((pack, index) => (
            <li
              key={pack.id}
              className={cn(pack.is_featured && "sm:col-span-2 lg:col-span-1")}
            >
              <Reveal delay={index * 80} className="h-full">
                <PackCard pack={pack} />
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-3">
          <Link
            href="/inscription"
            className={buttonVariants({ size: "lg", className: "px-8" })}
          >
            Découvrir les packs
            <ArrowRightIcon
              aria-hidden
              className="transition-transform duration-200 group-hover/button:translate-x-0.5"
            />
          </Link>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {[
              "Crédits ajoutés après confirmation du paiement",
              "Crédits sans date d'expiration",
              "Reçu pour chaque achat",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="max-w-xl text-center text-[11px] text-muted-foreground">
            Les crédits donnent accès aux analyses de PRONEX AI : un pronostic
            reste une estimation, sans garantie de résultat. Réservé aux 18 ans
            et plus.
          </p>
        </div>
      </div>
    </section>
  );
}

function PackCard({ pack }: { pack: Pack }) {
  const perCredit = pack.credits > 0 ? pack.price_xof / pack.credits : null;
  const featured = pack.is_featured;
  return (
    <div
      className={cn(
        "pronex-lift relative flex h-full flex-col rounded-3xl p-6",
        featured
          ? "pronex-panel lg:-mt-3 lg:pb-9"
          : "border border-white/8 bg-card",
      )}
    >
      {featured ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-pronex-pink px-3 py-1 text-[11px] font-bold tracking-wide text-pronex-night uppercase shadow-[0_0_18px_rgb(255_20_147_/_0.55)]">
          <CrownIcon className="size-3" aria-hidden />
          Recommandé
        </span>
      ) : null}
      <p
        className={cn(
          "text-xs font-bold tracking-[0.2em] uppercase",
          featured ? "text-pronex-pink" : "text-muted-foreground",
        )}
      >
        {pack.name}
      </p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-heading text-5xl font-black italic tabular-nums">
          {pack.credits}
        </span>
        <span className="text-sm text-muted-foreground">crédits</span>
      </p>
      <p className="mt-2 font-heading text-lg font-bold tabular-nums">
        {formatXof(pack.price_xof)}
      </p>
      {perCredit !== null ? (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          ≈ {FORMAT.format(perCredit)} FCFA par crédit
        </p>
      ) : null}
      <div className="mt-auto pt-6">
        <div
          className={cn(
            "h-px",
            featured
              ? "bg-linear-to-r from-pronex-pink/60 to-pronex-violet/30"
              : "bg-white/8",
          )}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Exactement {pack.credits} crédits, sans abonnement
        </p>
      </div>
    </div>
  );
}
