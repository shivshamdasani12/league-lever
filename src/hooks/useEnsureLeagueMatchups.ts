import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/**
 * Auto-imports Sleeper matchups for a league on first mount if no weeks exist yet.
 * - Verifies weeks via league_weeks_v; only triggers import when empty
 * - After import, invalidates caches and logs validation queries
 */
export function useEnsureLeagueMatchups(leagueId?: string | null) {
  const qc = useQueryClient();
  const ranRef = useRef<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    if (ranRef.current[leagueId]) return;

    (async () => {
      try {
        // Check if any weeks already exist
        const { count, error: headErr } = await supabase
          .from("league_weeks_v")
          .select("week", { count: "exact", head: true })
          .eq("league_id", leagueId);
        if (headErr) {
          console.warn("weeks head error", headErr);
        }
        if ((count ?? 0) > 0) {
          // Weeks already present; no import needed
          ranRef.current[leagueId] = true;
          return;
        }

        ranRef.current[leagueId] = true;
        setImporting(true);
        const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
          body: { league_id: leagueId, all_to_current: true },
        });
        if (error) throw new Error(error.message);
        const up = (data as any)?.rows_upserted ?? 0;
        if (up > 0) {
          toast({ title: "Matchups imported", description: `${up} rows imported across weeks.` });
        }
        const errs = (data as any)?.errors || [];
        if (errs.length > 0) {
          const sid = (data as any)?.sleeper_league_id;
          const weeksStr = errs.map((e: any) => `${e.week}(${e.status})`).join(", ");
          toast({ title: "Sleeper import partial failures", description: `League ${sid}: weeks ${weeksStr}` });
        }
      } catch (e: any) {
        toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
        // let it try again next mount
        ranRef.current[leagueId] = false;
      } finally {
        setImporting(false);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["league-weeks", leagueId] }),
          qc.invalidateQueries({ queryKey: ["league-standings", leagueId] }),
        ]);

        // Quick validation queries
        try {
          const { count: cntMatchups } = await supabase
            .from("sleeper_matchups")
            .select("*", { count: "exact", head: true })
            .eq("league_id", leagueId);
          const { data: weeksAll } = await supabase
            .from("sleeper_matchups")
            .select("week")
            .eq("league_id", leagueId)
            .order("week", { ascending: true });
          const weeksDistinct = Array.from(new Set((weeksAll || []).map((w: any) => w.week)));
          const { data: weeksView } = await supabase
            .from("league_weeks_v")
            .select("*")
            .eq("league_id", leagueId)
            .order("week", { ascending: true });
          const { data: pairs } = await supabase
            .from("league_matchup_pairs_v")
            .select("*")
            .eq("league_id", leagueId)
            .limit(5);
          const { data: standings } = await supabase
            .from("league_standings_v")
            .select("*")
            .eq("league_id", leagueId)
            .order("win_pct", { ascending: false })
            .order("pf", { ascending: false })
            .limit(10);

          console.log("Validation — sleeper_matchups count:", cntMatchups ?? 0);
          console.log("Validation — distinct weeks:", (weeksDistinct || []).map((w: any) => w.week));
          console.log("Validation — league_weeks_v:", weeksView || []);
          console.log("Validation — league_matchup_pairs_v (sample):", pairs || []);
          console.log("Validation — league_standings_v (top):", standings || []);
        } catch (e) {
          console.warn("Validation queries failed", e);
        }
      }
    })();
  }, [leagueId, qc]);

  return { importing };
}
