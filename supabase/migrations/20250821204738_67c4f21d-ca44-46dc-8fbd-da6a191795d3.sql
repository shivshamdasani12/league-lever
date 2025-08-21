-- Restore/align database schema to match current code and edge functions
-- 1) Augment leagues table with expected columns
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'sleeper',
  ADD COLUMN IF NOT EXISTS season integer,
  ADD COLUMN IF NOT EXISTS scoring_settings jsonb;

-- 2) Align players table shape with expected structure
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS player_id text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS fantasy_positions text[],
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS current_week_stats jsonb,
  ADD COLUMN IF NOT EXISTS current_week_projection numeric,
  ADD COLUMN IF NOT EXISTS per_game_stats jsonb,
  ADD COLUMN IF NOT EXISTS injury_status text,
  ADD COLUMN IF NOT EXISTS practice_participation text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS search_rank integer,
  ADD COLUMN IF NOT EXISTS search_rank_ppr integer,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS hashtag text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'players_player_id_key'
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_player_id_key UNIQUE (player_id);
  END IF;
END $$;

-- 3) Create supporting updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Sleeper tables used by edge functions
CREATE TABLE IF NOT EXISTS public.sleeper_rosters (
  league_id uuid NOT NULL,
  roster_id integer NOT NULL,
  owner_sleeper_user_id text,
  players jsonb,
  starters jsonb,
  settings jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sleeper_rosters_pkey PRIMARY KEY (league_id, roster_id)
);

ALTER TABLE public.sleeper_rosters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'sleeper_rosters' AND policyname = 'Users can read sleeper_rosters'
  ) THEN
    CREATE POLICY "Users can read sleeper_rosters" ON public.sleeper_rosters
      FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sleeper_league_users (
  league_id uuid NOT NULL,
  sleeper_user_id text NOT NULL,
  username text,
  display_name text,
  avatar text,
  is_commissioner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sleeper_league_users_pkey PRIMARY KEY (league_id, sleeper_user_id)
);

ALTER TABLE public.sleeper_league_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'sleeper_league_users' AND policyname = 'Users can read sleeper_league_users'
  ) THEN
    CREATE POLICY "Users can read sleeper_league_users" ON public.sleeper_league_users
      FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sleeper_matchups (
  league_id uuid NOT NULL,
  week integer NOT NULL,
  matchup_id integer,
  roster_id integer NOT NULL,
  points numeric,
  starters jsonb,
  players jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sleeper_matchups_pkey PRIMARY KEY (league_id, week, roster_id)
);

-- Helpful index for lookups
CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_lwrm ON public.sleeper_matchups (league_id, week, roster_id);
CREATE INDEX IF NOT EXISTS idx_sleeper_matchups_lwm ON public.sleeper_matchups (league_id, week, matchup_id);

ALTER TABLE public.sleeper_matchups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'sleeper_matchups' AND policyname = 'Users can read sleeper_matchups'
  ) THEN
    CREATE POLICY "Users can read sleeper_matchups" ON public.sleeper_matchups
      FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sleeper_standings (
  league_id uuid NOT NULL,
  season integer NOT NULL,
  roster_id integer NOT NULL,
  owner_name text,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  ties integer DEFAULT 0,
  points_for numeric DEFAULT 0,
  points_against numeric DEFAULT 0,
  rank integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sleeper_standings_pkey PRIMARY KEY (league_id, season, roster_id)
);

ALTER TABLE public.sleeper_standings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'sleeper_standings' AND policyname = 'Users can read sleeper_standings'
  ) THEN
    CREATE POLICY "Users can read sleeper_standings" ON public.sleeper_standings
      FOR SELECT USING (true);
  END IF;
END $$;

-- 5) Projections table used by sync
CREATE TABLE IF NOT EXISTS public.player_projections (
  player_id text NOT NULL,
  season integer NOT NULL,
  week integer NOT NULL,
  points numeric,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT player_projections_pkey PRIMARY KEY (player_id, season, week)
);

ALTER TABLE public.player_projections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'player_projections' AND policyname = 'Users can read player_projections'
  ) THEN
    CREATE POLICY "Users can read player_projections" ON public.player_projections
      FOR SELECT USING (true);
  END IF;
END $$;

-- 6) Attach update triggers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sleeper_rosters_updated_at'
  ) THEN
    CREATE TRIGGER trg_sleeper_rosters_updated_at
    BEFORE UPDATE ON public.sleeper_rosters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sleeper_matchups_updated_at'
  ) THEN
    CREATE TRIGGER trg_sleeper_matchups_updated_at
    BEFORE UPDATE ON public.sleeper_matchups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sleeper_standings_updated_at'
  ) THEN
    CREATE TRIGGER trg_sleeper_standings_updated_at
    BEFORE UPDATE ON public.sleeper_standings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sleeper_league_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_sleeper_league_users_updated_at
    BEFORE UPDATE ON public.sleeper_league_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 7) Create views required by the app and edge functions
CREATE OR REPLACE VIEW public.league_player_ids_v AS
SELECT 
  r.league_id,
  jsonb_array_elements_text(COALESCE(r.players, '[]'::jsonb)) AS player_id
FROM public.sleeper_rosters r
GROUP BY r.league_id, player_id;

CREATE OR REPLACE VIEW public.league_rosters_v AS
SELECT 
  r.league_id,
  r.roster_id,
  u.display_name AS owner_name,
  u.username AS owner_username,
  u.avatar AS owner_avatar,
  r.starters,
  r.players
FROM public.sleeper_rosters r
LEFT JOIN public.sleeper_league_users u
  ON u.league_id = r.league_id
 AND u.sleeper_user_id = r.owner_sleeper_user_id;

CREATE OR REPLACE VIEW public.league_rosters_named_v AS
SELECT * FROM public.league_rosters_v;

CREATE OR REPLACE VIEW public.league_matchups_v AS
WITH paired AS (
  SELECT
    a.league_id,
    a.week,
    a.matchup_id,
    a.roster_id AS roster_id_a,
    b.roster_id AS roster_id_b,
    a.points AS points_a,
    b.points AS points_b
  FROM public.sleeper_matchups a
  LEFT JOIN public.sleeper_matchups b
    ON b.league_id = a.league_id
   AND b.week = a.week
   AND b.matchup_id = a.matchup_id
   AND b.roster_id <> a.roster_id
  WHERE a.matchup_id IS NOT NULL
    AND (b.roster_id IS NULL OR a.roster_id < b.roster_id)
), singles AS (
  SELECT league_id, week, NULL::integer AS matchup_id,
         roster_id AS roster_id_a,
         NULL::integer AS roster_id_b,
         points AS points_a,
         NULL::numeric AS points_b
  FROM public.sleeper_matchups
  WHERE matchup_id IS NULL
)
SELECT * FROM paired
UNION ALL
SELECT * FROM singles;

CREATE OR REPLACE VIEW public.league_standings_v AS
SELECT
  s.league_id,
  s.roster_id,
  s.owner_name,
  s.wins,
  s.losses,
  s.ties,
  s.points_for AS pf,
  s.points_against AS pa,
  CASE 
    WHEN (s.wins + s.losses + s.ties) > 0 THEN (s.wins::numeric) / (s.wins + s.losses + s.ties)
    ELSE 0::numeric
  END AS win_pct
FROM public.sleeper_standings s;

-- 8) RPC to serve projections with proper source preference
CREATE OR REPLACE FUNCTION public.get_league_projections(
  in_league_player_ids text[],
  in_season integer,
  in_week integer
)
RETURNS TABLE(player_id text, points numeric, updated_at timestamptz)
LANGUAGE sql STABLE AS $$
  WITH p AS (
    SELECT pp.player_id, pp.points, pp.updated_at, 1 AS src_order
    FROM public.player_projections pp
    WHERE pp.season = in_season AND pp.week = in_week AND pp.player_id = ANY(in_league_player_ids)
    UNION ALL
    SELECT pr.player_id, pr.points, pr.updated_at, 2 AS src_order
    FROM public.projections pr
    WHERE pr.season = in_season AND pr.week = in_week AND pr.player_id = ANY(in_league_player_ids)
  ), ranked AS (
    SELECT DISTINCT ON (player_id) player_id, points, updated_at
    FROM p
    ORDER BY player_id, src_order
  )
  SELECT player_id, points, updated_at FROM ranked;
$$;