-- Narrow read for the public weekly recap.
--
-- season_states stays readable by the app (the client scores from it). This
-- function is the recap page's server read: unpublished weeks return no
-- episode results and no players, and a published week is returned without
-- emails, portraits, or submission history. Scoring still happens in the
-- Next.js server with calculatePlayerScore; the payload is only that input.
--
-- Execute is service_role only. The anon key can already call Edge Functions,
-- so granting this to anon would hand draft picks to anyone who can read the
-- public key. The page uses SUPABASE_SERVICE_ROLE_KEY when it is set, and
-- otherwise falls back to the existing season_states read and strips the
-- public projection before HTML.
--
-- Apply in the Supabase SQL Editor or with the Supabase CLI.
-- Do not apply from this pull request.

begin;

create or replace function public.published_weekly_recap(
  p_season_id text,
  p_week_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw jsonb;
  recap jsonb;
  published boolean;
  players jsonb;
  adjustments jsonb;
begin
  if p_season_id is null
     or length(trim(p_season_id)) = 0
     or p_week_id is null
     or length(trim(p_week_id)) = 0 then
    return jsonb_build_object('found', false, 'published', false);
  end if;

  select state
    into raw
  from public.season_states
  where season_id = trim(p_season_id);

  if raw is null then
    return jsonb_build_object('found', false, 'published', false);
  end if;

  select element
    into recap
  from jsonb_array_elements(coalesce(raw->'weeklyRecaps', '[]'::jsonb)) element
  where element->>'weekId' = trim(p_week_id)
  limit 1;

  published := coalesce(recap->>'published', '') = 'true';

  if not published then
    return jsonb_build_object(
      'found', true,
      'published', false,
      'seasonId', trim(p_season_id),
      'weekId', trim(p_week_id)
    );
  end if;

  select coalesce(jsonb_agg(player - 'email' - 'portraitUrl'), '[]'::jsonb)
    into players
  from jsonb_array_elements(coalesce(raw->'players', '[]'::jsonb)) player;

  select coalesce(
      jsonb_agg(adjustment - 'createdBy' - 'createdByLabel' - 'email'),
      '[]'::jsonb
    )
    into adjustments
  from jsonb_array_elements(coalesce(raw->'scoreAdjustments', '[]'::jsonb)) adjustment;

  raw := raw - 'weeklySubmissionHistory' - 'players' - 'scoreAdjustments';
  raw := jsonb_set(raw, '{players}', players, true);
  raw := jsonb_set(raw, '{scoreAdjustments}', adjustments, true);

  return jsonb_build_object(
    'found', true,
    'published', true,
    'intro', coalesce(recap->>'intro', ''),
    'seasonId', trim(p_season_id),
    'weekId', trim(p_week_id),
    'state', raw
  );
end;
$$;

revoke all on function public.published_weekly_recap(text, text) from public;
revoke all on function public.published_weekly_recap(text, text) from anon, authenticated;
grant execute on function public.published_weekly_recap(text, text) to service_role;

commit;
