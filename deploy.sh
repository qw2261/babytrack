#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$BASE_DIR"
git pull origin main

source .venv/bin/activate
pip install -r requirements.txt

sudo systemctl restart babytrack

echo "Deploy updated."
