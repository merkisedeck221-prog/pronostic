import {
  BrainCircuitIcon,
  CalendarDaysIcon,
  GaugeIcon,
  LayersIcon,
  LineChartIcon,
  LockOpenIcon,
  MessageSquareTextIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
  wide?: boolean;
  accent?: "pink" | "violet";
};

/**
 * Présentation de PRONEX (brief, partie 2) : uniquement des fonctionnalités qui
 * existent. Pas de générateur de tickets multi-matchs : le Combiné IA porte sur
 * 2 ou 3 sélections d'un MÊME match.
 */
function features(marketCount: number): Feature[] {
  return [
    {
      icon: BrainCircuitIcon,
      title: "Les analyses de PRONEX AI",
      text: "Pour chaque match, l'IA étudie la forme récente, le classement, les confrontations directes, les absences et les statistiques, puis rend son verdict.",
      wide: true,
      accent: "violet",
    },
    {
      icon: CalendarDaysIcon,
      title: "Les matchs à venir",
      text: "Premier League, LaLiga, Serie A, Bundesliga et Ligue 1, avec forme, classement et confrontations en accès libre.",
    },
    {
      icon: TargetIcon,
      title:
        marketCount > 0
          ? `${marketCount} types de pronostics`
          : "Plusieurs types de pronostics",
      text: "Résultat du match, double chance, score exact, nombre de buts, les deux équipes marquent, mi-temps, corners, cartons…",
    },
    {
      icon: GaugeIcon,
      title: "Probabilités et confiance",
      text: "Chaque sélection est accompagnée de sa probabilité estimée et d'un niveau de confiance : faible, moyen ou élevé.",
      accent: "pink",
    },
    {
      icon: MessageSquareTextIcon,
      title: "Des explications claires",
      text: "L'IA explique son choix en quelques phrases : vous comprenez le raisonnement, vous n'achetez pas une boîte noire.",
    },
    {
      icon: LockOpenIcon,
      title: "Déblocage avec des crédits",
      text: "Débloquez un pronostic à l'unité ou le match complet. Le prix est affiché avant chaque confirmation.",
    },
    {
      icon: LineChartIcon,
      title: "Résultats et performances",
      text: "Chaque pronostic est vérifié après le match. Le taux de réussite de PRONEX AI est public, pronostics perdus compris.",
      wide: true,
      accent: "pink",
    },
  ];
}

export function LandingPresentation({ marketCount }: { marketCount: number }) {
  return (
    <section
      id="decouvrir"
      aria-labelledby="decouvrir-title"
      className="relative scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:py-20">
        <Reveal>
          <SectionHeading
            id="decouvrir-title"
            eyebrow="La plateforme"
            title="Tout ce qu'il faut pour analyser un match"
            description="PRONEX réunit les données du match, l'analyse de l'intelligence artificielle et le suivi des résultats, au même endroit."
          />
        </Reveal>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features(marketCount).map(
            ({ icon: Icon, title, text, wide, accent }, index) => (
              <Reveal
                as="li"
                key={title}
                delay={(index % 3) * 90}
                className={cn(wide && "lg:col-span-2")}
              >
                <div className="pronex-lift group relative h-full overflow-hidden rounded-3xl border border-white/8 bg-card p-6">
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-2xl",
                      accent === "pink"
                        ? "bg-pronex-pink/15 text-pronex-pink"
                        : "bg-pronex-violet/15 text-violet-200",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </div>
              </Reveal>
            ),
          )}
        </ul>

        <div className="flex flex-col gap-4 rounded-3xl border border-pronex-violet/30 bg-card p-6 sm:flex-row sm:items-center sm:p-7">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pronex-violet/20 text-violet-100">
            <LayersIcon className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-heading text-lg font-bold">
              Une analyse par match, construite match par match
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Chaque rencontre est étudiée individuellement, une seule fois. Le{" "}
              <strong className="text-foreground">Combiné IA</strong> associe 2
              ou 3 sélections d&apos;un{" "}
              <strong className="text-foreground">même match</strong> : PRONEX
              ne propose pas de tickets mélangeant plusieurs matchs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
