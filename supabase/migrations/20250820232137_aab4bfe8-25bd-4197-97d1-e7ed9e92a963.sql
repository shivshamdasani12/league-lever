-- =====================================================
-- FIX SECURITY ISSUES FROM LINTER
-- =====================================================

-- Fix 1: Add missing RLS policies for tables that have RLS enabled but no policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Fix 2: Update function with search_path for security
DROP FUNCTION IF EXISTS public.get_league_projections(uuid[], integer, integer);
CREATE OR REPLACE FUNCTION public.get_league_projections(
    in_league_player_ids uuid[],
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
        pp.player_id::text,
        pp.points,
        pp.updated_at
    FROM public.player_projections pp
    WHERE pp.player_id = ANY(SELECT unnest(in_league_player_ids::text[]))
      AND pp.season = in_season
      AND pp.week = in_week
    ORDER BY pp.updated_at DESC;
END;
$$;

-- Fix 3: Update update_updated_at_column function with search_path
DROP FUNCTION IF EXISTS public.update_updated_at_column();
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

-- Recreate triggers after function update
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_leagues_updated_at ON public.leagues;
DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
DROP TRIGGER IF EXISTS update_player_projections_updated_at ON public.player_projections;
DROP TRIGGER IF EXISTS update_sleeper_league_users_updated_at ON public.sleeper_league_users;
DROP TRIGGER IF EXISTS update_sleeper_rosters_updated_at ON public.sleeper_rosters;
DROP TRIGGER IF EXISTS update_sleeper_matchups_updated_at ON public.sleeper_matchups;

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