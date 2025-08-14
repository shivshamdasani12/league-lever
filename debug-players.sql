-- Debug query to check players table
SELECT 
  player_id,
  full_name,
  position,
  team,
  created_at,
  updated_at
FROM players 
LIMIT 10;

-- Check if we have any players with the IDs from rosters
-- This will help us understand if the data exists
SELECT COUNT(*) as total_players FROM players;

-- Check a sample of player IDs to see the format
SELECT DISTINCT player_id FROM players LIMIT 5;
