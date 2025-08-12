import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  league_id: string;
  weeks?: number[];
  all_to_current?: boolean;
};

async function fetchWithRetry(url: string, init?: RequestInit, retries = 3, backoffMs = 500) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || i === retries) return res;
    const delay = backoffMs * Math.pow(2, i);
    console.log(`Retrying ${url} in ${delay}ms (status ${res.status})`);
    await new Promise((r) => setTimeout(r, delay));
  }
  // Should never reach here
  return fetch(url, init);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { league_id, weeks, all_to_current }: Payload = await req.json();
    if (!league_id) {
      return new Response(JSON.stringify({ error: "league_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Missing Supabase env configuration");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // RLS-safe read to verify membership
    const { data: memberRows, error: memberErr } = await userClient
      .from("league_members")
      .select("id")
      .eq("league_id", league_id)
      .limit(1);

    if (memberErr) {
      console.error("Membership check failed:", memberErr);
      return new Response(JSON.stringify({ error: "Membership check failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!memberRows || memberRows.length === 0) {
      return new Response(JSON.stringify({ error: "Not a league member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve external Sleeper league id from our DB using internal UUID
    const { data: leagueRow, error: leagueErr } = await userClient
      .from("leagues")
      .select("external_id, provider")
      .eq("id", league_id)
      .single();

    if (leagueErr || !leagueRow?.external_id) {
      console.error("External league id lookup failed", { league_id, leagueErr });
      return new Response(
        JSON.stringify({ error: "Missing external Sleeper league id mapping for this league" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sleeperLeagueId = String(leagueRow.external_id);

    // Compute target weeks robustly
    let targetWeeks: number[] | undefined = Array.isArray(weeks) && weeks.length > 0 ? weeks : undefined;

    if (!targetWeeks) {
      let currentWeek: number | null = null;
      try {
        const stateRes = await fetchWithRetry("https://api.sleeper.app/v1/state/nfl");
        if (stateRes.ok) {
          const state = await stateRes.json();
          currentWeek = Number(state?.week);
        } else {
          console.warn("NFL state fetch failed", { status: stateRes.status });
        }
      } catch (e) {
        console.warn("NFL state fetch threw", e);
      }

      if (all_to_current && typeof currentWeek === "number" && currentWeek >= 1) {
        targetWeeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
      } else {
        // Default to full regular season when unknown
        targetWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
      }
    }

    if (!targetWeeks || targetWeeks.length === 0) {
      return new Response(JSON.stringify({ error: "No weeks to import" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Import start", { internal_league_id: league_id, sleeper_league_id: sleeperLeagueId, weeks: targetWeeks });

    const imported_weeks: number[] = [];
    let rows_upserted = 0;
    const errors: Array<{ week: number; status: number; body?: string }> = [];

    for (const wk of targetWeeks) {
      const url = `https://api.sleeper.app/v1/league/${sleeperLeagueId}/matchups/${wk}`;
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        const txt = await res.text();
        console.error("Fetch failed", { week: wk, sleeper_league_id: sleeperLeagueId, status: res.status, body: txt });
        errors.push({ week: wk, status: res.status, body: txt?.slice(0, 200) });
        continue;
      }
      const matchups = await res.json();
      const fetchedCount = Array.isArray(matchups) ? matchups.length : 0;
      if (!Array.isArray(matchups)) {
        console.log("No matchups array", { week: wk, sleeper_league_id: sleeperLeagueId });
        continue;
      }

      const rows = matchups.map((m: any) => ({
        league_id,
        week: wk,
        matchup_id: typeof m.matchup_id === "number" ? m.matchup_id : null,
        roster_id: Number(m.roster_id),
        points: typeof m.points === "number" ? m.points : Number(m.points ?? 0),
        starters: m.starters ?? null,
        players: m.players ?? null,
        is_playoffs: Boolean(m.playoff_matchup ?? m.is_playoffs ?? false),
        is_consolation: Boolean(m.is_consolation ?? false),
      }));

      // Upsert using service role (idempotent)
      const { data, error } = await serviceClient
        .from("sleeper_matchups")
        .upsert(rows, { onConflict: "league_id,week,roster_id" })
        .select("league_id");

      if (error) {
        console.error("Upsert error week", wk, error.message);
        continue;
      }

      rows_upserted += data?.length ?? 0;
      imported_weeks.push(wk);
      console.log(`Week ${wk} imported`, { fetched: fetchedCount, upserted: data?.length ?? 0 });
    }

    return new Response(
      JSON.stringify({ imported_weeks: imported_weeks.length, rows_upserted, sleeper_league_id: sleeperLeagueId, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sleeper-import-matchups error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
