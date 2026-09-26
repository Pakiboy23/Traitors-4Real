-- Move the admin check out of the public API.
--
-- public.is_traitors_admin() was security definer and callable through
-- PostgREST. The same check now lives in private, which anon cannot use.
-- Each policy keeps its other conditions and calls
-- private.is_traitors_admin() instead.
--
-- Already applied on the live project (private_is_traitors_admin). This
-- file is what a fresh database runs after 0007. Do not re-apply it there:
-- public.is_traitors_admin() is already gone.
--
-- Apply in the Supabase SQL Editor or with the Supabase CLI.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_traitors_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function private.is_traitors_admin() from public, anon;
grant execute on function private.is_traitors_admin() to authenticated, service_role;

alter policy admin_users_select_self_or_admin
on public.admin_users
using (auth.uid() = user_id or private.is_traitors_admin());

alter policy admin_users_admin_write
on public.admin_users
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy show_configs_admin_write
on public.show_configs
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy seasons_admin_write
on public.seasons
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy season_states_admin_write
on public.season_states
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy submissions_admin_manage
on public.submissions
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy score_adjustments_admin_manage
on public.score_adjustments
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy player_portraits_admin_write
on public.player_portraits
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy push_tokens_admin_manage
on public.push_tokens
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy push_registration_events_admin_manage
on public.push_registration_events
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy season_state_emails_admin_all
on public.season_state_emails
using (private.is_traitors_admin())
with check (private.is_traitors_admin());

alter policy traitors_portraits_admin_insert
on storage.objects
with check (bucket_id = 'traitors-portraits' and private.is_traitors_admin());

alter policy traitors_portraits_admin_update
on storage.objects
using (bucket_id = 'traitors-portraits' and private.is_traitors_admin())
with check (bucket_id = 'traitors-portraits' and private.is_traitors_admin());

alter policy traitors_portraits_admin_delete
on storage.objects
using (bucket_id = 'traitors-portraits' and private.is_traitors_admin());

drop function public.is_traitors_admin();

commit;
