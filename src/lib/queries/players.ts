import { supabase } from "@/integrations/supabase/client";

export interface PlayerRow {
  player_id: string;
  full_name: string | null;
  position: string | null;
  team: string | null;
  fantasy_positions: string[] | null;
  status: string | null;
  current_week_stats: any | null;
  current_week_projection: number | null;
  per_game_stats: any | null;
  injury_status: string | null;
  practice_participation: string | null;
}

export async function fetchPlayersByIds(ids: string[]) {
  if (!ids || ids.length === 0) return {} as Record<string, PlayerRow>;

  const { data, error } = await supabase
    .from("players")
    .select("player_id, full_name, position, team, fantasy_positions, status, current_week_stats, current_week_projection, per_game_stats, injury_status, practice_participation")
    .in("player_id", ids);

  if (error) throw error;

  const map: Record<string, PlayerRow> = {};
  (data || []).forEach((p: any) => {
    map[p.player_id] = p as PlayerRow;
  });
  return map;
}
