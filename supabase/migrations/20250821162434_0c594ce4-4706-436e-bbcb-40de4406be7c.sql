-- Create missing tables and fix remaining schema issues

-- 1. Bets table (referenced by SportsbooksTab and WagersTab)
CREATE TABLE IF NOT EXISTS public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE,
  created_by uuid,
  type text NOT NULL,
  token_amount integer NOT NULL DEFAULT 0,
  terms jsonb,
  status text NOT NULL DEFAULT 'offered',
  week integer,
  season integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read bets in their leagues" ON public.bets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = bets.league_id AND lm.user_id = auth.uid()
  ));

CREATE POLICY "Users can create bets in their leagues" ON public.bets
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = bets.league_id AND lm.user_id = auth.uid()
  ));

-- 2. Invitations table (referenced by GeneralTab)
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE,
  created_by uuid,
  email text,
  status text DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read invitations for their leagues" ON public.invitations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = invitations.league_id AND lm.user_id = auth.uid()
  ));

-- 3. Add updated_at trigger for bets table
CREATE TRIGGER set_updated_at_bets
  BEFORE UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Update players table interface to match PlayerRow
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;