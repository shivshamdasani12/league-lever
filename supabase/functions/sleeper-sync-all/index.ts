// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

async function callSleeperFunction(functionName: string, payload: any, authHeader: string): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${functionName} failed: ${response.status}`);
  }

  return await response.json();
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
      return cors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
    }

    const { league_id, season, week } = await req.json().catch(() => ({}));
    if (!league_id) {
      return cors(new Response(JSON.stringify({ error: "league_id required" }), { status: 400 }));
    }

    console.log(`Starting comprehensive sync for league ${league_id}`);

    const results: any = {
      league_id,
      season,
      week,
      started_at: new Date().toISOString(),
      functions: {}
    };

    const basePayload = { league_id, season, week };

    try {
      // 1. Sync players first (foundation for everything else)
      console.log("Step 1: Syncing players...");
      results.functions.players = await callSleeperFunction('sleeper-sync-players', {
        league_id,
        fetch_live_data: true
      }, authHeader);
    } catch (e: any) {
      console.error("Players sync failed:", e);
      results.functions.players = { error: e.message };
    }

    try {
      // 2. Sync rosters
      console.log("Step 2: Syncing rosters...");
      results.functions.rosters = await callSleeperFunction('sleeper-sync-rosters', basePayload, authHeader);
    } catch (e: any) {
      console.error("Rosters sync failed:", e);
      results.functions.rosters = { error: e.message };
    }

    try {
      // 3. Sync matchups for current week
      console.log("Step 3: Syncing matchups...");
      results.functions.matchups = await callSleeperFunction('sleeper-import-matchups', {
        league_id,
        week
      }, authHeader);
    } catch (e: any) {
      console.error("Matchups sync failed:", e);
      results.functions.matchups = { error: e.message };
    }

    try {
      // 4. Sync projections
      console.log("Step 4: Syncing projections...");
      results.functions.projections = await callSleeperFunction('sleeper-sync-projections', basePayload, authHeader);
    } catch (e: any) {
      console.error("Projections sync failed:", e);
      results.functions.projections = { error: e.message };
    }

    try {
      // 5. Compute standings last (depends on matchups)
      console.log("Step 5: Computing standings...");
      results.functions.standings = await callSleeperFunction('sleeper-sync-standings', basePayload, authHeader);
    } catch (e: any) {
      console.error("Standings sync failed:", e);
      results.functions.standings = { error: e.message };
    }

    results.completed_at = new Date().toISOString();
    results.duration_ms = new Date(results.completed_at).getTime() - new Date(results.started_at).getTime();

    // Count successes and failures
    const functionResults = Object.values(results.functions);
    const successes = functionResults.filter((r: any) => !r.error).length;
    const failures = functionResults.filter((r: any) => r.error).length;

    results.summary = {
      total_functions: functionResults.length,
      successes,
      failures,
      success_rate: `${Math.round((successes / functionResults.length) * 100)}%`
    };

    console.log(`Sync completed: ${successes}/${functionResults.length} functions succeeded`);

    return cors(new Response(JSON.stringify(results), { status: 200 }));

  } catch (e: any) {
    console.error("Sync all error:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});