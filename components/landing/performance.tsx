"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, InfoIcon } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { RateBars, WeeklyChart } from "@/components/performance/charts";
import { buttonVariants } from "@/components/ui/button";
import { formatRate, isSmallSample } from "@/lib/settle/labels";
import type { PerformanceStats } from "@/lib/settle/schemas";
import { cn } from "@/lib/utils";

/**
 * Performances de PRONEX AI sur la landing (brief, partie 9).
 *
 * UNE seule source : la réponse de get_performance_stats(), la même que la page
 * publique /performances, avec les mêmes graphiques et la même formule
 * (gagnés ÷ (gagnés + perdus), annulés exclus). Les perdus sont toujours
 * affichés. Sans pronostic résolu : état explicatif, jamais de faux taux.
 */
type Period = "tout" | "30-jours";
type View = "semaines" | "types" | "competitions";

const VIEWS: { id: View; label: string }[] = [
  { id: "semaines", label: "12 semaines" },
  { id: "types", label: "Par type" },
  { id: "competitions", label: "Par compétition" },
];

export function LandingPerformance({ stats }: { stats: PerformanceStats | null }) {
  const [period, setPeriod] = useState<Period>("tout");
  const [view, setView] = useState<View>("semaines");

  const global = stats?.global ?? { won: 0, lost: 0, void: 0 };
  const resolved = global.won + global.lost;
  const shown = period === "30-jours" ? (stats?.last_30_days ?? { won: 0, lost: 0, void: 0 }) : global;
  const shownResolved = shown.won + shown.lost;

  return (
    <section id="performances" aria-labelledby="performances-titre" className="scroll-mt-16 border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">Performances</p>
            <h2 id="performances-titre" className="font-heading text-2xl font-bold sm:text-3xl">
              Les performances de PRONEX AI en toute transparence
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Chaque pronostic publié est vérifié automatiquement après le match. Les pronostics perdus sont comptés, toujours.
            </p>
          </div>
          <Link href="/performances" className={buttonVariants({ variant: "outline", className: "shrink-0" })}>
            Voir toutes les performances
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>

        {stats === null || resolved === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-white/8 bg-card p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pronex-violet/15 text-violet-200">
              <BarChart3Icon className="size-6" aria-hidden />
            </span>
            <div className="space-y-1.5">
              <p className="font-heading text-lg font-bold">Les premiers résultats arrivent bientôt</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {stats === null
                  ? "Les performances sont momentanément indisponibles. Elles restent consultables sur la page dédiée."
                  : "Aucun pronostic n'est encore terminé. Le taux de réussite, les gagnés, les perdus et les annulés s'afficheront ici dès les premiers matchs analysés et joués : aucun chiffre n'est affiché avant d'être réel."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Période"
                value={period}
                onChange={setPeriod}
                options={[
                  { id: "tout", label: "Depuis le lancement" },
                  { id: "30-jours", label: "30 derniers jours" },
                ]}
              />
              {isSmallSample(global.won, global.lost) ? (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <InfoIcon className="size-3.5" aria-hidden />
                  Échantillon encore réduit ({resolved} pronostic{resolved > 1 ? "s" : ""} terminé{resolved > 1 ? "s" : ""}) : à interpréter avec prudence.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Taux de réussite"
                value={formatRate(shown.won, shown.lost)}
                hint={shownResolved === 0 ? "Aucun pronostic terminé sur la période" : `Sur ${shownResolved} pronostic${shownResolved > 1 ? "s" : ""}, hors annulés`}
              />
              <StatCard label="Gagnés" value={shown.won} tone="success" />
              <StatCard label="Perdus" value={shown.lost} tone="danger" />
              <StatCard label="Annulés" value={shown.void} hint="Exclus du taux de réussite" />
            </div>

            <div className="space-y-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-heading font-bold">
                  {view === "semaines" ? "Résultats des 12 dernières semaines" : view === "types" ? "Réussite par type de pronostic" : "Réussite par compétition"}
                </p>
                <Segmented label="Graphique" value={view} onChange={setView} options={VIEWS} />
              </div>
              {view === "semaines" ? (
                <WeeklyChart weeks={stats.by_week} />
              ) : view === "types" ? (
                <RateBars emptyLabel="Aucun type de pronostic résolu." rows={stats.by_market.map((m) => ({ ...m, key: m.code, name: m.label }))} />
              ) : (
                <RateBars emptyLabel="Aucune compétition résolue." rows={stats.by_competition.map((c) => ({ ...c, key: String(c.id), name: c.name }))} />
              )}
              <p className="text-xs text-muted-foreground">
                Taux = gagnés ÷ (gagnés + perdus). Les graphiques par type et par compétition portent sur toute la période.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-white/8 bg-pronex-night p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "tap-target rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === option.id ? "bg-pronex-violet text-white" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
