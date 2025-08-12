-- Phase 2: Minimal, idempotent migration for matchups + views
begin;

-- 1) Ensure extra columns exist on sleeper_matchups
alter table public.sleeper_matchups
  add column if not exists matchup_id int,
  add column if not exists is_playoffs boolean,
  add column if not exists is_consolation boolean;

-- 2) Helpful index on (league_id, week)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ix_sm_league_week'
  ) THEN
    CREATE INDEX ix_sm_league_week ON public.sleeper_matchups(league_id, week);
  END IF;
END $$;

-- 3) Views: drop and recreate in dependency-safe order
DROP VIEW IF EXISTS public.league_standings_v CASCADE;
DROP VIEW IF EXISTS public.league_matchup_pairs_v CASCADE;
DROP VIEW IF EXISTS public.league_weeks_v CASCADE;

-- 3.1) Weeks view (drives dropdown)
create view public.league_weeks_v as
select league_id,
       week,
       (week = max(week) over (partition by league_id)) as is_latest
from (select distinct league_id, week from public.sleeper_matchups) t;
alter view public.league_weeks_v set (security_invoker = on);

-- 3.2) Pair matchups by matchup_id where available; include singles for byes/unpaired
create view public.league_matchup_pairs_v as
with rows as (
  select league_id, week, matchup_id, roster_id, points
  from public.sleeper_matchups
),
paired as (
  select a.league_id, a.week, a.matchup_id,
         a.roster_id as roster_a, a.points as points_a,
         b.roster_id as roster_b, b.points as points_b
  from rows a
  join rows b
    on a.league_id=b.league_id and a.week=b.week
   and a.matchup_id is not null and a.matchup_id=b.matchup_id
   and a.roster_id < b.roster_id
),
singles as (
  -- rows that have no partner (bye or missing matchup_id)
  select r.league_id, r.week, r.matchup_id,
         r.roster_id as roster_a, r.points as points_a,
         null::int     as roster_b, null::numeric as points_b
  from rows r
  left join rows s
    on r.league_id=s.league_id and r.week=s.week
   and r.matchup_id is not null and r.matchup_id=s.matchup_id
   and r.roster_id <> s.roster_id
  where r.matchup_id is null
     or s.roster_id is null
)
select * from paired
union all
select * from singles;
alter view public.league_matchup_pairs_v set (security_invoker = on);

-- 3.3) Standings computed from pairs
create view public.league_standings_v as
with base as (
  select p.league_id, p.week,
         p.roster_a, p.points_a, p.roster_b, p.points_b
  from public.league_matchup_pairs_v p
),
rows as (
  -- expand to per-roster rows with W/L/T, PF/PA
  select league_id, week,
         roster_a as roster_id,
         points_a as pf,
         coalesce(points_b, 0) as pa,
         case when p.points_b is null then 0
              when p.points_a > p.points_b then 1 else 0 end as win,
         case when p.points_b is null then 0
              when p.points_a < p.points_b then 1 else 0 end as loss,
         case when p.points_b is null then 0
              when p.points_a = p.points_b then 1 else 0 end as tie
  from base p
  union all
  select league_id, week,
         roster_b as roster_id,
         points_b as pf,
         coalesce(points_a, 0) as pa,
         case when p.points_a is null then 0
              when p.points_b > p.points_a then 1 else 0 end as win,
         case when p.points_a is null then 0
              when p.points_b < p.points_a then 1 else 0 end as loss,
         case when p.points_a is null then 0
              when p.points_b = p.points_a then 1 else 0 end as tie
  from base p
  where p.roster_b is not null
),
agg as (
  select league_id, roster_id,
         sum(win)::int as wins,
         sum(loss)::int as losses,
         sum(tie)::int as ties,
         sum(pf)  as points_for,
         sum(pa)  as points_against,
         (sum(win)+sum(loss)+sum(tie)) as games
  from rows
  group by league_id, roster_id
)
select a.league_id,
       a.roster_id,
       coalesce(u.display_name, 'Unknown') as owner_name,
       a.wins, a.losses, a.ties,
       a.points_for as pf,
       a.points_against as pa,
       case when a.games > 0
            then round(((a.wins + 0.5*a.ties)::numeric / a.games), 3)
            else 0 end as win_pct
from agg a
left join public.sleeper_rosters r
  on r.league_id=a.league_id and r.roster_id=a.roster_id
left join public.sleeper_league_users u
  on u.league_id=r.league_id and u.sleeper_user_id=r.owner_sleeper_user_id;

alter view public.league_standings_v set (security_invoker = on);

commit;