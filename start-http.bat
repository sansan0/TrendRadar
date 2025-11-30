@echo off
chcp 65001 >nul

echo ╔════════════════════════════════════════╗
echo ║  TrendRadar MCP Server (HTTP Mode)     ║
echo ╚════════════════════════════════════════╝
echo.

REM Check for virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo ❌ [ERROR] Virtual environment not found.
    echo Please run setup-windows.bat or setup-windows-en.bat first to deploy.
    echo.
    pause
    exit /b 1
)

echo [Mode] HTTP (Suitable for remote access)
echo [Address] http://localhost:3333/mcp
echo [Info] Press Ctrl+C to stop the server
echo.

uv run python -m mcp_server.server --transport http --host 0.0.0.0 --port 3333

pause
