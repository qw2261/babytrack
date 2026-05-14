#!/bin/bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== BabyTrack 内网穿透（cpolar） ==="
echo ""

if [ ! -f "$HOME/.cpolar/cpolar" ]; then
  echo ">> 首次使用，安装 cpolar..."
  curl -L https://www.cpolar.com/static/downloads/install-release-cpolar.sh | sudo bash
  echo ""
  echo ">> 复制 authtoken（去 https://dashboard.cpolar.com/auth 复制你的 token）："
  read -rp "请输入 authtoken: " token
  cpolar authtoken "$token"
fi

echo ">> 启动隧道 (localhost:5000)..."
cpolar http 5000
