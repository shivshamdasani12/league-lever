-- Minimal players dictionary for Sleeper
create table if not exists public.players (
  player_id text primary key,
  full_name text,
  position text,
  team text,
  fantasy_positions text[],
  status text,
  updated_at timestamptz not null default now()
);

-- View: league_player_ids_v = all unique player_ids referenced by a league's rosters
create or replace view public.league_player_ids_v as
with all_ids as (
  select league_id, jsonb_array_elements_text(players) as player_id
  from public.sleeper_rosters
  union
  select league_id, jsonb_array_elements_text(starters) as player_id
  from public.sleeper_rosters
)
select league_id, player_id
from all_ids
group by league_id, player_id;

-- View: league_players_v = dictionary rows for a league
create or replace view public.league_players_v as
select lpid.league_id, p.player_id, p.full_name, p.position, p.team
from public.league_player_ids_v lpid
join public.players p on p.player_id = lpid.player_id;

-- Named rosters view: starters/bench with names
create or replace view public.league_rosters_named_v as
select
  r.league_id,
  r.roster_id,
  u.display_name as owner_name,
  u.username     as owner_username,
  u.avatar       as owner_avatar,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', s,
        'name', p.full_name,
        'pos', p.position,
        'team', p.team
      )
    )
    from jsonb_array_elements_text(r.starters) s
    left join public.players p on p.player_id = s
  ) as starters_named,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', pl,
        'name', p.full_name,
        'pos', p.position,
        'team', p.team
      )
    )
    from jsonb_array_elements_text(r.players) pl
    left join public.players p on p.player_id = pl
  ) as bench_named
from public.sleeper_rosters r
left join public.sleeper_league_users u
  on u.league_id = r.league_id
 and u.sleeper_user_id = r.owner_sleeper_user_id;

-- Weeks view (idempotent)
create or replace view public.league_weeks_v as
select
  league_id,
  week,
  (week = max(week) over (partition by league_id)) as is_latest
from (select distinct league_id, week from public.sleeper_matchups) t;

-- Matchups view (idempotent)
create or replace view public.league_matchups_v as
select league_id, week, roster_id, points
from public.sleeper_matchups;

-- Security: views should run with invoker, inheriting table RLS
alter view public.league_player_ids_v  set (security_invoker = on);
alter view public.league_players_v     set (security_invoker = on);
alter view public.league_rosters_named_v set (security_invoker = on);
alter view public.league_weeks_v set (security_invoker = on);
alter view public.league_matchups_v set (security_invoker = on);