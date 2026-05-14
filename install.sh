#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== BabyTrack 一键部署 ==="

sudo apt update
sudo apt install -y python3-venv python3-pip avahi-daemon

cd "$BASE_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt

sudo tee /etc/systemd/system/babytrack.service > /dev/null <<SYSTEMD
[Unit]
Description=BabyTrack Flask App
After=network.target

[Service]
User=pi
WorkingDirectory=$BASE_DIR
ExecStart=$BASE_DIR/.venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 run:app
Restart=always
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SYSTEMD

sudo systemctl daemon-reload
sudo systemctl enable babytrack
sudo systemctl restart babytrack

echo ""
echo "=== 局域网访问 ==="
echo "http://babytrack.local:5000"
echo "http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "=== 部署完成 ==="
echo "局域网内手机浏览器打开以上地址即可使用。"
echo "如需外网访问，可自行配置 frp / ngrok / cloudflared 等内网穿透工具。"
