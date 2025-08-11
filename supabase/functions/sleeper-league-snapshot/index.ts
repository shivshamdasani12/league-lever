// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { data: any; exp: number }>();
const TTL_MS = 5 * 60 * 1000;

async function fetchSleeper<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.exp > now) return cached.data as T;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, { headers: { "accept": "application/json" } });
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

    // Support POST body or query params
    let leagueId: string | null = null;
    let week: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      leagueId = body.league_id ?? null;
      week = body.week != null ? String(body.week) : null;
    } else {
      const url = new URL(req.url);
      leagueId = url.searchParams.get("league_id");
      week = url.searchParams.get("week");
    }
    if (!leagueId) {
      return new Response(JSON.stringify({ error: "league_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const league = await fetchSleeper<any>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`);
    const users = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/users`);
    const rosters = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/rosters`);

    let matchups: any[] | null = null;
    if (week) {
      matchups = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/matchups/${encodeURIComponent(week)}`);
    }

    const payload = { league, users, rosters, matchups };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
