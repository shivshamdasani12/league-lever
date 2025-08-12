import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/**
 * Auto-imports Sleeper matchups for a league on first mount if no weeks exist yet.
 * OPTIMIZED FOR PERFORMANCE AND SCALABILITY
 * - Verifies weeks via league_weeks_v; only triggers import when empty
 * - After import, invalidates caches efficiently and logs validation queries
 * - Uses refs and callbacks to prevent unnecessary re-renders
 */
export function useEnsureLeagueMatchups(leagueId?: string | null) {
  const qc = useQueryClient();
  const ranRef = useRef<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  
  // Memoize the query client to prevent unnecessary re-renders
  const qcRef = useRef(qc);
  qcRef.current = qc;

  // Memoize the import function to prevent recreation on every render
  const performImport = useCallback(async (leagueId: string) => {
    try {
      // Check if any weeks already exist
      const { count, error: headErr } = await supabase
        .from("league_weeks_v")
        .select("week", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if (headErr) {
        console.warn("weeks head error", headErr);
      }
      
      // During preseason, always attempt import even if no weeks exist
      // This ensures we get the schedule structure
      const shouldImport = (count ?? 0) === 0;
      
      if (!shouldImport) {
        // Weeks already present; no import needed
        ranRef.current[leagueId] = true;
        return;
      }

      ranRef.current[leagueId] = true;
      setImporting(true);
      
      console.log("No weeks found, attempting Sleeper import for league:", leagueId);
      
      // Import matchups from Sleeper API
      const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
        body: { league_id: leagueId, all_to_current: true },
      });
      if (error) throw new Error(error.message);
      
      const up = (data as any)?.rows_upserted ?? 0;
      const message = (data as any)?.message ?? "";
      
      console.log("Sleeper import result:", { up, message, data });
      
      if (up > 0) {
        toast({ title: "Schedule imported", description: `${up} rows imported across weeks.` });
      } else if (message && message.includes("preseason")) {
        toast({ 
          title: "Preseason detected", 
          description: "Schedule structure imported. Check the week dropdown above!" 
        });
      } else if (up === 0) {
        toast({ 
          title: "Schedule imported", 
          description: "Schedule structure imported from Sleeper. You can now navigate between weeks!" 
        });
      }
      const errs = (data as any)?.errors || [];
      if (errs.length > 0) {
        const sid = (data as any)?.sleeper_league_id;
        const weeksStr = errs.map((e: any) => `${e.week}(${e.status})`).join(", ");
        toast({ title: "Sleeper import partial failures", description: `League ${sid}: weeks ${weeksStr}` });
      }
    } catch (e: any) {
      console.error("Import failed:", e);
      toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
      // let it try again next mount
      ranRef.current[leagueId] = false;
    } finally {
      setImporting(false);
      
      // Small delay to ensure database updates are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // OPTIMIZED: Single broad invalidation instead of multiple specific ones
      // This is more efficient and ensures all related queries are refreshed
      await qcRef.current.invalidateQueries({ 
        queryKey: ["league", leagueId],
        exact: false 
      });

      // Quick validation queries for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
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
            .from("league_matchups_v")
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
          console.log("Validation — league_matchups_v (sample):", pairs || []);
          console.log("Validation — league_standings_v (top):", standings || []);
        } catch (e) {
          console.warn("Validation queries failed", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    if (ranRef.current[leagueId]) return;

    performImport(leagueId);
  }, [leagueId, performImport]);

  return { importing };
}
