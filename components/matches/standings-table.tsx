import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TeamLogo } from "./team-logo";

export type StandingRowView = {
  id: number;
  group_name: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  team: { id: number; name: string; logo_url: string | null };
};

/** Classement par groupe ; les équipes `highlightTeamIds` sont mises en évidence. */
export function StandingsTable({ rows, highlightTeamIds = [] }: { rows: StandingRowView[]; highlightTeamIds?: number[] }) {
  const groups = new Map<string, StandingRowView[]>();
  for (const row of rows) groups.set(row.group_name, [...(groups.get(row.group_name) ?? []), row]);

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, groupRows]) => (
        <div key={group} className="space-y-2">
          {groups.size > 1 && group ? <h3 className="text-sm font-medium">{group}</h3> : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-right" title="Matchs joués">J</TableHead>
                  <TableHead className="hidden text-right sm:table-cell" title="Victoires">V</TableHead>
                  <TableHead className="hidden text-right sm:table-cell" title="Nuls">N</TableHead>
                  <TableHead className="hidden text-right sm:table-cell" title="Défaites">D</TableHead>
                  <TableHead className="text-right" title="Différence de buts">Diff.</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupRows.map((row) => (
                  <TableRow key={row.id} className={cn(highlightTeamIds.includes(row.team.id) && "bg-muted font-medium")}>
                    <TableCell className="tabular-nums">{row.rank}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <TeamLogo name={row.team.name} src={row.team.logo_url} size={18} />
                        <span className="truncate">{row.team.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.played}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.won}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.drawn}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{row.lost}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.goals_for - row.goals_against > 0 ? "+" : ""}
                      {row.goals_for - row.goals_against}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{row.points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
