// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
}

// Default PPR scoring
const DEFAULT_SCORING = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -2,
  rush_yd: 0.1,
  rush_td: 6,
  rec: 1, // PPR
  rec_yd: 0.1,
  rec_td: 6,
  fumble_lost: -2,
  pass_2pt: 2,
  rush_2pt: 2,
  rec_2pt: 2,
};

function calculateFantasyPoints(projections: any, scoring: any = DEFAULT_SCORING): number {
  let points = 0;
  
  for (const [stat, value] of Object.entries(projections)) {
    const multiplier = scoring[stat];
    if (multiplier && typeof value === 'number') {
      points += value * multiplier;
    }
  }
  
  return Math.round(points * 100) / 100; // Round to 2 decimal places
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify auth
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return cors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
    }

    const { league_id, season, week } = await req.json().catch(() => ({}));
    if (!league_id) {
      return cors(new Response(JSON.stringify({ error: "league_id required" }), { status: 400 }));
    }

    // Verify league membership
    const { data: memberRow, error: memberErr } = await userClient
      .from("league_members")
      .select("user_id")
      .eq("league_id", league_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !memberRow) {
      return cors(new Response(JSON.stringify({ error: "Forbidden (not a league member)" }), { status: 403 }));
    }

    // Get current NFL state to determine season/week
    const stateRes = await fetch("https://api.sleeper.app/v1/state/nfl");
    if (!stateRes.ok) {
      return cors(new Response(JSON.stringify({ error: "Failed to get NFL state" }), { status: 502 }));
    }

    const nflState = await stateRes.json();
    const currentSeason = season || nflState.season || 2024;
    const currentWeek = week || nflState.week || 1;

    // Skip if not regular season
    if (nflState.season_type !== 'regular') {
      return cors(new Response(JSON.stringify({ 
        league_id, 
        season: currentSeason,
        week: currentWeek,
        skipped: true,
        reason: "Not regular season"
      }), { status: 200 }));
    }

    console.log(`Syncing projections for season ${currentSeason}, week ${currentWeek}`);

    // Fetch projections from Sleeper
    const projectionsRes = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${currentWeek}`);
    if (!projectionsRes.ok) {
      return cors(new Response(JSON.stringify({ error: `Sleeper projections API error: ${projectionsRes.status}` }), { status: 502 }));
    }

    const projectionsData = await projectionsRes.json() as Record<string, any>;

    // Get league scoring settings if available
    const { data: leagueData } = await userClient
      .from("leagues")
      .select("scoring_settings")
      .eq("id", league_id)
      .single();

    const scoringSettings = leagueData?.scoring_settings || DEFAULT_SCORING;

    // Get player IDs that are relevant to this league
    const { data: playerIds } = await userClient
      .from("league_player_ids_v")
      .select("player_id")
      .eq("league_id", league_id);

    const relevantPlayerIds = new Set((playerIds || []).map(p => p.player_id));

    // Process projections
    const projectionRows = [];
    const playerUpdateRows = [];

    for (const [playerId, projections] of Object.entries(projectionsData)) {
      if (!projections || typeof projections !== 'object') continue;

      const fantasyPoints = calculateFantasyPoints(projections, scoringSettings);

      // Add to player_projections table
      projectionRows.push({
        player_id: playerId,
        season: currentSeason,
        week: currentWeek,
        points: fantasyPoints,
        updated_at: new Date().toISOString(),
      });

      // Update current_week_projection in players table if relevant to league
      if (relevantPlayerIds.has(playerId)) {
        playerUpdateRows.push({
          player_id: playerId,
          current_week_projection: fantasyPoints,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (projectionRows.length === 0) {
      return cors(new Response(JSON.stringify({ 
        league_id, 
        season: currentSeason,
        week: currentWeek,
        skipped: true,
        message: "No projections to sync" 
      }), { status: 200 }));
    }

    // Upsert projections
    const { error: projectionsErr, count: projectionsCount } = await adminClient
      .from("player_projections")
      .upsert(projectionRows, { onConflict: "player_id,season,week", count: "exact" });

    if (projectionsErr) {
      console.error("Projections upsert error:", projectionsErr);
      return cors(new Response(JSON.stringify({ error: projectionsErr.message }), { status: 500 }));
    }

    // Update players table with current week projections
    let playersUpdated = 0;
    if (playerUpdateRows.length > 0) {
      const { error: playersErr, count: playersCount } = await adminClient
        .from("players")
        .upsert(playerUpdateRows, { onConflict: "player_id", count: "exact" });

      if (playersErr) {
        console.warn("Players update error:", playersErr);
      } else {
        playersUpdated = playersCount ?? 0;
      }
    }

    console.log(`Synced ${projectionsCount} projections, updated ${playersUpdated} players`);

    return cors(new Response(JSON.stringify({
      league_id,
      season: currentSeason,
      week: currentWeek,
      projections_synced: projectionsCount ?? projectionRows.length,
      players_updated: playersUpdated,
      skipped: false
    }), { status: 200 }));

  } catch (e: any) {
    console.error("Error:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});