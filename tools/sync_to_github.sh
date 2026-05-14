#!/bin/bash
set -euo pipefail

# ============================================================
# 配置：替换为你的 GitHub Pages 仓库地址
# ============================================================
PAGES_REPO_URL="${PAGES_REPO_URL:-git@github.com:YOU/babytrack-pages.git}"
PAGES_REPO_BRANCH="${PAGES_REPO_BRANCH:-main}"

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAGES_DIR="$BASE_DIR/../babytrack-pages"
DATE_STR=$(date +'%Y-%m-%d %H:%M')

# ---- Step 1: 准备 Pages repo 本地目录 -----------------------
mkdir -p "$PAGES_DIR"

if [ ! -d "$PAGES_DIR/.git" ]; then
  echo ">> 首次克隆 Pages 仓库: $PAGES_REPO_URL"
  git clone "$PAGES_REPO_URL" "$PAGES_DIR"
else
  echo ">> 更新 Pages 仓库"
  cd "$PAGES_DIR"
  git fetch origin "$PAGES_REPO_BRANCH"
  git reset --hard "origin/$PAGES_REPO_BRANCH"
fi

# ---- Step 2: 生成 snapshot.json ----------------------------
cd "$BASE_DIR"
source .venv/bin/activate
python tools/export_snapshot.py "$PAGES_DIR/data"

# ---- Step 3: 复制静态文件到 Pages 仓库 -----------------------
cp docs/index.html "$PAGES_DIR/index.html"
cp docs/app.js "$PAGES_DIR/app.js"
cp server/static/css/main.css "$PAGES_DIR/main.css"

# ---- Step 4: 提交并推送 ------------------------------------
cd "$PAGES_DIR"

if ! git diff --quiet; then
  git add -A
  git commit -m "sync: $DATE_STR"
  git push origin "$PAGES_REPO_BRANCH"
  echo ">> 已同步到 GitHub Pages ($PAGES_REPO_URL)"
else
  echo ">> 无变更，跳过同步"
fi
