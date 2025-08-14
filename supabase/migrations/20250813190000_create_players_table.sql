-- Create players table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.players (
    player_id text PRIMARY KEY,
    full_name text,
    position text,
    team text,
    fantasy_positions text[],
    status text,
    current_week_stats jsonb,
    current_week_projection numeric(6,2),
    per_game_stats jsonb,
    injury_status text,
    practice_participation text,
    first_name text,
    last_name text,
    age integer,
    height text,
    weight text,
    experience integer,
    college text,
    number integer,
    search_rank integer,
    search_rank_ppr integer,
    sport text,
    hashtag text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read players
DROP POLICY IF EXISTS "Allow authenticated users to read players" ON public.players;
CREATE POLICY "Allow authenticated users to read players" ON public.players
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_position ON public.players(position) WHERE position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_team ON public.players(team) WHERE team IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_status ON public.players(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_updated_at ON public.players(updated_at) WHERE updated_at IS NOT NULL;

-- Create GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_players_stats ON public.players USING GIN(current_week_stats) WHERE current_week_stats IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_per_game_stats ON public.players USING GIN(per_game_stats) WHERE per_game_stats IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_fantasy_positions ON public.players USING GIN(fantasy_positions) WHERE fantasy_positions IS NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
