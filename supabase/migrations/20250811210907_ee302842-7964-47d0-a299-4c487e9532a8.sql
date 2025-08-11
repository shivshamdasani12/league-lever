-- Invite fixes migration: unique membership, creator trigger, RLS updates, and accept_invite RPC

-- 1) Ensure unique membership to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname='public' AND indexname='ux_league_members_unique'
  ) THEN
    CREATE UNIQUE INDEX ux_league_members_unique ON public.league_members(league_id, user_id);
  END IF;
END $$;

-- 2) Auto-add creator as owner on league creation (trigger)
CREATE OR REPLACE FUNCTION public.leagues_add_creator_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.league_members(league_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (league_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leagues_add_creator ON public.leagues;
CREATE TRIGGER trg_leagues_add_creator
AFTER INSERT ON public.leagues
FOR EACH ROW EXECUTE FUNCTION public.leagues_add_creator_as_member();

-- 3) Helper: check if user is league creator
CREATE OR REPLACE FUNCTION public.is_league_creator(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = _league_id AND l.created_by = _user_id
  );
$$;

-- 4) Invitations RLS updates
-- Ensure RLS is enabled
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if present
DROP POLICY IF EXISTS "Invitee can accept invitation" ON public.invitations;
DROP POLICY IF EXISTS "League members can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "League members can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Inviter or creator can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Inviter or creator can delete invitations" ON public.invitations;

-- Create policies allowing creators OR members to manage invites
CREATE POLICY "Creators or members can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_league_member(league_id, auth.uid())
  OR public.is_league_creator(league_id, auth.uid())
);

CREATE POLICY "Creators or members can read invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  public.is_league_member(league_id, auth.uid())
  OR public.is_league_creator(league_id, auth.uid())
);

CREATE POLICY "Inviter or creator can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  invited_by = auth.uid()
  OR public.is_league_creator(league_id, auth.uid())
);

CREATE POLICY "Inviter or creator can delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (
  invited_by = auth.uid()
  OR public.is_league_creator(league_id, auth.uid())
);

-- 5) Secure, idempotent accept-invite function using existing columns
-- Accepts a code, validates pending, inserts membership, marks accepted.
CREATE OR REPLACE FUNCTION public.accept_invite(_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.code = _invite_code
    AND i.status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already used invite' USING errcode = '22023';
  END IF;

  -- Insert membership (idempotent)
  INSERT INTO public.league_members(league_id, user_id, role)
  VALUES (v_inv.league_id, auth.uid(), 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  -- Mark accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  WHERE id = v_inv.id AND status = 'pending';

  RETURN jsonb_build_object(
    'league_id', v_inv.league_id,
    'status', 'accepted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;