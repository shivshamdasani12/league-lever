import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

async function ensureMembership(leagueId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("ensure-league-membership", {
      body: { league_id: leagueId },
    });
    if (error) throw new Error(error.message);
    return data as any;
  } catch (e) {
    console.warn("ensureMembership failed:", e);
    return null;
  }
}

export function useEnsureLeaguePlayers(leagueId?: string | null) {
  const ranRef = useRef<Record<string, boolean>>({});
  const [syncingPlayers, setSyncingPlayers] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    const key = leagueId;
    if (ranRef.current[key]) return;

    (async () => {
      ranRef.current[key] = true;
      try {
        setSyncingPlayers(true);
        // Ensure membership first
        await ensureMembership(leagueId);
        // Kick off player sync for this league
        const { data, error } = await supabase.functions.invoke("sleeper-sync-players", {
          body: { league_id: leagueId, fetch_live_data: true },
        });
        if (error) throw new Error(error.message);
        const result = data as any;
        console.log("sleeper-sync-players result:", result);
        if (result?.upserted_count > 0) {
          toast({ title: "Players synced", description: `${result.upserted_count} players updated.` });
        }
      } catch (e: any) {
        console.error("Player sync failed:", e);
        // Let it retry next mount
        ranRef.current[key] = false;
      } finally {
        setSyncingPlayers(false);
      }
    })();
  }, [leagueId]);

  return { syncingPlayers };
}
