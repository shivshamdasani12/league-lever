/**
 * Supabase Edge Function: ingest-projections
 * 
 * Accepts fantasy football projections data and upserts to projections table.
 * 
 * ACCEPTED HEADERS:
 * - x-api-key: <secret> (primary)
 * - x-ingest-secret: <secret> (fallback)
 * - authorization: Bearer <secret> (fallback)
 * 
 * ENDPOINTS:
 * - /health - Returns { ok: true } for health checks
 * - POST / - Ingests projections data
 * 
 * SAMPLE CURL COMMANDS:
 * # Health check
 * curl -sS "https://dcqxqetlbgtaceyospij.supabase.co/functions/v1/ingest-projections/health"
 * 
 * # Auth with x-api-key
 * curl -X POST "https://dcqxqetlbgtaceyospij.supabase.co/functions/v1/ingest-projections" \
 *   -H "x-api-key: YOUR_SECRET" \
 *   -H "content-type: application/json" \
 *   -d '{"data":[]}'
 * 
 * # Auth with authorization bearer
 * curl -X POST "https://dcqxqetlbgtaceyospij.supabase.co/functions/v1/ingest-projections" \
 *   -H "authorization: Bearer YOUR_SECRET" \
 *   -H "content-type: application/json" \
 *   -d '{"data":[]}'
 * 
 * LOGS: Supabase Dashboard → Edge Functions → ingest-projections → Logs
 * 
 * Last updated: 2025-08-15 18:15 UTC
 */

/*
 * TEMP DIAGNOSTICS
 * 
 * This block adds temporary logging and a /health endpoint to debug auth issues.
 * 
 * TO REMOVE LATER:
 * 1. Delete the /health endpoint logic
 * 2. Remove all console.log statements
 * 3. Remove the TEMP DIAGNOSTICS comment block
 */

// Deno / Supabase Edge Function
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INGEST_API_KEY
// Updated: 2025-01-15 - Fixed defense projections matching logic
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const url = new URL(req.url);
    
    // Health check endpoint
    if (url.pathname.endsWith("/health")) {
      return new Response(JSON.stringify({ ok: true }), { 
        status: 200, 
        headers: { "content-type": "application/json" }
      });
    }

    // TEMP DIAGNOSTICS: Log header presence and env status
    function headerPresence(h: Headers) {
      const auth = h.get("authorization") ?? "";
      return {
        x_api_key: !!h.get("x-api-key"),
        x_ingest_secret: !!h.get("x-ingest-secret"),
        authorization: !!auth,
        authorization_bearer: auth.toLowerCase().startsWith("bearer "),
      };
    }
    const saw = headerPresence(req.headers);
    const has_env = !!(Deno.env.get("INGEST_API_KEY") ?? "");
    console.log(JSON.stringify({ where: "pre_auth", path: url.pathname, saw, has_env }));

    // Robust auth gate - accepts multiple header formats
    function incomingSecret(req: Request): string | null {
      const h = req.headers;
      const xApi = h.get("x-api-key");
      if (xApi) return xApi.trim();
      const xIngest = h.get("x-ingest-secret");
      if (xIngest) return xIngest.trim();
      const auth = h.get("authorization");
      if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
      return null;
    }

    const EXPECTED = (Deno.env.get("INGEST_API_KEY") ?? "").trim();
    const PUBLISHABLE_KEY = "sb_publishable_dQKzDdBEMeXQrXsLUlZu9A_wFyAD3E_";
    const got = incomingSecret(req);

    // Accept either the custom INGEST_API_KEY or the publishable key
    if (!got || (got !== EXPECTED && got !== PUBLISHABLE_KEY)) {
      console.log(JSON.stringify({ where: "auth_fail", saw, has_env }));
      return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as any;
    if (!body || !Array.isArray(body.data) || body.data.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "empty" }), { status: 200 });
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize rows and set updated_at
    const rows = body.data.map((r: any) => ({
      source: String(r.source),
      season: Number(r.season),
      week: Number(r.week),
      scoring: String(r.scoring),
      player_id: String(r.player_id),
      position: String(r.position),
      raw: r.raw,
      points: r.points == null ? null : Number(r.points),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client
      .from("projections")
      .upsert(rows, { onConflict: "source,season,week,scoring,player_id" });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, upserted: rows.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
