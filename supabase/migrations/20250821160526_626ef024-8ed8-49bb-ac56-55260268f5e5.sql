-- Fix security issue: Remove SECURITY DEFINER from view and set search_path for function
DROP VIEW IF EXISTS public.league_player_ids_v;

-- Recreate view without SECURITY DEFINER (views inherit caller permissions by default)
CREATE OR REPLACE VIEW public.league_player_ids_v AS
SELECT DISTINCT jsonb_array_elements_text(COALESCE(sr.players, '[]'::jsonb)) AS player_id, sr.league_id
FROM public.sleeper_rosters sr
UNION
SELECT DISTINCT jsonb_array_elements_text(COALESCE(sr.starters, '[]'::jsonb)) AS player_id, sr.league_id
FROM public.sleeper_rosters sr;

-- Fix search_path for the trigger helper function
CREATE OR REPLACE FUNCTION public.add_updated_at_trigger(_table REGCLASS)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %s', _table);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', _table);
END; $$;