import { supabase } from "@/integrations/supabase/client";

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

// OPTIMIZED: Cache roster data to reduce duplicate API calls
const rosterCache = new Map<string, LeagueRosterRow[]>();

export async function fetchRosters(leagueId: string) {
  // Check cache first
  if (rosterCache.has(leagueId)) {
    return rosterCache.get(leagueId)!;
  }

  const { data, error } = await supabase
    .from("league_rosters_v")
    .select("*")
    .eq("league_id", leagueId);
  
  if (error) throw error;
  
  const result = (data ?? []) as LeagueRosterRow[];
  
  // Cache the result
  rosterCache.set(leagueId, result);
  
  return result;
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

// OPTIMIZED: Clear cache when needed
export function clearRosterCache(leagueId?: string) {
  if (leagueId) {
    rosterCache.delete(leagueId);
  } else {
    rosterCache.clear();
  }
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

