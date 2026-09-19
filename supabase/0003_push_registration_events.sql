-- Debug trail for device push registration.
--
-- push_tokens stays the real token store. This table records the steps that
-- lead there (or fail to), so a TestFlight build can be diagnosed without a Mac.
-- Apply in the Supabase SQL Editor or with the Supabase CLI.

begin;

create table if not exists public.push_registration_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  event_type text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  detail jsonb not null default '{}'::jsonb,
  season_id text null,
  app_version text null,
  app_build text null
);

create index if not exists push_registration_events_created_idx
  on public.push_registration_events (created_at desc);

create index if not exists push_registration_events_type_idx
  on public.push_registration_events (event_type, created_at desc);

alter table public.push_registration_events enable row level security;

-- A device reports its own registration steps, so insert has to be open to
-- anon — the same trade-off as push_tokens.
drop policy if exists push_registration_events_public_record on public.push_registration_events;
create policy push_registration_events_public_record
on public.push_registration_events
for insert
to anon, authenticated
with check (
  char_length(trim(event_type)) > 0
  and platform in ('ios', 'android', 'web')
);

-- Deliberately no public select. These rows can include a token tail and
-- permission state; readable to the world they would leak device activity.
-- Admins (and the service role) can read them in the dashboard.
drop policy if exists push_registration_events_admin_manage on public.push_registration_events;
create policy push_registration_events_admin_manage
on public.push_registration_events
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

commit;
