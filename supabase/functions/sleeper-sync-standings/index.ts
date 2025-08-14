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

    const { league_id, season } = await req.json().catch(() => ({}));
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

    // Get league external_id for Sleeper API
    const { data: league, error: leagueErr } = await userClient
      .from("leagues")
      .select("external_id, season")
      .eq("id", league_id)
      .single();

    if (leagueErr || !league?.external_id) {
      return cors(new Response(JSON.stringify({ error: "League external_id not found" }), { status: 404 }));
    }

    const currentSeason = season || league.season || 2024;
    console.log(`Computing standings for league ${league.external_id}, season ${currentSeason}`);

    // Get all matchups for the season to compute standings
    const { data: matchups, error: matchupsErr } = await adminClient
      .from("sleeper_matchups")
      .select("roster_id, points, matchup_id, week")
      .eq("league_id", league_id)
      .order("week");

    if (matchupsErr) {
      return cors(new Response(JSON.stringify({ error: "Failed to fetch matchups" }), { status: 500 }));
    }

    // Get rosters for owner names
    const { data: rosters, error: rostersErr } = await adminClient
      .from("sleeper_rosters")
      .select("roster_id, owner_sleeper_user_id")
      .eq("league_id", league_id);

    if (rostersErr) {
      return cors(new Response(JSON.stringify({ error: "Failed to fetch rosters" }), { status: 500 }));
    }

    // Get user names
    const { data: users, error: usersErr } = await adminClient
      .from("sleeper_league_users")
      .select("sleeper_user_id, display_name, username")
      .eq("league_id", league_id);

    const userMap = new Map((users || []).map(u => [u.sleeper_user_id, u.display_name || u.username]));
    const rosterOwnerMap = new Map((rosters || []).map(r => [r.roster_id, userMap.get(r.owner_sleeper_user_id)]));

    // Group matchups by week and matchup_id to determine wins/losses
    const standings = new Map<number, {
      wins: number;
      losses: number;
      ties: number;
      points_for: number;
      points_against: number;
      owner_name: string;
    }>();

    // Initialize standings for all rosters
    (rosters || []).forEach(roster => {
      standings.set(roster.roster_id, {
        wins: 0,
        losses: 0,
        ties: 0,
        points_for: 0,
        points_against: 0,
        owner_name: rosterOwnerMap.get(roster.roster_id) || `Roster ${roster.roster_id}`
      });
    });

    // Group matchups by week and matchup_id
    const weekMatchups = new Map<string, any[]>();
    (matchups || []).forEach(m => {
      if (m.matchup_id) {
        const key = `${m.week}-${m.matchup_id}`;
        if (!weekMatchups.has(key)) weekMatchups.set(key, []);
        weekMatchups.get(key)!.push(m);
      }
    });

    // Calculate wins/losses/ties and points
    weekMatchups.forEach(matchup => {
      if (matchup.length === 2) {
        const [team1, team2] = matchup;
        const standing1 = standings.get(team1.roster_id);
        const standing2 = standings.get(team2.roster_id);

        if (standing1 && standing2) {
          const points1 = Number(team1.points || 0);
          const points2 = Number(team2.points || 0);

          standing1.points_for += points1;
          standing1.points_against += points2;
          standing2.points_for += points2;
          standing2.points_against += points1;

          if (points1 > points2) {
            standing1.wins++;
            standing2.losses++;
          } else if (points2 > points1) {
            standing2.wins++;
            standing1.losses++;
          } else {
            standing1.ties++;
            standing2.ties++;
          }
        }
      }
    });

    // Create standings rows
    const standingsRows = Array.from(standings.entries()).map(([roster_id, stats], index) => ({
      league_id,
      season: currentSeason,
      roster_id,
      owner_name: stats.owner_name,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      points_for: stats.points_for,
      points_against: stats.points_against,
      rank: index + 1, // Will be updated after sorting
      updated_at: new Date().toISOString(),
    }));

    // Sort by wins (desc), then points_for (desc), then points_against (asc)
    standingsRows.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.points_for !== b.points_for) return b.points_for - a.points_for;
      return a.points_against - b.points_against;
    });

    // Update ranks
    standingsRows.forEach((row, index) => {
      row.rank = index + 1;
    });

    if (standingsRows.length === 0) {
      return cors(new Response(JSON.stringify({ 
        league_id, 
        season: currentSeason,
        skipped: true, 
        message: "No standings to compute" 
      }), { status: 200 }));
    }

    // Upsert standings
    const { error: upsertErr, count } = await adminClient
      .from("sleeper_standings")
      .upsert(standingsRows, { onConflict: "league_id,season,roster_id", count: "exact" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return cors(new Response(JSON.stringify({ error: upsertErr.message }), { status: 500 }));
    }

    console.log(`Computed standings for ${count} teams in league ${league_id}`);

    return cors(new Response(JSON.stringify({
      league_id,
      season: currentSeason,
      computed: count ?? standingsRows.length,
      matchups_processed: weekMatchups.size
    }), { status: 200 }));

  } catch (e: any) {
    console.error("Error:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});