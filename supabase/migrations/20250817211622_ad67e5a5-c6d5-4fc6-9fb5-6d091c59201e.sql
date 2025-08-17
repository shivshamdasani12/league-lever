-- Create indexes for better projection query performance
CREATE INDEX IF NOT EXISTS idx_projections_weekly
  ON player_projections (season, week, player_id);

CREATE INDEX IF NOT EXISTS idx_projections_updated
  ON player_projections (player_id, season, week, updated_at DESC);

-- Create function to get league projections (simplified version for existing table structure)
CREATE OR REPLACE FUNCTION get_league_projections(
  in_league_player_ids text[],
  in_season int,
  in_week int
)
RETURNS TABLE(
  player_id text,
  projection_points numeric,
  updated_at timestamptz,
  full_name text,
  team text,
  player_position text,
  projection_data jsonb
) AS $$
WITH latest_projections AS (
  SELECT 
    p.player_id, 
    p.projection_points, 
    p.updated_at, 
    p.projection_data,
    pl.full_name, 
    pl.team, 
    pl.position as player_position,
    ROW_NUMBER() OVER (
      PARTITION BY p.player_id
      ORDER BY p.updated_at DESC
    ) AS rn
  FROM player_projections p
  LEFT JOIN players pl ON pl.player_id = p.player_id
  WHERE p.season = in_season
    AND p.week = in_week
    AND p.player_id = ANY(in_league_player_ids)
)
SELECT 
  lp.player_id, 
  lp.projection_points, 
  lp.updated_at, 
  lp.full_name, 
  lp.team, 
  lp.player_position, 
  lp.projection_data
FROM latest_projections lp
WHERE lp.rn = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;