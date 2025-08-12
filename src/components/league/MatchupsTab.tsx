import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMatchups, fetchRosters, fetchWeeks, LeagueMatchupRow, LeagueRosterRow, LeagueWeekRow } from "@/lib/queries/league";

interface Props { leagueId: string }

export default function MatchupsTab({ leagueId }: Props) {
  const weeksQ = useQuery({
    queryKey: ["league-weeks", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchWeeks(leagueId),
  });

  const [week, setWeek] = useState<number | null>(null);

  useEffect(() => {
    if (weeksQ.data && weeksQ.data.length > 0 && week == null) {
      const latest = weeksQ.data.find((w) => w.is_latest) || weeksQ.data[weeksQ.data.length - 1];
      setWeek(latest.week);
    }
  }, [weeksQ.data, week]);

  const rostersQ = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  const matchupsQ = useQuery({
    queryKey: ["league-matchups", leagueId, week],
    enabled: !!leagueId && typeof week === "number",
    queryFn: () => fetchMatchups(leagueId, week as number),
  });

  const rosterName = useMemo(() => {
    const map = new Map<number, string>();
    (rostersQ.data || []).forEach((r: LeagueRosterRow) => {
      map.set(r.roster_id, r.owner_name || r.owner_username || `Roster ${r.roster_id}`);
    });
    return map;
  }, [rostersQ.data]);

  if (weeksQ.isLoading) return <p className="text-muted-foreground">Loading weeks...</p>;
  if (weeksQ.isError) return <p className="text-destructive">Failed to load weeks.</p>;

  const weeks = weeksQ.data as LeagueWeekRow[];

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select value={week?.toString()} onValueChange={(v) => setWeek(parseInt(v, 10))}>
          <SelectTrigger aria-label="Select week">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.week} value={w.week.toString()}>
                Week {w.week}{w.is_latest ? " (latest)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {matchupsQ.isLoading && <p className="text-muted-foreground">Loading matchups...</p>}
      {matchupsQ.isError && <p className="text-destructive">Failed to load matchups.</p>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(matchupsQ.data || []).map((m: LeagueMatchupRow) => (
          <Card key={`${m.league_id}-${m.week}-${m.roster_id}`}>
            <CardHeader>
              <CardTitle className="text-base">Week {m.week}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage alt={`${rosterName.get(m.roster_id) || "Team"} avatar`} />
                    <AvatarFallback>
                      {(rosterName.get(m.roster_id) || "T").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{rosterName.get(m.roster_id) || `Roster ${m.roster_id}`}</div>
                    <div className="text-sm text-muted-foreground">Points: {m.points ?? 0}</div>
                  </div>
                </div>
                {/* Opponent fields are null in current schema; placeholder for future pairing */}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
