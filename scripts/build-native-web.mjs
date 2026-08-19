#!/usr/bin/env node
/**
 * Builds the web assets that the Capacitor iOS/Android shells bundle into the
 * app binary.
 *
 * `capacitor.config.ts` points `webDir` at `native-web` when CAPACITOR_BUNDLED=1,
 * and `next.config.ts` switches Next.js to `output: "export"` under the same
 * flag. Next always writes a static export to `out/`, so this script runs that
 * build and then republishes the result as `native-web/`.
 *
 * Bundling matters beyond convenience: a shell that loads the live site over
 * the network is what App Store Review Guideline 4.2 rejects. Shipping the web
 * assets inside the binary is the baseline for submission.
 *
 * Usage:
 *   npm run native:web:build
 *   npm run ios:sync:bundled     # build + npx cap sync ios
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exportDir = resolve(repoRoot, "out");
const nativeWebDir = resolve(repoRoot, "native-web");

const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

function fail(message) {
  console.error(`\n[native:web:build] ${message}\n`);
  process.exit(1);
}

// Next.js inlines NEXT_PUBLIC_* at build time. A bundled shell cannot pick these
// up later from the server, so an incomplete environment silently produces an
// app that can never reach Supabase — caught here rather than in App Review.
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  fail(
    `Missing required environment ${missingEnv.join(", ")}.\n` +
      `These are inlined into the bundle at build time, so the native app cannot\n` +
      `recover them at runtime. Set them (see .env.example) and re-run.`
  );
}

console.log("[native:web:build] Cleaning previous output...");
rmSync(exportDir, { recursive: true, force: true });
rmSync(nativeWebDir, { recursive: true, force: true });

console.log("[native:web:build] Building static export (CAPACITOR_BUNDLED=1)...");
const build = spawnSync("npx", ["next", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, CAPACITOR_BUNDLED: "1" },
  shell: process.platform === "win32",
});

if (build.status !== 0) {
  fail(`next build exited with code ${build.status ?? "unknown"}.`);
}

if (!existsSync(exportDir)) {
  fail(
    `Expected a static export at ${exportDir} but none was produced.\n` +
      `Check that next.config.ts still sets output: "export" when CAPACITOR_BUNDLED=1.`
  );
}

console.log("[native:web:build] Publishing export to native-web/...");
cpSync(exportDir, nativeWebDir, { recursive: true });

console.log(
  "\n[native:web:build] Done. native-web/ is ready.\n" +
    "Next: npx cap sync ios   (or: npm run ios:sync:bundled)\n"
);
