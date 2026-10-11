#!/usr/bin/env node
/**
 * Cloudflare Pages project `traitors-4real` still publishes `dist`, the
 * directory `vite build` used to write. `npm run build` is `next build`
 * now, which writes `.next`, so every Pages build since the Supabase
 * migration fails looking for an output directory that Next does not create.
 *
 * Production is Vercel. This runs only when Cloudflare sets CF_PAGES=1 and
 * gives that retired project a directory to publish, pointing at the live site.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const liveSite = "https://traitorsfantasydraft.online/";

if (process.env.CF_PAGES !== "1") {
  process.exit(0);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(repoRoot, "dist");
mkdirSync(dist, { recursive: true });

writeFileSync(
  resolve(dist, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Round Table Draft</title>
  <meta http-equiv="refresh" content="0; url=${liveSite}" />
  <link rel="canonical" href="${liveSite}" />
</head>
<body>
  <p><a href="${liveSite}">Round Table Draft</a> is hosted at ${liveSite}</p>
</body>
</html>
`
);

writeFileSync(resolve(dist, "_redirects"), `/* ${liveSite} 301\n`);
console.log("[cloudflare-pages] wrote dist/ for the retired Pages project");
