#!/bin/bash
# ============================================================
# Raptor AI — Repo Cleanup Script
# Run this from the ROOT of your Raptor-ai repo
# ============================================================

set -e

echo "🦖 Starting Raptor AI repo cleanup..."

# ------------------------------------------------------------
# 1. DELETE JUNK FILES
# ------------------------------------------------------------
echo "Removing junk files..."

git rm "ai-code-review-agent - Shortcut.lnk" 2>/dev/null || true
git rm PROJECT_SUMMARY.md 2>/dev/null || true
git rm implementation_plan.md 2>/dev/null || true

# Remove committed pycache (should never be in git)
git rm -r --cached backend/app/__pycache__/ 2>/dev/null || true
git rm -r --cached backend/app/services/__pycache__/ 2>/dev/null || true

# Remove the nested Clerk boilerplate project (it's a create-vite scaffold, not your code)
git rm -r --cached frontend/src/clerk-react/ 2>/dev/null || true

# Remove duplicate auth callback folders (pick ONE — backend handles this)
git rm -r --cached app/ 2>/dev/null || true
git rm -r --cached api/ 2>/dev/null || true

echo "✅ Junk files removed"

# ------------------------------------------------------------
# 2. FIX .gitignore
# ------------------------------------------------------------
echo "Updating .gitignore..."

cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.eggs/
venv/
.venv/
env/

# Node
node_modules/
dist/
.next/
.cache/

# Environment
.env
.env.local
.env.*.local
!.env.example

# OS
.DS_Store
Thumbs.db
*.lnk
desktop.ini

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
logs/

# Build artifacts
*.pyc
*.pyo
EOF

git add .gitignore
echo "✅ .gitignore updated"

# ------------------------------------------------------------
# 3. COMMIT THE CLEANUP
# ------------------------------------------------------------
echo "Committing cleanup..."

git add -A
git commit -m "chore: clean up repo structure, remove junk files and pycache"

echo ""
echo "============================================================"
echo "✅ Cleanup complete. Run: git push origin main"
echo "============================================================"
