#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== BabyTrack 一键部署 ==="

sudo apt update
sudo apt install -y python3-venv python3-pip nginx avahi-daemon

cd "$BASE_DIR"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt

sudo tee /etc/nginx/sites-available/babytrack > /dev/null <<'NGINX'
server {
    listen 80;
    server_name babytrack.local _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/babytrack /etc/nginx/sites-enabled/babytrack
sudo rm -f /etc/nginx/sites-enabled/default

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
sudo systemctl restart nginx

echo ""
echo "=== 部署完成 ==="
echo "访问 http://babytrack.local 或 http://$(hostname -I | awk '{print $1}')"
