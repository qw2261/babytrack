#!/bin/bash
set -euo pipefail

# ============================================================
# 配置：GitHub Pages 仓库（个人站点）
# ============================================================
PAGES_REPO_URL="${PAGES_REPO_URL:-git@github.com:qw2261/qw2261.github.io.git}"
PAGES_REPO_BRANCH="${PAGES_REPO_BRANCH:-master}"
SUBDIR="babytrack"

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAGES_DIR="$BASE_DIR/../qw2261.github.io"
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
DEST_DIR="$PAGES_DIR/$SUBDIR"
mkdir -p "$DEST_DIR/data"
cd "$BASE_DIR"
source .venv/bin/activate
python tools/export_snapshot.py "$DEST_DIR/data"

# ---- Step 3: 复制静态文件到 Pages 仓库 -----------------------
cp docs/index.html "$DEST_DIR/index.html"
cp docs/app.js "$DEST_DIR/app.js"
cp server/static/css/main.css "$DEST_DIR/main.css"

# ---- Step 4: 提交并推送 ------------------------------------
cd "$PAGES_DIR"

if ! git diff --quiet; then
  git add -A
  git commit -m "sync babytrack: $DATE_STR"
  git push origin "$PAGES_REPO_BRANCH"
  echo ">> 已同步到 GitHub Pages (https://qw2261.github.io/babytrack/)"
else
  echo ">> 无变更，跳过同步"
fi
