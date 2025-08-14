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

    // Get league_id from request body or URL params
    let league_id: string;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      league_id = body.league_id;
    } else {
      const url = new URL(req.url);
      league_id = url.searchParams.get('league_id') || '';
    }

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

    // Get enhanced roster data from view
    const { data: rosters, error } = await userClient
      .from('league_rosters_named_v')
      .select('*')
      .eq('league_id', league_id)
      .order('roster_id');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Get last updated timestamp
    const { data: updateInfo } = await userClient
      .from('sleeper_rosters')
      .select('updated_at')
      .eq('league_id', league_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return new Response(JSON.stringify({
      rosters: rosters || [],
      league_id,
      updated_at: updateInfo?.updated_at || new Date().toISOString(),
      count: (rosters || []).length
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