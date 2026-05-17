#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$BASE_DIR"

BEFORE=$(git rev-parse HEAD)

for i in 1 2 3; do
  if git -c http.version=HTTP/1.1 pull origin master --quiet 2>/dev/null; then
    break
  fi
  sleep 30
done

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  exit 0
fi

source .venv/bin/activate
pip install -r requirements.txt --quiet

sudo systemctl restart babytrack

echo "[$(date '+%Y-%m-%d %H:%M')] Updated to $AFTER"
