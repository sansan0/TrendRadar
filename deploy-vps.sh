#!/usr/bin/env bash
# TrendRadar Web 管理台部署脚本（Ubuntu / Debian）
# 用法：sudo ADMIN_PASSWORD='强密码' bash deploy-vps.sh
# 可选：APP_DIR=/opt/trendradar PORT=80 bash deploy-vps.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/trendradar}"
PORT="${PORT:-80}"
SERVICE_NAME="trendradar-web"
PYTHON_VERSION="3.12"

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 运行：sudo bash deploy-vps.sh" >&2
  exit 1
fi

if [ ! -f "$APP_DIR/pyproject.toml" ]; then
  echo "未在 $APP_DIR 找到项目文件，请先把项目上传到该目录。" >&2
  exit 1
fi

echo "[1/6] 安装 uv"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
fi

echo "[2/6] 安装 Python $PYTHON_VERSION"
export UV_PYTHON_INSTALL_DIR=/opt/uv-python
uv python install "$PYTHON_VERSION"

echo "[3/6] 安装项目依赖"
cd "$APP_DIR"
uv sync --frozen --python "$PYTHON_VERSION"

echo "[4/6] 创建运行用户并设置权限"
if ! id trendradar >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin trendradar
fi
chown -R trendradar:trendradar "$APP_DIR"
chmod 755 /opt/uv-python

echo "[5/6] 初始化管理员密码"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD="$(openssl rand -hex 12)"
  GENERATED=1
fi
runuser -u trendradar -- "$APP_DIR/.venv/bin/python" -m web_admin --set-password "$ADMIN_PASSWORD"
if [ "${GENERATED:-0}" = "1" ]; then
  echo "已生成管理员密码：$ADMIN_PASSWORD"
  echo "请登录后立即修改。"
fi

echo "[6/6] 安装 systemd 服务"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=TrendRadar Web Admin
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=trendradar
Group=trendradar
WorkingDirectory=${APP_DIR}
Environment=PYTHONUNBUFFERED=1
Environment=CONFIG_PATH=${APP_DIR}/config/config.yaml
Environment=TZ=Asia/Shanghai
ExecStart=${APP_DIR}/.venv/bin/python -m web_admin --settings-tls --host 0.0.0.0 --port ${PORT} --http-port ${PORT} --https-port 443
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
sleep 2

if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp" >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

echo
echo "部署完成："
echo "  访问地址: http://<服务器公网IP>:${PORT}/"
echo "  域名/HTTPS: 登录后在「系统设置 → 域名与 HTTPS」中配置，保存并应用后自动重启"
echo "  用户名:   admin"
echo "  服务名:   ${SERVICE_NAME}"
echo "  安装目录: ${APP_DIR}"
echo "  查看日志: journalctl -u ${SERVICE_NAME} -f"