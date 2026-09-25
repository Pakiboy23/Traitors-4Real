-- One-off alignment for traitors-new-blood-s1. Do not run as a schema migration.
--
-- Admin treats state.activeWeekId as the running week. That value is week-2.
-- Two copies were left on week-1:
--   seasons.active_week_id
--   season_states.state.seasonConfig.activeWeekId
--
-- This sets both copies to week-2 and leaves players, results, and history
-- alone. Idempotent: a row already on week-2 is not rewritten.
--
-- Review the SELECT, then run the UPDATE block in the Supabase SQL Editor.

-- Preview
select
  s.season_id,
  s.active_week_id as seasons_active_week_id,
  ss.state->>'activeWeekId' as state_active_week_id,
  ss.state->'seasonConfig'->>'activeWeekId' as season_config_active_week_id
from public.seasons s
join public.season_states ss using (season_id)
where s.season_id = 'traitors-new-blood-s1';

begin;

update public.seasons
set
  active_week_id = 'week-2',
  updated_at = timezone('utc', now())
where season_id = 'traitors-new-blood-s1'
  and active_week_id is distinct from 'week-2';

update public.season_states
set
  state = jsonb_set(
    jsonb_set(state, '{activeWeekId}', '"week-2"'::jsonb, true),
    '{seasonConfig,activeWeekId}',
    '"week-2"'::jsonb,
    true
  ),
  updated_at = timezone('utc', now())
where season_id = 'traitors-new-blood-s1'
  and (
    state->>'activeWeekId' is distinct from 'week-2'
    or state->'seasonConfig'->>'activeWeekId' is distinct from 'week-2'
  );

commit;
