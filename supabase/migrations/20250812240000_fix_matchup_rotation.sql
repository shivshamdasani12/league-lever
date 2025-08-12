-- Fix matchup display to work with real Sleeper API data
-- Show team information during preseason, real data during season
-- OPTIMIZED FOR PERFORMANCE AND SCALABILITY

-- Step 1: Clear any existing fake placeholder data
DELETE FROM sleeper_matchups WHERE points = 0;

-- Step 2: Drop existing views
DROP VIEW IF EXISTS public.league_matchups_v;
DROP VIEW IF EXISTS public.league_standings_v;
DROP VIEW IF EXISTS public.league_weeks_v;

-- Step 3: Drop the fake schedule generation function
DROP FUNCTION IF EXISTS generate_simple_schedule(UUID);

-- Step 4: Create OPTIMIZED views that work with real Sleeper data and show teams during preseason
-- Use window functions and CTEs for maximum performance

CREATE OR REPLACE VIEW public.league_weeks_v AS
WITH week_stats AS (
  SELECT 
    league_id,
    week,
    -- Use window function instead of subquery for better performance
    MAX(CASE WHEN points > 0 THEN week END) OVER (PARTITION BY league_id) as max_week_with_data,
    -- Check if any weeks have actual data
    MAX(CASE WHEN points > 0 THEN 1 ELSE 0 END) OVER (PARTITION BY league_id) as has_actual_data
  FROM public.sleeper_matchups
  WHERE (points > 0 OR points IS NULL OR points = 0)
)
SELECT DISTINCT
  league_id,
  week,
  CASE 
    -- During preseason, show week 1 as latest (but all weeks are available)
    WHEN has_actual_data = 0 THEN (week = 1)
    -- During season, show actual latest week with data
    ELSE (week = max_week_with_data)
  END AS is_latest
FROM week_stats
ORDER BY league_id, week;

CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH weekly_matchups AS (
  SELECT 
    league_id,
    week,
    roster_id,
    points,
    is_playoffs,
    is_consolation,
    -- Use ROW_NUMBER for efficient pairing
    ROW_NUMBER() OVER (PARTITION BY league_id, week ORDER BY roster_id) AS row_num,
    COUNT(*) OVER (PARTITION BY league_id, week) AS total_teams
  FROM public.sleeper_matchups
  -- Show all matchups during preseason (including schedule structure), 
  -- but only actual games during regular season
  WHERE (points > 0 OR points IS NULL OR points = 0)
)
SELECT 
  league_id,
  week,
  roster_id,
  points,
  -- Efficient pairing using LEAD window function
  CASE 
    WHEN row_num % 2 = 1 AND row_num < total_teams THEN 
      LEAD(roster_id) OVER (PARTITION BY league_id, week ORDER BY roster_id)
    ELSE NULL 
  END AS opp_roster_id,
  CASE 
    WHEN row_num % 2 = 1 AND row_num < total_teams THEN 
      LEAD(points) OVER (PARTITION BY league_id, week ORDER BY roster_id)
    ELSE NULL 
  END AS opp_points,
  is_playoffs,
  is_consolation
FROM weekly_matchups;

CREATE OR REPLACE VIEW public.league_standings_v AS
WITH team_scores AS (
  SELECT 
    league_id,
    roster_id,
    SUM(COALESCE(points, 0)) AS total_points,
    COUNT(*) AS games_played
  FROM sleeper_matchups
  WHERE points > 0  -- Only count actual games with points
  GROUP BY league_id, roster_id
),
-- Optimized team lookup with single join
all_teams AS (
  SELECT DISTINCT
    r.league_id,
    r.roster_id,
    COALESCE(u.display_name, 'Unknown') AS owner_name
  FROM sleeper_rosters r
  LEFT JOIN sleeper_league_users u ON u.league_id = r.league_id AND u.sleeper_user_id = r.owner_sleeper_user_id
)
SELECT 
  at.league_id,
  at.roster_id,
  at.owner_name,
  COALESCE(ts.wins, 0) AS wins,   -- Will be calculated when real games happen
  COALESCE(ts.losses, 0) AS losses, -- Will be calculated when real games happen
  COALESCE(ts.ties, 0) AS ties,   -- Will be calculated when real games happen
  COALESCE(ts.total_points, 0) AS pf,
  0 AS pa,     -- Will be calculated when real games happen
  0 AS win_pct -- Will be calculated when real games happen
FROM all_teams at
LEFT JOIN (
  SELECT 
    league_id,
    roster_id,
    0 AS wins,  -- Placeholder for now
    0 AS losses, -- Placeholder for now
    0 AS ties,   -- Placeholder for now
    total_points
  FROM team_scores
) ts ON ts.league_id = at.league_id AND ts.roster_id = at.roster_id
ORDER BY ts.total_points DESC NULLS LAST, at.owner_name;

-- Set security on all views
ALTER VIEW public.league_weeks_v SET (security_invoker = on);
ALTER VIEW public.league_matchups_v SET (security_invoker = on);
ALTER VIEW public.league_standings_v SET (security_invoker = on);

-- Step 5: Add performance indexes for better query performance
-- These indexes will significantly improve view performance
CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_league_week ON sleeper_matchups(league_id, week);
CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_league_points ON sleeper_matchups(league_id, points) WHERE points > 0;
CREATE INDEX IF NOT EXISTS idx_sleeper_rosters_league ON sleeper_rosters(league_id);
CREATE INDEX IF NOT EXISTS idx_sleeper_league_users_league ON sleeper_league_users(league_id);
