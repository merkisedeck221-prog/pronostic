import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, ShieldCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Appel à l'action final (brief, partie 13) : panneau à liseré dégradé, terrain
 * en perspective très discret et symbole PRONEX en filigrane (fichier fourni
 * par le porteur, non redessiné). Titre et boutons visibles d'emblée.
 */
export function LandingFinalCta() {
  return (
    <section aria-labelledby="cta-titre" className="mx-auto w-full max-w-6xl px-4 pt-4 pb-20 sm:pb-24">
      <div className="pronex-panel relative isolate overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
        {/* Décor : terrain, halo, symbole en filigrane */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="pronex-pitch absolute inset-x-0 top-0 h-[140%] opacity-40" />
          <div className="absolute -right-24 -bottom-32 size-[26rem] rounded-full bg-pronex-violet/20 blur-[110px]" />
          <div className="absolute -top-24 -left-24 size-72 rounded-full bg-pronex-pink/10 blur-[100px]" />
          <Image
            src="/brand/pronex-symbol-lg.webp"
            alt=""
            width={640}
            height={302}
            className="absolute top-1/2 -right-16 w-[26rem] max-w-none -translate-y-1/2 opacity-[0.09] sm:-right-10 lg:right-6 lg:w-[34rem] lg:opacity-[0.12]"
          />
        </div>

        <div className="max-w-2xl space-y-6">
          <Image src="/brand/pronex-wordmark.webp" alt="PRONEX" width={995} height={138} className="h-auto w-32 opacity-90" />
          <h2 id="cta-titre" className="font-heading text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Prêt à découvrir une nouvelle façon d&apos;<span className="text-pronex-pink">analyser le football</span>{"\u00a0"}?
          </h2>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
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
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
            <span>Inscription gratuite · Paiement à l&apos;unité, sans abonnement · Réservé aux 18 ans et plus</span>
          </p>
        </div>
      </div>
    </section>
  );
}
