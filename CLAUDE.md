# Round Table Draft

Fantasy draft and weekly scoring for a private league built around a reality
competition series. Next.js on Vercel, Supabase for everything server-side, and
a Capacitor wrapper for iOS.

> **If you have older context on this repo, discard it.** Three stacks have been
> removed. Anything referring to PocketBase, Fly.io, Firebase Cloud Functions,
> or a Vite build is describing an architecture that no longer exists — see
> [Retired stacks](#retired-stacks).

---

## Stack

| Layer | What |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack), React 19, TypeScript |
| Hosting | **Vercel** — production is `traitorsfantasydraft.online` |
| Backend | **Supabase** project `tpjiqegneohtbcxapqnq` — Postgres 17, Auth, Realtime, Edge Functions (Deno) |
| Native | **Capacitor 8**, iOS only. Swift Package Manager, not CocoaPods |
| Tests | **Vitest** — 177 tests across 10 files |
| Styling | Tailwind 4 + a hand-written design system in `src/index.css` |

There is no separate API server. The browser talks to Supabase directly with
the anon key; Row-Level Security is the access control.

## Commands

```bash
npm run dev          # next dev
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # next build

npm run icons:build  # regenerate all app icons from design/app-icon.svg

npm run ios:sync:bundled   # static export -> native-web/ -> cap sync ios
npm run ios:open           # open Xcode
```

**Always sync iOS through `ios:sync:bundled`.** A bare `npx cap sync` resolves
`webDir` to `public/` and re-adds the live-site `server.url`, producing a shell
that loads a website over the network — exactly what App Store Review Guideline
4.2 rejects.

## Layout

```
App.tsx                    root component; normalises game state
components/                UI, including components/admin/
src/app/                   Next routes: /, /privacy, /support, /status
src/config/                show config, rule packs, cast, validation
src/utils/                 scoring, draft window, cast profiles, persistence
src/native/                Capacitor bridge (push registration)
supabase/functions/        Edge Functions (Deno)
ios/App/                   Xcode project
ios/App/Scripts/           build-phase guard against an assetless archive
ios/App/ci_scripts/        Xcode Cloud post-clone hook (location is load-bearing)
design/app-icon.svg        source art for every icon
```

## Things that will bite you

**An archive can ship with no web app in it, silently.** `ios/App/App/public` is
gitignored build output and a *folder reference* in Copy Bundle Resources. Xcode
resolves folder references by enumerating the directory, so a missing directory
enumerates to nothing and is dropped from the build without an error — the
archive succeeds, uploads, and passes App Store Connect processing containing no
web assets. On the device, `CAPBridgeViewController.loadWebView()` guards on
`index.html` existing and calls `exit(1)`, so the app installs from TestFlight,
shows the launch screen, and closes. It reads as a crash and it shipped that way
once. Two guards now prevent it: `ios/App/Scripts/verify-web-assets.sh` runs as
the App target's first build phase, and `ios/App/ci_scripts/ci_post_clone.sh`
runs the sync for Xcode Cloud. **`ci_scripts` must sit next to `App.xcodeproj`**
— Xcode Cloud looks for it beside the project it builds, never at the repository
root, and a copy at the root silently never runs.

**Two sign conventions in scoring.** Weekly penalties are stored **positive**
and subtracted; `REDEMPTION_ROULETTE_INCORRECT` is stored **negative** and
added. `src/utils/scoring.ts` is pinned by 34 tests — read them before changing
a constant.

**Rule constants must be documented or the build fails.** `RULE_EXPLANATIONS`
in `src/config/ruleExplanations.ts` is a total `Record` over the rule pack keys.
Add a scoring constant without a matching explanation and typecheck fails. This
is deliberate — it keeps the in-app Rules screen honest.

**Season state is the authority, not the bundled config.** Each season row
carries its own `showConfig`, cast names, and per-member profiles. The bundled
`CAST_NAMES` is a fallback for the pre-sync path only. Merging it into a live
roster has caused two separate bugs; a test in `src/utils/castRoster.test.ts`
now bans the `...CAST_NAMES` spread outright.

**The draft window is resolved at runtime, not build time.** See
`src/utils/draftWindow.ts`. Authority order: env override → season lifecycle →
admin toggle → scheduled lock. `NEXT_PUBLIC_DRAFT_CLOSED` is an emergency
override and is normally unset.

**Cast portraits are derived from the name.** `public/cast-portraits/<slug>.png`
where slug is the lowercased, hyphenated name. A missing file is fine —
`components/CastPortrait.tsx` falls back to the initial on load error. Never
render a portrait through a bare `<img>`.

**Verify UI changes by rendering them.** Several bugs here passed typecheck,
tests, and build, and were only caught by opening the app in a browser — a
roster showing 45 names, a counter reading 23 for a 22-person cast. Run the app.

## Keys

- **Anon key is public by design.** It ships in the client bundle; RLS governs
  access. Safe to commit to `.env.local` and paste into a shell.
- **Service role key must never reach the browser.** Edge Functions only.
- **APNs credentials** are Edge Function secrets, never request parameters.

## Deployment

Push to `main` → Vercel deploys production. Edge Functions deploy separately
(Supabase CLI or MCP). Database changes go through `supabase/*.sql` applied as
migrations.

**Cloudflare Pages fails on every commit.** It is a leftover of the retired Vite
build, configured dashboard-side, and it fails identically on `main`. Same for a
permanently-queued Google Cloud Build check. Neither is actionable from the
repo; ignore both.

## Retired stacks

Removed in August 2026. If you find a reference, it is stale — correct it.

| Gone | Replaced by |
|---|---|
| PocketBase on Fly.io | Supabase |
| Firebase Cloud Functions | Supabase Edge Functions |
| Vite build path | Next.js |

`README.md` has a History section describing the migration, and
`docs/sora_ad_concept.md` is an archived marketing document that still names the
old stack in its body — it carries a correction header.

## Current state — August 2026

- Season `traitors-new-blood-s1` is **live**, 22 cast members, draft open.
- App renamed **Round Table Draft**; league name is a separate configurable
  field, currently `UPRV Fantasy League`. The two are deliberately distinct —
  only one is public on the App Store.
- Bundle id `com.roundtabledraft.app`. **Locks permanently at first submission.**
- iOS target has the push entitlement, the `remote-notification` background
  mode, and `PrivacyInfo.xcprivacy` in Copy Bundle Resources.
- `send-lock-reminder` Edge Function is deployed (v3) and exercised. Real APNs
  delivery is untested. It needs three secrets that are not set yet:
  `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`. `APNS_ENV` defaults to
  `sandbox` and `APNS_BUNDLE_ID` defaults to the correct bundle id, so neither
  is required — but **set `APNS_ENV=production` before the first TestFlight
  send**. On a sandbox/production mismatch Apple returns `BadDeviceToken`, which
  the function treats as a stale token and deletes; it cannot tell a mismatch
  from a dead device. `push_tokens` is currently empty, so secrets alone will
  not deliver anything — a physical device has to register first.

**Shipping already.** App Store Connect record, App ID, and signing are all
done — do not describe them as outstanding. As of 2026-08-27 three builds are
uploaded under version 1.0: build 1 in internal Testing, build 2 Expired, build
3 Waiting for Review. TestFlight groups `DrafTers` (internal) and `DrafTers2`
(external) exist, and Xcode Cloud is wired to the App target.

**Build 2 recorded 5 crashes.** It predates #133, which fixed a launch trap on
iOS 26+ (no UIScene adoption — UIKit calls
`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` and traps).
That is the most likely cause and the timing fits, but it is not confirmed
against the crash logs. Build 3 was created after #133 merged.

**Not done:** cast photos.

Screenshots are unblocked as of #118. The `DEVELOPMENT` badge is gated on
`NODE_ENV` and is dead-code-eliminated from a production build; the `NO SYNC YET`
chip no longer exists (`syncLabel` is null until there is a real sync); the Admin
tab is hidden unless `?admin=1`/`#admin` or already signed in. Verified 2026-08-24
by rendering a production build: the nav is exactly Overview / Draft / Weekly
Council / Leaderboard / Rules and the utility bar is empty.
