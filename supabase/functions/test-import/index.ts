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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Test basic database connection
    const { data: leagues, error: leaguesErr } = await supabase
      .from('leagues')
      .select('*')
      .limit(1);
    
    if (leaguesErr) {
      return new Response(JSON.stringify({ error: `Leagues table error: ${leaguesErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Test sleeper_league_users table
    const { data: users, error: usersErr } = await supabase
      .from('sleeper_league_users')
      .select('*')
      .limit(1);
    
    if (usersErr) {
      return new Response(JSON.stringify({ error: `Users table error: ${usersErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Test sleeper_rosters table
    const { data: rosters, error: rostersErr } = await supabase
      .from('sleeper_rosters')
      .select('*')
      .limit(1);
    
    if (rostersErr) {
      return new Response(JSON.stringify({ error: `Rosters table error: ${rostersErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Test sleeper_matchups table
    const { data: matchups, error: matchupsErr } = await supabase
      .from('sleeper_matchups')
      .select('*')
      .limit(1);
    
    if (matchupsErr) {
      return new Response(JSON.stringify({ error: `Matchups table error: ${matchupsErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "All tables accessible",
      leagues: leagues,
      users: users,
      rosters: rosters,
      matchups: matchups
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
