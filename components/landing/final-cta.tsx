import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, ShieldCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Appel à l'action final (brief, partie 13) : panneau à liseré dégradé sur une
 * photo de stade fournie par le porteur (voile sombre pour la lisibilité),
 * logotype PRONEX au-dessus du titre. Titre et boutons visibles d'emblée.
 */
export function LandingFinalCta() {
  return (
    <section aria-labelledby="cta-titre" className="mx-auto w-full max-w-6xl px-4 pt-4 pb-20 sm:pb-24">
      <div className="pronex-panel relative isolate overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
        {/* Décor : photo de stade (fournie par le porteur) sous un voile noir nuit / violet */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <Image
            src="/landing/stadium.webp"
            alt=""
            fill
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover object-[center_55%] lg:object-[center_36%]"
          />
          <div className="absolute inset-0 bg-linear-to-b from-pronex-night/55 via-pronex-night/50 to-pronex-night/80 lg:bg-linear-to-r lg:from-pronex-night/85 lg:via-pronex-night/40 lg:to-transparent" />
          
          <div className="absolute -right-24 -bottom-32 size-[26rem] rounded-full bg-pronex-violet/15 blur-[110px]" />
        </div>

        <div className="max-w-2xl space-y-6">
          <Image src="/brand/pronex-wordmark.webp" alt="PRONEX" width={995} height={138} className="h-auto w-32 opacity-90" />
          <h2 id="cta-titre" className="font-heading text-3xl leading-tight font-extrabold tracking-tight [text-shadow:0_2px_18px_rgb(8_11_32_/_0.65)] sm:text-4xl lg:text-5xl">
            Prêt à découvrir une nouvelle façon d&apos;<span className="text-pronex-pink">analyser le football</span>{"\u00a0"}?
          </h2>
          <p className="max-w-xl text-base text-white/85 [text-shadow:0_1px_12px_rgb(8_11_32_/_0.8)] sm:text-lg">
            Rejoignez PRONEX et découvrez les analyses de notre intelligence artificielle.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className={buttonVariants({ variant: "hero", size: "lg", className: "px-7" })}>
              Créer mon compte
              <ArrowRightIcon aria-hidden />
            </Link>
            <Link href="/performances" className={buttonVariants({ variant: "outline", size: "lg", className: "px-7" })}>
              <BarChart3Icon aria-hidden />
              Découvrir les performances
            </Link>
          </div>
          <p className="flex items-start gap-2 text-xs text-white/75 [text-shadow:0_1px_8px_rgb(8_11_32_/_0.9)]">
            <ShieldCheckIcon className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
            <span>Inscription gratuite · Paiement à l&apos;unité, sans abonnement · Réservé aux 18 ans et plus</span>
          </p>
        </div>
      </div>
    </section>
  );
}
