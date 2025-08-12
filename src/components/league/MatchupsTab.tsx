import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMatchupPairs, fetchRosters, fetchWeeks, LeagueMatchupRow, LeagueRosterRow, LeagueWeekRow } from "@/lib/queries/league";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useEnsureLeagueMatchups } from "@/hooks/useEnsureLeagueMatchups";

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
    if (weeksQ.data && weeksQ.data.length > 0 && (week == null || !params.get("week"))) {
      const latest = weeksQ.data.find((w) => w.is_latest) || weeksQ.data[weeksQ.data.length - 1];
      setWeek(latest.week);
      const nextParams = new URLSearchParams(params);
      nextParams.set("week", String(latest.week));
      setParams(nextParams, { replace: true });
    }
  }, [weeksQ.data, week, params, setParams]);

  const { importing: importingAll } = useEnsureLeagueMatchups(leagueId);
  const qc = useQueryClient();
  const [importingWeek, setImportingWeek] = useState(false);
  const selectedWeek = typeof week === "number" ? week : 1;

  // Week-level import effect moved below after matchupsQ declaration to avoid TDZ

  // Backfill button removed; automatic import runs on page load via useEnsureLeagueMatchups

  const rostersQ = useQuery({
    queryKey: ["league-rosters", leagueId],
    enabled: !!leagueId,
    queryFn: () => fetchRosters(leagueId),
  });

  const matchupsQ = useQuery({
    queryKey: ["matchup-pairs", leagueId, week],
    enabled: !!leagueId && typeof week === "number",
    queryFn: () => fetchMatchupPairs(leagueId, week as number),
  });

  // Ensure selected week's data exists; fetch from Sleeper only if missing
  useEffect(() => {
    if (!leagueId || typeof week !== "number") return;
    if (matchupsQ.isLoading) return;
    const rows = (matchupsQ.data || []) as LeagueMatchupRow[];
    if (rows.length === 0) {
      (async () => {
        setImportingWeek(true);
        try {
          const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
            body: { league_id: leagueId, weeks: [week] },
          });
          if (error) throw new Error(error.message);
          const errs = (data as any)?.errors || [];
          if (errs.length > 0) {
            const sid = (data as any)?.sleeper_league_id;
            const weeksStr = errs.map((e: any) => `${e.week}(${e.status})`).join(", ");
            toast({ title: "Sleeper import failed", description: `League ${sid}: weeks ${weeksStr}` });
          }
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["matchup-pairs", leagueId, week] }),
            qc.invalidateQueries({ queryKey: ["league-weeks", leagueId] }),
            qc.invalidateQueries({ queryKey: ["standings", leagueId] }),
            qc.invalidateQueries({ queryKey: ["league-standings", leagueId] }),
          ]);
        } catch (e: any) {
          toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
        } finally {
          setImportingWeek(false);
        }
      })();
    }
  }, [leagueId, week, matchupsQ.isLoading, matchupsQ.data, qc]);

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

  if (weeksQ.isLoading) return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading weeks...</span>
    </div>
  );
  if (weeksQ.isError) return <p className="text-destructive">Failed to load weeks.</p>;
  const weeks = weeksQ.data as LeagueWeekRow[];

  // Debug logs for investigating data flow
  console.log('=== MATCHUPS DEBUG ===');
  console.log('League ID:', leagueId);
  console.log('Weeks data:', weeksQ.data);
  console.log('Current week:', week);
  console.log('Matchups data for key', ["matchup-pairs", leagueId, week], matchupsQ.data);
  console.log('Matchup pairs:', matchupPairs);

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select value={week != null ? String(week) : ""} onValueChange={(v) => {
          const next = Number(v);
          setWeek(next);
          setParams((prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.set("week", String(next));
            return newParams;
          }, { replace: true });
        }}>
          <SelectTrigger aria-label="Select week">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w.week} value={String(w.week)}>
                Week {w.week}{w.is_latest ? " (latest)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(matchupsQ.isLoading || importingAll || importingWeek) && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading matchups...</span>
        </div>
      )}
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
