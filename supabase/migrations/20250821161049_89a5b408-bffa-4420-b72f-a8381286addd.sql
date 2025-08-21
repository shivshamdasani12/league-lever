-- RLS policies to allow authenticated users to import Sleeper data for leagues they own

-- Leagues: allow owners to insert/update their leagues
CREATE POLICY IF NOT EXISTS "Users can insert their leagues"
ON public.leagues
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their leagues"
ON public.leagues
FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Sleeper league users: allow insert/update when user owns the league
CREATE POLICY IF NOT EXISTS "League owners can insert sleeper users"
ON public.sleeper_league_users
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "League owners can update sleeper users"
ON public.sleeper_league_users
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_league_users.league_id AND l.created_by = auth.uid()
));

-- Sleeper rosters: allow insert/update when user owns the league
CREATE POLICY IF NOT EXISTS "League owners can insert rosters"
ON public.sleeper_rosters
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "League owners can update rosters"
ON public.sleeper_rosters
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_rosters.league_id AND l.created_by = auth.uid()
));

-- Sleeper matchups: allow insert/update when user owns the league
CREATE POLICY IF NOT EXISTS "League owners can insert matchups"
ON public.sleeper_matchups
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));

CREATE POLICY IF NOT EXISTS "League owners can update matchups"
ON public.sleeper_matchups
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.leagues l
  WHERE l.id = sleeper_matchups.league_id AND l.created_by = auth.uid()
));