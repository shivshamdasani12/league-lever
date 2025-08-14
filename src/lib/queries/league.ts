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

// Use direct database access with enhanced server-backed views
export async function fetchRosters(leagueId: string) {
  const { data, error } = await supabase
    .from("league_rosters_v")
    .select("*")
    .eq("league_id", leagueId)
    .order("roster_id");
  
  if (error) throw error;
  return data ?? [];
}

export async function fetchApiMatchups(leagueId: string, week: number) {
  const { data: matchups, error } = await supabase
    .from('sleeper_matchups')
    .select('*')
    .eq('league_id', leagueId)
    .eq('week', week)
    .order('matchup_id', { ascending: true, nullsFirst: true })
    .order('roster_id', { ascending: true });

  if (error) throw error;

  // Get roster info for owner names
  const { data: rosters } = await supabase
    .from('league_rosters_v')
    .select('*')
    .eq('league_id', leagueId);

  const rosterMap = new Map((rosters || []).map(r => [r.roster_id, r]));

  // Group matchups by matchup_id and add owner names
  const matchupGroups = new Map<string, any[]>();
  (matchups || []).forEach(m => {
    const key = m.matchup_id != null ? String(m.matchup_id) : `solo-${m.roster_id}`;
    if (!matchupGroups.has(key)) matchupGroups.set(key, []);
    matchupGroups.get(key)!.push({
      ...m,
      owner_name: rosterMap.get(m.roster_id)?.owner_name || 
                 rosterMap.get(m.roster_id)?.owner_username || 
                 `Roster ${m.roster_id}`
    });
  });

  return Array.from(matchupGroups.values()).map(group => {
    const [team1, team2] = group.sort((a, b) => a.roster_id - b.roster_id);
    return {
      matchup_id: team1.matchup_id,
      week,
      team1,
      team2: team2 ?? null
    };
  });
}

export async function fetchApiStandings(leagueId: string, season: number = 2024) {
  const { data, error } = await supabase
    .from('sleeper_standings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', season)
    .order('rank', { ascending: true });
  
  if (error) throw error;
  return data ?? [];
}

export async function fetchApiProjections(leagueId: string, week: number, season: number = 2024) {
  // Get player IDs relevant to this league
  const { data: playerIds } = await supabase
    .from('league_player_ids_v')
    .select('player_id')
    .eq('league_id', leagueId);

  if (!playerIds || playerIds.length === 0) return [];

  const relevantPlayerIds = playerIds.map(p => p.player_id);

  const { data, error } = await supabase
    .from('player_projections')
    .select(`
      player_id, 
      projection_points, 
      projection_data, 
      updated_at,
      players!inner(full_name, position, team)
    `)
    .eq('season', season)
    .eq('week', week)
    .in('player_id', relevantPlayerIds)
    .order('projection_points', { ascending: false, nullsFirst: true });
  
  if (error) throw error;
  return data ?? [];
}

export async function fetchApiPlayers(search: string = '', leagueId?: string, limit: number = 50) {
  let query = supabase
    .from('players')
    .select('*')
    .order('search_rank', { ascending: true, nullsFirst: true });

  // If league_id provided, filter to players in that league
  if (leagueId) {
    const { data: playerIds } = await supabase
      .from('league_player_ids_v')
      .select('player_id')
      .eq('league_id', leagueId);
    
    if (playerIds && playerIds.length > 0) {
      const ids = playerIds.map(p => p.player_id);
      query = query.in('player_id', ids);
    }
  }

  // Apply search filter
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,last_name.ilike.%${search}%,first_name.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function triggerSleeperSyncAll(leagueId: string, week?: number, season?: number) {
  const { data, error } = await supabase.functions.invoke('sleeper-sync-all', {
    body: { league_id: leagueId, week, season }
  });
  
  if (error) throw new Error(`Failed to sync: ${error.message}`);
  return data;
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

