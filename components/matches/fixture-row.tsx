import Link from "next/link";
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
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      <div className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
        {showDate ? <div>{formatShortDate(fixture.kickoff_at, timezone)}</div> : null}
        <div className="text-sm font-medium text-foreground">{formatTime(fixture.kickoff_at, timezone)}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {[
          { team: fixture.home, goals: fixture.goals_home },
          { team: fixture.away, goals: fixture.goals_away },
        ].map(({ team, goals }, index) => (
          <div key={index} className="flex items-center gap-2">
            <TeamLogo name={team.name} src={team.logo_url} size={20} />
            <span className="truncate text-sm">{team.name}</span>
            {showScore ? <span className="ml-auto pl-2 text-sm font-semibold tabular-nums">{goals}</span> : null}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={fixture.status_short} />
        {hasPrediction && status.phase === "upcoming" ? <Badge variant="outline">Pronostic disponible</Badge> : null}
      </div>
    </Link>
  );
}
