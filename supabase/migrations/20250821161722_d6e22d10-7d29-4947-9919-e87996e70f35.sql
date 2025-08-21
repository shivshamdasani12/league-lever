-- Create the missing database views that the application expects

-- League rosters view: combines roster data with user information
CREATE OR REPLACE VIEW public.league_rosters_v AS
SELECT 
  sr.id,
  sr.league_id,
  sr.roster_id,
  sr.players,
  sr.starters,
  sr.settings,
  sr.owner_sleeper_user_id,
  sr.metadata,
  sr.created_at,
  sr.updated_at,
  slu.username,
  slu.display_name,
  slu.avatar,
  slu.is_commissioner
FROM public.sleeper_rosters sr
LEFT JOIN public.sleeper_league_users slu 
  ON sr.league_id = slu.league_id 
  AND sr.owner_sleeper_user_id = slu.sleeper_user_id;

-- League matchups view: processes matchup data into pairs for head-to-head display
CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH matchup_pairs AS (
  SELECT 
    m1.league_id,
    m1.week,
    m1.roster_id as roster_id_a,
    m1.points as points_a,
    m1.players as players_a,
    m1.starters as starters_a,
    m2.roster_id as roster_id_b,
    m2.points as points_b,
    m2.players as players_b,
    m2.starters as starters_b,
    CASE 
      WHEN m1.points > COALESCE(m2.points, 0) THEN m1.roster_id
      WHEN m2.points > COALESCE(m1.points, 0) THEN m2.roster_id
      ELSE NULL
    END as winner_roster_id,
    r1.username as username_a,
    r1.display_name as display_name_a,
    r1.avatar as avatar_a,
    r2.username as username_b,
    r2.display_name as display_name_b,
    r2.avatar as avatar_b
  FROM public.sleeper_matchups m1
  LEFT JOIN public.sleeper_matchups m2 
    ON m1.league_id = m2.league_id 
    AND m1.week = m2.week 
    AND m1.roster_id < m2.roster_id
    AND m1.metadata->>'matchup_id' = m2.metadata->>'matchup_id'
    AND m1.metadata->>'matchup_id' IS NOT NULL
  LEFT JOIN public.league_rosters_v r1 ON m1.league_id = r1.league_id AND m1.roster_id = r1.roster_id
  LEFT JOIN public.league_rosters_v r2 ON m2.league_id = r2.league_id AND m2.roster_id = r2.roster_id
  WHERE m1.metadata->>'matchup_id' IS NOT NULL
)
SELECT * FROM matchup_pairs
WHERE roster_id_a IS NOT NULL;

-- League standings view: calculates wins, losses, and standings from matchup results
CREATE OR REPLACE VIEW public.league_standings_v AS
WITH roster_stats AS (
  SELECT 
    r.league_id,
    r.roster_id,
    r.username,
    r.display_name,
    r.avatar,
    COALESCE(SUM(
      CASE 
        WHEN m.roster_id = mv.roster_id_a AND mv.winner_roster_id = m.roster_id THEN 1
        WHEN m.roster_id = mv.roster_id_b AND mv.winner_roster_id = m.roster_id THEN 1
        ELSE 0
      END
    ), 0) as wins,
    COALESCE(SUM(
      CASE 
        WHEN m.roster_id = mv.roster_id_a AND mv.winner_roster_id != m.roster_id AND mv.winner_roster_id IS NOT NULL THEN 1
        WHEN m.roster_id = mv.roster_id_b AND mv.winner_roster_id != m.roster_id AND mv.winner_roster_id IS NOT NULL THEN 1
        ELSE 0
      END
    ), 0) as losses,
    COALESCE(SUM(
      CASE 
        WHEN m.roster_id = mv.roster_id_a AND mv.winner_roster_id IS NULL THEN 1
        WHEN m.roster_id = mv.roster_id_b AND mv.winner_roster_id IS NULL THEN 1
        ELSE 0
      END
    ), 0) as ties,
    COALESCE(SUM(m.points), 0) as pf,
    COALESCE(SUM(
      CASE 
        WHEN m.roster_id = mv.roster_id_a THEN COALESCE(mv.points_b, 0)
        WHEN m.roster_id = mv.roster_id_b THEN COALESCE(mv.points_a, 0)
        ELSE 0
      END
    ), 0) as pa
  FROM public.league_rosters_v r
  LEFT JOIN public.sleeper_matchups m ON r.league_id = m.league_id AND r.roster_id = m.roster_id
  LEFT JOIN public.league_matchups_v mv ON m.league_id = mv.league_id AND m.week = mv.week 
    AND (m.roster_id = mv.roster_id_a OR m.roster_id = mv.roster_id_b)
  GROUP BY r.league_id, r.roster_id, r.username, r.display_name, r.avatar
)
SELECT 
  *,
  CASE 
    WHEN (wins + losses + ties) = 0 THEN 0.0
    ELSE ROUND(wins::numeric / (wins + losses + ties), 3)
  END as win_pct
FROM roster_stats;