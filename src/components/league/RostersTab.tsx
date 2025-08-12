import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchRosters, LeagueRosterRow } from "@/lib/queries/league";

interface Props { leagueId: string }

function getBench(all: string[] | null, starters: string[] | null) {
  const a = Array.isArray(all) ? all : [];
  const s = new Set(Array.isArray(starters) ? starters : []);
  return a.filter((id) => !s.has(id));
}

export default function RostersTab({ leagueId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading rosters...</p>;
  if (isError) return <p className="text-destructive">{(error as any)?.message || "Failed to load rosters."}</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground">No rosters found.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map((r: LeagueRosterRow) => {
        const starters = Array.isArray(r.starters) ? r.starters : [];
        const bench = getBench(r.players, r.starters);
        const initials = (r.owner_name || r.owner_username || "?").split(" ").map((p) => p[0]).join("").slice(0,2).toUpperCase();
        return (
          <Card key={`${r.league_id}-${r.roster_id}`}>
            <CardHeader className="flex-row items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={r.owner_avatar || undefined} alt={`${r.owner_name || r.owner_username || "Owner"} avatar`} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <CardTitle className="text-base">{r.owner_name || r.owner_username || `Roster ${r.roster_id}`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium mb-2">Starters</div>
                  <ul className="space-y-1 text-sm">
                    {starters.length === 0 && <li className="text-muted-foreground">None</li>}
                    {starters.map((pid, idx) => (
                      <li key={pid + idx} className="font-mono">{pid}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium mb-2">Bench</div>
                  <ul className="space-y-1 text-sm">
                    {bench.length === 0 && <li className="text-muted-foreground">None</li>}
                    {bench.map((pid, idx) => (
                      <li key={pid + idx} className="font-mono">{pid}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
