-- Secure players table with RLS and basic policies
alter table public.players enable row level security;

-- Allow authenticated users to read player dictionary
create policy if not exists "Authenticated can read players"
  on public.players
  for select
  using (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update player dictionary rows
create policy if not exists "Authenticated can insert players"
  on public.players
  for insert
  with check (auth.role() = 'authenticated');

create policy if not exists "Authenticated can update players"
  on public.players
  for update
  using (auth.role() = 'authenticated');