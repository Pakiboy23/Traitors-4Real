# App Store submission kit

Copy, screenshots, privacy answers, and Mac archive steps for **Round Table
Draft 2.0.1 (build 36)**. Version **2.0 (build 35)** is already on the App
Store. This directory is the follow-up binary, not a new app record.

Paste the `metadata/en-US` files into App Store Connect. Do not invent a
different public name. The binary display name, the listing name, and
`metadata.json` all have to stay **Round Table Draft**.

## You do not start over

Apple has no “just push a minor update” path that skips review. You also do
not create a new app, new bundle id, or new listing. The workflow is:

1. In App Store Connect, open the existing **Round Table Draft** app.
2. Create a **new version** `2.0.1` on that same record (2.0 is already
   Released, so it cannot take another binary).
3. On a Mac: archive and upload **2.0.1 (36)** — build numbers only go up.
4. Select that build on the 2.0.1 version, paste What’s New from
   `metadata/en-US/release_notes.txt`, submit for review.

Review is required for any new binary. For a lock-date bug you can ask for
**expedited review** (App Store Connect → the version → Request Expedited
Review) and point at the What’s New copy. Metadata-only edits (screenshots,
description) can save without a new binary; this countdown fix is code, so it
needs a build.

Player signups are **not** in the IPA. They live in Supabase. Replacing the
binary does not wipe entries. The draft window itself is also runtime state:
season status and `lockSchedule.draftLockAt` are fetched from the server, so
the live 2.0 (35) build already picks up a corrected lock time on the next
launch. 2.0.1 is the code fix so the home countdown reads the draft lock
instead of a leftover finale timestamp.

## App Store Connect fields

| Field | File | Limit |
|---|---|---|
| Name | `metadata/en-US/name.txt` | 30 |
| Subtitle | `metadata/en-US/subtitle.txt` | 30 |
| Description | `metadata/en-US/description.txt` | 4000 |
| Keywords | `metadata/en-US/keywords.txt` | 100 |
| Promotional text | `metadata/en-US/promotional_text.txt` | 170 |
| What’s New | `metadata/en-US/release_notes.txt` | 4000 |
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
only (`TARGETED_DEVICE_FAMILY = 1`), so iPad slots stay empty. Reuse the 2.0
shots unless the nav changed.

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
4. Open `ios/App/App.xcodeproj`, confirm Version **2.0.1** / Build **36** /
   iPhone only
5. Archive and upload **2.0.1 (36)** to App Store Connect
6. Attach that build to the **2.0.1** version record (not 2.0), paste What’s
   New, submit for review

Set `APNS_ENV=production` on the `send-lock-reminder` Edge Function before
the first production push. `push_tokens` is empty until a device registers;
that is not a submission blocker.
