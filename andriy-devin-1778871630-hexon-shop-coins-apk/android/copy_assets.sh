#!/usr/bin/env bash
# Mirror the web/ payload into android/assets/web so build_apk.sh can pack it.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
mkdir -p "$HERE/assets/web"
rsync -a --delete \
  --include='index.html' \
  --include='scripts/***' \
  --include='styles/***' \
  --exclude='*' \
  "$ROOT/" "$HERE/assets/web/"
echo "OK -> $HERE/assets/web"
