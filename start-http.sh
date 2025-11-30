#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  TrendRadar MCP Server (HTTP Mode)     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check for virtual environment
if [ ! -d ".venv" ]; then
    echo "❌ [ERROR] Virtual environment not found."
    echo "Please run ./setup-mac.sh first to deploy."
    echo ""
    exit 1
fi

echo "[Mode] HTTP (Suitable for remote access)"
echo "[Address] http://localhost:3333/mcp"
echo "[Info] Press Ctrl+C to stop the server"
echo ""

uv run python -m mcp_server.server --transport http --host 0.0.0.0 --port 3333
