#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
MANIFEST="$ROOT_DIR/manifest.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq が必要です。" >&2
  exit 1
fi

VERSION="$(jq -r '.version' "$MANIFEST")"
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "manifest.json の version を取得できません。" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$DIST_DIR/crx-box-direct-link-v${VERSION}-${STAMP}.zip"

mkdir -p "$DIST_DIR"

FILES=(
  manifest.json
  LICENSE
  README.md
  src/content.js
  src/content.css
  assets/icons/icon16.png
  assets/icons/icon32.png
  assets/icons/icon48.png
  assets/icons/icon128.png
)

(
  cd "$ROOT_DIR"
  zip -q "$OUT_FILE" "${FILES[@]}"
)

echo "Created: $OUT_FILE"
