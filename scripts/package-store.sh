#!/usr/bin/env bash
set -euo pipefail

# Creates a Chrome Web Store upload artifact. The development manifest keeps
# its public `key` field so unpacked installs retain a stable local extension
# ID; Chrome Web Store uploads must omit that field and place manifest.json at
# the ZIP root.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/public/manifest.json"
version="$(node -p "require(process.argv[1]).version" "$manifest")"
output_dir="$repo_root/store-release"
output_archive="$output_dir/evolvio-extension-store-$version.zip"
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/evolvio-store.XXXXXX")"

cleanup() {
  rm -rf "$staging_dir"
}
trap cleanup EXIT

mkdir -p "$output_dir"
rm -f "$output_archive"
cp -R "$repo_root/public/." "$staging_dir/"
find "$staging_dir" -name '.DS_Store' -delete

node - "$staging_dir/manifest.json" <<'NODE'
const fs = require('fs');
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete manifest.key;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

(
  cd "$staging_dir"
  zip -q -r "$output_archive" .
)

node - "$output_archive" <<'NODE'
const { execFileSync } = require('child_process');
const archivePath = process.argv[2];
const files = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
  .trim()
  .split('\n');
if (!files.includes('manifest.json') || files.some((file) => file.startsWith('public/'))) {
  throw new Error('Store archive must contain manifest.json at its root.');
}
const manifest = JSON.parse(execFileSync('unzip', ['-p', archivePath, 'manifest.json'], { encoding: 'utf8' }));
if (Object.prototype.hasOwnProperty.call(manifest, 'key')) {
  throw new Error('Store archive manifest must not include the development key field.');
}
console.log(`Validated Chrome Web Store archive v${manifest.version}`);
NODE

echo "Store upload: $output_archive"
