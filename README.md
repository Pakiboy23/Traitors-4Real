<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1x7fQsJeDPeXMHWLokiShFFAUfzNnWy1f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_POCKETBASE_URL` in [.env.local](.env.local) if you’re not using the default (`http://127.0.0.1:8090`).
3. Run the app:
   `npm run dev`
   
## PocketBase (Auth + Realtime + DB)

1. Download PocketBase from https://pocketbase.io/docs/ and unzip it in the repo root.
2. Start PocketBase:
   `./pocketbase serve --http=127.0.0.1:8090`
3. Create the PocketBase superuser in the admin UI (first run).
4. Initialize collections + rules:
   `POCKETBASE_ADMIN_EMAIL=you@example.com POCKETBASE_ADMIN_PASSWORD=... node scripts/pocketbase-init.mjs`
   - Optional: add `POCKETBASE_APP_ADMIN_EMAIL` + `POCKETBASE_APP_ADMIN_PASSWORD` to seed a login for the app.
5. Set `VITE_POCKETBASE_URL` in `.env.local` (default `http://127.0.0.1:8090`).

### Restore game state from a backup
`POCKETBASE_ADMIN_EMAIL=you@example.com POCKETBASE_ADMIN_PASSWORD=... node scripts/restore-backup-pocketbase.mjs /path/to/backup.json`

### Migrate from Firestore (optional)
