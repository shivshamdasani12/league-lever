import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { fetchWeeks, fetchMatchups, LeagueWeekRow, LeagueMatchupRow } from "@/lib/queries/league";
import { useEnsureLeagueMatchups } from "@/hooks/useEnsureLeagueMatchups";
import { supabase } from "@/integrations/supabase/client";

interface Props { leagueId: string; }

export default function MatchupsTab({ leagueId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = searchParams;
  const qc = useQueryClient();

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

  // Memoize the week selection logic to prevent unnecessary recalculations
  const selectedWeek = useMemo(() => {
    if (weeksQ.data && weeksQ.data.length > 0 && (week == null || !params.get("week"))) {
      return weeksQ.data.find(w => w.week === 1) || weeksQ.data[0];
    }
    return null;
  }, [weeksQ.data, week, params]);

  // Memoize the week change handler to prevent recreation on every render
  const handleWeekChange = useCallback((value: string) => {
    const next = Number(value);
    setWeek(next);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("week", String(next));
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (selectedWeek) {
      setWeek(selectedWeek.week);
      const nextParams = new URLSearchParams(params);
      nextParams.set("week", String(selectedWeek.week));
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedWeek, params, setSearchParams]);

  const { importing: importingAll } = useEnsureLeagueMatchups(leagueId);

  const matchupsQ = useQuery({
    queryKey: ["matchups", leagueId, week],
    enabled: !!leagueId && typeof week === "number",
    queryFn: () => fetchMatchups(leagueId, week as number),
  });

  const rostersQ = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_rosters_v")
        .select("*")
        .eq("league_id", leagueId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Memoize the roster name mapping to prevent recalculation on every render
  const rosterName = useMemo(() => {
    const map = new Map<number, string>();
    (rostersQ.data || []).forEach((r: any) => {
      map.set(r.roster_id, r.owner_name || r.owner_username || `Roster ${r.roster_id}`);
    });
    return map;
  }, [rostersQ.data]);

  // OPTIMIZED: More efficient matchup pairing algorithm
  const matchupPairs = useMemo(() => {
    const rows = (matchupsQ.data || []) as LeagueMatchupRow[];
    if (rows.length === 0) return [];
    
    const pairs: Array<{ team1: LeagueMatchupRow; team2?: LeagueMatchupRow }> = [];
    
    // Use a more efficient pairing algorithm
    for (let i = 0; i < rows.length; i += 2) {
      const team1 = rows[i];
      const team2 = rows[i + 1];
      
      if (team1) {
        pairs.push({ team1, team2 });
      }
    }
    
    return pairs;
  }, [matchupsQ.data]);

  // Memoize the weeks data to prevent unnecessary re-renders
  const weeks = useMemo(() => weeksQ.data || [], [weeksQ.data]);
  const hasWeeks = weeks.length > 0;

  // Memoize the loading states to prevent unnecessary re-renders
  const isLoading = useMemo(() => 
    weeksQ.isLoading || matchupsQ.isLoading || importingAll, 
    [weeksQ.isLoading, matchupsQ.isLoading, importingAll]
  );

  const hasError = useMemo(() => 
    weeksQ.isError || matchupsQ.isError, 
    [weeksQ.isError, matchupsQ.isError]
  );

  if (weeksQ.isLoading) {
    return <div className="p-4 text-center text-muted-foreground">Loading weeks...</div>;
  }

  if (weeksQ.isError) {
    return <div className="p-4 text-center text-destructive">Failed to load weeks.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Always show week dropdown during preseason */}
      <div className="max-w-xs">
        <Select value={week != null ? String(week) : ""} onValueChange={handleWeekChange}>
          <SelectTrigger aria-label="Select week">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {hasWeeks ? (
              weeks.map((w) => (
                <SelectItem key={w.week} value={String(w.week)}>
                  Week {w.week}{w.is_latest ? " (current)" : ""}
                </SelectItem>
              ))
            ) : (
              // Show placeholder weeks during preseason
              Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <SelectItem key={w} value={String(w)} disabled>
                  Week {w} (Import Required)
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Show preseason message if no weeks available */}
      {!hasWeeks && (
        <div className="p-8 text-center space-y-4">
          {importingAll ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Importing season schedule from Sleeper...</span>
            </div>
          ) : (
            <div className="text-muted-foreground">
              <h3 className="text-lg font-semibold mb-2">Preseason - Schedule Loading...</h3>
              <p className="mb-4">
                The regular season hasn't started yet, but the system is automatically importing 
                the full season schedule from Sleeper. This should only take a few seconds.
              </p>
              <p className="text-sm">
                <strong>Tip:</strong> Check the Standings tab to see all teams in your league.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Show matchups if weeks are available */}
      {hasWeeks && (
        <>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading matchups...</span>
            </div>
          )}
          
          {hasError && <p className="text-destructive">Failed to load matchups.</p>}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {matchupPairs.length === 0 && !isLoading && (
              <p className="text-muted-foreground col-span-full">No matchups for week {week}.</p>
            )}
            
            {matchupPairs.map(({ team1, team2 }) => (
              <Card key={`${team1.league_id}-${team1.week}-${team1.roster_id}`}>
                <CardHeader>
                  <CardTitle className="text-base">Week {team1.week}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage alt={`${rosterName.get(team1.roster_id) || "Team"} avatar`} />
                        <AvatarFallback>
                          {(rosterName.get(team1.roster_id) || "T").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{rosterName.get(team1.roster_id) || `Roster ${team1.roster_id}`}</div>
                        <div className="text-sm text-muted-foreground">Points: {team1.points ?? 0}</div>
                      </div>
                    </div>
                    
                    {team2 ? (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">vs</div>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage alt={`${rosterName.get(team2.roster_id) || "Opponent"} avatar`} />
                            <AvatarFallback>
                              {(rosterName.get(team2.roster_id) || "T").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{rosterName.get(team2.roster_id) || `Roster ${team2.roster_id}`}</div>
                            <div className="text-sm text-muted-foreground">Points: {team2.points ?? 0}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm font-medium text-blue-600">BYE WEEK</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
