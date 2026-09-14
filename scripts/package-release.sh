#!/usr/bin/env bash
set -euo pipefail

# Creates both a versioned archive for release history and the stable archive
# used by customer-facing download links. Run after updating public/manifest.json.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/public/manifest.json"
version="$(node -p "require(process.argv[1]).version" "$manifest")"
versioned_archive="$repo_root/evolvio-extension-$version.zip"
latest_archive="$repo_root/evolvio-extension.zip"
temporary_archive="$(mktemp "${TMPDIR:-/tmp}/evolvio-extension.XXXXXX.zip")"

trap 'rm -f "$temporary_archive"' EXIT
rm -f "$temporary_archive"

(
  cd "$repo_root"
  zip -q -r "$temporary_archive" public -x 'public/.DS_Store' 'public/**/.DS_Store'
)

cp "$temporary_archive" "$versioned_archive"
cp "$temporary_archive" "$latest_archive"

echo "Packaged Evolvio extension v$version"
echo "Versioned: $(basename "$versioned_archive")"
echo "Latest:    $(basename "$latest_archive")"
