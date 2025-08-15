create table if not exists public.projections (
  id bigserial primary key,
  source text not null,                 -- 'fantasypros' | 'fantasynerds' | etc.
  season int not null,
  week int not null,
  scoring text not null,                -- 'PPR' | 'Half' | 'STD'
  player_id text not null,              -- Sleeper's player_id
  position text not null,               -- QB/RB/WR/TE/K/DST
  raw jsonb not null,                   -- full scraped row
  points numeric(7,2),                  -- parsed fantasy points
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source, season, week, scoring, player_id)
);

alter table public.projections enable row level security;

drop policy if exists "projections read for authenticated" on public.projections;
create policy "projections read for authenticated"
  on public.projections for select
  using (auth.role() = 'authenticated');
