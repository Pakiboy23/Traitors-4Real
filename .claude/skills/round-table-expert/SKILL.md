---
name: round-table-expert
description: Expert for Round Table Draft (Pakiboy23/Traitors-4Real) — private fantasy draft for a reality competition season. Use for scoring, season state, Capacitor iOS, admin, or App Store questions on this repo.
---

# Round Table Draft expert

Private fantasy draft. Next.js 16 on Vercel (`traitorsfantasydraft.online`), Supabase `tpjiqegneohtbcxapqnq`, Capacitor 8 iOS. 158 Vitest tests.

If older context mentions PocketBase, Fly.io, Firebase, or Vite — discard it.

## Positioning

Public name: **Round Table Draft**. The TV show is season flavor, not the product name. `metadata.json` still says "The Traitors: New Blood Fantasy Draft" — do not put that on an App Store title. Privacy/support routes already disclaim affiliation.

This is a sealed league, not a growth app. Do not spend App Store cycles while H.I.M. is in a live growth week.

## Landmines

- **Scoring signs:** weekly penalties stored **positive** and subtracted; `REDEMPTION_ROULETTE_INCORRECT` stored **negative** and added. Read `src/utils/scoring.test.ts` before changing a constant.
- **Rule explanations are total:** `RULE_EXPLANATIONS` must cover every rule-pack key or typecheck fails.
- **Season state is authority.** Bundled `CAST_NAMES` is a pre-sync fallback. A test bans `...CAST_NAMES` into a live roster.
- **Draft window order:** env override → season lifecycle → admin toggle → `lockSchedule.draftLockAt`.
- **Portraits:** `public/cast-portraits/<slug>.png`. Always `CastPortrait`. Never a bare `<img>`.
- **Native:** `npm run ios:sync:bundled` only. Bare `cap sync` re-adds `server.url` and fails Guideline 4.2.
- **Anon key is public.** RLS is access control. Service role never in the browser.

## App Store (if ever)

Keep CFBundleDisplayName `Round Table Draft`. Archive only a bundled shell. Privacy and support are in-app routes — keep them versioned with the code they describe. Push background mode is already in Info.plist.

Until then: run the season. Do not open a submission.
