// Deno edge function to sync all league data
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { league_id } = await req.json().catch(() => ({}));
    if (!league_id) {
      return new Response(JSON.stringify({ error: "league_id required" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Sync players data for the league
    console.log("Starting league data sync for:", league_id);
    
    const { data: playersResult, error: playersError } = await userClient.functions.invoke(
      'sleeper-sync-players', 
      { body: { league_id, fetch_live_data: true } }
    );

    if (playersError) {
      console.error("Players sync error:", playersError);
      return new Response(JSON.stringify({ error: "Players sync failed" }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log("Players sync result:", playersResult);

    return new Response(JSON.stringify({
      success: true,
      players_synced: playersResult?.upserted || 0,
      message: "League data sync completed"
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('Sync error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});