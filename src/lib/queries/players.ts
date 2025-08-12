import { supabase } from "@/integrations/supabase/client";

export interface PlayerRow {
  player_id: string;
  full_name: string | null;
  position: string | null;
  team: string | null;
  fantasy_positions: string[] | null;
  status: string | null;
}

export async function fetchPlayersByIds(ids: string[]) {
  if (!ids || ids.length === 0) return {} as Record<string, PlayerRow>;

  const { data, error } = await supabase
    .from("players")
    .select("player_id, full_name, position, team, fantasy_positions, status")
    .in("player_id", ids);

  if (error) throw error;

  const map: Record<string, PlayerRow> = {};
  (data || []).forEach((p: any) => {
    map[p.player_id] = p as PlayerRow;
  });
  return map;
}
