-- Check if players table exists and create it if needed
DO $$
BEGIN
    -- Check if the players table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'players'
    ) THEN
        -- Create the players table with basic structure
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
        
        -- Add RLS policy
        ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for authenticated users
        CREATE POLICY "Allow authenticated users to read players" ON public.players
            FOR SELECT USING (auth.role() = 'authenticated');
            
        RAISE NOTICE 'Created players table with basic structure';
    ELSE
        RAISE NOTICE 'Players table already exists';
    END IF;
END $$;

-- Check current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'players'
ORDER BY ordinal_position;

-- Check if table has any data
SELECT COUNT(*) as player_count FROM public.players;
