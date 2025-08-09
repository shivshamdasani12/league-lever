-- Enable UUID generation
create extension if not exists pgcrypto;

-- Utility function to auto-update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper: check if a user is a member of a league
create or replace function public.is_league_member(_league_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members lm
    where lm.league_id = _league_id and lm.user_id = _user_id
  );
$$;

-- Profiles: one row per user
create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  display_name text,
  token_balance integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by the owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Trigger for updated_at on profiles
create or replace trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Leagues
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text default 'custom',
  external_id text,
  scoring_settings jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leagues enable row level security;

create policy "Members or owner can view leagues"
  on public.leagues for select
  to authenticated
  using (public.is_league_member(id, auth.uid()) or created_by = auth.uid());

create policy "Users can create leagues"
  on public.leagues for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Owner can update leagues"
  on public.leagues for update
  to authenticated
  using (created_by = auth.uid());

create policy "Owner can delete leagues"
  on public.leagues for delete
  to authenticated
  using (created_by = auth.uid());

-- Trigger for updated_at on leagues
create or replace trigger trg_leagues_updated_at
before update on public.leagues
for each row execute function public.update_updated_at_column();

-- League members
create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists idx_league_members_league_id on public.league_members(league_id);

alter table public.league_members enable row level security;

create policy "Users can view members of their leagues"
  on public.league_members for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

create policy "Users can join a league"
  on public.league_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can leave their membership"
  on public.league_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Invitations
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  email text not null,
  code text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

create policy "League members can view invitations"
  on public.invitations for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

create policy "League members can create invitations"
  on public.invitations for insert
  to authenticated
  with check (public.is_league_member(league_id, auth.uid()));

create policy "Invitee can accept invitation"
  on public.invitations for update
  to authenticated
  using (true)
  with check (accepted_by = auth.uid());

-- Bets
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  status text not null default 'offered',
  type text not null,
  terms jsonb,
  token_amount integer not null check (token_amount > 0),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  settled_at timestamptz,
  outcome text
);

create index if not exists idx_bets_league_id on public.bets(league_id);

alter table public.bets enable row level security;

create policy "League members can view bets"
  on public.bets for select
  to authenticated
  using (public.is_league_member(league_id, auth.uid()));

create policy "League members can create bets"
  on public.bets for insert
  to authenticated
  with check (created_by = auth.uid() and public.is_league_member(league_id, auth.uid()));

create policy "Creators or accepters can update their bets"
  on public.bets for update
  to authenticated
  using (created_by = auth.uid() or accepted_by = auth.uid());

-- Transactions (ledger)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  bet_id uuid references public.bets(id) on delete set null,
  amount integer not null,
  type text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_league_id on public.transactions(league_id);

alter table public.transactions enable row level security;

create policy "Users can view their own transactions"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own transactions"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());