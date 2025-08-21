import { supabase } from "@/integrations/supabase/client";

export interface PlayerRow {
  player_id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position: string | null;
  team: string | null;
  fantasy_positions: string[] | null;
  status: string | null;
  current_week_stats: any | null;
  current_week_projection: number | null;
  per_game_stats: any | null;
  injury_status: string | null;
  practice_participation: string | null;
  updated_at?: string | null;
}

export async function fetchPlayersByIds(ids: string[]) {
  if (!ids || ids.length === 0) return {} as Record<string, PlayerRow>;

  try {
    // First, let's check what columns actually exist in the players table
    const { data: tableInfo, error: tableError } = await supabase
      .from("players")
      .select("*")
      .limit(1);

    if (tableError) {
      console.error("Table structure error:", tableError);
      throw tableError;
    }

    console.log("Table structure check:", tableInfo);

    // Start with basic fields that should exist
    const { data, error } = await supabase
      .from("players")
      .select("player_id, full_name, position, team, fantasy_positions, status, current_week_stats, current_week_projection, per_game_stats, injury_status, practice_participation, updated_at")
      .in("player_id", ids);

    if (error) {
      console.error("Player fetch error:", error);
      throw error;
    }

    console.log("Fetched players:", data);

    const map: Record<string, PlayerRow> = {};
    (data || []).forEach((p: any) => {
      // Use the player_id as the key for the map
      map[p.player_id] = {
        player_id: p.player_id,
        full_name: p.full_name,
        position: p.position,
        team: p.team,
        fantasy_positions: p.fantasy_positions,
        status: p.status,
        current_week_stats: p.current_week_stats,
        current_week_projection: p.current_week_projection,
        per_game_stats: p.per_game_stats,
        injury_status: p.injury_status,
        practice_participation: p.practice_participation,
        updated_at: p.updated_at
      };
    });
    return map;
  } catch (error) {
    console.error("fetchPlayersByIds error:", error);
    throw error;
  }
}
