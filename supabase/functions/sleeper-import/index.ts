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
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const leagueId: string | undefined = body.league_id;
    const week: number | undefined = body.week;
    if (!leagueId) {
      return new Response(JSON.stringify({ error: "league_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Snapshot
    const league = await fetchSleeper<any>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`);
    const users = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/users`);
    const rosters = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/rosters`);
    let matchups: any[] | null = null;
    if (week) {
      matchups = await fetchSleeper<any[]>(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}/matchups/${encodeURIComponent(String(week))}`);
    }

    // Upsert league
    const leagueRow = {
      name: league.name as string,
      provider: "sleeper" as const,
      external_id: league.league_id as string,
      season: Number(league.season) || null,
      avatar: league.avatar ?? null,
      scoring_settings: league.scoring_settings ?? null,
      settings_json: {
        roster_positions: league.roster_positions ?? null,
        status: league.status ?? null,
      } as any,
      created_by: user.id,
    };

    const { data: upserted, error: upErr } = await adminClient
      .from('leagues')
      .upsert(leagueRow, { onConflict: 'provider,external_id' })
      .select('id')
      .limit(1);
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let league_uuid: string | null = upserted?.[0]?.id ?? null;
    if (!league_uuid) {
      const { data: found, error: findErr } = await adminClient
        .from('leagues')
        .select('id')
        .eq('provider', 'sleeper')
        .eq('external_id', league.league_id)
        .maybeSingle();
      if (findErr) {
        return new Response(JSON.stringify({ error: findErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      league_uuid = found?.id ?? null;
    }

    if (!league_uuid) {
      return new Response(JSON.stringify({ error: 'Failed to resolve league id' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure creator is a league member (owner)
    const { error: memberUpsertErr } = await adminClient
      .from('league_members')
      .upsert({ league_id: league_uuid, user_id: user.id, role: 'owner' }, { onConflict: 'league_id,user_id' });
    if (memberUpsertErr) {
      console.warn('Failed to upsert league member:', memberUpsertErr);
    }

    // Upsert users
    if (Array.isArray(users)) {
      const rows = users.map(u => ({
        league_id: league_uuid!,
        sleeper_user_id: String(u.user_id),
        username: u.username ?? null,
        display_name: u.display_name ?? null,
        avatar: u.avatar ?? null,
        is_commissioner: (league?.metadata?.owner_id ?? league?.owner_id) ? String(league.owner_id) === String(u.user_id) : false
      }));
      if (rows.length) {
        const { error } = await adminClient.from('sleeper_league_users').upsert(rows, { onConflict: 'league_id,sleeper_user_id' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Upsert rosters
    if (Array.isArray(rosters)) {
      const rows = rosters.map(r => ({
        league_id: league_uuid!,
        roster_id: Number(r.roster_id),
        owner_sleeper_user_id: r.owner_id ? String(r.owner_id) : null,
        starters: r.starters ?? null,
        players: r.players ?? null,
        settings: r.settings ?? null,
      }));
      if (rows.length) {
        const { error } = await adminClient.from('sleeper_rosters').upsert(rows, { onConflict: 'league_id,roster_id' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Upsert matchups (if provided)
    if (Array.isArray(matchups) && matchups.length) {
      const rows = matchups.map(m => ({
        league_id: league_uuid!,
        week: Number(m.matchup_id ? (m.week ?? body.week) : (body.week ?? 0)) || body.week || 0,
        roster_id: Number(m.roster_id),
        points: m.points != null ? Number(m.points) : null,
        starters: m.starters ?? null,
        players: m.players ?? null,
      }));
      if (rows.length) {
        const { error } = await adminClient.from('sleeper_matchups').upsert(rows, { onConflict: 'league_id,week,roster_id' });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ success: true, league_id: league_uuid }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
