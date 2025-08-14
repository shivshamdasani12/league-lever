// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify auth
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const url = new URL(req.url);
    const league_id = url.searchParams.get('league_id');
    const week = parseInt(url.searchParams.get('week') || '1');
    const season = parseInt(url.searchParams.get('season') || '2024');

    if (!league_id) {
      return new Response(JSON.stringify({ error: "league_id required" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Verify league membership
    const { data: memberRow, error: memberErr } = await userClient
      .from("league_members")
      .select("user_id")
      .eq("league_id", league_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !memberRow) {
      return new Response(JSON.stringify({ error: "Forbidden (not a league member)" }), { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    // Get player IDs relevant to this league
    const { data: playerIds } = await userClient
      .from('league_player_ids_v')
      .select('player_id')
      .eq('league_id', league_id);

    if (!playerIds || playerIds.length === 0) {
      return new Response(JSON.stringify({
        projections: [],
        league_id,
        week,
        season,
        updated_at: new Date().toISOString(),
        count: 0
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const relevantPlayerIds = playerIds.map(p => p.player_id);

    // Get projections for the specified week and season
    const { data: projections, error } = await userClient
      .from('player_projections')
      .select('player_id, projection_points, projection_data, updated_at')
      .eq('season', season)
      .eq('week', week)
      .in('player_id', relevantPlayerIds)
      .order('projection_points', { ascending: false, nullsLast: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Get player details
    const { data: players } = await userClient
      .from('players')
      .select('player_id, full_name, position, team, current_week_projection')
      .in('player_id', relevantPlayerIds);

    const playerMap = new Map((players || []).map(p => [p.player_id, p]));

    // Combine projections with player details
    const enrichedProjections = (projections || []).map(proj => {
      const player = playerMap.get(proj.player_id);
      return {
        ...proj,
        player_name: player?.full_name,
        position: player?.position,
        team: player?.team,
        current_week_projection: player?.current_week_projection
      };
    });

    // Get last updated timestamp
    const latestUpdate = enrichedProjections.length > 0 
      ? enrichedProjections.reduce((latest, proj) => 
          new Date(proj.updated_at) > new Date(latest) ? proj.updated_at : latest
        , enrichedProjections[0].updated_at)
      : new Date().toISOString();

    return new Response(JSON.stringify({
      projections: enrichedProjections,
      league_id,
      week,
      season,
      updated_at: latestUpdate,
      count: enrichedProjections.length
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});