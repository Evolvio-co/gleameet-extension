# Extension release checklist

1. Update the version in `public/manifest.json`.
2. Run `bash scripts/package-release.sh`.
3. Commit both generated archives:
   - `evolvio-extension-<version>.zip`
   - `evolvio-extension.zip`
4. Update the versioned link and version number in `README.md`.
5. Push to `main`.

The stable customer download URL never changes:

`https://github.com/Evolvio-co/gleameet-extension/raw/main/evolvio-extension.zip`

The packaging script refreshes that stable file from the exact same archive as the versioned release file.
