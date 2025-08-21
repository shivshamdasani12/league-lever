-- 1) Add missing column to league_members used by UI
ALTER TABLE public.league_members
  ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

-- 2) Create bets table for wagering features
CREATE TABLE IF NOT EXISTS public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'offered',
  token_amount numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  settled_at timestamptz,
  outcome text,
  terms jsonb
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

-- Policies: read for authenticated, insert for members, update by participants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bets' AND policyname='Authenticated can read bets'
  ) THEN
    CREATE POLICY "Authenticated can read bets" ON public.bets FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bets' AND policyname='Members can create bets'
  ) THEN
    CREATE POLICY "Members can create bets" ON public.bets FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = bets.league_id AND lm.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bets' AND policyname='Participants can update bets'
  ) THEN
    CREATE POLICY "Participants can update bets" ON public.bets FOR UPDATE TO authenticated USING (
      created_by = auth.uid() OR accepted_by = auth.uid()
    ) WITH CHECK (
      created_by = auth.uid() OR accepted_by = auth.uid()
    );
  END IF;
END $$;

-- 3) Transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  league_id uuid NOT NULL,
  bet_id uuid,
  amount numeric NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='Authenticated can read transactions'
  ) THEN
    CREATE POLICY "Authenticated can read transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='Authenticated can insert transactions'
  ) THEN
    CREATE POLICY "Authenticated can insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 4) Profiles table minimal to satisfy upserts
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can upsert their profile'
  ) THEN
    CREATE POLICY "Users can upsert their profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their profile'
  ) THEN
    CREATE POLICY "Users can update their profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 5) Invitations table used by UI
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  email text NOT NULL,
  code text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Members can read invitations'
  ) THEN
    CREATE POLICY "Members can read invitations" ON public.invitations FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = invitations.league_id AND lm.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitations' AND policyname='Members can create invitations'
  ) THEN
    CREATE POLICY "Members can create invitations" ON public.invitations FOR INSERT TO authenticated WITH CHECK (
      invited_by = auth.uid() AND EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = invitations.league_id AND lm.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 6) Strengthen/define league_weeks_v view used by UI
CREATE OR REPLACE VIEW public.league_weeks_v AS
SELECT
  m.league_id::text AS league_id,
  m.week,
  (m.week = MAX(m.week) OVER (PARTITION BY m.league_id)) AS is_latest
FROM public.sleeper_matchups m
GROUP BY m.league_id, m.week;
