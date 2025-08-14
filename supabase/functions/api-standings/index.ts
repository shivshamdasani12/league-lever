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

    // Get standings for the specified season
    const { data: standings, error } = await userClient
      .from('sleeper_standings')
      .select('*')
      .eq('league_id', league_id)
      .eq('season', season)
      .order('rank', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Calculate additional stats
    const processedStandings = (standings || []).map(team => {
      const totalGames = team.wins + team.losses + team.ties;
      const winPercentage = totalGames > 0 ? team.wins / totalGames : 0;
      
      return {
        ...team,
        total_games: totalGames,
        win_percentage: Math.round(winPercentage * 1000) / 1000,
        points_per_game: totalGames > 0 ? Math.round((team.points_for / totalGames) * 100) / 100 : 0,
        points_against_per_game: totalGames > 0 ? Math.round((team.points_against / totalGames) * 100) / 100 : 0
      };
    });

    // Get last updated timestamp
    const { data: updateInfo } = await userClient
      .from('sleeper_standings')
      .select('updated_at')
      .eq('league_id', league_id)
      .eq('season', season)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return new Response(JSON.stringify({
      standings: processedStandings,
      league_id,
      season,
      updated_at: updateInfo?.updated_at || new Date().toISOString(),
      count: processedStandings.length
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