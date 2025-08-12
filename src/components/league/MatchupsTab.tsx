import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMatchups, fetchRosters, fetchWeeks, LeagueMatchupRow, LeagueRosterRow, LeagueWeekRow } from "@/lib/queries/league";

interface Props { leagueId: string }

export default function MatchupsTab({ leagueId }: Props) {
  const [params, setParams] = useSearchParams();

  const weeksQ = useQuery({
    queryKey: ["league-weeks", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchWeeks(leagueId),
  });

  const initialWeek = (() => {
    const w = params.get("week");
    return w ? parseInt(w, 10) : null;
  })();

  const [week, setWeek] = useState<number | null>(initialWeek);

  useEffect(() => {
    if (weeksQ.data && weeksQ.data.length > 0 && week == null) {
      const latest = weeksQ.data.find((w) => w.is_latest) || weeksQ.data[weeksQ.data.length - 1];
      setWeek(latest.week);
      params.set("week", String(latest.week));
      setParams(params, { replace: true });
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

  const matchupPairs = useMemo(() => {
    const pairs: Array<{ a: LeagueMatchupRow; b?: LeagueMatchupRow }> = [];
    const rows = (matchupsQ.data || []) as LeagueMatchupRow[];
    const byRoster = new Map<number, LeagueMatchupRow>();
    rows.forEach((r) => byRoster.set(r.roster_id, r));
    rows.forEach((r) => {
      if (r.opp_roster_id != null) {
        if (r.roster_id < r.opp_roster_id) {
          pairs.push({ a: r, b: byRoster.get(r.opp_roster_id) });
        }
      } else {
        pairs.push({ a: r });
      }
    });
    return pairs;
  }, [matchupsQ.data]);

  if (weeksQ.isLoading) return <p className="text-muted-foreground">Loading weeks...</p>;
  if (weeksQ.isError) return <p className="text-destructive">Failed to load weeks.</p>;

  const weeks = weeksQ.data as LeagueWeekRow[];

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select value={week?.toString()} onValueChange={(v) => {
          const next = parseInt(v, 10);
          setWeek(next);
          const nextParams = new URLSearchParams(params);
          nextParams.set("week", String(next));
          setParams(nextParams, { replace: true });
        }}>
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
        {matchupPairs.length === 0 && !matchupsQ.isLoading && (
          <p className="text-muted-foreground col-span-full">No matchups for week {week}.</p>
        )}
        {matchupPairs.map(({ a, b }) => (
          <Card key={`${a.league_id}-${a.week}-${a.roster_id}-${b?.roster_id ?? "solo"}`}>
            <CardHeader>
              <CardTitle className="text-base">Week {a.week}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage alt={`${rosterName.get(a.roster_id) || "Team"} avatar`} />
                    <AvatarFallback>
                      {(rosterName.get(a.roster_id) || "T").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{rosterName.get(a.roster_id) || `Roster ${a.roster_id}`}</div>
                    <div className="text-sm text-muted-foreground">Points: {a.points ?? 0}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-muted-foreground">vs</div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage alt={`${b ? rosterName.get(b.roster_id) : "Opponent"} avatar`} />
                    <AvatarFallback>
                      {(b ? (rosterName.get(b.roster_id) || "T") : "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{b ? (rosterName.get(b.roster_id) || `Roster ${b.roster_id}`) : "TBD"}</div>
                    <div className="text-sm text-muted-foreground">Points: {b?.points ?? 0}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
