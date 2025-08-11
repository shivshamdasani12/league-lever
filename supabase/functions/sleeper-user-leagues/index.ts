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
    let userId: string | null = null;
    let season: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as any));
      userId = body.user_id ?? null;
      season = body.season != null ? String(body.season) : null;
    } else {
      const url = new URL(req.url);
      userId = url.searchParams.get("user_id");
      season = url.searchParams.get("season");
    }
    if (!userId || !season) {
      return new Response(JSON.stringify({ error: "user_id and season are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const leagues = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`);
    const result = (leagues || []).map((lg) => ({
      league_id: lg.league_id,
      name: lg.name,
      season: Number(lg.season),
      avatar: lg.avatar ?? null,
      scoring_settings: lg.scoring_settings ?? null,
      roster_positions: lg.roster_positions ?? null,
      status: lg.status ?? null,
    }));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
