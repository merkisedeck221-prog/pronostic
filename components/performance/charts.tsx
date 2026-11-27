import { formatRate } from "@/lib/settle/labels";
import type { Counts } from "@/lib/settle/schemas";
import { successRate } from "@/lib/settle/rules";
import { cn } from "@/lib/utils";

/**
 * Graphiques de performances (landing et page /performances) : HTML / CSS / SVG,
 * sans bibliothèque. Chaque graphique a un équivalent textuel pour les lecteurs
 * d'écran. Les chiffres viennent tels quels de get_performance_stats : rien
 * n'est extrapolé ; taux = gagnés ÷ (gagnés + perdus), annulés exclus.
 */

const WEEK_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function weekLabel(weekStart: string): string {
  return WEEK_FORMAT.format(new Date(`${weekStart}T12:00:00Z`));
}

/** Anneau du taux de réussite (dégradé rose → violet). « — » sans pronostic décidé. */
export function RateRing({
  won,
  lost,
  size = 176,
  label = "Taux de réussite",
}: {
  won: number;
  lost: number;
  size?: number;
  label?: string;
}) {
  const rate = successRate(won, lost);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = ((rate ?? 0) / 100) * circumference;
  return (
    <figure className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <defs>
          <linearGradient id="pronex-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff1493" />
            <stop offset="100%" stopColor="#a000ff" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.07)"
          strokeWidth={stroke}
        />
        {rate !== null && rate > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#pronex-ring)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="drop-shadow-[0_0_10px_rgb(255_20_147_/_0.45)]"
          />
        ) : null}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading text-4xl font-black tracking-tight italic tabular-nums">
          {formatRate(won, lost)}
        </span>
        <span className="mt-1 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </span>
      </figcaption>
    </figure>
  );
}

const SHORT_WEEK_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/**
 * Résultats par semaine : barres segmentées (gagnés, perdus, annulés), courbe
 * du taux de réussite avec aire dégradée, info-bulle au survol.
 */
export function WeeklyChart({
  weeks,
}: {
  weeks: Array<Counts & { week_start: string }>;
}) {
  const max = Math.max(1, ...weeks.map((w) => w.won + w.lost + w.void));
  const ticks = [max, Math.round(max / 2), 0];
  // Points de la courbe du taux (semaines sans pronostic décidé : pas de point).
  const points = weeks.map((w, i) => {
    const rate = successRate(w.won, w.lost);
    return rate === null
      ? null
      : { x: ((i + 0.5) / weeks.length) * 100, y: 100 - rate };
  });
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point) current.push(point);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);

  return (
    <figure className="space-y-4">
      <div className="flex gap-3">
        {/* Axe des volumes */}
        <div
          className="flex h-56 flex-col justify-between text-right text-[11px] leading-none text-muted-foreground tabular-nums"
          aria-hidden
        >
          {ticks.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>

        <div className="relative h-56 flex-1" aria-hidden>
          {/* Grille */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "border-t",
                  i === ticks.length - 1
                    ? "border-white/12"
                    : "border-dashed border-white/[0.06]",
                )}
              />
            ))}
          </div>

          {/* Aire et courbe du taux de réussite (0 → 100 %) */}
          <svg
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pronex-rate-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff1493" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#ff1493" stopOpacity="0" />
              </linearGradient>
            </defs>
            {segments.map((segment) =>
              segment.length > 1 ? (
                <polygon
                  key={`a-${segment[0].x}`}
                  points={`${segment[0].x},100 ${segment.map((p) => `${p.x},${p.y}`).join(" ")} ${segment[segment.length - 1].x},100`}
                  fill="url(#pronex-rate-area)"
                />
              ) : null,
            )}
          </svg>

          {/* Barres */}
          <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
            {weeks.map((w, index) => {
              const total = w.won + w.lost + w.void;
              // Info-bulle alignée sur le bord pour les premières et dernières semaines (pas de débordement).
              const align =
                index < 2
                  ? "left-0"
                  : index > weeks.length - 3
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2";
              return (
                <div
                  key={w.week_start}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <div className="absolute inset-x-0 top-0 bottom-0 rounded-lg bg-white/0 transition-colors duration-200 group-hover:bg-white/[0.03]" />
                  {total === 0 ? (
                    <div className="relative h-1 w-full max-w-[1.375rem] rounded-full bg-white/10" />
                  ) : (
                    <div
                      className="relative flex w-full max-w-[1.375rem] flex-col gap-[2px] transition-transform duration-200 group-hover:-translate-y-0.5"
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {w.void > 0 ? (
                        <div
                          className="min-h-[3px] rounded-[5px] bg-white/15"
                          style={{ flexGrow: w.void }}
                        />
                      ) : null}
                      {w.lost > 0 ? (
                        <div
                          className="min-h-[3px] rounded-[5px] bg-[#f87171]/75"
                          style={{ flexGrow: w.lost }}
                        />
                      ) : null}
                      {w.won > 0 ? (
                        <div
                          className="min-h-[3px] rounded-[5px] bg-linear-to-t from-success/80 to-[#4ade80] shadow-[0_0_14px_-2px_rgb(34_197_94_/_0.55)]"
                          style={{ flexGrow: w.won }}
                        />
                      ) : null}
                    </div>
                  )}
                  {/* Info-bulle */}
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-2 hidden w-40 rounded-2xl border border-white/10 bg-pronex-night/95 p-3 text-left text-[11px] shadow-2xl shadow-black/60 backdrop-blur group-hover:block",
                      align,
                    )}
                  >
                    <p className="font-semibold text-foreground">
                      Semaine du {weekLabel(w.week_start)}
                    </p>
                    <p className="mt-2 flex justify-between text-success">
                      Gagnés <span className="tabular-nums">{w.won}</span>
                    </p>
                    <p className="flex justify-between text-red-400">
                      Perdus <span className="tabular-nums">{w.lost}</span>
                    </p>
                    <p className="flex justify-between text-muted-foreground">
                      Annulés <span className="tabular-nums">{w.void}</span>
                    </p>
                    <p className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold text-pronex-pink">
                      Taux{" "}
                      <span className="tabular-nums">
                        {formatRate(w.won, w.lost)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <svg
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {segments.map((segment) => (
              <polyline
                key={`l-${segment[0].x}`}
                points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#ff1493"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="drop-shadow-[0_0_8px_rgb(255_20_147_/_0.7)]"
              />
            ))}
          </svg>
          {points.map((point, i) =>
            point ? (
              <span
                key={weeks[i].week_start}
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pronex-pink bg-pronex-night shadow-[0_0_8px_rgb(255_20_147_/_0.8)]"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* Dates : une sur deux sur ordinateur, une sur quatre sur mobile */}
      <div
        className="flex gap-1 pl-7 text-[11px] text-muted-foreground tabular-nums sm:gap-2"
        aria-hidden
      >
        {weeks.map((w, i) => (
          <span
            key={w.week_start}
            className={cn(
              "min-w-0 flex-1 text-center",
              i % 2 !== 0
                ? "invisible"
                : i % 4 !== 0
                  ? "invisible sm:visible"
                  : "",
            )}
          >
            {SHORT_WEEK_FORMAT.format(new Date(`${w.week_start}T12:00:00Z`))}
          </span>
        ))}
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <LegendDot className="bg-[#4ade80]" label="Gagnés" />
        <LegendDot className="bg-[#f87171]" label="Perdus" />
        <LegendDot className="bg-white/25" label="Annulés" />
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full bg-pronex-pink shadow-[0_0_6px_rgb(255_20_147_/_0.8)]"
          />{" "}
          Taux de réussite
        </span>
        <span className="basis-full text-[11px] sm:ml-auto sm:basis-auto">Semaines du lundi (heure de Porto-Novo)</span>
      </figcaption>

      {/* Un tableau ne se réduit pas avec sr-only : on masque un bloc qui l'enveloppe. */}
      <div className="sr-only">
        <table>
          <caption>Pronostics résolus par semaine</caption>
          <thead>
            <tr>
              <th>Semaine du</th>
              <th>Gagnés</th>
              <th>Perdus</th>
              <th>Annulés</th>
              <th>Taux de réussite</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week_start}>
                <td>{weekLabel(w.week_start)}</td>
                <td>{w.won}</td>
                <td>{w.lost}</td>
                <td>{w.void}</td>
                <td>{formatRate(w.won, w.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2.5 rounded-full", className)} />{" "}
      {label}
    </span>
  );
}

/**
 * Taux de réussite par ligne (type de pronostic, compétition) : répartition
 * gagnés / perdus / annulés en barre segmentée, taux en grand.
 */
export function RateBars({
  rows,
  emptyLabel,
}: {
  rows: Array<Counts & { key: string; name: string }>;
  emptyLabel: string;
}) {
  const sorted = [...rows].sort((a, b) => b.won + b.lost - (a.won + a.lost));
  if (sorted.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="divide-y divide-white/[0.06]">
      {sorted.map((row, index) => {
        const total = row.won + row.lost + row.void;
        const decided = row.won + row.lost;
        const rate = successRate(row.won, row.lost);
        return (
          <li
            key={row.key}
            className="group grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 gap-y-2 py-3.5 first:pt-1 last:pb-1"
          >
            <span
              className="font-heading text-xs font-bold text-white/25 tabular-nums"
              aria-hidden
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 space-y-2">
              <p className="truncate text-sm font-semibold">{row.name}</p>
              <div
                className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/[0.06]"
                role="presentation"
              >
                {total > 0 ? (
                  <>
                    {row.won > 0 ? (
                      <div
                        className="rounded-full bg-linear-to-r from-success to-[#4ade80]"
                        style={{ flexGrow: row.won }}
                      />
                    ) : null}
                    {row.lost > 0 ? (
                      <div
                        className="rounded-full bg-destructive/80"
                        style={{ flexGrow: row.lost }}
                      />
                    ) : null}
                    {row.void > 0 ? (
                      <div
                        className="rounded-full bg-white/20"
                        style={{ flexGrow: row.void }}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                <span className="text-success">
                  {row.won} gagné{row.won > 1 ? "s" : ""}
                </span>{" "}
                ·{" "}
                <span className="text-red-400">
                  {row.lost} perdu{row.lost > 1 ? "s" : ""}
                </span>
                {row.void > 0
                  ? ` · ${row.void} annulé${row.void > 1 ? "s" : ""}`
                  : ""}
                {decided === 0 ? " · aucun pronostic décidé" : ""}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-heading text-2xl font-black italic tabular-nums",
                  rate === null && "text-muted-foreground",
                )}
              >
                {formatRate(row.won, row.lost)}
              </p>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                réussite
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
