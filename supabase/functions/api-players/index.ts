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
    const search = url.searchParams.get('search') || '';
    const league_id = url.searchParams.get('league_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    let query = userClient
      .from('players')
      .select('*')
      .order('search_rank', { ascending: true, nullsLast: true });

    // If league_id provided, filter to players in that league
    if (league_id) {
      const { data: playerIds } = await userClient
        .from('league_player_ids_v')
        .select('player_id')
        .eq('league_id', league_id);
      
      if (playerIds && playerIds.length > 0) {
        const ids = playerIds.map(p => p.player_id);
        query = query.in('player_id', ids);
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,last_name.ilike.%${search}%,first_name.ilike.%${search}%`);
    }

    query = query.limit(limit);

    const { data: players, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    return new Response(JSON.stringify({
      players: players || [],
      updated_at: new Date().toISOString(),
      search,
      league_id,
      count: (players || []).length
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