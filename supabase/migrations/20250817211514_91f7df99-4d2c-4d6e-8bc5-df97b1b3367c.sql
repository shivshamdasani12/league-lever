-- Create indexes for better projection query performance
CREATE INDEX IF NOT EXISTS idx_projections_weekly
  ON player_projections (season, week, player_id);

CREATE INDEX IF NOT EXISTS idx_projections_updated
  ON player_projections (player_id, season, week, updated_at DESC);

-- Create function to get league projections with source preference
CREATE OR REPLACE FUNCTION get_league_projections(
  in_league_player_ids text[],
  in_season int,
  in_week int,
  in_scoring text DEFAULT 'PPR',
  in_source_pref text[] DEFAULT ARRAY['fantasypros']
)
RETURNS TABLE(
  player_id text,
  projection_points numeric,
  source text,
  scoring text,
  updated_at timestamptz,
  full_name text,
  team text,
  position text,
  projection_data jsonb
) AS $$
WITH candidates AS (
  SELECT 
    p.player_id, 
    p.projection_points, 
    COALESCE(p.source, 'unknown') as source,
    COALESCE(p.scoring, 'PPR') as scoring,
    p.updated_at, 
    p.projection_data,
    pl.full_name, 
    pl.team, 
    pl.position,
    CASE 
      WHEN COALESCE(p.source, 'unknown') = ANY(in_source_pref) THEN array_position(in_source_pref, COALESCE(p.source, 'unknown'))
      ELSE 999 
    END AS src_rank
  FROM player_projections p
  LEFT JOIN players pl ON pl.player_id = p.player_id
  WHERE p.season = in_season
    AND p.week = in_week
    AND p.player_id = ANY(in_league_player_ids)
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY player_id
           ORDER BY src_rank ASC, updated_at DESC
         ) AS rn
  FROM candidates
)
SELECT 
  r.player_id, 
  r.projection_points, 
  r.source, 
  r.scoring, 
  r.updated_at, 
  r.full_name, 
  r.team, 
  r.position, 
  r.projection_data
FROM ranked r
WHERE r.rn = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;