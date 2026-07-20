# Raptor AI — Desktop App

Electron wrapper around the Raptor AI web frontend, pointing at the live Render backend.

## Development

```bash
# Install Electron + electron-builder
npm install

# Build the frontend first
npm run build:frontend

# Run Electron in dev mode (loads Vite dev server on :5173)
# In a separate terminal: cd frontend && npm run dev
npm run dev
```

## Building installers locally

```bash
# All platforms (only works on that platform's native OS)
npm run build

# Windows only (run on Windows)
npm run build:win

# macOS only (run on macOS)
npm run build:mac

# Linux only (run on Linux)
npm run build:linux
```

Output goes to `dist-electron/`.

## Releasing via GitHub Actions

The workflow at `.github/workflows/release.yml` builds all three
platforms automatically whenever you push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will:
1. Build Windows `.exe` (NSIS installer + portable)
2. Build macOS `.dmg` (Intel + Apple Silicon)
3. Build Linux `.AppImage` + `.deb`
4. Create a GitHub Release with all binaries attached
5. Auto-generate release notes from commits since last tag

Pre-release tags (e.g. `v1.1.0-beta.1`) are automatically marked
as pre-releases on GitHub.

## Assets needed

Place these in `electron/assets/`:
- `icon.png` — 512×512 PNG (used for Linux + fallback)
- `icon.ico` — Windows icon (multi-size ICO)
- `icon.icns` — macOS icon bundle

You can generate `.ico` and `.icns` from a single 1024×1024 PNG
using https://cloudconvert.com or `electron-icon-builder`:
```bash
npx electron-icon-builder --input=icon-source.png --output=electron/assets
```

## macOS code signing

Without an Apple Developer ID certificate, macOS users will see a
Gatekeeper warning. They can still open the app via right-click → Open.

To sign: add these secrets to your GitHub repo:
- `CSC_LINK` — base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` — certificate password

And remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow.
