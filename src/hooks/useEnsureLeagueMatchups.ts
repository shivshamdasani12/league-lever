import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

/**
 * Ensures league matchups are imported from week 1..current on first load.
 * - Runs once per mount per leagueId
 * - Invalidates weeks and standings after completion
 */
export function useEnsureLeagueMatchups(leagueId?: string | null) {
  const qc = useQueryClient();
  const ranRef = useRef<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    if (ranRef.current[leagueId]) return; // already ran for this league in this session

    ranRef.current[leagueId] = true;
    (async () => {
      setImporting(true);
      try {
        const { data, error } = await supabase.functions.invoke("sleeper-import-matchups", {
          body: { league_id: leagueId, all_to_current: true },
        });
        if (error) throw new Error(error.message);
        const up = (data as any)?.rows_upserted ?? 0;
        if (up > 0) {
          toast({ title: "Matchups imported", description: `${up} rows imported across weeks.` });
        }
      } catch (e: any) {
        toast({ title: "Import failed", description: e?.message ?? "Unknown error" });
        // allow retry on next mount/navigation by resetting flag
        ranRef.current[leagueId] = false;
      } finally {
        setImporting(false);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["league-weeks", leagueId] }),
          qc.invalidateQueries({ queryKey: ["league-standings", leagueId] }),
        ]);
      }
    })();
  }, [leagueId, qc]);

  return { importing };
}
