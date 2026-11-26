import {
  ArrowLeftRightIcon,
  BadgeCheckIcon,
  ClockIcon,
  CornerUpRightIcon,
  CrosshairIcon,
  GoalIcon,
  HourglassIcon,
  LayersIcon,
  ScaleIcon,
  ShieldHalfIcon,
  SquareIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";

type Category = "Résultat" | "Buts" | "Statistiques" | "Combiné";

type MarketCard = {
  code: string;
  icon: LucideIcon;
  name: string;
  text: string;
  category: Category;
};

/**
 * Les 13 types de pronostics de PRONEX (brief, partie 8), dans l'ordre du brief.
 * Codes = table `markets` ; explications fidèles aux règles de résolution
 * (temps réglementaire). Aucun nouveau marché ; le Combiné IA porte sur un
 * SEUL match.
 */
export const MARKET_CARDS: readonly MarketCard[] = [
  {
    code: "MATCH_RESULT",
    icon: ScaleIcon,
    name: "1N2",
    text: "Victoire à domicile, match nul ou victoire à l'extérieur.",
    category: "Résultat",
  },
  {
    code: "DOUBLE_CHANCE",
    icon: ShieldHalfIcon,
    name: "Double chance",
    text: "Deux issues sur trois : 1N, 12 ou N2.",
    category: "Résultat",
  },
  {
    code: "HANDICAP",
    icon: ArrowLeftRightIcon,
    name: "Handicap ±1,5",
    text: "Handicap européen de 1,5 but appliqué à une équipe.",
    category: "Résultat",
  },
  {
    code: "OVER_UNDER_1_5",
    icon: TrendingUpIcon,
    name: "Over/Under 1,5 buts",
    text: "Plus de 1,5 but (2 ou plus) ou moins (0 ou 1).",
    category: "Buts",
  },
  {
    code: "OVER_UNDER_2_5",
    icon: TrendingUpIcon,
    name: "Over/Under 2,5 buts",
    text: "Plus de 2,5 buts (3 ou plus) ou moins (2 ou moins).",
    category: "Buts",
  },
  {
    code: "OVER_UNDER_3_5",
    icon: TrendingUpIcon,
    name: "Over/Under 3,5 buts",
    text: "Plus de 3,5 buts (4 ou plus) ou moins (3 ou moins).",
    category: "Buts",
  },
  {
    code: "BTTS",
    icon: UsersIcon,
    name: "BTTS",
    text: "Les deux équipes marquent : oui ou non.",
    category: "Buts",
  },
  {
    code: "EXACT_SCORE",
    icon: CrosshairIcon,
    name: "Score exact",
    text: "Le score précis de la rencontre.",
    category: "Buts",
  },
  {
    code: "HT_RESULT",
    icon: ClockIcon,
    name: "Résultat à la mi-temps",
    text: "Équipe en tête ou égalité à la pause.",
    category: "Résultat",
  },
  {
    code: "HT_FT",
    icon: HourglassIcon,
    name: "Mi-temps / fin de match",
    text: "Le résultat à la mi-temps ET à la fin, par exemple N/1.",
    category: "Résultat",
  },
  {
    code: "CORNERS_OVER_UNDER_9_5",
    icon: CornerUpRightIcon,
    name: "Over/Under 9,5 corners",
    text: "Total des corners des deux équipes : 10 ou plus, ou 9 ou moins.",
    category: "Statistiques",
  },
  {
    code: "CARDS_OVER_UNDER_4_5",
    icon: SquareIcon,
    name: "Over/Under 4,5 cartons",
    text: "Total des cartons jaunes et rouges : 5 ou plus, ou 4 ou moins.",
    category: "Statistiques",
  },
  {
    code: "COMBO",
    icon: LayersIcon,
    name: "Combiné IA",
    text: "2 ou 3 sélections de l'IA sur le même match, gagné seulement si toutes sont gagnées. Ce n'est pas un ticket multi-matchs.",
    category: "Combiné",
  },
];

const CATEGORY_CLASSES: Record<Category, string> = {
  Résultat: "border-pronex-violet/30 text-violet-200",
  Buts: "border-pronex-pink/30 text-pink-200",
  Statistiques: "border-white/15 text-muted-foreground",
  Combiné: "border-pronex-pink/40 text-pronex-pink",
};

export function LandingMarkets({ activeCodes }: { activeCodes: string[] }) {
  const active = new Set(activeCodes);
  const cards = MARKET_CARDS.filter((card) => active.has(card.code));
  if (cards.length === 0) return null;

  return (
    <section
      id="types-pronostics"
      aria-labelledby="types-titre"
      className="scroll-mt-16"
    >
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-16 sm:py-20">
        <Reveal>
          <SectionHeading
            id="types-titre"
            eyebrow="Analyses"
            title={`Les ${cards.length} types de pronostics`}
            description="Chaque match est analysé sur tous ces marchés. Débloquez-les un par un, ou tous ensemble avec le match complet. Tous se jouent au temps réglementaire."
          />
        </Reveal>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ code, icon: Icon, name, text, category }, index) => {
            const combo = code === "COMBO";
            return (
              <Reveal
                as="li"
                key={code}
                delay={(index % 4) * 70}
                className={cn(combo && "sm:col-span-2 lg:col-span-4")}
              >
                <div
                  className={cn(
                    "pronex-lift group relative flex h-full flex-col rounded-2xl border bg-card p-5",
                    combo
                      ? "border-pronex-pink/35 lg:flex-row lg:items-center lg:gap-5"
                      : "border-white/8",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                        combo
                          ? "bg-pronex-pink/15 text-pronex-pink"
                          : "bg-pronex-violet/15 text-violet-200 group-hover:bg-pronex-pink/15 group-hover:text-pronex-pink",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span
                      className="font-heading text-xs font-bold text-white/20 tabular-nums lg:hidden"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className={cn("mt-4 flex-1", combo && "lg:mt-0")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-base font-bold">
                        {name}
                      </h3>
                      {combo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pronex-pink/15 px-2 py-0.5 text-[11px] font-semibold text-pink-200">
                          <BadgeCheckIcon className="size-3" aria-hidden />
                          Même match
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-4 inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      CATEGORY_CLASSES[category],
                      combo && "lg:mt-0",
                    )}
                  >
                    {category}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </ul>

        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <GoalIcon className="size-3.5 text-pronex-violet" aria-hidden />
          Pour chaque marché : la sélection de PRONEX AI, sa probabilité, son
          niveau de confiance et l&apos;explication.
        </p>
      </div>
    </section>
  );
}
