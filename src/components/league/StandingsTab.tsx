import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchRosters, LeagueRosterRow } from "@/lib/queries/league";
import { Loader2 } from "lucide-react";
import { useEnsureLeagueMatchups } from "@/hooks/useEnsureLeagueMatchups";

interface Props { 
  leagueId: string;
  onRosterSelect?: (rosterId: string) => void;
}

export default function StandingsTab({ leagueId, onRosterSelect }: Props) {
  const { importing } = useEnsureLeagueMatchups(leagueId);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
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

  // Debug: Log the data structure
  console.log("StandingsTab: Received data:", data);
  console.log("StandingsTab: onRosterSelect function:", onRosterSelect);

  // Check if this is preseason (all teams have 0-0 records)
  const isPreseason = true; // During preseason, we only have roster data

  return (
    <div className="w-full overflow-auto">
      {isPreseason && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Preseason Mode:</strong> No games have been played yet. 
            This table shows team rosters and will update to show standings when the season begins.
          </div>
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Team</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Players</TableHead>
            <TableHead>Starters</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data as LeagueRosterRow[]).map((row) => (
            <TableRow key={`${row.league_id}-${row.roster_id}`}>
              <TableCell className="font-medium">
                {onRosterSelect ? (
                  <button
                    onClick={() => {
                      console.log("StandingsTab: Username clicked for roster:", row.roster_id);
                      onRosterSelect(String(row.roster_id));
                    }}
                    className="hover:text-primary hover:underline cursor-pointer transition-colors"
                  >
                    {row.owner_name || row.owner_username || `Roster ${row.roster_id}`}
                  </button>
                ) : (
                  row.owner_name || row.owner_username || `Roster ${row.roster_id}`
                )}
              </TableCell>
              <TableCell>{row.owner_name || row.owner_username || 'Unknown'}</TableCell>
              <TableCell>{Array.isArray(row.players) ? row.players.length : 0}</TableCell>
              <TableCell>{Array.isArray(row.starters) ? row.starters.length : 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
