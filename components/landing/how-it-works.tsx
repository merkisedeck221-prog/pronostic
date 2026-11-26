import Link from "next/link";
import { ArrowRightIcon, BrainCircuitIcon, CalendarSearchIcon, LineChartIcon, LockOpenIcon, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { buttonVariants } from "@/components/ui/button";

type Step = { icon: LucideIcon; title: string; text: string; detail: string };

/** Les 4 étapes du brief (partie 7), décrites selon le fonctionnement réel de l'application. */
const STEPS: readonly Step[] = [
  {
    icon: CalendarSearchIcon,
    title: "Découvrez les matchs",
    text: "Consultez les rencontres disponibles et choisissez le match qui vous intéresse.",
    detail: "Forme, classement et confrontations en accès libre",
  },
  {
    icon: BrainCircuitIcon,
    title: "PRONEX AI analyse",
    text: "L'intelligence artificielle étudie les statistiques et les informations disponibles sur la rencontre.",
    detail: "Probabilités, niveau de confiance et explication",
  },
  {
    icon: LockOpenIcon,
    title: "Débloquez les pronostics",
    text: "Utilisez vos crédits pour accéder aux analyses souhaitées : un pronostic ou le match complet.",
    detail: "Prix affiché avant chaque confirmation",
  },
  {
    icon: LineChartIcon,
    title: "Suivez les résultats",
    text: "Retrouvez vos pronostics achetés, leur statut et les performances enregistrées après chaque match.",
    detail: "Gagné, perdu ou annulé : vérifié automatiquement",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="fonctionnement" aria-labelledby="fonctionnement-titre" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-16 sm:py-20">
        <SectionHeading
          id="fonctionnement-titre"
          eyebrow="Fonctionnement"
          title="Comment ça marche ?"
          description="Quatre étapes simples, du choix du match au suivi des résultats."
        />

        <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ligne de progression entre les étapes (ordinateur) */}
          <span aria-hidden className="pointer-events-none absolute top-[3.25rem] right-[12.5%] left-[12.5%] hidden h-px bg-linear-to-r from-pronex-pink/50 via-pronex-violet/50 to-pronex-violet/10 lg:block" />
          {STEPS.map(({ icon: Icon, title, text, detail }, index) => (
            <li key={title} className="relative">
              <Reveal delay={index * 120} className="h-full">
                <div className="pronex-lift group flex h-full flex-col rounded-3xl border border-white/8 bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="relative flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-pronex-night">
                      <Icon className="size-6 text-pronex-pink transition-transform duration-300 group-hover:scale-110" aria-hidden />
                    </span>
                    <span className="font-heading text-4xl font-black text-white/[0.07] italic tabular-nums" aria-hidden>
                      0{index + 1}
                    </span>
                  </div>
                  <p className="mt-5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Étape {index + 1}</p>
                  <h3 className="mt-1 font-heading text-lg font-bold">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  <p className="mt-4 border-t border-white/8 pt-3 text-xs text-violet-200">{detail}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="flex justify-center">
          <Link href="/inscription" className={buttonVariants({ size: "lg", className: "px-6" })}>
            Commencer maintenant
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
