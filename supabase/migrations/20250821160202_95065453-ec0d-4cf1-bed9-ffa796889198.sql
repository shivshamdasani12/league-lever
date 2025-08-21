-- Comprehensive database rebuild to fix corrupted migration state

-- Drop dependent objects
DROP VIEW IF EXISTS public.league_player_ids_v CASCADE;

-- Recreate core helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop tables (safe even if missing)
DROP TABLE IF EXISTS public.sleeper_matchups CASCADE;
DROP TABLE IF EXISTS public.sleeper_rosters CASCADE;
DROP TABLE IF EXISTS public.sleeper_league_users CASCADE;
DROP TABLE IF EXISTS public.league_members CASCADE;
DROP TABLE IF EXISTS public.player_projections CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.leagues CASCADE;
DROP TABLE IF EXISTS public.job_locks CASCADE;

-- Recreate tables
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  season INTEGER,
  avatar TEXT,
  scoring_settings JSONB,
  settings_json JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.players (
  player_id TEXT PRIMARY KEY,
  full_name TEXT,
  position TEXT,
  team TEXT,
  fantasy_positions TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.player_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  week INTEGER NOT NULL,
  points NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_projections_unique
  ON public.player_projections (player_id, season, week);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  token_balance INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.sleeper_league_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  sleeper_user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  avatar TEXT,
  is_commissioner BOOLEAN DEFAULT false,
  app_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.sleeper_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  roster_id INTEGER NOT NULL,
  players JSONB,
  starters JSONB,
  settings JSONB,
  owner_sleeper_user_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.sleeper_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  roster_id INTEGER NOT NULL,
  players JSONB,
  starters JSONB,
  points NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.job_locks (
  job TEXT NOT NULL PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Upsert support indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_provider_external_id
  ON public.leagues (provider, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_members_unique
  ON public.league_members (league_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_league_users_league_user
  ON public.sleeper_league_users (league_id, sleeper_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_rosters_league_roster
  ON public.sleeper_rosters (league_id, roster_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_matchups_league_week_roster
  ON public.sleeper_matchups (league_id, week, roster_id);

-- Triggers to maintain updated_at
CREATE OR REPLACE FUNCTION public.add_updated_at_trigger(_table REGCLASS)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %s', _table);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', _table);
END; $$;

SELECT public.add_updated_at_trigger('public.leagues');
SELECT public.add_updated_at_trigger('public.players');
SELECT public.add_updated_at_trigger('public.player_projections');
SELECT public.add_updated_at_trigger('public.profiles');
SELECT public.add_updated_at_trigger('public.sleeper_league_users');
SELECT public.add_updated_at_trigger('public.sleeper_rosters');
SELECT public.add_updated_at_trigger('public.sleeper_matchups');

-- RLS: enable and policies
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_league_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

-- Leagues
DROP POLICY IF EXISTS "Authenticated users can read leagues" ON public.leagues;
CREATE POLICY "Authenticated users can read leagues"
ON public.leagues FOR SELECT
TO authenticated
USING (true);

-- League members
DROP POLICY IF EXISTS "League members can view their memberships" ON public.league_members;
CREATE POLICY "League members can view their memberships"
ON public.league_members FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Players
DROP POLICY IF EXISTS "Allow authenticated users to read players" ON public.players;
CREATE POLICY "Allow authenticated users to read players"
ON public.players FOR SELECT
TO authenticated
USING (true);

-- Projections
DROP POLICY IF EXISTS "Authenticated users can read projections" ON public.player_projections;
CREATE POLICY "Authenticated users can read projections"
ON public.player_projections FOR SELECT
TO authenticated
USING (true);

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Sleeper users
DROP POLICY IF EXISTS "Authenticated users can read sleeper data" ON public.sleeper_league_users;
CREATE POLICY "Authenticated users can read sleeper data"
ON public.sleeper_league_users FOR SELECT
TO authenticated
USING (true);

-- Sleeper rosters
DROP POLICY IF EXISTS "Authenticated users can read rosters" ON public.sleeper_rosters;
CREATE POLICY "Authenticated users can read rosters"
ON public.sleeper_rosters FOR SELECT
TO authenticated
USING (true);

-- Sleeper matchups
DROP POLICY IF EXISTS "Authenticated users can read matchups" ON public.sleeper_matchups;
CREATE POLICY "Authenticated users can read matchups"
ON public.sleeper_matchups FOR SELECT
TO authenticated
USING (true);

-- League helper funcs: projections and auto-membership
CREATE OR REPLACE FUNCTION public.get_league_projections(in_league_player_ids TEXT[], in_season INTEGER, in_week INTEGER)
RETURNS TABLE(player_id TEXT, points NUMERIC, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pp.player_id, pp.points, pp.updated_at
  FROM public.player_projections pp
  WHERE pp.player_id = ANY(in_league_player_ids)
    AND pp.season = in_season
    AND pp.week = in_week
  ORDER BY pp.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.leagues_add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'owner')
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leagues_add_creator_as_member ON public.leagues;
CREATE TRIGGER trg_leagues_add_creator_as_member
AFTER INSERT OR UPDATE ON public.leagues
FOR EACH ROW
EXECUTE FUNCTION public.leagues_add_creator_as_member();

-- View to expose league player ids
CREATE OR REPLACE VIEW public.league_player_ids_v AS
SELECT DISTINCT jsonb_array_elements_text(COALESCE(sr.players, '[]'::jsonb)) AS player_id, sr.league_id
FROM public.sleeper_rosters sr
UNION
SELECT DISTINCT jsonb_array_elements_text(COALESCE(sr.starters, '[]'::jsonb)) AS player_id, sr.league_id
FROM public.sleeper_rosters sr;

-- Job locks policy: service role only
DROP POLICY IF EXISTS "Service role can manage job locks" ON public.job_locks;
CREATE POLICY "Service role can manage job locks"
ON public.job_locks
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');