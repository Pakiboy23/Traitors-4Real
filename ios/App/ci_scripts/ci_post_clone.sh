#!/bin/sh
#
# Xcode Cloud post-clone hook.
#
# LOCATION IS LOAD-BEARING. Xcode Cloud looks for ci_scripts in the directory
# that holds the Xcode project or workspace it is building — here ios/App/,
# next to App.xcodeproj — not at the repository root. A copy at the root is
# never found and never runs, and because ios/App/App/public is a folder
# reference, a missing folder is silently dropped from the build rather than
# failing it: the archive succeeds and ships with no web assets. Capacitor
# calls exit(1) when index.html is absent, so that build installs from
# TestFlight and closes the instant it is opened. Do not move this file.
#
# Xcode Cloud clones the repo and builds ios/App/App.xcodeproj directly. It has
# no knowledge of npm, Next.js, or Capacitor — and `ios/App/App/public` is
# gitignored (ios/.gitignore), so a clone contains no web assets at all.
#
# So: install Node, build the static export, and run `cap sync` before Xcode
# opens the project.
#
# Required Xcode Cloud environment variables (Workflow > Environment):
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
# Both are inlined into the bundle at build time. The anon key is public by
# design — it ships in the client bundle and RLS is the access control — so it
# is an ordinary environment variable, not a secret.

set -e

# Xcode Cloud runs this script with ci_scripts/ as the working directory, so
# every path below is resolved from the repository root explicitly.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Node 20 deliberately, matching .github/workflows/ci.yml. It is not cosmetic:
# npm 11 (Node 22+) rejects this lockfile with ~90 "Missing: @tailwindcss/oxide-*"
# and "@esbuild/*" errors, because it is stricter about optional platform
# binaries. `npm ci` succeeds on Node 20 and fails on Node 26.
echo "[ci_post_clone] Installing Node 20..."
brew install node@20
export PATH="$(brew --prefix node@20)/bin:$PATH"

echo "[ci_post_clone] node $(node -v), npm $(npm -v)"

echo "[ci_post_clone] Installing dependencies..."
npm ci

# Fail loudly here rather than letting build-native-web.mjs discover it further
# in, so the reason is the first thing in the Xcode Cloud log.
for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "[ci_post_clone] Missing required environment variable: $var" >&2
    echo "[ci_post_clone] Set it in the Xcode Cloud workflow's Environment tab." >&2
    exit 1
  fi
done

echo "[ci_post_clone] Building bundled web assets and syncing iOS..."
npm run ios:sync:bundled

# cap sync is what populates ios/App/App/public. If it is empty the archive
# would still succeed, so assert it here instead of shipping a blank app.
# The App target repeats this check as a build phase, which is what catches a
# local archive that skipped the sync; this one keeps the reason at the top of
# the Xcode Cloud log rather than buried in the build output.
if [ ! -f "ios/App/App/public/index.html" ]; then
  echo "[ci_post_clone] ios/App/App/public/index.html missing after sync." >&2
  echo "[ci_post_clone] The archive would contain no web assets — stopping." >&2
  exit 1
fi

echo "[ci_post_clone] Done. Web assets are in place."
