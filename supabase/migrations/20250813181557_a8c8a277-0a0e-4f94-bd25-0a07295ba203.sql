-- Add matchup_id column if not exists
ALTER TABLE public.sleeper_matchups
  ADD COLUMN IF NOT EXISTS matchup_id integer;

-- Ensure unique constraint exists for one team entry per week
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sleeper_matchups_unique_team_per_week'
  ) THEN
    ALTER TABLE public.sleeper_matchups
      ADD CONSTRAINT sleeper_matchups_unique_team_per_week
      UNIQUE (league_id, week, roster_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ix_sm_league_week_matchup
  ON public.sleeper_matchups (league_id, week, matchup_id);

CREATE INDEX IF NOT EXISTS ix_sm_league_week_roster
  ON public.sleeper_matchups (league_id, week, roster_id);

-- Replace any existing pairing view with matchup_id-based view
DROP VIEW IF EXISTS public.league_matchups_v;

CREATE VIEW public.league_matchups_v AS
SELECT
  a.league_id,
  a.week,
  a.matchup_id,
  a.roster_id    AS roster_id_a,
  b.roster_id    AS roster_id_b,
  a.points       AS points_a,
  b.points       AS points_b
FROM public.sleeper_matchups a
JOIN public.sleeper_matchups b
  ON a.league_id  = b.league_id
 AND a.week       = b.week
 AND a.matchup_id = b.matchup_id
 AND a.roster_id  < b.roster_id;  -- one row per matchup

-- Set security invoker for the view
ALTER VIEW public.league_matchups_v SET (security_invoker = on);

-- Add new columns to players table for enhanced data
ALTER TABLE public.players 
  ADD COLUMN IF NOT EXISTS current_week_stats jsonb,
  ADD COLUMN IF NOT EXISTS current_week_projection numeric(6,2),
  ADD COLUMN IF NOT EXISTS per_game_stats jsonb,
  ADD COLUMN IF NOT EXISTS injury_status text,
  ADD COLUMN IF NOT EXISTS practice_participation text;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_players_projection ON public.players(current_week_projection) WHERE current_week_projection IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_injury ON public.players(injury_status) WHERE injury_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_stats ON public.players USING GIN(current_week_stats) WHERE current_week_stats IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_per_game_stats ON public.players USING GIN(per_game_stats) WHERE per_game_stats IS NOT NULL;

-- Add additional player bio fields
ALTER TABLE public.players 
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS experience integer,
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS search_rank integer,
  ADD COLUMN IF NOT EXISTS search_rank_ppr integer,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS hashtag text;

-- Create indexes for the new bio fields
CREATE INDEX IF NOT EXISTS idx_players_age ON public.players(age) WHERE age IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_experience ON public.players(experience) WHERE experience IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_college ON public.players(college) WHERE college IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_search_rank ON public.players(search_rank) WHERE search_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_search_rank_ppr ON public.players(search_rank_ppr) WHERE search_rank_ppr IS NOT NULL;