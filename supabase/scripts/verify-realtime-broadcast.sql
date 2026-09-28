-- Read-only check for supabase/0009_realtime_broadcasts.sql.
-- Run in the Supabase SQL Editor after that migration. This script does not
-- insert, update, or delete. A mismatch raises; a match emits a notice.

do $$
declare
  missing text[] := array[]::text[];
  season_using text;
  admin_using text;
  season_roles text[];
  admin_roles text[];
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'send_season_state_signal'
      and p.prosecdef
  ) then
    missing := missing || 'private.send_season_state_signal (security definer)';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'broadcast_season_state_change'
      and p.prosecdef
  ) then
    missing := missing || 'private.broadcast_season_state_change (security definer)';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'broadcast_submission_change'
      and p.prosecdef
  ) then
    missing := missing || 'private.broadcast_submission_change (security definer)';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('broadcast_season_state_change', 'broadcast_submission_change')
  ) then
    missing := missing || 'public broadcast functions should have been dropped';
  end if;

  if to_regprocedure('private.broadcast_submission_change()') is not null
     and has_function_privilege('anon', 'private.broadcast_submission_change()', 'execute') then
    missing := missing || 'anon can execute private.broadcast_submission_change';
  end if;

  if to_regprocedure('private.send_season_state_signal(text, text, text)') is not null
     and has_function_privilege('anon', 'private.send_season_state_signal(text, text, text)', 'execute') then
    missing := missing || 'anon can execute private.send_season_state_signal';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'season_states'
      and t.tgname = 'broadcast_season_state_change_trigger'
      and pn.nspname = 'private'
      and p.proname = 'broadcast_season_state_change'
      and (t.tgtype & 1) = 1  -- FOR EACH ROW
      and (t.tgtype & 2) = 0  -- AFTER, not BEFORE
      and (t.tgtype & 64) = 0  -- not INSTEAD OF
      and (t.tgtype & 28) = 28  -- INSERT OR DELETE OR UPDATE
  ) then
    missing := missing || 'season_states broadcast trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'seasons'
      and t.tgname = 'broadcast_season_row_change_trigger'
      and pn.nspname = 'private'
      and p.proname = 'broadcast_season_state_change'
      and (t.tgtype & 1) = 1
      and (t.tgtype & 2) = 0
      and (t.tgtype & 64) = 0
      and (t.tgtype & 28) = 28
  ) then
    missing := missing || 'seasons broadcast trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'submissions'
      and t.tgname = 'broadcast_submission_change_trigger'
      and pn.nspname = 'private'
      and p.proname = 'broadcast_submission_change'
      and (t.tgtype & 1) = 1
      and (t.tgtype & 2) = 0
      and (t.tgtype & 64) = 0
      and (t.tgtype & 28) = 28
  ) then
    missing := missing || 'submissions broadcast trigger';
  end if;

  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in ('show_configs', 'score_adjustments', 'season_state_emails')
      and t.tgname like 'broadcast_%'
  ) then
    missing := missing || 'unexpected broadcast trigger on a private or config table';
  end if;

  select pg_get_expr(pol.polqual, pol.polrelid),
         array(select rol.rolname from pg_roles rol where rol.oid = any(pol.polroles))
    into season_using, season_roles
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'realtime'
    and c.relname = 'messages'
    and pol.polname = 'season_state_broadcast_read'
    and pol.polcmd = 'r';

  if season_using is null
     or season_using !~ 'season:\[\^:\]\+:state'
     or season_roles is null
     or not ('anon' = any(season_roles) and 'authenticated' = any(season_roles)) then
    missing := missing || 'season_state_broadcast_read for anon and authenticated';
  end if;

  select pg_get_expr(pol.polqual, pol.polrelid),
         array(select rol.rolname from pg_roles rol where rol.oid = any(pol.polroles))
    into admin_using, admin_roles
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'realtime'
    and c.relname = 'messages'
    and pol.polname = 'admin_submission_broadcast_read'
    and pol.polcmd = 'r';

  if admin_using is null
     or admin_using !~ 'admin:submissions'
     or admin_using !~ 'is_traitors_admin'
     or admin_roles is null
     or 'anon' = any(admin_roles)
     or not ('authenticated' = any(admin_roles)) then
    missing := missing || 'admin_submission_broadcast_read for authenticated admins only';
  end if;

  if exists (
    select 1
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime'
      and c.relname = 'messages'
      and pol.polcmd in ('a', 'w', 'd', '*')
  ) then
    missing := missing || 'client write policy on realtime.messages';
  end if;

  if cardinality(missing) > 0 then
    raise exception 'realtime broadcast sender is incomplete: %', array_to_string(missing, '; ');
  end if;

  raise notice 'realtime broadcast sender matches 0009';
end;
$$;
