import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchMatchups, fetchRosters, fetchWeeks, LeagueMatchupRow, LeagueRosterRow, LeagueWeekRow } from "@/lib/queries/league";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

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

  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const selectedWeek = typeof week === "number" ? week : 1;

  const handleImportWeek = async () => {
    if (!leagueId) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
        body: { league_id: leagueId, weeks: [selectedWeek] },
      });
      if (error) throw new Error(error.message);
      toast({ title: "Matchups imported", description: `Week ${selectedWeek} imported successfully.` });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["league-weeks", leagueId] }),
        qc.invalidateQueries({ queryKey: ["league-matchups", leagueId] }),
        qc.invalidateQueries({ queryKey: ["league-matchups", leagueId, selectedWeek] }),
        qc.invalidateQueries({ queryKey: ["league-standings", leagueId] }),
      ]);
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
    } finally {
      setImporting(false);
    }
  };

  const handleBackfillAll = async () => {
    if (!leagueId) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
        body: { league_id: leagueId, all_to_current: true },
      });
      if (error) throw new Error(error.message);
      const up = (data as any)?.rows_upserted ?? 0;
      toast({ title: "Backfill complete", description: `${up} rows upserted across weeks.` });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["league-weeks", leagueId] }),
        qc.invalidateQueries({ queryKey: ["league-matchups", leagueId] }),
        qc.invalidateQueries({ queryKey: ["league-standings", leagueId] }),
      ]);
    } catch (e: any) {
      toast({ title: "Backfill failed", description: e?.message ?? "Unknown error" });
    } finally {
      setImporting(false);
    }
  };

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

  // Debug logs for investigating data flow
  console.log('=== MATCHUPS DEBUG ===');
  console.log('League ID:', leagueId);
  console.log('Weeks data:', weeksQ.data);
  console.log('Current week:', week);
  console.log('Matchups data:', matchupsQ.data);
  console.log('Matchup pairs:', matchupPairs);

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select value={week?.toString()} onValueChange={(v) => {
          const next = parseInt(v, 10);
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
              <SelectItem key={w.week} value={w.week.toString()}>
                Week {w.week}{w.is_latest ? " (latest)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {matchupsQ.isLoading && <p className="text-muted-foreground">Loading matchups...</p>}
      {matchupsQ.isError && <p className="text-destructive">Failed to load matchups.</p>}

      <div className="flex items-center gap-3">
        {(!weeks || weeks.length === 0) ? (
          <Button variant="secondary" onClick={handleBackfillAll} disabled={importing || !leagueId}>
            {importing ? "Importing..." : "Backfill matchups (1..current)"}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleImportWeek} disabled={importing || !leagueId}>
              {importing ? "Importing..." : `Import matchups for week ${selectedWeek}`}
            </Button>
            {((!weeks?.length) || !weeks.some(w => w.week === selectedWeek)) && (
              <span className="text-sm text-muted-foreground">No data yet for this week.</span>
            )}
          </>
        )}
      </div>

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
