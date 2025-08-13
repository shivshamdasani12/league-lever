import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/**
 * Triggers import for a specific league and week.
 * Used by MatchupsTab to ensure data exists for the selected week.
 */
export function useEnsureLeagueMatchups(leagueId?: string | null, week?: number | null) {
  const qc = useQueryClient();
  const ranRef = useRef<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  
  // Memoize the query client to prevent unnecessary re-renders
  const qcRef = useRef(qc);
  qcRef.current = qc;

  // Import function for specific week
  const performImport = useCallback(async (leagueId: string, week: number) => {
    const key = `${leagueId}-${week}`;
    
    try {
      // Check if this week already has data
      const { count, error: headErr } = await supabase
        .from("sleeper_matchups")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueId)
        .eq("week", week);
      
      if (headErr) {
        console.warn("week data check error", headErr);
      }
      
      if ((count ?? 0) > 0) {
        // Data already exists for this week
        ranRef.current[key] = true;
        return;
      }

      ranRef.current[key] = true;
      setImporting(true);
      
      console.log(`Importing data for league ${leagueId}, week ${week}`);
      
      // Import specific week from Sleeper API
      const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
        body: { league_id: leagueId, weeks: [week] },
      });
      if (error) throw new Error(error.message);
      
      const result = data as any;
      console.log("Import result:", result);
      
      if (result?.ok && result?.rows_upserted > 0) {
        toast({ 
          title: "Week imported", 
          description: `Week ${week} data imported successfully.` 
        });
      } else if (result?.skippedPreseason) {
        toast({ 
          title: "Preseason week", 
          description: "No data available during preseason." 
        });
      } else if (result?.skippedEmpty) {
        toast({ 
          title: "No data", 
          description: `No matchup data available for week ${week}.` 
        });
      }
    } catch (e: any) {
      console.error("Import failed:", e);
      toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
      // let it try again next mount
      ranRef.current[key] = false;
    } finally {
      setImporting(false);
      
      // Small delay to ensure database updates are complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidate queries related to this league and week
      await qcRef.current.invalidateQueries({ 
        queryKey: ["leagueMatchups", leagueId, week]
      });
      await qcRef.current.invalidateQueries({ 
        queryKey: ["league-weeks", leagueId]
      });
    }
  }, []);

  useEffect(() => {
    if (!leagueId || !week) return;
    const key = `${leagueId}-${week}`;
    if (ranRef.current[key]) return;

    performImport(leagueId, week);
  }, [leagueId, week, performImport]);

  return { importing };
}
