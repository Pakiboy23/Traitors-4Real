-- Stop anon reads from returning player emails.
--
-- season_states stays selectable. The App Store build loads that table
-- directly; revoking the policy would blank the board on every installed
-- copy. A BEFORE trigger archives addresses into season_state_emails
-- (admin RLS, no anon policy) and strips every "email" key from the
-- stored JSON. season_states_public runs the same strip again.
--
-- An empty email on write does not clear the archive. The shipping admin
-- client normalises a missing address to "" and would otherwise wipe the
-- only copy the next time it autosaves.
--
-- player_portraits.email is the primary key. Anon and authenticated lose
-- SELECT on that column. player_portraits_public exposes name and
-- portrait_url. submissions is unchanged and stays admin-only.

begin;

create table if not exists public.season_state_emails (
  season_id text primary key references public.seasons(season_id) on delete cascade,
  emails jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.season_state_emails enable row level security;

drop policy if exists season_state_emails_admin_all on public.season_state_emails;
create policy season_state_emails_admin_all
on public.season_state_emails
for all
to authenticated
using (public.is_traitors_admin())
with check (public.is_traitors_admin());

revoke all on table public.season_state_emails from public, anon;
grant select, insert, update, delete on table public.season_state_emails to authenticated, service_role;

create or replace function public.redact_emails(doc jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  key text;
  value jsonb;
  result jsonb;
begin
  if doc is null then
    return null;
  elsif jsonb_typeof(doc) = 'object' then
    result := '{}'::jsonb;
    for key, value in
      select entry.key, entry.value
      from jsonb_each(doc) as entry
    loop
      if key = 'email' then
        continue;
      end if;
      result := result || jsonb_build_object(key, public.redact_emails(value));
    end loop;
    return result;
  elsif jsonb_typeof(doc) = 'array' then
    select coalesce(jsonb_agg(public.redact_emails(item.elem) order by item.ord), '[]'::jsonb)
      into result
    from jsonb_array_elements(doc) with ordinality as item(elem, ord);
    return result;
  else
    return doc;
  end if;
end;
$$;

create or replace function public.merge_season_emails(previous jsonb, state jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  stored_players jsonb := coalesce(previous->'players', '{}'::jsonb);
  stored_history jsonb := coalesce(previous->'history', '{}'::jsonb);
  next_players jsonb := '{}'::jsonb;
  next_history jsonb := '{}'::jsonb;
  elem jsonb;
  entry_id text;
  incoming text;
begin
  if jsonb_typeof(state->'players') = 'array' then
    for elem in
      select value from jsonb_array_elements(state->'players')
    loop
      entry_id := elem->>'id';
      if entry_id is null or length(trim(entry_id)) = 0 then
        continue;
      end if;
      incoming := trim(coalesce(elem->>'email', ''));
      if elem ? 'email' and length(incoming) > 0 then
        next_players := next_players || jsonb_build_object(entry_id, incoming);
      elsif stored_players ? entry_id then
        next_players := next_players || jsonb_build_object(entry_id, stored_players->>entry_id);
      end if;
    end loop;
  else
    next_players := stored_players;
  end if;

  if jsonb_typeof(state->'weeklySubmissionHistory') = 'array' then
    for elem in
      select value from jsonb_array_elements(state->'weeklySubmissionHistory')
    loop
      entry_id := elem->>'id';
      if entry_id is null or length(trim(entry_id)) = 0 then
        continue;
      end if;
      incoming := trim(coalesce(elem->>'email', ''));
      if elem ? 'email' and length(incoming) > 0 then
        next_history := next_history || jsonb_build_object(entry_id, incoming);
      elsif stored_history ? entry_id then
        next_history := next_history || jsonb_build_object(entry_id, stored_history->>entry_id);
      end if;
    end loop;
  else
    next_history := stored_history;
  end if;

  return jsonb_build_object('players', next_players, 'history', next_history);
end;
$$;

create or replace function public.archive_and_redact_season_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous jsonb;
begin
  select emails into previous
  from public.season_state_emails
  where season_id = new.season_id;

  insert into public.season_state_emails (season_id, emails)
  values (new.season_id, public.merge_season_emails(coalesce(previous, '{}'::jsonb), new.state))
  on conflict (season_id) do update
    set emails = excluded.emails,
        updated_at = timezone('utc', now());

  new.state := public.redact_emails(new.state);
  return new;
end;
$$;

revoke all on function public.archive_and_redact_season_state() from public, anon, authenticated;

drop trigger if exists season_states_redact_emails on public.season_states;
create trigger season_states_redact_emails
before insert or update on public.season_states
for each row
execute function public.archive_and_redact_season_state();

-- Archive whatever is stored today, then let the trigger strip the JSON.
update public.season_states
set state = state;

create or replace view public.season_states_public
with (security_barrier = true, security_invoker = true)
as
select
  season_id,
  public.redact_emails(state) as state,
  created_at,
  updated_at
from public.season_states;

create or replace view public.player_portraits_public
with (security_barrier = true, security_invoker = true)
as
select
  name,
  portrait_url,
  updated_at
from public.player_portraits;

revoke all on public.season_states_public from public, anon, authenticated, service_role;
revoke all on public.player_portraits_public from public, anon, authenticated, service_role;
grant select on public.season_states_public to anon, authenticated, service_role;
grant select on public.player_portraits_public to anon, authenticated, service_role;

-- Table-level SELECT covers every column. Revoke it, then grant the
-- columns the board needs. Column-level REVOKE alone leaves the table grant.
revoke select on table public.player_portraits from public, anon, authenticated;
grant select (name, portrait_url, updated_at)
  on table public.player_portraits to anon, authenticated;

grant execute on function public.redact_emails(jsonb) to anon, authenticated, service_role;
grant execute on function public.merge_season_emails(jsonb, jsonb) to anon, authenticated, service_role;

commit;
