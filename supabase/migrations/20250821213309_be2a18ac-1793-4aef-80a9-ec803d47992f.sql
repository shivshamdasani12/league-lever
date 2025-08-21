-- Create the missing league_player_ids_v view that maps league players to their IDs
-- Use JSONB array functions since players column is JSONB type
CREATE OR REPLACE VIEW league_player_ids_v AS
SELECT DISTINCT 
  sr.league_id,
  jsonb_array_elements_text(sr.players) as player_id
FROM public.sleeper_rosters sr
WHERE sr.players IS NOT NULL 
AND jsonb_typeof(sr.players) = 'array';