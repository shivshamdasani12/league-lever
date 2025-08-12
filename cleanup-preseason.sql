-- Clean up preseason weeks that were incorrectly imported
-- Run this in your Supabase SQL Editor

-- First, let's see what weeks exist for your league
SELECT 
  league_id,
  week,
  COUNT(*) as matchup_count
FROM sleeper_matchups 
GROUP BY league_id, week 
ORDER BY league_id, week;

-- Remove preseason weeks (weeks 1-2) for all leagues
-- This will clean up the data and fix your standings
DELETE FROM sleeper_matchups 
WHERE week IN (1, 2);

-- Verify the cleanup
SELECT 
  league_id,
  week,
  COUNT(*) as matchup_count
FROM sleeper_matchups 
GROUP BY league_id, week 
ORDER BY league_id, week;

-- Check the updated standings view
SELECT * FROM league_standings_v 
ORDER BY win_pct DESC, pf DESC;
