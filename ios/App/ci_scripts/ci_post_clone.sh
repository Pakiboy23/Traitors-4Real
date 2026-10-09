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
# NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.
# They now come from the committed .env.production, so a fresh clone builds with
# no Xcode Cloud configuration. Setting them in Workflow > Environment still
# works and still wins. Both are inlined into the bundle at build time and the
# anon key is public by design — RLS is the access control, not secrecy.

set -e

# Xcode Cloud runs this script with ci_scripts/ as the working directory, so
# every path below is resolved from the repository root explicitly.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Node 22, matching .github/workflows/ci.yml. Not a preference: @capacitor/cli
# has declared engines >=22.0.0 since 8.1.0 and enforces it itself, so `cap sync`
# below dies outright on anything older —
#
#   [fatal] The Capacitor CLI requires NodeJS >=22.0.0
#
# npm only warns (EBADENGINE on every Xcode Cloud build); the CLI does not.
# This was pinned to 20 for a lockfile that npm 11 rejected with ~90
# "Missing: @tailwindcss/oxide-*" errors; that lockfile has since been
# regenerated and `npm ci` is clean on npm 10 and 11 alike, so the constraint
# that motivated node@20 no longer holds while the CLI's always did. Homebrew
# has also deprecated node@20 and disables it on 2026-10-28.
#
# Node 22 ships npm 10.9.x, keeping npm on the 10.x line `npm ci` is verified
# against.
#
# Installed from the official nodejs.org tarball, not Homebrew. Since 9 Oct
# 2026 `brew install node@22` on Xcode Cloud dies part-way through with
#
#   Error: node@22: A `brew install node@22` process has already locked
#   /opt/homebrew/Cellar/openssl@3.
#
# (Homebrew upgrading the image's preinstalled openssl@3 races its own lock),
# which failed every Xcode Cloud run on main. The tarball has no dependencies
# and is checked against the SHASUMS256.txt published beside it. Homebrew
# stays as a fallback only if nodejs.org cannot be reached.
echo "[ci_post_clone] Installing Node 22..."
NODE_DIST="https://nodejs.org/dist/latest-v22.x"
case "$(uname -m)" in
  arm64) NODE_ARCH="arm64" ;;
  *) NODE_ARCH="x64" ;;
esac
NODE_HOME="$HOME/node22"
if NODE_SUMS="$(curl -fsSL --retry 3 "$NODE_DIST/SHASUMS256.txt")"; then
  NODE_TARBALL="$(printf '%s\n' "$NODE_SUMS" | awk -v arch="$NODE_ARCH" '$2 ~ ("-darwin-" arch "\\.tar\\.gz$") { print $2; exit }')"
  NODE_SHA="$(printf '%s\n' "$NODE_SUMS" | awk -v f="$NODE_TARBALL" '$2 == f { print $1; exit }')"
  if [ -z "$NODE_TARBALL" ] || [ -z "$NODE_SHA" ]; then
    echo "[ci_post_clone] Could not find a darwin-$NODE_ARCH Node 22 tarball in SHASUMS256.txt." >&2
    exit 1
  fi
  curl -fsSL --retry 3 -o "/tmp/$NODE_TARBALL" "$NODE_DIST/$NODE_TARBALL"
  echo "$NODE_SHA  /tmp/$NODE_TARBALL" | shasum -a 256 -c -
  rm -rf "$NODE_HOME" && mkdir -p "$NODE_HOME"
  tar -xzf "/tmp/$NODE_TARBALL" -C "$NODE_HOME" --strip-components=1
  export PATH="$NODE_HOME/bin:$PATH"
else
  echo "[ci_post_clone] nodejs.org unreachable; falling back to Homebrew." >&2
  brew install node@22
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi

echo "[ci_post_clone] node $(node -v), npm $(npm -v)"

echo "[ci_post_clone] Installing dependencies..."
npm ci

# Fail loudly here rather than letting build-native-web.mjs discover it further
# in, so the reason is the first thing in the Xcode Cloud log.
#
# Resolved the way the build resolves it, not from the shell alone. These may
# come from Workflow > Environment *or* from the committed .env.production,
# which Next.js loads via @next/env and the shell never sees. A shell-only
# check rejects a clone that would build perfectly well from the committed
# defaults — which is the whole point of committing them.
node -e '
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  .filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("[ci_post_clone] Missing required environment: " + missing.join(", "));
  console.error("[ci_post_clone] Set them in Workflow > Environment, or restore .env.production.");
  process.exit(1);
}
'

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
