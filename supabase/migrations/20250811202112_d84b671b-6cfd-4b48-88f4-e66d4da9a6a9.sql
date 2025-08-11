-- Extend leagues table with Sleeper-related columns
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS season integer,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb;

-- Ensure uniqueness for provider + external_id pairs (used for idempotent upserts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'leagues_provider_external_id_unique'
  ) THEN
    CREATE UNIQUE INDEX leagues_provider_external_id_unique
      ON public.leagues (provider, external_id);
  END IF;
END $$;

-- Sleeper league users table
CREATE TABLE IF NOT EXISTS public.sleeper_league_users (
  id bigserial PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  sleeper_user_id text NOT NULL,
  username text,
  display_name text,
  avatar text,
  is_commissioner boolean DEFAULT false,
  app_user_id uuid,
  CONSTRAINT sleeper_league_users_unique UNIQUE (league_id, sleeper_user_id)
);

CREATE INDEX IF NOT EXISTS idx_sleeper_league_users_league_id ON public.sleeper_league_users(league_id);

-- Sleeper rosters table
CREATE TABLE IF NOT EXISTS public.sleeper_rosters (
  id bigserial PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  roster_id integer NOT NULL,
  owner_sleeper_user_id text,
  starters jsonb,
  players jsonb,
  settings jsonb,
  CONSTRAINT sleeper_rosters_unique UNIQUE (league_id, roster_id)
);

CREATE INDEX IF NOT EXISTS idx_sleeper_rosters_league_id ON public.sleeper_rosters(league_id);

-- Sleeper matchups table
CREATE TABLE IF NOT EXISTS public.sleeper_matchups (
  id bigserial PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  week integer NOT NULL,
  roster_id integer NOT NULL,
  points numeric(10,2),
  starters jsonb,
  players jsonb,
  CONSTRAINT sleeper_matchups_unique UNIQUE (league_id, week, roster_id)
);

CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_league_week ON public.sleeper_matchups(league_id, week);

-- Enable RLS and add policies to allow the league owner (created_by) to manage imported data
ALTER TABLE public.sleeper_league_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_matchups ENABLE ROW LEVEL SECURITY;

-- Helper policy condition: owner of the league
-- Using EXISTS with leagues.created_by = auth.uid()
CREATE POLICY IF NOT EXISTS "Owner can view sleeper league users"
ON public.sleeper_league_users FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can insert sleeper league users"
ON public.sleeper_league_users FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can update sleeper league users"
ON public.sleeper_league_users FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can delete sleeper league users"
ON public.sleeper_league_users FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

-- Policies for rosters
CREATE POLICY IF NOT EXISTS "Owner can view sleeper rosters"
ON public.sleeper_rosters FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can insert sleeper rosters"
ON public.sleeper_rosters FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can update sleeper rosters"
ON public.sleeper_rosters FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can delete sleeper rosters"
ON public.sleeper_rosters FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

-- Policies for matchups
CREATE POLICY IF NOT EXISTS "Owner can view sleeper matchups"
ON public.sleeper_matchups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can insert sleeper matchups"
ON public.sleeper_matchups FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can update sleeper matchups"
ON public.sleeper_matchups FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "Owner can delete sleeper matchups"
ON public.sleeper_matchups FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));
