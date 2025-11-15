#!/bin/sh
set -e

APP=${GO_APP:-trendradar}

echo "启动 TrendRadar Go 容器，模式：${APP}"
mkdir -p /app/output

case "$APP" in
  trendradar)
    exec trendradar
    ;;
  mcpserver)
    exec mcpserver
    ;;
  *)
    echo "未知的 GO_APP=${APP}，可选值为 trendradar 或 mcpserver"
    exit 1
    ;;
esac
