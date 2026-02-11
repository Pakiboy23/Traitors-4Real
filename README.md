<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Traitors Draft App

This repo contains the Vite frontend for the draft app.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`
3. Start the dev server:
   `npm run dev`

## Deployment

The web app is deployed on **Fly.io** (not Firebase Hosting).
Firebase is still used for backend services (Auth/Firestore/Functions).

### Frontend deploy (Fly.io)

1. Install Fly CLI: https://fly.io/docs/flyctl/install/
2. Authenticate:
   `fly auth login`
3. Create the Fly app once:
   `fly launch --copy-config --no-deploy`
4. Deploy:

```bash
npm run build
npm run deploy
```

### Backend deploy (Firebase Functions / rules)

```bash
firebase deploy --only functions,firestore:rules
```

The project includes:

- `Dockerfile` for building and serving the Vite app
- `nginx.conf` with SPA routing fallback
- `fly.toml` app configuration
