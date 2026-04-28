# Buddylist Stack Migration

Goal: move Traitors Fantasy Draft onto the same platform model as Buddylist:

- Next.js on Vercel
- Supabase Auth, Postgres, Realtime, and Storage
- Capacitor iOS and Android shells

The current production app on `origin/main` uses PocketBase + Fly.io. Treat PocketBase as the migration source until Supabase is populated and the UI service layer has been ported.

## Phase 1: Platform Foundation

Status: started on branch `codex/buddylist-stack`.

- Next App Router shell wraps the existing React app at `/`.
- Vite scripts remain available as `dev:vite`, `build:vite`, and `start:vite`.
- Capacitor config targets hosted web content at `https://traitorsfantasydraft.online`.
- Supabase core schema lives in `supabase/0001_traitors_core.sql`.
- PocketBase-to-Supabase migration script lives in `scripts/migrate-pocketbase-to-supabase.mjs`.

## Phase 2: Supabase Project Setup

1. Create a Supabase project for Traitors.
2. Apply `supabase/0001_traitors_core.sql`.
3. Create the first Supabase Auth admin user.
4. Seed `public.admin_users` with that user's `auth.users.id`.

Example admin seed:

```sql
insert into public.admin_users (user_id, email, display_name)
select id, email, raw_user_meta_data->>'name'
from auth.users
where lower(email) = lower('you@example.com')
on conflict (user_id) do update
set email = excluded.email,
    display_name = excluded.display_name;
```

## Phase 3: Data Migration

Run a dry run first:

```bash
DRY_RUN=1 \
POCKETBASE_URL=https://api.traitorsfantasydraft.online \
POCKETBASE_ADMIN_EMAIL=you@example.com \
POCKETBASE_ADMIN_PASSWORD=... \
SUPABASE_URL=https://your-project-ref.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run migrate:pocketbase-to-supabase
```

Then run without `DRY_RUN=1`.

Notes:

- Admin passwords do not migrate from PocketBase. Supabase Auth users must be created separately.
- The first migration keeps season and game state in `jsonb` to avoid delaying the mobile release behind a full relational remodel.
- `player_portraits.portrait_url` is preserved. Moving files into Supabase Storage can happen after the app reads from Supabase.

## Phase 4: Service Port

Replace `services/pocketbase.ts` with a Supabase service module using the same exported function names first:

- `fetchGameState`
- `saveGameState`
- `subscribeToGameState`
- `fetchWeeklySubmissions`
- `submitWeeklyCouncilVote`
- `submitDraftEntry`
- `fetchShowConfig`
- `listSeasons`
- `fetchSeasonState`
- `saveSeasonState`
- `listScoreAdjustments`

Keeping the function surface stable lets `App.tsx` and the admin components move over with the smallest UI diff.

## Phase 5: Mobile Wrappers

After the Supabase service port builds:

```bash
npm run native:web:build
npx cap add ios
npx cap add android
npm run ios:sync:bundled
npm run android:sync
```

Use the same Apple Developer and app-store workflow as Buddylist. The current bundle id seed is `online.traitorsfantasydraft.app`; confirm it before creating the App Store Connect record.

## Cutover Checklist

- Set Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_API_ORIGIN`.
- Point `traitorsfantasydraft.online` at Vercel.
- Keep `api.traitorsfantasydraft.online` and PocketBase online until data verification is complete.
- Verify public draft submission, weekly submission, admin login, admin merge, leaderboard, realtime state sync, and portrait rendering.
- Build and open both native shells before store submission.
