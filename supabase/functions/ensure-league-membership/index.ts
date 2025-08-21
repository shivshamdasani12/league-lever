// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Checking user authentication...");
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      console.error("User auth error:", userErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("User authenticated:", user.id);

    const body = await req.json().catch(() => ({}));
    const leagueId: string | undefined = body.league_id;
    if (!leagueId) {
      console.error("Missing league_id");
      return new Response(JSON.stringify({ error: "league_id is required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Processing league:", leagueId);

    // Check if already a member
    console.log("Checking existing membership...");
    const { data: existing, error: existErr } = await adminClient
      .from('league_members')
      .select('id, role, user_id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existErr) {
      console.warn('Membership check error:', existErr);
    }

    if (existing) {
      console.log("User is already a member with role:", existing.role);
      return new Response(JSON.stringify({ 
        ok: true, 
        already_member: true, 
        role: existing.role 
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Determine desired role: owner if created_by, else member
    console.log("Fetching league info...");
    const { data: league, error: leagueErr } = await adminClient
      .from('leagues')
      .select('id, created_by')
      .eq('id', leagueId)
      .maybeSingle();

    if (leagueErr) {
      console.error('League fetch error:', leagueErr);
      return new Response(JSON.stringify({ 
        error: leagueErr.message 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!league) {
      console.error('League not found:', leagueId);
      return new Response(JSON.stringify({ 
        error: 'League not found' 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const role = league.created_by === user.id ? 'owner' : 'member';
    console.log("Determined role:", role, "for user:", user.id);

    console.log("Upserting league membership...");
    const { error: upErr } = await adminClient
      .from('league_members')
      .upsert({ 
        league_id: leagueId, 
        user_id: user.id, 
        role 
      }, { 
        onConflict: 'league_id,user_id' 
      });

    if (upErr) {
      console.error('Upsert error:', upErr);
      return new Response(JSON.stringify({ 
        error: upErr.message 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Successfully ensured membership");
    return new Response(JSON.stringify({ 
      ok: true, 
      role 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ 
      error: (e as Error).message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});