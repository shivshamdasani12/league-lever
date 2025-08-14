// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type UpdateBody = { league_id?: string; force_update?: boolean };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    // 1) Parse input
    const { league_id, force_update }: UpdateBody = await req.json().catch(() => ({} as UpdateBody));
    
    // 2) Create Supabase client with service role
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 3) Get current NFL state and week
    const weekRes = await fetch("https://api.sleeper.app/v1/state/nfl");
    if (!weekRes.ok) {
      return cors(new Response(JSON.stringify({ error: "Failed to get NFL state" }), { status: 502 }));
    }
    
    const stateData = await weekRes.json();
    const currentWeek = stateData.week;
    const seasonType = stateData.season_type;
    
    console.log(`Current NFL Week: ${currentWeek}, Season Type: ${seasonType}`);

    // 4) Get all player IDs from the league
    let playerIds: string[] = [];
    if (league_id) {
      // Get players for specific league
      const { data: leaguePlayers, error: leagueErr } = await adminClient
        .from("league_player_ids_v")
        .select("player_id")
        .eq("league_id", league_id);
      
      if (leagueErr) {
        console.error("Failed to get league players:", leagueErr);
        return cors(new Response(JSON.stringify({ error: "Failed to get league players" }), { status: 500 }));
      }
      
      playerIds = (leaguePlayers || []).map((p: any) => p.player_id);
    } else {
      // Get all players from database
      const { data: allPlayers, error: allErr } = await adminClient
        .from("players")
        .select("player_id");
      
      if (allErr) {
        console.error("Failed to get all players:", allErr);
        return cors(new Response(JSON.stringify({ error: "Failed to get all players" }), { status: 500 }));
      }
      
      playerIds = (allPlayers || []).map((p: any) => p.player_id);
    }

    if (playerIds.length === 0) {
      return cors(new Response(JSON.stringify({ 
        updated: 0, 
        message: "No players to update",
        current_week: currentWeek,
        season_type: seasonType
      }), { status: 200 }));
    }

    // 5) Fetch live data for current week (if season is active)
    let statsData: Record<string, any> = {};
    let projectionsData: Record<string, any> = {};
    let updatedCount = 0;

    if (currentWeek && currentWeek > 0 && seasonType === "regular") {
      try {
        // Fetch current week stats
        console.log(`Fetching stats for week ${currentWeek}`);
        const statsRes = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${currentWeek}`);
        if (statsRes.ok) {
          statsData = await statsRes.json();
          console.log(`Fetched stats for ${Object.keys(statsData).length} players`);
        }
        
        // Fetch current week projections
        console.log(`Fetching projections for week ${currentWeek}`);
        const projectionsRes = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${currentWeek}`);
        if (projectionsRes.ok) {
          projectionsData = await projectionsRes.json();
          console.log(`Fetched projections for ${Object.keys(projectionsData).length} players`);
        }
      } catch (e) {
        console.error("Failed to fetch live data:", e);
      }
    }

    // 6) Update player records with live data
    const updatePromises = playerIds.map(async (playerId) => {
      try {
        const stats = statsData[playerId] || {};
        const projections = projectionsData[playerId] || {};
        
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Only update if we have new data
        if (Object.keys(stats).length > 0) {
          updateData.current_week_stats = stats;
        }
        
        if (projections?.fantasy_points_ppr || projections?.fantasy_points) {
          updateData.current_week_projection = projections?.fantasy_points_ppr || projections?.fantasy_points;
        }

        // Only update if we have new data to avoid unnecessary updates
        if (Object.keys(updateData).length > 1) { // More than just updated_at
          const { error: updateErr } = await adminClient
            .from("players")
            .update(updateData)
            .eq("player_id", playerId);
          
          if (!updateErr) {
            updatedCount++;
          } else {
            console.error(`Failed to update player ${playerId}:`, updateErr);
          }
        }
      } catch (e) {
        console.error(`Error updating player ${playerId}:`, e);
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    return cors(new Response(JSON.stringify({ 
      updated: updatedCount,
      total_players: playerIds.length,
      current_week: currentWeek,
      season_type: seasonType,
      stats_fetched: Object.keys(statsData).length > 0,
      projections_fetched: Object.keys(projectionsData).length > 0,
      message: `Updated ${updatedCount} players with live data`
    }), { status: 200 }));

  } catch (e: any) {
    console.error("Live update error:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});
