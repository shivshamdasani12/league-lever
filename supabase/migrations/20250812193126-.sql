-- Fix league_matchups_v to properly pair weekly matchups with opponent data
CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH weekly_rosters AS (
  SELECT 
    league_id, 
    week, 
    roster_id, 
    points,
    ROW_NUMBER() OVER (PARTITION BY league_id, week ORDER BY roster_id) AS row_num,
    COUNT(*) OVER (PARTITION BY league_id, week) AS total_teams
  FROM public.sleeper_matchups
),
paired_matchups AS (
  SELECT 
    a.league_id,
    a.week,
    a.roster_id,
    a.points,
    CASE 
      WHEN a.row_num % 2 = 1 AND a.row_num < a.total_teams 
        THEN LEAD(a.roster_id) OVER (PARTITION BY a.league_id, a.week ORDER BY a.roster_id)
      WHEN a.row_num % 2 = 0 
        THEN LAG(a.roster_id) OVER (PARTITION BY a.league_id, a.week ORDER BY a.roster_id)
      ELSE NULL
    END AS opp_roster_id,
    CASE 
      WHEN a.row_num % 2 = 1 AND a.row_num < a.total_teams 
        THEN LEAD(a.points) OVER (PARTITION BY a.league_id, a.week ORDER BY a.roster_id)
      WHEN a.row_num % 2 = 0 
        THEN LAG(a.points) OVER (PARTITION BY a.league_id, a.week ORDER BY a.roster_id)
      ELSE NULL
    END AS opp_points
  FROM weekly_rosters a
)
SELECT 
  league_id,
  week,
  roster_id,
  points,
  opp_roster_id,
  opp_points
FROM paired_matchups
WHERE opp_roster_id IS NOT NULL;