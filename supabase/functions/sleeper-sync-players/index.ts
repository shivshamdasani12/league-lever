// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SyncBody = { league_id?: string };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    // 1) Parse input
    const { league_id }: SyncBody = await req.json().catch(() => ({} as SyncBody));
    if (!league_id) return cors(new Response(JSON.stringify({ error: "league_id required" }), { status: 400 }));

    // 2) Create two Supabase clients:
    //    - userClient forwards the caller's JWT (RLS-enforced reads)
    //    - adminClient uses service role for controlled writes (bypass RLS)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 3) Verify caller auth (JWT) and get user
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return cors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));

    // 4) Verify membership (RLS-safe): user must be in this league
    const { data: memberRow, error: memberErr } = await userClient
      .from("league_members")
      .select("user_id")
      .eq("league_id", league_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr) return cors(new Response(JSON.stringify({ error: "Membership check failed" }), { status: 500 }));
    if (!memberRow) return cors(new Response(JSON.stringify({ error: "Forbidden (not a league member)" }), { status: 403 }));

    // 5) Get the set of player IDs for this league
    const { data: ids, error: idsErr } = await userClient
      .from("league_player_ids_v")
      .select("player_id")
      .eq("league_id", league_id);

    if (idsErr) return cors(new Response(JSON.stringify({ error: "Failed to list player IDs" }), { status: 500 }));

    const needed = new Set((ids ?? []).map((r: any) => r.player_id));
    if (needed.size === 0) {
      return cors(new Response(JSON.stringify({ upserted: 0, message: "No player IDs to sync" }), { status: 200 }));
    }

    // 6) Fetch Sleeper NFL players dictionary once and filter to needed IDs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.sleeper.app/v1/players/nfl", { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return cors(new Response(JSON.stringify({ error: `Sleeper fetch failed ${res.status}` }), { status: 502 }));
    }

    const allPlayers = await res.json() as Record<string, any>;

    // Build upsert rows for only needed IDs
    const rows = [] as any[];
    for (const id of needed) {
      const p = allPlayers[id] || null;
      rows.push({
        player_id: id,
        full_name: p?.full_name ?? (p?.first_name && p?.last_name ? `${p.first_name} ${p.last_name}` : null),
        position: p?.position ?? null,
        team: p?.team ?? null,
        fantasy_positions: Array.isArray(p?.fantasy_positions) ? p?.fantasy_positions : null,
        status: p?.status ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    // 7) Upsert using service role (bypass RLS safely for dictionary table)
    const { error: upsertErr, count } = await adminClient
      .from("players")
      .upsert(rows, { onConflict: "player_id", ignoreDuplicates: false, count: "exact" });

    if (upsertErr) return cors(new Response(JSON.stringify({ error: upsertErr.message }), { status: 500 }));

    return cors(new Response(JSON.stringify({ upserted: count ?? rows.length }), { status: 200 }));
  } catch (e: any) {
    return cors(new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 }));
  }
});
