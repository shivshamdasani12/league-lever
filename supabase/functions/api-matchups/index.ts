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

// Simple logistic function for win probability
function calculateWinProbability(teamProjection: number, oppProjection: number): number {
  if (teamProjection <= 0 || oppProjection <= 0) return 0.5;
  
  const diff = teamProjection - oppProjection;
  const probability = 1 / (1 + Math.exp(-diff / 15)); // Adjusted for fantasy points scale
  
  return Math.round(probability * 1000) / 1000; // Round to 3 decimal places
}

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

    // Get matchups for the specified week
    const { data: matchups, error } = await userClient
      .from('sleeper_matchups')
      .select('*')
      .eq('league_id', league_id)
      .eq('week', week)
      .order('matchup_id', { ascending: true, nullsFirst: true })
      .order('roster_id', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Get roster info for owner names
    const { data: rosters } = await userClient
      .from('league_rosters_v')
      .select('*')
      .eq('league_id', league_id);

    const rosterMap = new Map((rosters || []).map(r => [r.roster_id, r]));

    // Get projections for the week if available
    const { data: projections } = await userClient
      .from('player_projections')
      .select('player_id, projection_points')
      .eq('week', week);

    const projectionMap = new Map((projections || []).map(p => [p.player_id, p.projection_points]));

    // Group matchups by matchup_id
    const matchupGroups = new Map<string, any[]>();
    (matchups || []).forEach(m => {
      const key = m.matchup_id != null ? String(m.matchup_id) : `solo-${m.roster_id}`;
      if (!matchupGroups.has(key)) matchupGroups.set(key, []);
      matchupGroups.get(key)!.push(m);
    });

    // Process matchup pairs with projections
    const pairs = Array.from(matchupGroups.values()).map(group => {
      const [team1, team2] = group.sort((a, b) => a.roster_id - b.roster_id);
      
      // Calculate team projections based on starters
      const calculateTeamProjection = (team: any) => {
        if (!team.starters || !Array.isArray(team.starters)) return 0;
        return team.starters.reduce((total: number, playerId: string) => {
          return total + (projectionMap.get(playerId) || 0);
        }, 0);
      };

      const team1Projection = calculateTeamProjection(team1);
      const team2Projection = team2 ? calculateTeamProjection(team2) : 0;

      // Calculate win probabilities if both teams exist
      let team1WinProb = 0.5;
      let team2WinProb = 0.5;
      
      if (team2 && (team1Projection > 0 || team2Projection > 0)) {
        team1WinProb = calculateWinProbability(team1Projection, team2Projection);
        team2WinProb = 1 - team1WinProb;
      }

      return {
        matchup_id: team1.matchup_id,
        week,
        team1: {
          ...team1,
          owner_name: rosterMap.get(team1.roster_id)?.owner_name || 
                     rosterMap.get(team1.roster_id)?.owner_username || 
                     `Roster ${team1.roster_id}`,
          projected_points: Math.round(team1Projection * 100) / 100,
          win_probability: Math.round(team1WinProb * 1000) / 1000
        },
        team2: team2 ? {
          ...team2,
          owner_name: rosterMap.get(team2.roster_id)?.owner_name || 
                     rosterMap.get(team2.roster_id)?.owner_username || 
                     `Roster ${team2.roster_id}`,
          projected_points: Math.round(team2Projection * 100) / 100,
          win_probability: Math.round(team2WinProb * 1000) / 1000
        } : null
      };
    });

    // Get last updated timestamp
    const { data: updateInfo } = await userClient
      .from('sleeper_matchups')
      .select('updated_at')
      .eq('league_id', league_id)
      .eq('week', week)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return new Response(JSON.stringify({
      matchups: pairs,
      league_id,
      week,
      updated_at: updateInfo?.updated_at || new Date().toISOString(),
      count: pairs.length,
      projections_available: projections ? projections.length > 0 : false
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