-- Create the league_weeks_v view that shows all 18 weeks for all leagues
CREATE OR REPLACE VIEW league_weeks_v AS
SELECT 
  l.id::text as league_id,
  generate_series(1, 18) as week,
  CASE 
    WHEN generate_series(1, 18) = 1 THEN true 
    ELSE false 
  END as is_latest
FROM public.leagues l;

-- Create the league_matchups_v view for matchup pairs from sleeper_matchups
CREATE OR REPLACE VIEW league_matchups_v AS
SELECT 
  sm1.league_id,
  sm1.week,
  sm1.matchup_id,
  sm1.roster_id as roster_id_a,
  sm1.points as points_a,
  sm2.roster_id as roster_id_b,
  sm2.points as points_b
FROM public.sleeper_matchups sm1
LEFT JOIN public.sleeper_matchups sm2 ON 
  sm1.league_id = sm2.league_id 
  AND sm1.week = sm2.week 
  AND sm1.matchup_id = sm2.matchup_id
  AND sm1.roster_id < sm2.roster_id
WHERE sm1.matchup_id IS NOT NULL;