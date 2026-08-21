# Raptor AI — Desktop App

Electron wrapper around the Raptor AI web frontend, pointing at the live Render backend.

`frontend/` is a sibling directory (repo root, not inside `raptor-desktop/`).
The frontend is built once at the repo root, then copied into
`raptor-desktop/frontend/dist` (see `scripts/copy-frontend.js`) so
electron-builder can package it and `electron/main.js` can load it.

## Development

```bash
# From the repo root
npm run build:frontend   # builds frontend/ and copies dist/ in here

cd raptor-desktop
npm install               # installs electron + electron-builder

# Run Electron in dev mode (loads the Vite dev server on :5173)
# In a separate terminal: cd ../frontend && npm run dev
npm run dev
```

## Building installers locally

Run these from the **repo root** — they install this app's deps and
delegate into electron-builder:

```bash
# Windows only (run on Windows)
npm run build:win

# macOS only (run on macOS)
npm run build:mac

# Linux only (run on Linux)
npm run build:linux
```

Or from inside `raptor-desktop/` directly: `npm run dist:win` / `dist:mac` / `dist:linux`.

Output goes to `raptor-desktop/dist-electron/` (gitignored — build
artifacts aren't committed; releases are published via GitHub Actions).

## Releasing via GitHub Actions

The workflow at `.github/workflows/release.yaml` builds all three
platforms automatically whenever you push a version tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

GitHub Actions will:
1. Build Windows `.exe` (NSIS installer + portable)
2. Build macOS `.dmg` (Intel + Apple Silicon)
3. Build Linux `.AppImage` + `.deb`
4. Create a GitHub Release with all binaries attached
5. Auto-generate release notes from commits since last tag

Pre-release tags (e.g. `v1.1.0-beta.1`) are automatically marked
as pre-releases on GitHub.

## Assets

`electron/assets/icon.png` (512×512), `icon.ico`, and `icon.icns` are
generated from `frontend/public/favicon.svg` (the Raptor T-Rex mark) on a
black background. Regenerate them if the brand mark changes:

```bash
rsvg-convert -w 1024 -h 1024 -b black ../frontend/public/favicon.svg -o /tmp/icon-source.png
convert /tmp/icon-source.png -resize 512x512 electron/assets/icon.png
convert /tmp/icon-source.png -define icon:auto-resize=256,128,64,48,32,16 electron/assets/icon.ico
python3 -c "import icnsutil; f = icnsutil.IcnsFile(); f.add_media(file='/tmp/icon-source.png'); f.write('electron/assets/icon.icns')"
```

## macOS code signing

Without an Apple Developer ID certificate, macOS users will see a
Gatekeeper warning. They can still open the app via right-click → Open.

To sign: add these secrets to your GitHub repo:
- `CSC_LINK` — base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` — certificate password

And remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow.
