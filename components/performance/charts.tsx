import { formatRate } from "@/lib/settle/labels";
import type { Counts } from "@/lib/settle/schemas";
import { successRate } from "@/lib/settle/rules";
import { cn } from "@/lib/utils";

/**
 * Graphiques de la page Performances (HTML / CSS, sans bibliothèque) : chaque
 * graphique a un équivalent textuel pour les lecteurs d'écran. Les chiffres
 * viennent tels quels de get_performance_stats : rien n'est extrapolé.
 */

const WEEK_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function weekLabel(weekStart: string): string {
  return WEEK_FORMAT.format(new Date(`${weekStart}T12:00:00Z`));
}

/** Barres empilées par semaine : gagnés (vert), perdus (rouge), annulés (gris). */
export function WeeklyChart({ weeks }: { weeks: Array<Counts & { week_start: string }> }) {
  const max = Math.max(1, ...weeks.map((w) => w.won + w.lost + w.void));
  return (
    <figure className="space-y-3">
      <div className="flex h-44 items-end gap-1.5 sm:gap-2" aria-hidden>
        {weeks.map((w) => {
          const total = w.won + w.lost + w.void;
          return (
            <div key={w.week_start} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${weekLabel(w.week_start)} : ${w.won} gagnés, ${w.lost} perdus, ${w.void} annulés`}>
              {total === 0 ? (
                <div className="h-0.5 rounded-full bg-white/10" />
              ) : (
                <div className="flex flex-col overflow-hidden rounded-md" style={{ height: `${(total / max) * 100}%` }}>
                  {w.void > 0 ? <div className="bg-white/25" style={{ flexGrow: w.void }} /> : null}
                  {w.lost > 0 ? <div className="bg-destructive" style={{ flexGrow: w.lost }} /> : null}
                  {w.won > 0 ? <div className="bg-success" style={{ flexGrow: w.won }} /> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 text-[10px] text-muted-foreground sm:gap-2" aria-hidden>
        {weeks.map((w, i) => (
          <span key={w.week_start} className="min-w-0 flex-1 truncate text-center">
            {i % 2 === 0 || weeks.length <= 6 ? weekLabel(w.week_start) : ""}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-success" /> Gagnés
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-destructive" /> Perdus
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-white/25" /> Annulés
        </span>
        <span>Semaines commençant le lundi (heure de Porto-Novo).</span>
      </figcaption>
      <table className="sr-only">
        <caption>Pronostics résolus par semaine</caption>
        <thead>
          <tr>
            <th>Semaine du</th>
            <th>Gagnés</th>
            <th>Perdus</th>
            <th>Annulés</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week_start}>
              <td>{weekLabel(w.week_start)}</td>
              <td>{w.won}</td>
              <td>{w.lost}</td>
              <td>{w.void}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Taux de réussite par ligne (type de pronostic, compétition) en barres horizontales. */
export function RateBars({ rows, emptyLabel }: { rows: Array<Counts & { key: string; name: string }>; emptyLabel: string }) {
  const sorted = [...rows].sort((a, b) => b.won + b.lost - (a.won + a.lost));
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {sorted.map((row) => {
        const rate = successRate(row.won, row.lost);
        const decided = row.won + row.lost;
        return (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{row.name}</span>
              <span className="shrink-0 font-heading font-bold tabular-nums">{formatRate(row.won, row.lost)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8" role="presentation">
              <div className={cn("h-full rounded-full", rate === null ? "" : "bg-pronex-violet")} style={{ width: `${rate ?? 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {row.won} gagné{row.won > 1 ? "s" : ""} · {row.lost} perdu{row.lost > 1 ? "s" : ""}
              {row.void > 0 ? ` · ${row.void} annulé${row.void > 1 ? "s" : ""}` : ""}
              {decided === 0 ? " · aucun pronostic décidé" : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
