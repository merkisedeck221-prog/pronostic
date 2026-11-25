import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FixtureListItem } from "@/lib/catalog/queries";
import { formatShortDate, formatTime } from "@/lib/utils/dates";
import { matchStatus } from "@/lib/utils/match-status";
import { StatusBadge } from "./status-badge";
import { TeamLogo } from "./team-logo";

/**
 * Ligne de match cliquable : heure locale, équipes et logos, score si commencé,
 * statut, pastille « Pronostic disponible » (booléen uniquement).
 */
export function FixtureRow({
  fixture,
  timezone,
  hasPrediction,
  showDate = false,
}: {
  fixture: FixtureListItem;
  timezone: string;
  hasPrediction: boolean;
  showDate?: boolean;
}) {
  const status = matchStatus(fixture.status_short);
  const showScore = (status.phase === "live" || status.phase === "finished") && fixture.goals_home !== null && fixture.goals_away !== null;

  return (
    <Link
      href={`/matchs/${fixture.id}`}
      className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
    >
      <div className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
        {showDate ? <div>{formatShortDate(fixture.kickoff_at, timezone)}</div> : null}
        <div className="font-heading text-sm font-bold text-foreground">{formatTime(fixture.kickoff_at, timezone)}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {[
          { team: fixture.home, goals: fixture.goals_home },
          { team: fixture.away, goals: fixture.goals_away },
        ].map(({ team, goals }, index) => (
          <div key={index} className="flex items-center gap-2">
            <TeamLogo name={team.name} src={team.logo_url} size={20} />
            <span className="truncate text-sm font-medium">{team.name}</span>
            {showScore ? <span className="ml-auto pl-2 text-sm font-semibold tabular-nums">{goals}</span> : null}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={fixture.status_short} />
        {hasPrediction && status.phase === "upcoming" ? (
          <Badge variant="outline" className="gap-1 border-pronex-pink/40 bg-pronex-pink/10 text-pink-200">
            <SparklesIcon className="size-3" aria-hidden />
            <span className="hidden sm:inline">Pronostic disponible</span>
            <span className="sm:hidden">IA</span>
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
