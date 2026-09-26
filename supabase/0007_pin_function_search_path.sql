-- Pin search_path on the three public functions left mutable.
--
-- redact_emails and merge_season_emails call jsonb_* / coalesce / trim
-- without a schema, and set_updated_at calls timezone() and now(). Those
-- names live in pg_catalog. The bodies also leave them unqualified, so the
-- safe pin is public, pg_temp: catalog resolution stays intact, and a
-- session search_path cannot substitute another schema. Bodies and grants
-- are unchanged.
--
-- Apply in the Supabase SQL Editor or with the Supabase CLI.

begin;

alter function public.redact_emails(doc jsonb)
  set search_path = public, pg_temp;

alter function public.merge_season_emails(previous jsonb, state jsonb)
  set search_path = public, pg_temp;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

commit;
