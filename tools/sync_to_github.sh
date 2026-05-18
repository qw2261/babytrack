#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

mkdir -p data docs/data

source .venv/bin/activate

python tools/export_snapshot.py

cp -f server/static/css/main.css docs/main.css

if git status docs --porcelain | grep -q .; then
  git add docs/
  git commit -m "chore: update snapshot $(date '+%Y-%m-%d %H:%M')"
  git push origin main
  echo "Snapshot pushed."
else
  echo "No changes to sync."
fi
