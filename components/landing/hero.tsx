import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BrainCircuitIcon, LockIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Hero de la landing PRONEX : promesse, appel à l'inscription et aperçu animé
 * de l'interface d'une analyse. L'aperçu est explicitement présenté comme un
 * EXEMPLE (équipes et valeurs fictives) : aucune statistique réelle inventée.
 */
export function LandingHero({ marketCount }: { marketCount: number }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Décor : terrain en perspective et halos de marque */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="pronex-pitch absolute inset-x-0 top-0 h-[120%] opacity-60" />
        <div className="absolute -top-56 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-pronex-violet/10 blur-[120px] sm:size-[40rem] sm:bg-pronex-violet/15 sm:blur-[140px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-pronex-night" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-12 pb-20 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:pt-20 lg:pb-28">
        <div className="space-y-7">
          <Image
            src="/brand/pronex-wordmark.webp"
            alt="PRONEX"
            width={995}
            height={138}
            priority
            className="h-auto w-56 sm:w-72"
          />
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold tracking-wide text-violet-100 backdrop-blur">
            <SparklesIcon className="size-3.5 text-pronex-pink" aria-hidden />
            Pronostics football assistés par intelligence artificielle
          </p>
          <h1 id="hero-title" className="font-heading text-5xl leading-[0.95] font-extrabold tracking-tight italic sm:text-6xl lg:text-7xl">
            Prédisez.
            <br />
            <span className="text-pronex-pink">Analysez.</span>
            <br />
            Dominez.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            PRONEX AI étudie chaque match, un par un, et vous livre{" "}
            <strong className="font-semibold text-foreground">sa sélection, sa probabilité, son niveau de confiance</strong> et
            l&apos;explication de son choix.
            {marketCount > 0 ? ` ${marketCount} types de pronostics par match.` : null}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className={buttonVariants({ variant: "hero", size: "lg", className: "px-6" })}>
              Créer mon compte gratuitement
              <ArrowRightIcon aria-hidden />
            </Link>
            <Link href="#decouvrir" className={buttonVariants({ variant: "outline", size: "lg", className: "px-6" })}>
              Découvrir PRONEX
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-success" aria-hidden />
              Inscription gratuite
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-success" aria-hidden />
              Paiement à l&apos;unité, sans abonnement
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-success" aria-hidden />
              Réservé aux 18 ans et plus
            </li>
          </ul>
        </div>

        <AnalysisPreview />
      </div>
    </section>
  );
}

/** Barre de probabilité animée (valeurs d'exemple). */
function ProbabilityRow({ label, value, highlight = false, delay }: { label: string; value: number; highlight?: boolean; delay: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={highlight ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
        <span className={highlight ? "font-heading font-bold text-foreground tabular-nums" : "text-muted-foreground tabular-nums"}>{value} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={highlight ? "pronex-fill h-full rounded-full bg-linear-to-r from-pronex-pink to-pronex-violet" : "pronex-fill h-full rounded-full bg-white/25"}
          style={{ width: `${value}%`, animationDelay: delay }}
        />
      </div>
    </div>
  );
}

/** Aperçu de l'interface d'une analyse PRONEX (exemple illustratif, données fictives). */
function AnalysisPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card p-5 shadow-2xl shadow-black/50 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pronex-violet/20 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
              <BrainCircuitIcon className="size-3.5" aria-hidden />
              Analyse PRONEX AI
            </span>
            <span className="text-[11px] text-muted-foreground">Exemple</span>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="space-y-2">
              <span aria-hidden className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-white/8 font-heading font-bold">A</span>
              <p className="text-sm font-semibold">Équipe A</p>
            </div>
            <span className="font-heading text-sm font-bold text-muted-foreground">VS</span>
            <div className="space-y-2">
              <span aria-hidden className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-white/8 font-heading font-bold">B</span>
              <p className="text-sm font-semibold">Équipe B</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 rounded-2xl bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Résultat du match (1N2)</p>
            <ProbabilityRow label="Victoire Équipe A" value={52} highlight delay="0.3s" />
            <ProbabilityRow label="Match nul" value={26} delay="0.5s" />
            <ProbabilityRow label="Victoire Équipe B" value={22} delay="0.7s" />
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-muted-foreground">Niveau de confiance</span>
              <span className="rounded-full bg-pronex-violet/20 px-2 py-0.5 font-semibold text-violet-100">Moyen</span>
            </div>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-2xl border border-pronex-pink/25 bg-pronex-pink/[0.06] p-4">
            <div aria-hidden className="space-y-2 blur-[5px] select-none">
              <p className="text-sm font-semibold">Plus de 2,5 buts</p>
              <p className="text-xs text-muted-foreground">Les deux attaques restent sur une série de matchs prolifiques et…</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold">
              <LockIcon className="size-4 text-pronex-pink" aria-hidden />
              Sélection et explication à débloquer
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">
        Aperçu de l&apos;interface d&apos;une analyse · équipes et valeurs d&apos;exemple
      </figcaption>
    </figure>
  );
}
