-- Device push tokens, for weekly lock reminders.
--
-- Apply in the Supabase SQL Editor or with the Supabase CLI.

begin;

create table if not exists public.push_tokens (
  token text primary key,
  platform text not null check (platform in ('ios', 'android', 'web')),
  season_id text null,
  email text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_tokens_season_idx
  on public.push_tokens (season_id, created_at desc);

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row
execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

-- A device registers itself, so insert has to be open to anon — the same
-- trade-off already made for submissions, since players are identified by email
-- rather than authenticated.
drop policy if exists push_tokens_public_register on public.push_tokens;
create policy push_tokens_public_register
on public.push_tokens
for insert
to anon, authenticated
with check (char_length(trim(token)) > 0);

-- Deliberately no public select or update. A push token is a device
-- identifier: readable tokens would let anyone enumerate the league's devices,
-- and updatable rows would let anyone repoint another device's notifications.
-- Re-registration inserts a new row; tokens APNs rejects are pruned by the
-- sender rather than by the client.
drop policy if exists push_tokens_admin_manage on public.push_tokens;
create policy push_tokens_admin_manage
on public.push_tokens
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

commit;
