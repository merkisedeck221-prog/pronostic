import { BrainCircuitIcon, ListChecksIcon, TrophyIcon, UsersIcon, WorkflowIcon, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import type { PublicCounters } from "@/lib/catalog/counters";

export type CounterItem = { key: string; icon: LucideIcon; label: string; value: number; prefix?: string };

/**
 * Indicateurs d'activité RÉELS (get_public_counters), affichés avec « + » :
 * chaque valeur est un nombre réel, au moins atteint. Libellés : des pronostics
 * match par match, jamais des tickets multi-matchs.
 */
export function activityItems(counters: PublicCounters): CounterItem[] {
  const items: CounterItem[] = [];
  if (counters.users !== null) items.push({ key: "users", icon: UsersIcon, label: "Utilisateurs inscrits", value: counters.users, prefix: "+" });
  if (counters.won !== null) items.push({ key: "won", icon: TrophyIcon, label: "Pronostics gagnants validés par PRONEX AI", value: counters.won, prefix: "+" });
  if (counters.analyses !== null) items.push({ key: "analyses", icon: BrainCircuitIcon, label: "Analyses réalisées par PRONEX AI", value: counters.analyses, prefix: "+" });
  return items;
}

/**
 * Chiffres RÉELS du produit, affichés tant que les indicateurs d'activité ne
 * sont pas disponibles : valeurs exactes lues en base ou dans le code (pas de
 * « + », ce ne sont pas des minimums). Aucune valeur d'exemple.
 */
export function productItems({ markets, competitions, steps }: { markets: number; competitions: number; steps: number }): CounterItem[] {
  const items: CounterItem[] = [];
  if (markets > 0) items.push({ key: "markets", icon: ListChecksIcon, label: "Types de pronostics par match", value: markets });
  if (competitions > 0) items.push({ key: "competitions", icon: TrophyIcon, label: competitions > 1 ? "Grands championnats couverts" : "Championnat couvert", value: competitions });
  if (steps > 0) items.push({ key: "steps", icon: WorkflowIcon, label: "Étapes d'analyse par PRONEX AI", value: steps });
  return items;
}

/** Compteurs animés (brief, partie 5) : uniquement des chiffres vrais. */
export function LandingCounters({ items }: { items: CounterItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="chiffres-titre" className="relative border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
        <h2 id="chiffres-titre" className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">
          PRONEX en chiffres
        </h2>

        <dl className={items.length === 1 ? "mt-8 grid" : items.length === 2 ? "mt-8 grid gap-4 sm:grid-cols-2" : "mt-8 grid gap-4 md:grid-cols-3"}>
          {items.map(({ key, icon: Icon, label, value, prefix }) => (
            <div key={key} className="flex flex-col items-center rounded-3xl border border-white/8 bg-card px-6 py-8 text-center">
              <dt className="order-2 mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-pronex-violet" aria-hidden />
                {label}
              </dt>
              <dd className="order-1 font-heading text-5xl font-black tracking-tight italic sm:text-6xl lg:text-7xl">
                <CountUp value={value} prefix={prefix} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
