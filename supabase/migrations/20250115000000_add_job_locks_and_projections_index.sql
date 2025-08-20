-- Migration: Add job_locks table and ensure projections unique index
-- Date: 2025-01-15
-- Purpose: Support for scheduled refresh_projections function with job locking

-- Create job_locks table for preventing overlapping function executions
CREATE TABLE IF NOT EXISTS public.job_locks (
    job text PRIMARY KEY,
    locked_at timestamptz NOT NULL DEFAULT now(),
    locked_until timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on job_locks
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

-- Create policy for service role to manage job locks
DROP POLICY IF EXISTS "Service role can manage job locks" ON public.job_locks;
CREATE POLICY "Service role can manage job locks" ON public.job_locks
    FOR ALL USING (auth.role() = 'service_role');

-- Ensure projections table has the correct unique constraint
-- (This should already exist from the previous migration, but let's make sure)
DO $$
BEGIN
    -- Check if the unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'projections_source_season_week_scoring_player_id_key'
    ) THEN
        -- Add the unique constraint if it doesn't exist
        ALTER TABLE public.projections 
        ADD CONSTRAINT projections_source_season_week_scoring_player_id_key 
        UNIQUE (source, season, week, scoring, player_id);
    END IF;
END $$;

-- Create additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projections_source_season_week 
    ON public.projections(source, season, week);

CREATE INDEX IF NOT EXISTS idx_projections_updated_at 
    ON public.projections(updated_at);

CREATE INDEX IF NOT EXISTS idx_projections_position 
    ON public.projections(position);

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_projections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for projections table
DROP TRIGGER IF EXISTS update_projections_updated_at ON public.projections;
CREATE TRIGGER update_projections_updated_at
    BEFORE UPDATE ON public.projections
    FOR EACH ROW
    EXECUTE FUNCTION update_projections_updated_at();

-- Insert initial job lock record for refresh_projections
INSERT INTO public.job_locks (job, locked_at) 
VALUES ('refresh_projections', now())
ON CONFLICT (job) DO NOTHING;

