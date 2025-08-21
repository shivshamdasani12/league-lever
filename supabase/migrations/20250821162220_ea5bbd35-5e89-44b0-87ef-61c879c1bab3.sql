-- Align database schema and views with application expectations

-- 1) Players table: add missing columns used by app and sync function
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS current_week_stats jsonb,
  ADD COLUMN IF NOT EXISTS current_week_projection numeric,
  ADD COLUMN IF NOT EXISTS per_game_stats jsonb,
  ADD COLUMN IF NOT EXISTS injury_status text,
  ADD COLUMN IF NOT EXISTS practice_participation text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS search_rank integer,
  ADD COLUMN IF NOT EXISTS search_rank_ppr integer,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS hashtag text;

-- Optional index for search ordering
CREATE INDEX IF NOT EXISTS idx_players_search_rank ON public.players (search_rank);

-- 2) Sleeper matchups: add matchup_id column used across app
ALTER TABLE public.sleeper_matchups
  ADD COLUMN IF NOT EXISTS matchup_id integer;

-- 3) Projections table to match ingest and queries
CREATE TABLE IF NOT EXISTS public.projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  season integer NOT NULL,
  week integer NOT NULL,
  scoring text NOT NULL DEFAULT 'PPR',
  player_id text NOT NULL,
  position text,
  raw jsonb,
  points numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projections_unique
  ON public.projections (source, season, week, scoring, player_id);

ALTER TABLE public.projections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read projections (new)" ON public.projections;
CREATE POLICY "Authenticated users can read projections (new)"
  ON public.projections FOR SELECT TO authenticated USING (true);

-- 4) Update RPC to read from projections table (latest per player)
CREATE OR REPLACE FUNCTION public.get_league_projections(in_league_player_ids text[], in_season integer, in_week integer)
RETURNS TABLE(player_id text, points numeric, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (p.player_id)
    p.player_id,
    p.points,
    p.updated_at
  FROM public.projections p
  WHERE p.player_id = ANY(in_league_player_ids)
    AND p.season = in_season
    AND p.week = in_week
  ORDER BY p.player_id, p.updated_at DESC
$$;

-- 5) Views expected by the app
-- League rosters (compact shape used by tabs)
CREATE OR REPLACE VIEW public.league_rosters_v AS
SELECT 
  sr.league_id,
  sr.roster_id,
  COALESCE(slu.display_name, slu.username) AS owner_name,
  slu.username AS owner_username,
  slu.avatar AS owner_avatar,
  sr.starters,
  sr.players
FROM public.sleeper_rosters sr
LEFT JOIN public.sleeper_league_users slu 
  ON sr.league_id = slu.league_id 
  AND sr.owner_sleeper_user_id = slu.sleeper_user_id;

-- Named variant used by edge function
CREATE OR REPLACE VIEW public.league_rosters_named_v AS
SELECT 
  sr.league_id,
  sr.roster_id,
  COALESCE(slu.display_name, slu.username) AS owner_name,
  slu.username AS owner_username,
  slu.avatar AS owner_avatar,
  slu.is_commissioner,
  sr.starters,
  sr.players,
  sr.settings,
  sr.owner_sleeper_user_id
FROM public.sleeper_rosters sr
LEFT JOIN public.sleeper_league_users slu 
  ON sr.league_id = slu.league_id 
  AND sr.owner_sleeper_user_id = slu.sleeper_user_id;

-- Matchup pairs view with matchup_id included
CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH matchup_pairs AS (
  SELECT 
    m1.league_id,
    m1.week,
    m1.matchup_id,
    m1.roster_id AS roster_id_a,
    m1.points AS points_a,
    m2.roster_id AS roster_id_b,
    m2.points AS points_b
  FROM public.sleeper_matchups m1
  LEFT JOIN public.sleeper_matchups m2 
    ON m1.league_id = m2.league_id 
    AND m1.week = m2.week 
    AND m1.matchup_id IS NOT NULL
    AND m1.matchup_id = m2.matchup_id
    AND m1.roster_id < m2.roster_id
)
SELECT * FROM matchup_pairs
WHERE roster_id_a IS NOT NULL;

-- Weeks per league, marking latest
CREATE OR REPLACE VIEW public.league_weeks_v AS
SELECT 
  league_id,
  week,
  week = MAX(week) OVER (PARTITION BY league_id) AS is_latest
FROM (
  SELECT DISTINCT league_id, week FROM public.sleeper_matchups
) t;
