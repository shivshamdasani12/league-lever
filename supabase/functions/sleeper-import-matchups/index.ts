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

    // Early NFL state check for preseason gating
    let seasonType: string | null = null;
    let currentWeekNum: number | null = null;
    
    try {
      const stateRes = await fetchWithRetry("https://api.sleeper.app/v1/state/nfl");
      if (stateRes.ok) {
        const state = await stateRes.json();
        seasonType = String(state?.season_type ?? "");
        currentWeekNum = Number(state?.week);
        console.log("NFL state check:", { season_type: seasonType, current_week: currentWeekNum });
      } else {
        console.warn("NFL state fetch failed", { status: stateRes.status });
      }
    } catch (e) {
      console.warn("NFL state fetch threw", e);
    }

    // Block preseason/offseason imports unless manual weeks specified
    if (!Array.isArray(weeks) && (seasonType !== "regular" || !(typeof currentWeekNum === "number" && currentWeekNum >= 1))) {
      console.log("Blocking preseason/offseason auto-import", { seasonType, currentWeekNum, league_id });
      return new Response(JSON.stringify({
        ok: true,
        league_id,
        season_type: seasonType,
        current_week: currentWeekNum,
        skippedPreseason: true,
        imported_weeks: 0,
        rows_upserted: 0,
        message: "Preseason/offseason - no auto-import"
      }), {
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

    // Compute target weeks
    let targetWeeks: number[] | undefined = Array.isArray(weeks) && weeks.length > 0 ? weeks.map(Number) : undefined;

    if (!targetWeeks) {

      if (all_to_current) {
        // Only import up to current week during regular season
        if (seasonType === "regular" && currentWeekNum && currentWeekNum >= 1) {
          targetWeeks = Array.from({ length: currentWeekNum }, (_, i) => i + 1);
        } else {
          // Not regular season or invalid week - already handled above
          targetWeeks = [];
        }
      } else {
        // Manual import: only import regular season weeks if in regular season
        if (seasonType === "regular" && currentWeekNum && currentWeekNum >= 1) {
          targetWeeks = Array.from({ length: currentWeekNum }, (_, i) => i + 1);
        } else {
          targetWeeks = [];
        }
      }
    }

    if (!targetWeeks || targetWeeks.length === 0) {
      return new Response(JSON.stringify({ error: "No weeks to import" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Import start", { internal_league_id: league_id, sleeper_league_id: sleeperLeagueId, season_type: seasonType, current_week: currentWeekNum, weeks: targetWeeks });

    // Add preseason detection logging
    if (targetWeeks.length === 0) {
      console.log("No weeks to import - likely preseason/offseason", { 
        seasonType, 
        currentWeekNum, 
        league_id: league_id,
        message: "League will show 0 weeks until regular season begins"
      });
      return new Response(JSON.stringify({
        imported_weeks: 0,
        rows_upserted: 0,
        internal_league_id: league_id,
        sleeper_league_id: sleeperLeagueId,
        season_type: seasonType,
        current_week: currentWeekNum,
        requested_weeks: targetWeeks,
        fetched: {},
        upserted: 0,
        message: "No weeks imported - preseason/offseason detected"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imported_weeks: number[] = [];
    let rows_upserted = 0;
    const errors: Array<{ week: number; status: number; body?: string }> = [];
    const fetchedCounts: Record<number, number> = {};

    // Batch fetch all weeks concurrently instead of sequentially
    const weekPromises = targetWeeks.map(async (wk) => {
      try {
        const url = `https://api.sleeper.app/v1/league/${sleeperLeagueId}/matchups/${wk}`;
        const res = await fetchWithRetry(url);
        
        if (!res.ok) {
          const txt = await res.text();
          console.error("Fetch failed", { week: wk, sleeper_league_id: sleeperLeagueId, status: res.status, body: txt });
          errors.push({ week: wk, status: res.status, body: txt?.slice(0, 200) });
          return { week: wk, success: false, data: null };
        }
        
        const matchups = await res.json();
        const fetchedCount = Array.isArray(matchups) ? matchups.length : 0;
        fetchedCounts[wk] = fetchedCount;

        if (!Array.isArray(matchups)) {
          console.log("No matchups array", { week: wk, sleeper_league_id: sleeperLeagueId });
          return { week: wk, success: false, data: null };
        }

        // During preseason, import schedule structure even if no actual game results
        if (fetchedCount === 0 && (seasonType === "regular" || seasonType === "post")) {
          console.log(`Week ${wk} fetched 0 matchups during regular/post season — skipping upsert`);
          return { week: wk, success: false, data: null };
        }
        
        // For preseason, we want to import the schedule structure even with 0 matchups
        if (fetchedCount === 0) {
          console.log(`Week ${wk} fetched 0 matchups during preseason — this might be the schedule structure`);
        }

        return { week: wk, success: true, data: matchups, count: fetchedCount };
      } catch (error) {
        console.error(`Error processing week ${wk}:`, error);
        errors.push({ week: wk, status: 500, body: String(error) });
        return { week: wk, success: false, data: null };
      }
    });

    // Wait for all weeks to be fetched concurrently
    const weekResults = await Promise.all(weekPromises);
    
    // Prepare all rows for batch upsert
    const allRows: any[] = [];
    
    weekResults.forEach((result) => {
      if (result.success && result.data) {
        const rows = result.data
          .filter((m: any) => m && m.roster_id != null)
          .map((m: any) => ({
            league_id,
            week: result.week,
            matchup_id: typeof m.matchup_id === "number" ? m.matchup_id : null,
            roster_id: Number(m.roster_id),
            points: typeof m.points === "number" ? m.points : Number(m.points ?? 0),
            starters: m.starters ?? null,
            players: m.players ?? null,
          }));
        
        allRows.push(...rows);
        imported_weeks.push(result.week);
        console.log(`Week ${result.week} prepared`, { fetched: result.count, prepared: rows.length });
      }
    });

    // Single batch upsert instead of multiple individual upserts
    if (allRows.length > 0) {
      const { data, error } = await serviceClient
        .from("sleeper_matchups")
        .upsert(allRows, { onConflict: "league_id,week,roster_id" })
        .select("league_id");

      if (error) {
        console.error("Batch upsert error:", error.message);
        throw error;
      }

      rows_upserted = data?.length ?? 0;
      console.log(`Batch upsert completed: ${rows_upserted} rows imported across ${imported_weeks.length} weeks`);
    } else {
      console.log("No rows to upsert - likely empty weeks during preseason");
      return new Response(JSON.stringify({
        ok: true,
        league_id,
        season_type: seasonType,
        current_week: currentWeekNum,
        skippedEmpty: true,
        imported_weeks: 0,
        rows_upserted: 0,
        message: "No matchup data available for requested weeks"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        league_id,
        season_type: seasonType,
        current_week: currentWeekNum,
        imported_weeks: imported_weeks.length,
        rows_upserted,
        requested_weeks: targetWeeks,
        fetched: fetchedCounts,
        errors,
        skippedEmpty: false,
        skippedPreseason: false,
      }),
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
