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
    .from('league_standings_v')
    .select('*')
    .eq('league_id', leagueId)
    .order('win_pct', { ascending: false })
    .order('pf', { ascending: false });
  
  if (error) throw error;
  return data ?? [];
}

export interface PlayerProjection {
  player_id: string;
  projection_points: number | null;
  updated_at: string | null;
  full_name: string | null;
  team: string | null;
  player_position: string | null;
  projection_data?: any;
}

export async function fetchApiProjections(leagueId: string, week: number, season: number = 2025, scoring: string = 'PPR') {
  console.log('=== fetchApiProjections DEBUG ===');
  console.log('League ID:', leagueId);
  console.log('Week:', week);
  console.log('Season:', season);
  console.log('Scoring:', scoring);
  
  try {
    // Get player IDs relevant to this league
    const { data: playerIds } = await supabase
      .from('league_player_ids_v')
      .select('player_id')
      .eq('league_id', leagueId);

    if (!playerIds || playerIds.length === 0) {
      console.log('No player IDs found for league');
      return [];
    }

    const relevantPlayerIds = playerIds.map(p => p.player_id);
    console.log('Relevant player IDs:', relevantPlayerIds.length);
    console.log('Sample player IDs:', relevantPlayerIds.slice(0, 5));

    // First, let's check what projections exist for this week/season/scoring
    const { data: allProjections, error: allProjError } = await supabase
      .from('projections')
      .select(`
        player_id, 
        points, 
        raw, 
        updated_at,
        position,
        source
      `)
      .eq('season', season)
      .eq('week', week)
      .eq('scoring', scoring);

    if (allProjError) {
      console.error('All projections query error:', allProjError);
      throw allProjError;
    }

    console.log('All projections for week/season/scoring:', allProjections?.length || 0);
    console.log('Sample all projections:', allProjections?.slice(0, 3));

    // Check if there are defense projections
    const defenseProjections = allProjections?.filter(p => p.position === 'DEF' || p.position === 'DST') || [];
    console.log('Defense projections found:', defenseProjections.length);
    console.log('Sample defense projections:', defenseProjections.slice(0, 3));

    // Also check what positions exist in the projections
    const positionsInProjections = [...new Set(allProjections?.map(p => p.position) || [])];
    console.log('All positions in projections:', positionsInProjections);

    // Query the projections table for league players
    const { data: projectionData, error: projError } = await supabase
      .from('projections')
      .select(`
        player_id, 
        points, 
        raw, 
        updated_at,
        position,
        source
      `)
      .eq('season', season)
      .eq('week', week)
      .eq('scoring', scoring)
      .in('player_id', relevantPlayerIds)
      .order('points', { ascending: false, nullsFirst: true });
    
    if (projError) {
      console.error('Projections query error:', projError);
      throw projError;
    }

    console.log('League-specific projections found:', projectionData?.length || 0);
    console.log('Sample league projections:', projectionData?.slice(0, 3));

    // Check if we're missing defense projections
    const leagueDefenseProjections = projectionData?.filter(p => p.position === 'DEF' || p.position === 'DST') || [];
    console.log('League defense projections found:', leagueDefenseProjections.length);
    
    if (defenseProjections.length > 0 && leagueDefenseProjections.length === 0) {
      console.log('WARNING: Defense projections exist but none found for league players');
      console.log('This suggests defense IDs in league_player_ids_v might not match defense IDs in projections');
    }

    // Get player details separately
    const { data: playerData } = await supabase
      .from('players')
      .select('player_id, full_name, position, team')
      .in('player_id', relevantPlayerIds);

    const playerMap = new Map((playerData || []).map(p => [p.player_id, p]));

    // Transform to match PlayerProjection interface
    const result = (projectionData || []).map(proj => {
      const player = playerMap.get(proj.player_id);
      return {
        player_id: proj.player_id,
        projection_points: proj.points || 0, // Use 'points' from projections table
        updated_at: proj.updated_at,
        full_name: player?.full_name || null,
        team: player?.team || null,
        player_position: player?.position || proj.position,
        projection_data: proj.raw || null
      } as PlayerProjection;
    });

    console.log('Final result count:', result.length);
    console.log('Sample final result:', result.slice(0, 3));

    // If we're missing defense projections, try to add them
    if (defenseProjections.length > 0 && leagueDefenseProjections.length === 0) {
      // Try to get defense projections by looking for team-based IDs
      const { data: defenseProjData, error: defProjError } = await supabase
        .from('projections')
        .select(`
          player_id, 
          points, 
          raw, 
          updated_at,
          position,
          source
        `)
        .eq('season', season)
        .eq('week', week)
        .eq('scoring', scoring)
        .in('position', ['DEF', 'DST'])
        .order('points', { ascending: false, nullsFirst: true });
      
      if (!defProjError && defenseProjData && defenseProjData.length > 0) {
        console.log('Found defense projections outside of league players:', defenseProjData.length);
        console.log('Sample defense projections:', defenseProjData.slice(0, 3));
        
        // Add these defense projections to the result
        const defenseResults = defenseProjData.map(proj => ({
          player_id: proj.player_id,
          projection_points: proj.points || 0,
          updated_at: proj.updated_at,
          full_name: `Team ${proj.player_id}`, // Use team ID as name for defenses
          team: proj.player_id, // Team ID for defenses
          player_position: proj.position,
          projection_data: proj.raw || null
        } as PlayerProjection));
        
        // Combine regular projections with defense projections
        const combinedResult = [...result, ...defenseResults];
        console.log('Combined result count (including defenses):', combinedResult.length);
        return combinedResult;
      }
    }

    console.log('=== END DEBUG ===');
    
    return result;
    
  } catch (error) {
    console.error('Error in fetchApiProjections:', error);
    throw error;
  }
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

