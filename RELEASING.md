# Extension release checklist

1. Update the version in `public/manifest.json`.
2. Run `bash scripts/package-release.sh`.
3. Run `bash scripts/package-store.sh` when preparing a Chrome Web Store upload.
4. Commit both generated customer-download archives:
   - `evolvio-extension-<version>.zip`
   - `evolvio-extension.zip`
5. Update the versioned link and version number in `README.md`.
6. Push to `main`.

The stable customer download URL never changes:

`https://github.com/Evolvio-co/gleameet-extension/raw/main/evolvio-extension.zip`

The packaging script refreshes that stable file from the exact same archive as the versioned release file.

## Chrome Web Store uploads

Use `bash scripts/package-store.sh`. It creates
`store-release/evolvio-extension-store-<version>.zip` with `manifest.json` at
the ZIP root and removes only the development-only top-level manifest `key`.
Do not upload either customer-download ZIP: those intentionally contain a
`public/` directory for unpacked installation.

The development manifest retains its public key to preserve the local unpacked
extension ID. Removing it from the store package causes the Chrome Web Store to
assign the published extension ID. Before enabling sign-in in the published
extension, register that Store-assigned ID with the Google OAuth Chrome
extension client.
