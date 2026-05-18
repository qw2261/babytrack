#!/bin/bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== BabyTrack 一键部署 ==="

sudo apt update
sudo apt install -y python3-venv python3-pip avahi-daemon nginx

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
User=$USER
WorkingDirectory=$BASE_DIR
ExecStart=$BASE_DIR/.venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 run:app
Restart=always
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SYSTEMD

sudo tee /etc/nginx/sites-available/babytrack > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/babytrack /etc/nginx/sites-enabled/babytrack
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl daemon-reload
sudo systemctl enable babytrack
sudo systemctl restart babytrack
sudo systemctl restart nginx

# ---- 定时自动更新（每 5 分钟） -----------------------------
CRON_JOB="*/5 * * * * cd $BASE_DIR && bash deploy.sh >> /tmp/babytrack-deploy.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "bash deploy.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo ""
  echo ">> 已添加定时更新任务（每 5 分钟自动 git pull + 重启）"
fi

echo ""
echo "=== 局域网访问 ==="
echo "http://babytrack.local"
echo "http://$(hostname -I | awk '{print $1}')"
echo ""
echo "=== 部署完成 ==="
echo "局域网内手机浏览器打开以上地址即可使用。"
echo "推送代码到 GitHub 后，树莓派每 5 分钟自动拉取并重启服务。"
