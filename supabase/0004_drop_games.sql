-- Drop leftover public.games after the client path was removed (#176).
-- Live play is seasons + season_states. 0001 already ran; do not rewrite it.
--
-- Apply in the Supabase SQL Editor or with the Supabase CLI.

begin;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime drop table public.games;
  end if;
end;
$$;

-- Policies games_public_read / games_admin_write and trigger
-- games_set_updated_at drop with the table.
drop table if exists public.games;

-- Client only reads and writes portrait_url. This column is unused.
alter table public.player_portraits drop column if exists portrait_path;

commit;
