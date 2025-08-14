-- Create missing tables and enhance existing ones for comprehensive Sleeper integration

-- Enhance sleeper_rosters table if missing columns
ALTER TABLE public.sleeper_rosters 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create trigger for sleeper_rosters
DROP TRIGGER IF EXISTS update_sleeper_rosters_updated_at ON public.sleeper_rosters;
CREATE TRIGGER update_sleeper_rosters_updated_at
  BEFORE UPDATE ON public.sleeper_rosters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enhance sleeper_matchups table if missing columns  
ALTER TABLE public.sleeper_matchups
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create trigger for sleeper_matchups
DROP TRIGGER IF EXISTS update_sleeper_matchups_updated_at ON public.sleeper_matchups;
CREATE TRIGGER update_sleeper_matchups_updated_at
  BEFORE UPDATE ON public.sleeper_matchups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create sleeper_standings table
CREATE TABLE IF NOT EXISTS public.sleeper_standings (
    id bigserial PRIMARY KEY,
    league_id uuid NOT NULL,
    season integer NOT NULL,
    roster_id integer NOT NULL,
    owner_name text,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    ties integer DEFAULT 0,
    points_for numeric(8,2) DEFAULT 0,
    points_against numeric(8,2) DEFAULT 0,
    waiver_position integer,
    total_moves integer DEFAULT 0,
    rank integer,
    playoff_seed integer,
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(league_id, season, roster_id)
);

-- Enable RLS on sleeper_standings
ALTER TABLE public.sleeper_standings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sleeper_standings
DROP POLICY IF EXISTS "Authenticated users can read sleeper_standings" ON public.sleeper_standings;
CREATE POLICY "Authenticated users can read sleeper_standings" ON public.sleeper_standings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create trigger for sleeper_standings
DROP TRIGGER IF EXISTS update_sleeper_standings_updated_at ON public.sleeper_standings;
CREATE TRIGGER update_sleeper_standings_updated_at
  BEFORE UPDATE ON public.sleeper_standings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create player_projections table for detailed weekly projections
CREATE TABLE IF NOT EXISTS public.player_projections (
    id bigserial PRIMARY KEY,
    player_id text NOT NULL,
    season integer NOT NULL,
    week integer NOT NULL,
    projection_points numeric(6,2),
    projection_data jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(player_id, season, week)
);

-- Enable RLS on player_projections
ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_projections
DROP POLICY IF EXISTS "Authenticated users can read player_projections" ON public.player_projections;
CREATE POLICY "Authenticated users can read player_projections" ON public.player_projections
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create trigger for player_projections
DROP TRIGGER IF EXISTS update_player_projections_updated_at ON public.player_projections;
CREATE TRIGGER update_player_projections_updated_at
  BEFORE UPDATE ON public.player_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_sleeper_rosters_league_id ON public.sleeper_rosters(league_id);
CREATE INDEX IF NOT EXISTS idx_sleeper_rosters_updated_at ON public.sleeper_rosters(updated_at);

CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_league_week ON public.sleeper_matchups(league_id, week);
CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_updated_at ON public.sleeper_matchups(updated_at);

CREATE INDEX IF NOT EXISTS idx_sleeper_standings_league_season ON public.sleeper_standings(league_id, season);
CREATE INDEX IF NOT EXISTS idx_sleeper_standings_updated_at ON public.sleeper_standings(updated_at);

CREATE INDEX IF NOT EXISTS idx_player_projections_player_season_week ON public.player_projections(player_id, season, week);
CREATE INDEX IF NOT EXISTS idx_player_projections_season_week ON public.player_projections(season, week);
CREATE INDEX IF NOT EXISTS idx_player_projections_updated_at ON public.player_projections(updated_at);

-- Add enhanced RLS policies for existing sleeper tables if not present
DROP POLICY IF EXISTS "Authenticated users can read sleeper_rosters" ON public.sleeper_rosters;
CREATE POLICY "Authenticated users can read sleeper_rosters" ON public.sleeper_rosters
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read sleeper_matchups" ON public.sleeper_matchups;  
CREATE POLICY "Authenticated users can read sleeper_matchups" ON public.sleeper_matchups
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read sleeper_league_users" ON public.sleeper_league_users;
CREATE POLICY "Authenticated users can read sleeper_league_users" ON public.sleeper_league_users
    FOR SELECT USING (auth.role() = 'authenticated');