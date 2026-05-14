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
echo "=== 内网穿透（外网访问） ==="
echo "1. 注册 cpolar: https://dashboard.cpolar.com/signup （免费）"
echo "2. 登录后复制 authtoken: https://dashboard.cpolar.com/auth"
echo "3. 安装: curl -L https://www.cpolar.com/static/downloads/install-release-cpolar.sh | sudo bash"
echo "4. cpolar authtoken <你的token>"
echo "5. 启动: bash tools/tunnel.sh"
echo "   会显示一个 https://xxx.cpolar.top 地址，手机浏览器打开即可"
