# App Store submission kit

Copy, screenshots, privacy answers, and the remaining Mac archive steps for
**Round Table Draft 2.0 (build 35)**.

#155 bumped the binary identity. It did not fill the version record, capture
screenshots against the current nav, or restrict the device family. This
directory is that leftover work.

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
4. Open `ios/App/App.xcodeproj`, confirm Version **2.0** / Build **35** /
   iPhone only
5. Archive and upload **2.0 (35)** to App Store Connect
6. Select that build on the 2.0 version record, paste the copy and
   screenshots from this directory, then submit for review

Set `APNS_ENV=production` on the `send-lock-reminder` Edge Function before
the first production push. `push_tokens` is empty until a device registers;
that is not a submission blocker.
