-- Add unique indexes to support ON CONFLICT targets used by edge functions
-- Leagues: provider + external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_provider_external_id
ON public.leagues (provider, external_id);

-- Sleeper league users: league_id + sleeper_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_league_users_league_user
ON public.sleeper_league_users (league_id, sleeper_user_id);

-- Sleeper rosters: league_id + roster_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_rosters_league_roster
ON public.sleeper_rosters (league_id, roster_id);

-- Sleeper matchups: league_id + week + roster_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleeper_matchups_league_week_roster
ON public.sleeper_matchups (league_id, week, roster_id);