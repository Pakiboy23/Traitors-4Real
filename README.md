<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Traitors Fantasy Draft (PocketBase + Fly.io)

This repository hosts the Traitors Season 4 fantasy draft app.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set `VITE_POCKETBASE_URL` in [.env.local](.env.local) if you’re not using the default (`http://127.0.0.1:8090`).
3. Run the frontend:
   `npm run dev`

## PocketBase (auth + realtime + DB)

1. Download PocketBase from https://pocketbase.io/docs/ and unzip it in the repo root.
2. Start PocketBase:
   `./pocketbase serve --http=127.0.0.1:8090`
3. Create the PocketBase superuser in the admin UI (first run).
4. Initialize collections + rules:
   `POCKETBASE_ADMIN_EMAIL=you@example.com POCKETBASE_ADMIN_PASSWORD=... node scripts/pocketbase-init.mjs`
   - Optional: set `POCKETBASE_APP_ADMIN_EMAIL` + `POCKETBASE_APP_ADMIN_PASSWORD` to seed an app admin login.
5. Set `VITE_POCKETBASE_URL` in `.env.local` (default `http://127.0.0.1:8090`).

## Deploy on Fly.io

### Backend (PocketBase)
- Uses `fly.toml` + `Dockerfile`
- Deploy:
  `flyctl deploy -a traitorsfantasydraft-pb`

### Frontend (Vite)
- Uses `fly.frontend.toml` + `Dockerfile.frontend`
- The frontend image bakes `VITE_POCKETBASE_URL` at build time.
- Deploy:
  `flyctl deploy -c fly.frontend.toml -a traitorsfantasydraft-web`

### Domains
- Frontend:
  - `traitorsfantasydraft.online` (A + AAAA)
  - `www.traitorsfantasydraft.online` (CNAME)
- Backend API:
  - `api.traitorsfantasydraft.online` (CNAME → `traitorsfantasydraft-pb.fly.dev`)

## Weekly Council submissions

Weekly Council votes are stored in the `submissions` collection (public create, admin-only read).
Admins can merge Weekly Council votes into the main `games` record from the Admin panel.

### Restore game state from backup
`POCKETBASE_ADMIN_EMAIL=you@example.com POCKETBASE_ADMIN_PASSWORD=... node scripts/restore-backup-pocketbase.mjs /path/to/backup.json`

## Legacy Firebase note

The production stack now runs on PocketBase + Fly.io. The old Firebase/Firestore implementation is legacy and should not be used for current deployment workflows.

- Legacy Firebase code is retained under `functions/` for historical reference only.
- Local Firebase CLI/cache files are intentionally git-ignored to prevent merge conflicts with the current Fly/PocketBase deployment setup.
### PR #32 conflict-resolution decision

When reconciling old Firebase-to-Fly migration branches, keep the current PocketBase-first deployment model as the source of truth:

- Keep `Dockerfile`, `fly.toml`, and app code aligned to PocketBase backend + Fly.io deployment.
- Do **not** restore legacy Firebase Hosting cache/artifacts (for example `.firebase/hosting.*`).
- Keep `firebase.json` / `firestore.rules` out of the active deployment path unless a separate, explicit Firebase backend migration is planned.

This avoids re-introducing stale Firebase hosting assumptions into the current production topology.
