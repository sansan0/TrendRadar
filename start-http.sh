#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  TrendRadar MCP Server (HTTP 模式)    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 가상 환경 확인
if [ ! -d ".venv" ]; then
    echo "❌ [오류] 가상 환경을 찾을 수 없습니다"
    echo "먼저 ./setup-mac.sh를 실행하여 배포하세요"
    echo ""
    exit 1
fi

echo "[모드] HTTP (원격 접근에 적합)"
echo "[주소] http://localhost:3333/mcp"
echo "[팁] Ctrl+C를 눌러 서비스 중지"
echo ""

uv run python -m mcp_server.server --transport http --host 0.0.0.0 --port 3333
