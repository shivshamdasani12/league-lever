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

    const { league_id } = await req.json().catch(() => ({}));
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
      .select("external_id")
      .eq("id", league_id)
      .single();

    if (leagueErr || !league?.external_id) {
      return cors(new Response(JSON.stringify({ error: "League external_id not found" }), { status: 404 }));
    }

    console.log(`Syncing rosters for league ${league.external_id}`);

    // Fetch rosters from Sleeper
    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${league.external_id}/rosters`);
    if (!rostersRes.ok) {
      return cors(new Response(JSON.stringify({ error: `Sleeper API error: ${rostersRes.status}` }), { status: 502 }));
    }

    const rostersData = await rostersRes.json() as any[];

    // Fetch users to get owner info
    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.external_id}/users`);
    const usersData = usersRes.ok ? await usersRes.json() : [];
    const usersMap = new Map(usersData.map((u: any) => [u.user_id, u]));

    const rows = rostersData.map((roster: any) => {
      const owner = usersMap.get(roster.owner_id) || {};
      return {
        league_id,
        roster_id: roster.roster_id,
        owner_sleeper_user_id: roster.owner_id,
        players: roster.players || [],
        starters: roster.starters || [],
        settings: roster.settings || {},
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length === 0) {
      return cors(new Response(JSON.stringify({ 
        league_id, 
        skipped: true, 
        message: "No rosters to sync" 
      }), { status: 200 }));
    }

    // Upsert rosters
    const { error: upsertErr, count } = await adminClient
      .from("sleeper_rosters")
      .upsert(rows, { onConflict: "league_id,roster_id", count: "exact" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return cors(new Response(JSON.stringify({ error: upsertErr.message }), { status: 500 }));
    }

    // Also sync user info
    const userRows = usersData.map((user: any) => ({
      league_id,
      sleeper_user_id: user.user_id,
      username: user.username || user.display_name,
      display_name: user.display_name,
      avatar: user.avatar,
      is_commissioner: user.is_commissioner || false,
    }));

    if (userRows.length > 0) {
      await adminClient
        .from("sleeper_league_users")
        .upsert(userRows, { onConflict: "league_id,sleeper_user_id" });
    }

    console.log(`Synced ${count} rosters for league ${league_id}`);

    return cors(new Response(JSON.stringify({
      league_id,
      upserted: count ?? rows.length,
      users_synced: userRows.length
    }), { status: 200 }));

  } catch (e: any) {
    console.error("Error:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});