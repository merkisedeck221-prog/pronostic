import { BrainCircuitIcon, TrophyIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/landing/count-up";
import type { PublicCounters } from "@/lib/catalog/counters";

type Indicator = { key: keyof PublicCounters; icon: LucideIcon; label: string };

/** Libellés : des pronostics match par match, jamais des tickets multi-matchs. */
const INDICATORS: readonly Indicator[] = [
  { key: "users", icon: UsersIcon, label: "Utilisateurs inscrits" },
  { key: "won", icon: TrophyIcon, label: "Pronostics gagnants validés par PRONEX AI" },
  { key: "analyses", icon: BrainCircuitIcon, label: "Analyses réalisées par PRONEX AI" },
];

/** Valeurs de DÉMONSTRATION (aperçu ?apercu=compteurs), toujours étiquetées comme telles. */
export const DEMO_COUNTERS: PublicCounters = { users: 25000, won: 12500, analyses: 50000 };

/**
 * Compteurs animés (brief, partie 5). Chiffres RÉELS (get_public_counters) ;
 * un indicateur sans valeur réelle suffisante est masqué. Tant qu'aucun chiffre
 * réel n'est disponible, la page montre l'aperçu de DÉMONSTRATION (décision du
 * porteur, 26/11/2026), signalé par un bandeau et une mention « Exemple » par carte.
 */
export function LandingCounters({ counters, demo = false }: { counters: PublicCounters; demo?: boolean }) {
  const shown = INDICATORS.filter((indicator) => counters[indicator.key] !== null);
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="chiffres-titre" className="relative border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="chiffres-titre" className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">
            PRONEX en chiffres
          </h2>
          {demo ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              Démonstration · valeurs d&apos;exemple, pas des statistiques réelles
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Calculés automatiquement à partir de la plateforme</span>
          )}
        </div>

        <dl className={shown.length === 1 ? "mt-8 grid" : shown.length === 2 ? "mt-8 grid gap-4 sm:grid-cols-2" : "mt-8 grid gap-4 md:grid-cols-3"}>
          {shown.map(({ key, icon: Icon, label }) => (
            <div key={key} className="flex flex-col items-center rounded-3xl border border-white/8 bg-card px-6 py-8 text-center">
              <dt className="order-2 mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-pronex-violet" aria-hidden />
                {label}
              </dt>
              <dd className="order-1 font-heading text-5xl font-extrabold tracking-tight sm:text-6xl">
                <CountUp value={counters[key] ?? 0} />
              </dd>
              {demo ? (
                <dd className="order-3 mt-3 rounded-full border border-warning/40 px-2.5 py-0.5 text-[11px] font-semibold text-warning">Exemple</dd>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
