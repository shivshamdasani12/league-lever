-- Unique membership per (league_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_members_unique
ON public.league_members (league_id, user_id);

-- Function: add creator/importer as owner member on league insert/update
CREATE OR REPLACE FUNCTION public.leagues_add_creator_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the current user (importer/creator) as owner; fallback to NEW.created_by if present
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by), 'owner')
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: fire on INSERT and UPDATE to also cover upsert/import flows
DROP TRIGGER IF EXISTS trg_leagues_add_creator_as_member ON public.leagues;
CREATE TRIGGER trg_leagues_add_creator_as_member
AFTER INSERT OR UPDATE ON public.leagues
FOR EACH ROW
EXECUTE FUNCTION public.leagues_add_creator_as_member();

-- Backfill: ensure existing leagues have their creator set as owner member
-- Assumes leagues.created_by exists; safely no-op if already present due to ON CONFLICT
INSERT INTO public.league_members (league_id, user_id, role)
SELECT l.id, l.created_by, 'owner'
FROM public.leagues l
LEFT JOIN public.league_members m
  ON m.league_id = l.id AND m.user_id = l.created_by
WHERE l.created_by IS NOT NULL AND m.user_id IS NULL
ON CONFLICT (league_id, user_id) DO NOTHING;