-- Safeguard: ensure league_weeks_v only returns weeks that actually have matchup rows
CREATE OR REPLACE VIEW public.league_weeks_v AS
SELECT
  t.league_id,
  t.week,
  (t.week = max(t.week) OVER (PARTITION BY t.league_id)) AS is_latest
FROM (
  SELECT league_id, week
  FROM public.sleeper_matchups
  GROUP BY league_id, week
  HAVING COUNT(*) > 0
) AS t;

-- Ensure the view runs with the caller's permissions so underlying RLS applies
ALTER VIEW public.league_weeks_v SET (security_invoker = on);
