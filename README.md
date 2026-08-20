<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Traitors Fantasy Draft

Fantasy draft companion for **The Traitors**. Players draft a roster before the
season, make weekly banishment and murder calls, play optional bonus games, and
follow a live leaderboard.

**Stack:** Next.js on Vercel, Supabase for Postgres, Auth, Realtime and Storage,
Capacitor for the iOS and Android shells.

## Run locally

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required.
Next.js inlines them at build time, so changing one needs a rebuild. The anon
key is public by design — it ships in the client bundle and access is governed
by row-level security.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run native:web:build` | Static export for the Capacitor shells |

## Supabase

Schema lives in [`supabase/0001_traitors_core.sql`](supabase/0001_traitors_core.sql)
— eight tables with row-level security on every one, realtime on the tables the
app subscribes to, and a public storage bucket for portraits.

Admin access is granted by row in `public.admin_users`, checked through the
`is_traitors_admin()` security-definer function. To grant it:

```sql
insert into public.admin_users (user_id, email, display_name)
select id, email, raw_user_meta_data->>'name'
from auth.users
where lower(email) = lower('you@example.com')
on conflict (user_id) do update set email = excluded.email;
```

## Seasons

The app is season-scoped and white-label capable. Each season owns its cast,
rules and lifecycle, so a new season does not inherit the previous one.

- `show_configs` — branding and terminology
- `seasons` — lifecycle metadata and lock schedule
- `season_states` — the full game state for one season, including its own cast
  and its own embedded show config
- `submissions` — player entries, admin-read only
- `score_adjustments` — manual point changes, each with a reason

A season's status drives what players can do: `draft` (set up, not accepting
entries), `live` (in play), `finalized` and `archived` (read-only).

### Opening and closing the draft

The season record is the authority. In order of precedence:

1. `NEXT_PUBLIC_DRAFT_CLOSED=true` — emergency override, normally unset
2. Season status — `finalized` and `archived` are closed; anything other than
   `live` is closed
3. **Draft open** switch in Admin → Show Config — immediate close
4. `lockSchedule.draftLockAt` — scheduled lock

All of 2–4 are changeable at runtime with no redeploy. The logic is a pure
function in [`src/utils/draftWindow.ts`](src/utils/draftWindow.ts) with tests.

## Scoring

The engine lives in [`src/utils/scoring.ts`](src/utils/scoring.ts) and is driven
by a rule pack from [`src/config/rulePacks.ts`](src/config/rulePacks.ts), so
point values are data rather than code.

The in-app Rules tab is **generated** from the active rule pack.
`RULE_EXPLANATIONS` is typed as a total record over `RulePackPoints`, so adding
a scoring constant fails to compile until it is explained — the guide cannot
drift from the engine that awards the points.

Two conventions worth knowing before changing anything here:

- Weekly penalties are stored **positive** and subtracted; bonus penalties are
  stored **negative** and added.
- The below-zero bonus check is snapshotted **once** before both bonus games, so
  the pair is order-independent.

Both are covered by tests. Run `npm test` before touching scoring.

## Native apps

```bash
npm run native:web:build   # static export into native-web/
npx cap add ios            # first time only
npm run ios:sync:bundled
npm run ios:open
```

Always sync through the bundled scripts. A bare `npx cap sync` resolves `webDir`
to `public/` and re-adds the live-site `server.url`, producing a shell that
loads a website over the network — which is what App Store Review Guideline 4.2
rejects.

## Push notifications

Devices register themselves on launch (`src/native/push.ts`) and tokens land in
`public.push_tokens`, which is insert-only for anon and readable by admins.

Reminders are sent by the `send-lock-reminder` Edge Function. It resolves the
live season, collects that season's iOS tokens, sends through APNs, and prunes
tokens Apple reports as gone.

```bash
# Resolve the audience and render the message without contacting Apple.
curl -X POST "$SUPABASE_URL/functions/v1/send-lock-reminder" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

Sending for real needs four function secrets, taken from an APNs auth key in
the Apple Developer portal:

| Secret | Where it comes from |
| --- | --- |
| `APNS_KEY_ID` | Key ID shown when the `.p8` is created |
| `APNS_TEAM_ID` | Membership details in the developer portal |
| `APNS_PRIVATE_KEY` | Full `.p8` contents, including the BEGIN and END lines |
| `APNS_ENV` | `sandbox` for TestFlight builds, `production` for the App Store |

Without them the function returns 503 and names what is missing, rather than
reporting success and sending nothing — a reminder that quietly fails is only
discovered after the lock has passed.

## Deployment

Production is Vercel, deployed from `main`. Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in both the Vercel project and the repository
secrets, so CI builds match what ships.

## History

The app previously ran on Firebase, then PocketBase on Fly.io, before moving to
Supabase and Vercel in April 2026. Those code paths have been removed rather
than left to rot; recover them from git history if ever needed.
