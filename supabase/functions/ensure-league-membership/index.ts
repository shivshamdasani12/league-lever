// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!leagueId) {
      return new Response(JSON.stringify({ error: "league_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if already a member
    const { data: existing, error: existErr } = await adminClient
      .from('league_members')
      .select('id, role, user_id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existErr) {
      console.warn('Membership check error', existErr);
    }

    if (existing) {
      return new Response(JSON.stringify({ ok: true, already_member: true, role: existing.role }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine desired role: owner if created_by, else member
    const { data: league, error: leagueErr } = await adminClient
      .from('leagues')
      .select('id, created_by')
      .eq('id', leagueId)
      .maybeSingle();

    if (leagueErr || !league) {
      return new Response(JSON.stringify({ error: leagueErr?.message || 'League not found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const role = league.created_by === user.id ? 'owner' : 'member';

    const { error: upErr } = await adminClient
      .from('league_members')
      .upsert({ league_id: leagueId, user_id: user.id, role }, { onConflict: 'league_id,user_id' });

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, role }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
