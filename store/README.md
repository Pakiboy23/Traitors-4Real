# App Store submission kit

Copy, screenshots, privacy answers, and the Mac archive steps for
**Round Table Draft**. Current native identity is **2.0.3 (build 103)**.
**2.0.1 (101)** is approved and on the App Store, so the 2.0.1 train is
closed: App Store Connect rejects any further 2.0.1 upload (ITMS-90186 /
ITMS-90062 — that is what happened to build 105). Do not archive 2.0.1 again,
and do not archive build 102 or anything lower.

Xcode Cloud replaces `CFBundleVersion` with its own build-run number, so a
Xcode Cloud archive is numbered by the run (113 was the last run recorded on
9 Oct), not by `CURRENT_PROJECT_VERSION`. The 103 in the project is the repo
floor / source identity, not an uploadable Mac build — App Store Connect has
already seen 105 (rejected on the closed 2.0.1 train) and Xcode Cloud runs
through at least 113. A Mac archive must bump `CURRENT_PROJECT_VERSION` to a
number App Store Connect has not used, then verify that number in App Store
Connect before upload.

`release_notes.txt` holds the What's New for the version currently being
shipped — rewrite it for each update, it is not a changelog.

Paste the `metadata/en-US` files into App Store Connect. Do not invent a
different public name. The binary display name, the listing name, and
`metadata.json` all have to stay **Round Table Draft**.

## App Store Connect fields

| Field | File | Limit |
|---|---|---|
| Name | `metadata/en-US/name.txt` | 30 |
| Subtitle | `metadata/en-US/subtitle.txt` | 30 |
| Description | `metadata/en-US/description.txt` | 4000 |
| Keywords | `metadata/en-US/keywords.txt` | 100 |
| Promotional text | `metadata/en-US/promotional_text.txt` | 170 |
| What's New | `metadata/en-US/release_notes.txt` | 4000 |
| Support URL | `metadata/en-US/support_url.txt` | — |
| Privacy Policy URL | `metadata/en-US/privacy_url.txt` | — |
| Marketing URL | `metadata/en-US/marketing_url.txt` | — |
| Copyright | `metadata/en-US/copyright.txt` | — |
| Primary category | `metadata/en-US/primary_category.txt` | Entertainment |
| Secondary category | `metadata/en-US/secondary_category.txt` | Sports |
| Review notes | `review_notes.txt` | 4000 |
| App Privacy | `privacy_answers.md` | must match `PrivacyInfo.xcprivacy` |
| Age rating | `age_rating.md` | 12+ |

Screenshots: `store/screenshots/iphone-6.9/` (1320×2868) and
`store/screenshots/iphone-6.5/` (1242×2688). Six shots each. The 6.5" slot
rejects a 6.9" asset, so both sizes are required. The App target is iPhone
only (`TARGETED_DEVICE_FAMILY = 1`), so iPad slots stay empty.

## Recapture

```bash
npx next build && npx next start -p 3222
# other terminal:
npx playwright install chromium
npm run screenshots:capture
```

Live Supabase is blocked in the capture browser so the fictional sample
season stays in frame. Do not upload shots of the live New Blood roster.

## Archive and upload (Mac)

This environment cannot sign or upload. On a Mac, from `main` (or this
branch):

1. `npm ci && npm run ios:sync:bundled`
2. Confirm `ios/App/App/public/index.html` exists and
   `ios/App/App/capacitor.config.json` has no `server.url`
3. Discard a `CapApp-SPM/Package.swift` rewrite if `cap sync` changes
   platforms to iOS 17
4. Open `ios/App/App.xcodeproj`, confirm Version **2.0.3** / iPhone only.
   Do not archive at Build **103**. Bump both App Debug and Release
   `CURRENT_PROJECT_VERSION` values to a number App Store Connect has not
   used (higher than the last recorded Xcode Cloud run — 113 on 9 Oct —
   and any later run or rejected upload). Confirm that unused number in
   App Store Connect before you archive.
5. Archive and upload that 2.0.3 build to App Store Connect
6. Create the 2.0.3 version record if needed, select that build on it, paste `release_notes.txt`
   into What's New, then submit for review

Set `APNS_ENV=production` on the `send-lock-reminder` Edge Function before
the first production push. Devices have already registered tokens, so a live
send can reach phones. That is not a submission blocker.

## Shipping an update to a live app

An update is not a resubmission. The App Store record, App ID, signing,
screenshots, description, keywords, privacy answers, age rating, and review
notes all carry over; only the build and the What's New text are new. Two
things have to change in the repo per update, both in
`ios/App/App.xcodeproj/project.pbxproj`:

- `MARKETING_VERSION` — the public version string. Must be higher than the
  version on the store (`2.0.1` → `2.0.3`). Apple compares this numerically per
  component, so `2.0.3 > 2.0.1` and `2.1 > 2.0.3`. Once a version is approved
  its train closes, and uploads under that string are rejected.
- `CURRENT_PROJECT_VERSION` — the build number. Must be higher than any
  build ever uploaded for this app. The repo floor is **103** (102 was the
  build on both 2.0.1 and 2.0.2); that is not the next Mac upload number.
  Confirm an unused value in App Store Connect before a local archive.
  Xcode Cloud still replaces this with its run number. Apple rejects a
  reused build number at upload, across TestFlight and the store.

Then, on a Mac:

1. `npm ci && npm run ios:sync:bundled` — the iOS app is a bundled static
   export, so a web fix is not on devices until a new archive ships. The
   website on Vercel picks it up on the next push to `main` without any of
   this.
2. Archive in Xcode (Product → Archive) and Distribute → App Store Connect.
3. In App Store Connect → the app → **+** next to iOS App → enter the new
   version string. Everything from the previous version is pre-filled.
4. Once the upload finishes processing (usually 5–20 minutes), select it
   under Build, paste `release_notes.txt` into What's New, and Add for
   Review. Nothing else on the page needs touching unless the listing itself
   is changing.
5. Under Version Release, "Automatically release" ships the moment review
   passes; "Manually release" holds it so it can be released at a chosen
   time. Phased release is off by default and unnecessary for a private
   league.

Review for an update is the same process as the first submission but is
usually much faster — commonly under 24 hours, often a few hours — because
the record, privacy answers, and age rating already passed. TestFlight
internal testers (`DrafTers`) can install the new build as soon as it
processes, before review, which is the way to confirm the fix on a real
device first.

What does not need an app update: anything read from Supabase at runtime.
Season status, lock schedules, cast, scoring results, and feature toggles all
change from the Admin panel and are live in the installed app on its next
launch. The September 2026 "already locked" report was mostly this kind of
fix — the season row had been archived — and the installed 2.0 (35) started
showing the correct countdown as soon as the row was corrected.
