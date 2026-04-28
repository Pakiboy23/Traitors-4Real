-- Traitors Fantasy Draft core schema for the Buddylist-aligned stack.
-- Apply in Supabase SQL Editor or with the Supabase CLI.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null references auth.users(id) on delete set null
);

create or replace function public.is_traitors_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create table if not exists public.games (
  slug text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.show_configs (
  slug text primary key,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seasons (
  season_id text primary key,
  label text not null,
  status text not null check (status in ('draft', 'live', 'finalized', 'archived')),
  timezone text not null default 'America/New_York',
  lock_schedule jsonb not null default '{}'::jsonb,
  active_week_id text null,
  finale_config jsonb null,
  rule_pack_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.season_states (
  season_id text primary key references public.seasons(season_id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  kind text not null check (kind in ('draft', 'weekly', 'weekly_merged', 'growth')),
  season_id text null,
  week_id text null,
  submission_status text not null default 'new' check (
    submission_status in ('new', 'merged', 'skipped_late', 'skipped_stale')
  ),
  rule_pack_id text null,
  league text null check (league is null or league in ('main', 'jr')),
  weekly_banished text null,
  weekly_murdered text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.score_adjustments (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons(season_id) on delete cascade,
  player_id text not null,
  week_id text null,
  reason text not null check (char_length(trim(reason)) > 0),
  points numeric not null check (points between -100000 and 100000),
  created_by uuid null references auth.users(id) on delete set null,
  created_by_label text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_portraits (
  email text primary key,
  name text null,
  portrait_url text null,
  portrait_path text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists submissions_season_status_idx
  on public.submissions (season_id, submission_status, created_at desc);
create index if not exists submissions_kind_idx
  on public.submissions (kind, created_at desc);
create index if not exists score_adjustments_season_idx
  on public.score_adjustments (season_id, created_at desc);

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

drop trigger if exists show_configs_set_updated_at on public.show_configs;
create trigger show_configs_set_updated_at
before update on public.show_configs
for each row
execute function public.set_updated_at();

drop trigger if exists seasons_set_updated_at on public.seasons;
create trigger seasons_set_updated_at
before update on public.seasons
for each row
execute function public.set_updated_at();

drop trigger if exists season_states_set_updated_at on public.season_states;
create trigger season_states_set_updated_at
before update on public.season_states
for each row
execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
before update on public.submissions
for each row
execute function public.set_updated_at();

drop trigger if exists player_portraits_set_updated_at on public.player_portraits;
create trigger player_portraits_set_updated_at
before update on public.player_portraits
for each row
execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.games enable row level security;
alter table public.show_configs enable row level security;
alter table public.seasons enable row level security;
alter table public.season_states enable row level security;
alter table public.submissions enable row level security;
alter table public.score_adjustments enable row level security;
alter table public.player_portraits enable row level security;

drop policy if exists admin_users_select_self_or_admin on public.admin_users;
create policy admin_users_select_self_or_admin
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id or public.is_traitors_admin());

drop policy if exists admin_users_admin_write on public.admin_users;
create policy admin_users_admin_write
on public.admin_users
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists games_public_read on public.games;
create policy games_public_read
on public.games
for select
to anon, authenticated
using (true);

drop policy if exists games_admin_write on public.games;
create policy games_admin_write
on public.games
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists show_configs_public_read on public.show_configs;
create policy show_configs_public_read
on public.show_configs
for select
to anon, authenticated
using (true);

drop policy if exists show_configs_admin_write on public.show_configs;
create policy show_configs_admin_write
on public.show_configs
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists seasons_public_read on public.seasons;
create policy seasons_public_read
on public.seasons
for select
to anon, authenticated
using (true);

drop policy if exists seasons_admin_write on public.seasons;
create policy seasons_admin_write
on public.seasons
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists season_states_public_read on public.season_states;
create policy season_states_public_read
on public.season_states
for select
to anon, authenticated
using (true);

drop policy if exists season_states_admin_write on public.season_states;
create policy season_states_admin_write
on public.season_states
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists submissions_public_create on public.submissions;
create policy submissions_public_create
on public.submissions
for insert
to anon, authenticated
with check (
  kind in ('draft', 'weekly', 'growth')
  and submission_status = 'new'
);

drop policy if exists submissions_admin_manage on public.submissions;
create policy submissions_admin_manage
on public.submissions
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists score_adjustments_admin_manage on public.score_adjustments;
create policy score_adjustments_admin_manage
on public.score_adjustments
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

drop policy if exists player_portraits_public_read on public.player_portraits;
create policy player_portraits_public_read
on public.player_portraits
for select
to anon, authenticated
using (true);

drop policy if exists player_portraits_admin_write on public.player_portraits;
create policy player_portraits_admin_write
on public.player_portraits
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

insert into storage.buckets (id, name, public)
values ('traitors-portraits', 'traitors-portraits', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists traitors_portraits_public_read on storage.objects;
create policy traitors_portraits_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'traitors-portraits');

drop policy if exists traitors_portraits_admin_insert on storage.objects;
create policy traitors_portraits_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'traitors-portraits' and public.is_traitors_admin());

drop policy if exists traitors_portraits_admin_update on storage.objects;
create policy traitors_portraits_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'traitors-portraits' and public.is_traitors_admin())
with check (bucket_id = 'traitors-portraits' and public.is_traitors_admin());

drop policy if exists traitors_portraits_admin_delete on storage.objects;
create policy traitors_portraits_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'traitors-portraits' and public.is_traitors_admin());

do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.season_states;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.submissions;
exception
  when duplicate_object then null;
end;
$$;

commit;
