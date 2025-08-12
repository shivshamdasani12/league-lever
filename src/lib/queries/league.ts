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

export async function fetchRosters(leagueId: string) {
  const { data, error } = await supabase
    .from("league_rosters_v")
    .select("*")
    .eq("league_id", leagueId);
  if (error) throw error;
  return (data ?? []) as LeagueRosterRow[];
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
    .order("roster_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeagueMatchupRow[];
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
export async function fetchMatchupPairs(leagueId: string, week: number) {
  console.log("Fetching matchup pairs for week:", week);
  const { data, error } = await supabase
    .from("league_matchups_v")
    .select("*")
    .eq("league_id", leagueId)
    .eq("week", week)
    .order("roster_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeagueMatchupRow[];
}

