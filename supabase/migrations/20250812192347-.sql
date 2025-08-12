-- Replace broken view that returned NULL opponent data
CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH ranked AS (
  SELECT
    m.league_id,
    m.week,
    m.roster_id,
    m.points,
    ROW_NUMBER() OVER (PARTITION BY m.league_id, m.week ORDER BY m.roster_id) AS rn,
    COUNT(*) OVER (PARTITION BY m.league_id, m.week) AS total_teams
  FROM public.sleeper_matchups m
),
paired AS (
  SELECT
    r.league_id,
    r.week,
    r.roster_id,
    r.points,
    CASE 
      WHEN r.rn % 2 = 1 AND r.rn < r.total_teams THEN LEAD(r.roster_id) OVER (PARTITION BY r.league_id, r.week ORDER BY r.roster_id)
      WHEN r.rn % 2 = 0 THEN LAG(r.roster_id) OVER (PARTITION BY r.league_id, r.week ORDER BY r.roster_id)
      ELSE NULL
    END AS opp_roster_id,
    CASE 
      WHEN r.rn % 2 = 1 AND r.rn < r.total_teams THEN LEAD(r.points) OVER (PARTITION BY r.league_id, r.week ORDER BY r.roster_id)
      WHEN r.rn % 2 = 0 THEN LAG(r.points) OVER (PARTITION BY r.league_id, r.week ORDER BY r.roster_id)
      ELSE NULL
    END AS opp_points
  FROM ranked r
)
SELECT 
  league_id,
  week,
  roster_id,
  points,
  opp_roster_id,
  opp_points
FROM paired;