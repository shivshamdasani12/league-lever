// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const season = parseInt(url.searchParams.get('season') || '2025');
    const scoring = url.searchParams.get('scoring') || 'PPR';

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

    // Create admin client for RPC call
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
        scoring,
        updated_max: null,
        count: 0
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const relevantPlayerIds = playerIds.map(p => p.player_id);

    // Use RPC function to get projections with proper source preference
    const { data: projections, error } = await adminClient
      .rpc('get_league_projections', {
        in_league_player_ids: relevantPlayerIds,
        in_season: season,
        in_week: week
      });

    if (error) {
      console.error('RPC error:', error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Calculate updated_max from the results
    let updated_max: string | null = null;
    if (projections && projections.length > 0) {
      for (const p of projections) {
        if (!updated_max || (p.updated_at && p.updated_at > updated_max)) {
          updated_max = p.updated_at;
        }
      }
    }

    return new Response(JSON.stringify({
      projections: projections || [],
      league_id,
      week,
      season,
      scoring,
      updated_max,
      count: (projections || []).length
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Edge function error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});