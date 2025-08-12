import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchStandings, LeagueStandingRow } from "@/lib/queries/league";

interface Props { leagueId: string }

export default function StandingsTab({ leagueId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["league-standings", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchStandings(leagueId),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading standings...</p>;
  if (isError) return <p className="text-destructive">{(error as any)?.message || "Failed to load standings."}</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground">No standings yet. Use Backfill Matchups from the Matchups tab.</p>;

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Team</TableHead>
            <TableHead>W</TableHead>
            <TableHead>L</TableHead>
            <TableHead>T</TableHead>
            <TableHead>Win %</TableHead>
            <TableHead>PF</TableHead>
            <TableHead>PA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data as LeagueStandingRow[]).map((row) => (
            <TableRow key={`${row.league_id}-${row.roster_id}`}>
              <TableCell className="font-medium">{row.owner_name || `Roster ${row.roster_id}`}</TableCell>
              <TableCell>{row.wins}</TableCell>
              <TableCell>{row.losses}</TableCell>
              <TableCell>{row.ties}</TableCell>
              <TableCell>{Number(row.win_pct).toFixed(3)}</TableCell>
              <TableCell>{Number(row.pf).toFixed(2)}</TableCell>
              <TableCell>{Number(row.pa).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
