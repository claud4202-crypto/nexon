#!/usr/bin/env bash
# Mirror the web/ payload into android/assets/web so build_apk.sh can
# pack it. Uses plain cp + rm so the script doesn't depend on rsync
# being installed (the build VM doesn't have it by default).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DEST="$HERE/assets/web"

# Wipe and recreate the destination so removed source files don't
# linger in the APK build.
rm -rf "$DEST"
mkdir -p "$DEST/scripts" "$DEST/styles"

cp "$ROOT/index.html" "$DEST/index.html"
cp -r "$ROOT/scripts/." "$DEST/scripts/"
cp -r "$ROOT/styles/."  "$DEST/styles/"

echo "OK -> $DEST"
