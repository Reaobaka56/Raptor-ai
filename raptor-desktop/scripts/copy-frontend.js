// Copies the already-built ../frontend/dist into ./frontend/dist so that:
//   - electron/main.js can load '../frontend/dist/index.html' in production
//   - electron-builder's "files": ["frontend/dist/**/*"] has something to package
// Written in Node (not `cp -r`/`rsync`) so it behaves identically on the
// Windows, macOS, and Linux GitHub Actions runners this repo's release
// workflow builds on.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', '..', 'frontend', 'dist')
const dest = path.join(__dirname, '..', 'frontend', 'dist')

if (!fs.existsSync(src)) {
  console.error(`[copy-frontend] Build output not found at ${src}.`)
  console.error('[copy-frontend] Run the frontend build first (npm run build:frontend at the repo root).')
  process.exit(1)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log(`[copy-frontend] Copied ${src} -> ${dest}`)
