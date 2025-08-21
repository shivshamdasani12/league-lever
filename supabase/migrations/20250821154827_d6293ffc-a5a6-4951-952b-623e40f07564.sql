-- Fix get_league_projections signature to accept text[] instead of uuid[]
DROP FUNCTION IF EXISTS public.get_league_projections(uuid[], integer, integer);

CREATE OR REPLACE FUNCTION public.get_league_projections(
  in_league_player_ids text[],
  in_season integer,
  in_week integer
)
RETURNS TABLE(
  player_id text,
  points numeric,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.player_id,
    pp.points,
    pp.updated_at
  FROM public.player_projections pp
  WHERE pp.player_id = ANY(in_league_player_ids)
    AND pp.season = in_season
    AND pp.week = in_week
  ORDER BY pp.updated_at DESC;
END;
$$;