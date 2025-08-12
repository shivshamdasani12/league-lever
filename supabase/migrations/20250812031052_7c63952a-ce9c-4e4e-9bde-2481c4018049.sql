-- Views for Sleeper league data powering UI tabs: Rosters, Weeks, Matchups, Standings
-- Idempotent: create or replace

-- 1) View: league_rosters_v
-- One row per roster with owner name + starters/players
CREATE OR REPLACE VIEW public.league_rosters_v AS
SELECT
  r.league_id,
  r.roster_id,
  u.display_name AS owner_name,
  u.username     AS owner_username,
  u.avatar       AS owner_avatar,
  r.starters,
  r.players
FROM public.sleeper_rosters r
LEFT JOIN public.sleeper_league_users u
  ON u.league_id = r.league_id
 AND u.sleeper_user_id = r.owner_sleeper_user_id;

-- 2) View: league_weeks_v
-- All distinct (league_id, week) we have data for, plus a flag for latest
CREATE OR REPLACE VIEW public.league_weeks_v AS
SELECT
  league_id,
  week,
  (week = max(week) OVER (PARTITION BY league_id)) AS is_latest
FROM (
  SELECT DISTINCT league_id, week FROM public.sleeper_matchups
) w;

-- 3) View: league_matchups_v
-- Head-to-head by (league, week, roster_id) with opponent points (if any)
-- Current schema lacks matchup_id, so opponent fields are null; UI will show single rows
CREATE OR REPLACE VIEW public.league_matchups_v AS
SELECT
  m.league_id,
  m.week,
  m.roster_id,
  m.points,
  NULL::int     AS opp_roster_id,
  NULL::numeric AS opp_points
FROM public.sleeper_matchups m;

-- 4) View: league_standings_v
-- Compute W/L/T and points using weekly scores only; without pairing, PF is accurate, PA and W/L/T default to 0
CREATE OR REPLACE VIEW public.league_standings_v AS
WITH scores AS (
  SELECT league_id, roster_id, points
  FROM public.sleeper_matchups
),
agg AS (
  SELECT league_id, roster_id,
         0 AS wins,
         0 AS losses,
         0 AS ties,
         COALESCE(SUM(points), 0) AS points_for,
         0::numeric AS points_against
  FROM scores
  GROUP BY league_id, roster_id
)
SELECT
  a.league_id,
  a.roster_id,
  COALESCE(u.display_name, 'Unknown') AS owner_name,
  a.wins,
  a.losses,
  a.ties,
  a.points_for AS pf,
  a.points_against AS pa,
  CASE
    WHEN (a.wins + a.losses + a.ties) > 0 THEN ROUND(((a.wins + 0.5 * a.ties)::numeric) / (a.wins + a.losses + a.ties), 3)
    ELSE 0
  END AS win_pct
FROM agg a
LEFT JOIN public.sleeper_rosters r
  ON r.league_id = a.league_id AND r.roster_id = a.roster_id
LEFT JOIN public.sleeper_league_users u
  ON u.league_id = r.league_id AND u.sleeper_user_id = r.owner_sleeper_user_id;

-- Ensure views run with invoker rights and inherit underlying table RLS
ALTER VIEW public.league_rosters_v     SET (security_invoker = on);
ALTER VIEW public.league_weeks_v       SET (security_invoker = on);
ALTER VIEW public.league_matchups_v    SET (security_invoker = on);
ALTER VIEW public.league_standings_v   SET (security_invoker = on);
