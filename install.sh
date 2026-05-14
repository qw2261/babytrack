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
echo "推荐使用 cloudflared："
echo "  1. 安装: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"
echo "  2. 登录: cloudflared tunnel login"
echo "  3. 创建隧道: cloudflared tunnel create babytrack"
echo "  4. 配置:"
echo "     sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF"
echo "     tunnel: <TUNNEL_ID>"
echo "     credentials-file: /home/pi/.cloudflared/<TUNNEL_ID>.json"
echo "     ingress:"
echo "       - hostname: babytrack.your-domain.com"
echo "         service: http://localhost:5000"
echo "       - service: http_status:404"
echo "     EOF"
echo "  5. 安装为服务: cloudflared service install"
echo "  6. 在 Cloudflare DNS 添加 CNAME: babytrack -> <TUNNEL_ID>.cfargotunnel.com"
echo ""
echo "或使用 ngrok（简单但免费版 URL 随机）:"
echo "  1. https://ngrok.com 注册并获取 authtoken"
echo "  2. brew install ngrok && ngrok config add-authtoken <token>  (macOS)"
echo "     snap install ngrok && ngrok config add-authtoken <token>  (Linux)"
echo "  3. ngrok http 5000"
