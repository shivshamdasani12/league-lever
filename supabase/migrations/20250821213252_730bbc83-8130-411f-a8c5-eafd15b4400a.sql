-- Create the missing league_player_ids_v view that maps league players to their IDs
CREATE OR REPLACE VIEW league_player_ids_v AS
SELECT DISTINCT 
  sr.league_id,
  unnest(sr.players::text[]) as player_id
FROM public.sleeper_rosters sr
WHERE sr.players IS NOT NULL;