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
staging_directory="$(mktemp -d "${TMPDIR:-/tmp}/evolvio-extension.XXXXXX")"

trap 'rm -f "$temporary_archive"; rm -rf "$staging_directory"' EXIT
rm -f "$temporary_archive"

# Keep the expected public/ directory at the ZIP root. Chrome's "Load
# unpacked" action should target the extracted public directory.
cp -R "$repo_root/public" "$staging_directory/public"
(
  cd "$staging_directory"
  zip -q -r "$temporary_archive" public \
    -x 'public/.DS_Store' 'public/**/.DS_Store'
)

cp "$temporary_archive" "$versioned_archive"
cp "$temporary_archive" "$latest_archive"

echo "Packaged Evolvio extension v$version"
echo "Versioned: $(basename "$versioned_archive")"
echo "Latest:    $(basename "$latest_archive")"
