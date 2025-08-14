import { supabase } from "@/integrations/supabase/client";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcXhxZXRsYmd0YWNleW9zcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NzYzNjcsImV4cCI6MjA3MDM1MjM2N30.jaXUVmROotCjxJoMtO8aZL5iutjWxvTjspXK1DSJfso";

export interface LeagueRosterRow {
  league_id: string;
  roster_id: number;
  owner_name: string | null;
  owner_username: string | null;
  owner_avatar: string | null;
  starters: string[] | null;
  players: string[] | null;
}

export interface LeagueWeekRow {
  league_id: string;
  week: number;
  is_latest: boolean;
}

export interface LeagueMatchupRow {
  league_id: string;
  week: number;
  roster_id: number;
  points: number | null;
  opp_roster_id: number | null;
  opp_points: number | null;
}

export interface LeagueMatchupPairRow {
  league_id: string;
  week: number;
  matchup_id: number | null;
  roster_id_a: number;
  roster_id_b: number | null;
  points_a: number | null;
  points_b: number | null;
}

export interface LeagueStandingRow {
  league_id: string;
  roster_id: number;
  owner_name: string;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  win_pct: number;
}

// New API-based queries for server-backed data
export async function fetchRosters(leagueId: string) {
  const response = await fetch(`/functions/v1/api-rosters?league_id=${leagueId}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch rosters: ${response.status}`);
  }
  
  const data = await response.json();
  return data.rosters;
}

export async function fetchApiMatchups(leagueId: string, week: number) {
  const response = await fetch(`/functions/v1/api-matchups?league_id=${leagueId}&week=${week}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch matchups: ${response.status}`);
  }
  
  const data = await response.json();
  return data.matchups;
}

export async function fetchApiStandings(leagueId: string, season: number = 2024) {
  const response = await fetch(`/functions/v1/api-standings?league_id=${leagueId}&season=${season}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch standings: ${response.status}`);
  }
  
  const data = await response.json();
  return data.standings;
}

export async function fetchApiProjections(leagueId: string, week: number, season: number = 2024) {
  const response = await fetch(`/functions/v1/api-projections?league_id=${leagueId}&week=${week}&season=${season}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch projections: ${response.status}`);
  }
  
  const data = await response.json();
  return data.projections;
}

export async function fetchApiPlayers(search: string = '', leagueId?: string, limit: number = 50) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (leagueId) params.set('league_id', leagueId);
  params.set('limit', limit.toString());
  
  const response = await fetch(`/functions/v1/api-players?${params}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }
  
  const data = await response.json();
  return data.players;
}

export async function triggerSleeperSyncAll(leagueId: string, week?: number, season?: number) {
  const response = await fetch('/functions/v1/sleeper-sync-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ league_id: leagueId, week, season }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync: ${response.status}`);
  }
  
  return await response.json();
}

export async function fetchWeeks(leagueId: string) {
  const { data, error } = await supabase
    .from("league_weeks_v")
    .select("*")
    .eq("league_id", leagueId)
    .order("week", { ascending: true });
  
  if (error) throw error;
  return (data ?? []) as LeagueWeekRow[];
}

export async function fetchMatchups(leagueId: string, week: number) {
  console.log("Fetching matchups for week:", week);
  
  const { data, error } = await supabase
    .from("league_matchups_v")
    .select("*")
    .eq("league_id", leagueId)
    .eq("week", week)
    .order("roster_id_a", { ascending: true });
  
  if (error) throw error;
  return (data ?? []) as LeagueMatchupPairRow[];
}

export async function fetchLeagueMatchupsByWeek(leagueId: string, week: number) {
  console.log("Fetching league matchups by week:", week);
  
  const { data, error } = await supabase
    .from("sleeper_matchups")
    .select("*")
    .eq("league_id", leagueId)
    .eq("week", week)
    .order("matchup_id", { ascending: true, nullsFirst: true })
    .order("roster_id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchStandings(leagueId: string) {
  const { data, error } = await supabase
    .from("league_standings_v")
    .select("*")
    .eq("league_id", leagueId)
    .order("win_pct", { ascending: false })
    .order("pf", { ascending: false });
  
  if (error) throw error;
  return (data ?? []) as LeagueStandingRow[];
}

// OPTIMIZED: Single function for matchup pairs with better error handling
export async function fetchMatchupPairs(leagueId: string, week: number) {
  console.log("Fetching matchup pairs for week:", week);
  
  try {
    const { data, error } = await supabase
      .from("league_matchups_v")
      .select("*")
      .eq("league_id", leagueId)
      .eq("week", week)
      .order("roster_id_a", { ascending: true });
    
    if (error) throw error;
    
    const rows = (data ?? []) as LeagueMatchupPairRow[];
    return rows.map(row => ({
      team1: {
        league_id: row.league_id,
        week: row.week,
        roster_id: row.roster_id_a,
        points: row.points_a,
        opp_roster_id: row.roster_id_b,
        opp_points: row.points_b
      },
      team2: row.roster_id_b ? {
        league_id: row.league_id,
        week: row.week,
        roster_id: row.roster_id_b,
        points: row.points_b,
        opp_roster_id: row.roster_id_a,
        opp_points: row.points_a
      } : undefined
    }));
  } catch (error) {
    console.error("Error fetching matchup pairs:", error);
    return [];
  }
}

// OPTIMIZED: Batch fetch function for multiple weeks
export async function fetchMultipleWeeks(leagueId: string, weeks: number[]) {
  if (weeks.length === 0) return [];
  
  const { data, error } = await supabase
    .from("league_matchups_v")
    .select("*")
    .eq("league_id", leagueId)
    .in("week", weeks)
    .order("week", { ascending: true })
    .order("roster_id_a", { ascending: true });
  
  if (error) throw error;
  return (data ?? []) as LeagueMatchupPairRow[];
}

// Legacy cache clearing function (no-op now that we use API)
export function clearRosterCache(leagueId?: string) {
  // No-op since we're using API endpoints now
  console.log('clearRosterCache called for:', leagueId);
}

// Fetch roster details with player information for a specific week
export async function fetchRosterDetails(leagueId: string, week: number, rosterId: number) {
  try {
    const { data, error } = await supabase
      .from("sleeper_matchups")
      .select("starters, players")
      .eq("league_id", leagueId)
      .eq("week", week)
      .eq("roster_id", rosterId)
      .single();
    
    if (error) throw error;
    
    return {
      starters: data?.starters || [],
      players: data?.players || []
    };
  } catch (error) {
    console.error("Error fetching roster details:", error);
    return { starters: [], players: [] };
  }
}

