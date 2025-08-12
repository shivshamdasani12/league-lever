import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchStandings, LeagueStandingRow } from "@/lib/queries/league";
import { Loader2 } from "lucide-react";
import { useEnsureLeagueMatchups } from "@/hooks/useEnsureLeagueMatchups";

interface Props { leagueId: string }

export default function StandingsTab({ leagueId }: Props) {
  const { importing } = useEnsureLeagueMatchups(leagueId);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["league-standings", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchStandings(leagueId),
  });

  if (isLoading || importing) return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading standings...</span>
    </div>
  );
  
  if (isError) return <p className="text-destructive">{(error as any)?.message || "Failed to load standings."}</p>;
  
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-muted-foreground">
          <h3 className="text-lg font-semibold mb-2">No Standings Available</h3>
          <p className="mb-4">
            This league doesn't have any standings yet. During preseason, standings will appear 
            automatically once the regular season begins and games are played.
          </p>
          <p className="text-sm">
            The system will automatically import matchup data from Sleeper when available.
          </p>
        </div>
      </div>
    );
  }

  // Check if this is preseason (all teams have 0-0 records)
  const isPreseason = data.every((row: LeagueStandingRow) => 
    row.wins === 0 && row.losses === 0 && row.ties === 0
  );

  return (
    <div className="w-full overflow-auto">
      {isPreseason && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Preseason Mode:</strong> No games have been played yet. 
            Standings show team rosters and will update automatically when the season begins.
          </div>
        </div>
      )}
      
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
