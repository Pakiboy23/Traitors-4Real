-- Broadcast refresh signals for the #192 client.
--
-- The web client (and the Capacitor shell that loads it) listens for two
-- events and then re-fetches through the existing reads. It does not render
-- the payload. Nothing in this file copies a row onto the channel.
--
--   public.season_states  INSERT/UPDATE/DELETE
--   public.seasons         INSERT/UPDATE/DELETE
--     topic   season:<season_id>:state
--     event   season_state_changed
--     private false
--     payload { season_id, source, operation }
--             source is the table name (season_states or seasons)
--             operation is INSERT, UPDATE, or DELETE
--             realtime.send also adds a random id; that id is not a player,
--             submission, or email
--
--   public.submissions     INSERT/UPDATE/DELETE
--     topic   admin:submissions
--     event   submission_changed
--     private true
--     payload { submission_id, kind, submission_status, season_id, week_id, operation }
--             no name, email, weekly picks, or payload jsonb
--
-- realtime.broadcast_changes is the wrong helper here. It omits the private
-- flag, so the message defaults to a private channel and never reaches the
-- public season subscription. It also sends the whole old and new row, which
-- on submissions includes the email and the picks.
--
-- Public topics are not an authorization boundary. Anyone who can join
-- season:<id>:state can read the payload, so the payload stays an id and an
-- operation. The board itself is still loaded through season_states_public.
-- A season id containing ":" is skipped: the receive policy only allows
-- season:<one segment>:state, and the client builds the topic the same way.
--
-- Private delivery is the RLS policy on realtime.messages. SELECT (receive)
-- on admin:submissions is granted to authenticated admins only, checked with
-- private.is_traitors_admin(). There is no INSERT policy: clients cannot
-- publish. The trigger functions are security definer, owned by the migration
-- role (postgres, which bypasses RLS), so an anon submission insert can still
-- emit the signal. realtime.send swallows an insert failure as a warning;
-- the table write still commits, and the client keeps its existing poll.
--
-- Not broadcast:
--   show_configs — the draft-enabled switch lives here, but the client
--     ignores payload fields and a refetch of show config on every board
--     save would reset unsaved admin edits. It still loads on page start.
--   score_adjustments — the board copy is written into season_states, which
--     already broadcasts. The table itself stays admin-only.
--   season_state_emails — the admin email archive. Never a topic.
--
-- Apply after 0008 (private.is_traitors_admin must exist) in the Supabase
-- SQL Editor or with the Supabase CLI, as the postgres role. Do not apply
-- from this pull request. Idempotent: an earlier untracked pair of public
-- functions and the two policies are replaced by this version.
--
-- After applying, run supabase/scripts/verify-realtime-broadcast.sql.

begin;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.send_season_state_signal(
  target_season_id text,
  source text,
  operation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  season_id text := btrim(coalesce(target_season_id, ''));
begin
  -- Direct RPC calls are not a trigger. Do not publish.
  if pg_trigger_depth() < 1 then
    return;
  end if;
  if season_id = '' or position(':' in season_id) > 0 then
    return;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'season_id', season_id,
      'source', source,
      'operation', operation
    ),
    'season_state_changed',
    'season:' || season_id || ':state',
    false
  );
end;
$$;

create or replace function private.broadcast_season_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_season_state_signal(
    coalesce(new.season_id, old.season_id),
    tg_table_name,
    tg_op
  );
  return null;
end;
$$;

create or replace function private.broadcast_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() < 1 then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'submission_id', coalesce(new.id, old.id),
      'kind', coalesce(new.kind, old.kind),
      'submission_status', coalesce(new.submission_status, old.submission_status),
      'season_id', nullif(btrim(coalesce(new.season_id, old.season_id, '')), ''),
      'week_id', nullif(btrim(coalesce(new.week_id, old.week_id, '')), ''),
      'operation', tg_op
    ),
    'submission_changed',
    'admin:submissions',
    true
  );
  return null;
end;
$$;

revoke all on function private.send_season_state_signal(text, text, text) from public, anon, authenticated;
revoke all on function private.broadcast_season_state_change() from public, anon, authenticated;
revoke all on function private.broadcast_submission_change() from public, anon, authenticated;

grant execute on function private.send_season_state_signal(text, text, text) to service_role;
grant execute on function private.broadcast_season_state_change() to service_role;
grant execute on function private.broadcast_submission_change() to service_role;

-- Replace the untracked public functions if they were applied by hand.
drop trigger if exists broadcast_season_state_change_trigger on public.season_states;
drop trigger if exists broadcast_season_row_change_trigger on public.seasons;
drop trigger if exists broadcast_submission_change_trigger on public.submissions;

drop function if exists public.broadcast_season_state_change();
drop function if exists public.broadcast_submission_change();

create trigger broadcast_season_state_change_trigger
after insert or update or delete on public.season_states
for each row
execute function private.broadcast_season_state_change();

create trigger broadcast_season_row_change_trigger
after insert or update or delete on public.seasons
for each row
execute function private.broadcast_season_state_change();

create trigger broadcast_submission_change_trigger
after insert or update or delete on public.submissions
for each row
execute function private.broadcast_submission_change();

-- Receive-only. No insert, update, or delete policy: a client must not publish.
drop policy if exists season_state_broadcast_read on realtime.messages;
create policy season_state_broadcast_read
on realtime.messages
for select
to anon, authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) ~ '^season:[^:]+:state$'
);

drop policy if exists admin_submission_broadcast_read on realtime.messages;
create policy admin_submission_broadcast_read
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'admin:submissions'
  and (select private.is_traitors_admin())
);

commit;
