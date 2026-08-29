---
name: round-table-expert
description: Expert for Round Table Draft (Pakiboy23/Traitors-4Real) — private fantasy draft for a reality competition season. Use for scoring, season state, Capacitor iOS, admin, or App Store questions on this repo.
---

# Round Table Draft expert

Private fantasy draft. Next.js 16 on Vercel (`traitorsfantasydraft.online`), Supabase `tpjiqegneohtbcxapqnq`, Capacitor 8 iOS. 158 Vitest tests.

If older context mentions PocketBase, Fly.io, Firebase, or Vite — discard it.

## Positioning

Public name: **Round Table Draft**. The TV show is season flavor, not the product name. `metadata.json` and the README must stay on that name — never "The Traitors: New Blood Fantasy Draft" on an App Store title. Privacy/support routes already disclaim affiliation.

Private league, not a growth app. Calendar: H.I.M. growth flight ends 13 Sep 2026; New Blood premieres 17 Sep. TestFlight / portrait work on this repo is in-window — do not stall it behind H.I.M. copy.

## Landmines

- **Scoring signs:** weekly penalties stored **positive** and subtracted; `REDEMPTION_ROULETTE_INCORRECT` stored **negative** and added. Read `src/utils/scoring.test.ts` before changing a constant.
- **Rule explanations are total:** `RULE_EXPLANATIONS` must cover every rule-pack key or typecheck fails.
- **Season state is authority.** Bundled `CAST_NAMES` is a pre-sync fallback. A test bans `...CAST_NAMES` into a live roster.
- **Draft window order:** env override → season lifecycle → admin toggle → `lockSchedule.draftLockAt`.
- **Portraits:** `public/cast-portraits/<slug>.png`. Always `CastPortrait`. Never a bare `<img>`.
- **Native:** `npm run ios:sync:bundled` only. Bare `cap sync` re-adds `server.url` and fails Guideline 4.2.
- **Anon key is public.** RLS is access control. Service role never in the browser.

## App Store

Keep CFBundleDisplayName `Round Table Draft`. Archive only a bundled shell. Privacy and support are in-app routes — keep them versioned with the code they describe. Push background mode is already in Info.plist.

**Shipping already** (as of 2026-08-27). App Store Connect record, App ID, and signing are done — do not describe them as outstanding. Three builds under version 1.0: build 1 internal Testing, build 2 Expired, build 3 Waiting for Review. TestFlight groups `DrafTers` (internal) and `DrafTers2` (external) exist. Do not revert to "do not open a submission."

Still missing before a public release: New Blood civilian portraits. Last-season celebrity stills must not live in `public/cast-portraits/` (they ship in web + native if present). Set `APNS_ENV=production` before the first production TestFlight send; `push_tokens` is empty until a device registers.
