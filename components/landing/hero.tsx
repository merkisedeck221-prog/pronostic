import Link from "next/link";
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  CheckIcon,
  LockIcon,
} from "lucide-react";
import { FormBadges } from "@/components/matches/form-badges";
import { buttonVariants } from "@/components/ui/button";
import { VISUAL_STEPS } from "@/lib/generation/stages";

/**
 * Hero de la landing PRONEX (brief, partie 4).
 *
 * La composition reprend des éléments RÉELS de l'application : carte de match
 * avec forme récente (composant FormBadges de la fiche match), probabilités 1N2
 * et niveau de confiance, marchés verrouillés, et les 7 étapes réelles du moteur
 * PRONEX AI (lib/generation/stages.ts). Équipes et valeurs sont présentées comme
 * un EXEMPLE : aucune statistique réelle n'est inventée.
 */
export function LandingHero({ marketCount }: { marketCount: number }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="pronex-pitch absolute inset-x-0 top-0 h-[120%] opacity-60" />
        <div className="absolute -top-56 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-pronex-violet/10 blur-[120px] sm:size-[40rem] sm:bg-pronex-violet/15 sm:blur-[140px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-pronex-night" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-12 pb-20 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pt-20 lg:pb-28">
        <div className="space-y-7">
          <p className="font-heading text-sm font-bold tracking-[0.2em] text-muted-foreground uppercase italic">
            Prédisez. <span className="text-pronex-pink">Analysez.</span>{" "}
            Dominez.
          </p>
          <h1
            id="hero-title"
            className="font-heading text-[2rem] leading-[1.05] font-extrabold tracking-tight min-[375px]:text-4xl sm:text-5xl lg:text-6xl"
          >
            Le football analysé par{" "}
            <span className="text-pronex-pink">
              l&apos;intelligence artificielle
            </span>
            .
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Découvrez une nouvelle manière d&apos;analyser les matchs de
            football grâce à PRONEX AI. Des statistiques, des probabilités et
            des analyses détaillées pour mieux comprendre chaque rencontre.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/inscription"
              className={buttonVariants({
                variant: "hero",
                size: "lg",
                className: "px-6",
              })}
            >
              Créer mon compte
              <ArrowRightIcon
                aria-hidden
                className="transition-transform duration-200 group-hover/button:translate-x-0.5"
              />
            </Link>
            <Link
              href="#decouvrir"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "px-6",
              })}
            >
              Découvrir PRONEX
            </Link>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground/80">
              L&apos;analyse intelligente du football commence ici.
            </p>
            <p className="text-xs text-muted-foreground">
              Inscription gratuite · Paiement à l&apos;unité, sans abonnement ·
              Réservé aux 18 ans et plus
            </p>
          </div>
        </div>

        <HeroVisual marketCount={marketCount} />
      </div>
    </section>
  );
}

/** Barre de probabilité (valeurs d'exemple) ; remplissage animé = seule animation. */
function ProbabilityRow({
  label,
  value,
  highlight = false,
  delay,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  delay: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span
          className={
            highlight
              ? "font-semibold text-foreground"
              : "text-muted-foreground"
          }
        >
          {label}
        </span>
        <span
          className={
            highlight
              ? "font-heading font-bold text-foreground tabular-nums"
              : "text-muted-foreground tabular-nums"
          }
        >
          {value} %
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={
            highlight
              ? "pronex-fill h-full rounded-full bg-pronex-pink"
              : "pronex-fill h-full rounded-full bg-white/25"
          }
          style={{ width: `${value}%`, animationDelay: delay }}
        />
      </div>
    </div>
  );
}

const LOCKED_MARKETS = [
  "Score exact",
  "Les deux équipes marquent",
  "Combiné IA (même match)",
] as const;

function HeroVisual({ marketCount }: { marketCount: number }) {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:mr-0 lg:max-w-[34rem]">
      <div className="relative">
        {/* Carte de match : reflet de la fiche match réelle */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-100">
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-pronex-pink/70 [animation-duration:2.4s]" />
                <span className="relative inline-flex size-2 rounded-full bg-pronex-pink" />
              </span>
              Analyse PRONEX AI
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">
              Exemple
            </span>
          </div>

          <div className="space-y-5 p-5">
            <p className="text-center text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Championnat · Coup d&apos;envoi 20:00
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-center">
              <TeamBlock
                name="Équipe A"
                letter="A"
                form={["W", "W", "D", "W", "L"]}
              />
              <span className="pt-3 font-heading text-sm font-bold text-muted-foreground">
                VS
              </span>
              <TeamBlock
                name="Équipe B"
                letter="B"
                form={["L", "D", "W", "L", "D"]}
              />
            </div>

            <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Résultat du match
                </p>
                <span className="rounded-full bg-pronex-violet/20 px-2 py-0.5 text-[11px] font-semibold text-violet-100">
                  Confiance : moyenne
                </span>
              </div>
              <ProbabilityRow
                label="Victoire Équipe A"
                value={52}
                highlight
                delay="0.3s"
              />
              <ProbabilityRow label="Match nul" value={26} delay="0.45s" />
              <ProbabilityRow
                label="Victoire Équipe B"
                value={22}
                delay="0.6s"
              />
            </div>

            <ul className="divide-y divide-white/5 rounded-2xl border border-white/8">
              {LOCKED_MARKETS.map((market) => (
                <li
                  key={market}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 leading-snug">{market}</span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-pronex-pink">
                    <LockIcon className="size-3.5" aria-hidden />À débloquer
                  </span>
                </li>
              ))}
              {marketCount > LOCKED_MARKETS.length + 1 ? (
                <li className="px-4 py-2.5 text-xs text-muted-foreground">
                  + {marketCount - LOCKED_MARKETS.length - 1} autres types de
                  pronostics sur ce match
                </li>
              ) : null}
            </ul>
          </div>

          {/* Moteur PRONEX AI : les 7 étapes réelles de l'analyse (lib/generation/stages.ts) */}
          <div className="border-t border-white/8 px-5 py-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <BrainCircuitIcon
                  className="size-3.5 text-pronex-violet"
                  aria-hidden
                />
                Moteur PRONEX AI
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-success">
                <CheckIcon className="size-3.5" aria-hidden />
                Analyse validée
              </span>
            </div>
            <ol
              className="mt-3 grid grid-cols-7 gap-1"
              aria-label="Étapes de l'analyse"
            >
              {VISUAL_STEPS.map((step, index) => (
                <li key={step.key} title={step.title}>
                  <span
                    aria-hidden
                    className={
                      index === VISUAL_STEPS.length - 1
                        ? "block h-1.5 rounded-full bg-pronex-pink"
                        : "block h-1.5 rounded-full bg-success/60"
                    }
                  />
                  <span className="sr-only">{step.title}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {VISUAL_STEPS.length} étapes : données du match, statistiques,
              marchés, risque, combinaison, résultat.
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">
        Aperçu de l&apos;interface PRONEX · équipes et valeurs d&apos;exemple
      </figcaption>
    </figure>
  );
}

function TeamBlock({
  name,
  letter,
  form,
}: {
  name: string;
  letter: string;
  form: ("W" | "D" | "L")[];
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-heading font-bold"
      >
        {letter}
      </span>
      <p className="text-sm font-semibold">{name}</p>
      <FormBadges results={form} size="sm" />
    </div>
  );
}
