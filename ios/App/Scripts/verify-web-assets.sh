#!/bin/sh
#
# Run Script build phase for the App target: refuse to build an app that has no
# web assets in it.
#
# Why this exists as a build phase rather than a note in a README:
#
# `ios/App/App/public` is a *folder reference* in Copy Bundle Resources, and
# Xcode resolves folder references by enumerating the directory. A directory
# that is not there enumerates to nothing, so it is dropped from the build with
# no error at all — the archive succeeds, validates, uploads, and passes App
# Store Connect processing. The failure only appears on a device: Capacitor's
# CAPBridgeViewController.loadWebView() guards on index.html existing and calls
# exit(1) when it does not, during viewDidLoad. The app installs from
# TestFlight, shows the launch screen, and closes. It reads as a crash.
#
# The directory is gitignored (ios/.gitignore) because it is build output, so a
# fresh clone never has it and an archive taken before `npm run ios:sync:bundled`
# is exactly the empty shell described above. That is a one-keystroke mistake
# with no feedback until a tester reports the app will not open, which is what
# this phase converts into a build error.
#
# Keep this in step with ci_scripts/ci_post_clone.sh, which asserts the same
# thing for Xcode Cloud so the reason lands at the top of the build log.

set -e

WEB_DIR="$SRCROOT/App/public"
INDEX_FILE="$WEB_DIR/index.html"
CAPACITOR_CONFIG="$SRCROOT/App/capacitor.config.json"

if [ ! -f "$INDEX_FILE" ]; then
  echo "error: No web assets to bundle — $INDEX_FILE is missing."
  echo "error: Capacitor calls exit(1) at launch when index.html is absent, so this build would install and then close immediately on the device."
  echo "error: Run 'npm run ios:sync:bundled' from the repository root, then build again."
  exit 1
fi

# A bare `npx cap sync ios` resolves webDir to public/ and writes the live site
# back into capacitor.config.json as server.url. That produces a shell which
# loads the website over the network, which is the Guideline 4.2 rejection the
# bundled build exists to avoid. Debug builds are left alone so live reload
# still works.
if [ "$CONFIGURATION" = "Release" ] && [ -f "$CAPACITOR_CONFIG" ]; then
  # Degrades to skipping the check rather than failing the build if python3 is
  # unavailable; the index.html assertion above is the load-bearing one.
  SERVER_URL=$(/usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("server",{}).get("url") or "")' "$CAPACITOR_CONFIG" 2>/dev/null || echo "")
  if [ -n "$SERVER_URL" ]; then
    echo "error: capacitor.config.json points the app at $SERVER_URL instead of the bundled assets."
    echo "error: A Release build must not load the web app over the network — that is an App Store Guideline 4.2 rejection."
    echo "error: This is what a bare 'npx cap sync ios' produces. Run 'npm run ios:sync:bundled' instead, then build again."
    exit 1
  fi
fi

echo "Bundled web assets verified: $INDEX_FILE"
