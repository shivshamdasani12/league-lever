-- =====================================================
-- COMPREHENSIVE SCHEMA REBUILD - IDEMPOTENT SCRIPT
-- Recreates all app objects based on current schema
-- =====================================================

-- Add missing extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- DROP EXISTING OBJECTS (in dependency order)
-- =====================================================

-- Drop policies first
DROP POLICY IF EXISTS "Service role can manage job locks" ON public.job_locks;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trg_leagues_add_creator_as_member ON public.leagues;
DROP FUNCTION IF EXISTS public.leagues_add_creator_as_member();
DROP FUNCTION IF EXISTS public.get_league_projections(uuid[], integer, integer);
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop views
DROP VIEW IF EXISTS public.league_player_ids_v;

-- Drop indexes (will be recreated with tables)
DROP INDEX IF EXISTS idx_league_members_unique;
DROP INDEX IF EXISTS idx_player_projections_lookup;
DROP INDEX IF EXISTS idx_player_projections_week_season;

-- Drop tables (in dependency order)
DROP TABLE IF EXISTS public.sleeper_matchups CASCADE;
DROP TABLE IF EXISTS public.sleeper_rosters CASCADE;
DROP TABLE IF EXISTS public.sleeper_league_users CASCADE;
DROP TABLE IF EXISTS public.league_members CASCADE;
DROP TABLE IF EXISTS public.player_projections CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.leagues CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.job_locks CASCADE;

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Job locks table
CREATE TABLE public.job_locks (
    job text NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now(),
    locked_until timestamp with time zone,
    locked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY,
    full_name text,
    email text,
    avatar_url text,
    token_balance integer DEFAULT 1000,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Leagues table
CREATE TABLE public.leagues (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id text NOT NULL,
    name text NOT NULL,
    provider text NOT NULL,
    season integer,
    avatar text,
    settings_json jsonb,
    scoring_settings jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Players table
CREATE TABLE public.players (
    player_id text PRIMARY KEY,
    full_name text,
    position text,
    team text,
    fantasy_positions text[],
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Player projections table
CREATE TABLE public.player_projections (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id text NOT NULL,
    week integer NOT NULL,
    season integer NOT NULL,
    points numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- League members table
CREATE TABLE public.league_members (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Sleeper league users table
CREATE TABLE public.sleeper_league_users (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id uuid,
    sleeper_user_id text NOT NULL,
    username text,
    display_name text,
    avatar text,
    is_commissioner boolean DEFAULT false,
    app_user_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Sleeper rosters table
CREATE TABLE public.sleeper_rosters (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id uuid,
    roster_id integer NOT NULL,
    owner_sleeper_user_id text,
    players jsonb,
    starters jsonb,
    settings jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Sleeper matchups table
CREATE TABLE public.sleeper_matchups (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id uuid,
    week integer NOT NULL,
    roster_id integer NOT NULL,
    points numeric,
    starters jsonb,
    players jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

-- League members unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_members_unique
ON public.league_members (league_id, user_id);

-- Player projections indexes
CREATE INDEX IF NOT EXISTS idx_player_projections_lookup
ON public.player_projections (player_id, season, week);

CREATE INDEX IF NOT EXISTS idx_player_projections_week_season
ON public.player_projections (week, season);

-- =====================================================
-- CREATE VIEWS
-- =====================================================

-- View for league player IDs
CREATE OR REPLACE VIEW public.league_player_ids_v AS
SELECT DISTINCT 
    sr.league_id,
    jsonb_array_elements_text(sr.players) AS player_id
FROM public.sleeper_rosters sr
WHERE sr.players IS NOT NULL;

-- =====================================================
-- CREATE FUNCTIONS
-- =====================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- League projections function
CREATE OR REPLACE FUNCTION public.get_league_projections(
    in_league_player_ids uuid[],
    in_season integer,
    in_week integer
)
RETURNS TABLE(
    player_id text,
    points numeric,
    updated_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.player_id::text,
        pp.points,
        pp.updated_at
    FROM public.player_projections pp
    WHERE pp.player_id = ANY(SELECT unnest(in_league_player_ids::text[]))
      AND pp.season = in_season
      AND pp.week = in_week
    ORDER BY pp.updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- League creator as member function
CREATE OR REPLACE FUNCTION public.leagues_add_creator_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id)
  VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by))
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Updated at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at
    BEFORE UPDATE ON public.leagues
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_projections_updated_at
    BEFORE UPDATE ON public.player_projections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sleeper_league_users_updated_at
    BEFORE UPDATE ON public.sleeper_league_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sleeper_rosters_updated_at
    BEFORE UPDATE ON public.sleeper_rosters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sleeper_matchups_updated_at
    BEFORE UPDATE ON public.sleeper_matchups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- League creator trigger
CREATE TRIGGER trg_leagues_add_creator_as_member
    AFTER INSERT OR UPDATE ON public.leagues
    FOR EACH ROW
    EXECUTE FUNCTION public.leagues_add_creator_as_member();

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_league_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleeper_matchups ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Job locks - service role only
CREATE POLICY "Service role can manage job locks" ON public.job_locks
    FOR ALL
    USING (auth.role() = 'service_role'::text);

-- Players - allow read for authenticated users
CREATE POLICY "Allow authenticated users to read players" ON public.players
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- League members - authenticated users can view
CREATE POLICY "League members can view their memberships" ON public.league_members
    FOR SELECT
    USING (auth.uid() = user_id);

-- Basic policies for other tables (can be refined later)
CREATE POLICY "Authenticated users can read leagues" ON public.leagues
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read sleeper data" ON public.sleeper_league_users
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read rosters" ON public.sleeper_rosters
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read matchups" ON public.sleeper_matchups
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read projections" ON public.player_projections
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables exist
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify functions
SELECT proname, prosrc 
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
ORDER BY proname;