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