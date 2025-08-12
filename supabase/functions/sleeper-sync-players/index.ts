// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { data: any; exp: number }>();
const TTL_MS = 10 * 60 * 1000;

async function fetchSleeper<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.exp > now) return cached.data as T;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      continue;
    }
    if (!res.ok) {
      throw new Error(`Sleeper request failed ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    cache.set(url, { data, exp: now + TTL_MS });
    return data as T;
  }
}

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

    const isPost = req.method === "POST";
    const body = isPost ? await req.json().catch(() => ({} as any)) : ({} as any);
    const url = new URL(req.url);

    const leagueId: string | null = body.league_id ?? url.searchParams.get("league_id");
    let playerIds: string[] = Array.isArray(body.player_ids) ? body.player_ids.map(String) : [];

    // If league_id provided but no player_ids, derive from Sleeper rosters via league's external_id
    if ((!playerIds || playerIds.length === 0) && leagueId) {
      const { data: league, error: leagueErr } = await supabase
        .from("leagues").select("external_id").eq("id", leagueId).single();
      if (leagueErr || !league?.external_id) {
        return new Response(JSON.stringify({ error: "League external_id not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Optional: ensure requester is at least a member of the league
      const { data: isMember, error: memberErr } = await supabase.rpc("is_league_member", { _league_id: leagueId, _user_id: user.id });
      if (memberErr || !isMember) {
        return new Response(JSON.stringify({ error: "Forbidden: not a league member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rosters = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(league.external_id)}/rosters`);
      const ids = new Set<string>();
      for (const r of rosters || []) {
        (Array.isArray(r.players) ? r.players : []).forEach((id: any) => ids.add(String(id)));
        (Array.isArray(r.starters) ? r.starters : []).forEach((id: any) => ids.add(String(id)));
      }
      playerIds = Array.from(ids);
    }

    if (!playerIds || playerIds.length === 0) {
      return new Response(JSON.stringify({ error: "No player_ids provided or derived" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch NFL players dictionary and filter to requested IDs
    const playersDict = await fetchSleeper<Record<string, any>>("https://api.sleeper.app/v1/players/nfl");
    const rows = playerIds
      .filter((id) => !!playersDict[id])
      .map((id) => {
        const p = playersDict[id];
        const fullName = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.last_name || p.first_name || null;
        return {
          player_id: String(id),
          full_name: fullName,
          position: p.position ?? null,
          team: p.team ?? null,
          fantasy_positions: Array.isArray(p.fantasy_positions) ? p.fantasy_positions : null,
          status: p.status ?? null,
          updated_at: new Date().toISOString(),
        };
      });

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No matching players found in Sleeper dataset" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: upsertErr } = await supabase.from("players").upsert(rows, { onConflict: "player_id" });
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ synced: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
