@echo off
chcp 65001 >nul

echo ============================================================
echo   TrendRadar MCP Server (HTTP 模式)
echo ============================================================
echo.

REM 检查虚拟环境
if not exist ".venv\Scripts\python.exe" (
    echo ❌ [错误] 虚拟环境未找到
    echo 请先运行 setup-windows.bat 或 setup-windows-en.bat 进行部署
    echo.
    pause
    exit /b 1
)

echo [模式] HTTP (适合远程访问)
echo [地址] http://localhost:3333/mcp
echo [提示] 按 Ctrl+C 停止服务
echo.

uv run python -m mcp_server.server --transport http --host 0.0.0.0 --port 3333

pause
