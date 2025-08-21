-- Fix missing columns referenced by app and views
-- 1) Add accepted_at to bets
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- 2) Add joined_at to league_members
ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

-- (No data loss; safe additive changes)