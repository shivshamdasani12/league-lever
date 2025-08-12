-- Fix matchup pairing logic to properly show head-to-head matchups
-- This replaces the existing league_matchups_v view with proper team pairing

DROP VIEW IF EXISTS public.league_matchups_v;

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
),
paired_matchups AS (
  SELECT 
    m1.league_id,
    m1.week,
    m1.roster_id,
    m1.points,
    m1.is_playoffs,
    m1.is_consolation,
    CASE 
      WHEN m1.row_num % 2 = 1 AND m1.row_num < m1.total_teams THEN m2.roster_id
      WHEN m1.row_num % 2 = 0 THEN m1.roster_id
      ELSE NULL
    END AS opp_roster_id,
    CASE 
      WHEN m1.row_num % 2 = 1 AND m1.row_num < m1.total_teams THEN m2.points
      WHEN m1.row_num % 2 = 0 THEN m1.points
      ELSE NULL
    END AS opp_points
  FROM weekly_matchups m1
  LEFT JOIN weekly_matchups m2 ON 
    m1.league_id = m2.league_id 
    AND m1.week = m2.week 
    AND m2.row_num = m1.row_num + 1
    AND m1.row_num % 2 = 1
)
SELECT 
  league_id,
  week,
  roster_id,
  points,
  opp_roster_id,
  opp_points,
  is_playoffs,
  is_consolation
FROM paired_matchups
WHERE opp_roster_id IS NOT NULL OR roster_id IN (
  -- Include teams with byes (odd team counts)
  SELECT DISTINCT roster_id 
  FROM weekly_matchups 
  WHERE row_num = total_teams AND total_teams % 2 = 1
);

-- Ensure the view has proper security
ALTER VIEW public.league_matchups_v SET (security_invoker = on);
