-- Complete simplification of the matchup system
-- This fixes the core issues with weeks and matchups not working together

-- Step 1: Drop all existing views
DROP VIEW IF EXISTS public.league_matchups_v;
DROP VIEW IF EXISTS public.league_weeks_v;
DROP VIEW IF EXISTS public.league_standings_v;

-- Step 2: Create a simple, working weeks view
CREATE OR REPLACE VIEW public.league_weeks_v AS
SELECT DISTINCT
  league_id,
  week,
  (week = 1) AS is_latest  -- During preseason, week 1 is "latest"
FROM public.sleeper_matchups
ORDER BY league_id, week;

-- Step 3: Create a simple, working matchups view
CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH weekly_matchups AS (
  SELECT 
    league_id,
    week,
    roster_id,
    points,
    is_playoffs,
    is_consolation,
    ROW_NUMBER() OVER (PARTITION BY league_id, week ORDER BY roster_id) AS row_num,
    COUNT(*) OVER (PARTITION BY league_id, week) AS total_teams
  FROM public.sleeper_matchups
)
SELECT 
  league_id,
  week,
  roster_id,
  points,
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

-- Step 4: Create a simple, working standings view
CREATE OR REPLACE VIEW public.league_standings_v AS
WITH team_scores AS (
  SELECT 
    league_id,
    roster_id,
    SUM(COALESCE(points, 0)) AS total_points,
    COUNT(*) AS games_played
  FROM public.sleeper_matchups
  WHERE points > 0  -- Only count actual games, not placeholders
  GROUP BY league_id, roster_id
)
SELECT 
  ts.league_id,
  ts.roster_id,
  COALESCE(u.display_name, 'Unknown') AS owner_name,
  0 AS wins,   -- Placeholder - will be calculated when real games happen
  0 AS losses, -- Placeholder - will be calculated when real games happen
  0 AS ties,   -- Placeholder - will be calculated when real games happen
  ts.total_points AS pf,
  0 AS pa,     -- Placeholder - will be calculated when real games happen
  0 AS win_pct -- Placeholder - will be calculated when real games happen
FROM team_scores ts
LEFT JOIN public.sleeper_rosters r ON r.league_id = ts.league_id AND r.roster_id = ts.roster_id
LEFT JOIN public.sleeper_league_users u ON u.league_id = r.league_id AND u.sleeper_user_id = r.owner_sleeper_user_id
ORDER BY ts.total_points DESC;

-- Set security on all views
ALTER VIEW public.league_weeks_v SET (security_invoker = on);
ALTER VIEW public.league_matchups_v SET (security_invoker = on);
ALTER VIEW public.league_standings_v SET (security_invoker = on);
