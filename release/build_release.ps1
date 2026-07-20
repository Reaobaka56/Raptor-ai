# PowerShell script to build a Windows .exe release for AI Code Review Agent
# ------------------------------------------------------------
# Prerequisites: Python (>=3.9), pip, Node.js (>=18), npm, PyInstaller
# Run this script from the project root (where frontend/ and backend/ reside).
# ------------------------------------------------------------
$ErrorActionPreference = "Stop"

Write-Host "=== Installing backend Python dependencies ==="
py -m pip install --upgrade pip
py -m pip install -r backend/requirements.txt

Write-Host "=== Building frontend assets ==="
Push-Location frontend
npm install
npm run build   # uses the "build" script defined in frontend/package.json
Pop-Location

Write-Host "=== Copying built frontend into backend static folder ==="
$backendStatic = Join-Path -Path (Resolve-Path backend/app) -ChildPath "static"
if (Test-Path $backendStatic) { Remove-Item -Recurse -Force $backendStatic }
Copy-Item -Path frontend/dist -Destination $backendStatic -Recurse

Write-Host "=== Installing PyInstaller ==="
py -m pip install --upgrade pyinstaller

Write-Host "=== Creating executable with PyInstaller ==="
# Build the exe; include the static assets as data
pyinstaller --onefile --name backend --add-data "${backendStatic};static" backend/app/main.py

Write-Host "=== Packaging release archive ==="
$releaseDir = Join-Path -Path (Resolve-Path .) -ChildPath "release"
if (-Not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir }
# The generated exe is placed in ./dist/backend.exe by PyInstaller
$exePath = Join-Path -Path (Resolve-Path dist) -ChildPath "backend.exe"
$zipPath = Join-Path -Path $releaseDir -ChildPath "ai-code-review-agent-windows.zip"
Compress-Archive -Path $exePath, "frontend/dist/*" -DestinationPath $zipPath -Force

Write-Host "Release bundle created at: $zipPath"
