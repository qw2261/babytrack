#!/bin/bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "$BASE_DIR/tools/cloudflared" tunnel --url http://localhost:5000
