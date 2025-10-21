@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════╗
echo ║  TrendRadar MCP 一键部署 (Windows)    ║
echo ╚════════════════════════════════════════╝
echo.

REM 获取当前目录作为项目根目录
set "PROJECT_ROOT=%CD%"

echo 📍 项目目录: %PROJECT_ROOT%
echo.

REM 检查 UV 是否已安装
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] 🔧 UV 未安装，正在自动安装...
    echo 提示: UV 是一个快速的 Python 包管理器，只需安装一次
    echo.
    powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"

    echo.
    echo 🔄 刷新环境变量并检测 UV 安装状态...
    echo.

    REM 刷新 PATH 环境变量
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%b"
    set "PATH=%USER_PATH%;%SYSTEM_PATH%"

    REM 再次检查 UV 是否可用
    where uv >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ [错误] UV 安装失败 - 无法找到 UV 命令
        echo 可能的原因:
        echo   - 网络连接问题，安装脚本未成功下载
        echo   - 安装路径未正确添加到 PATH
        echo.
        echo 解决方案:
        echo   1. 请关闭此窗口，重新打开命令提示符后再次运行本脚本
        echo   2. 或手动安装: https://docs.astral.sh/uv/getting-started/installation/
        pause
        exit /b 1
    )

    echo ✅ [成功] UV 已安装
    echo ⚠️  请关闭此窗口，重新运行本脚本以继续安装依赖
    pause
    exit /b 0
) else (
    echo [1/3] ✅ UV 已安装
    uv --version
)

echo.
echo [2/3] 📦 安装项目依赖...
echo 提示: 这可能需要 1-2 分钟，请耐心等待
echo.

REM 创建虚拟环境并安装依赖
uv sync

if %errorlevel% neq 0 (
    echo.
    echo ❌ [错误] 依赖安装失败
    echo 请检查网络连接后重试
    pause
    exit /b 1
)

echo.
echo [3/3] ✅ 检查配置文件...
echo.

REM 检查配置文件
if not exist "config\config.yaml" (
    echo ⚠️  [警告] 未找到配置文件: config\config.yaml
    echo 请确保配置文件存在
    echo.
)

REM 获取 UV 的完整路径
for /f "tokens=*" %%i in ('where uv') do set "UV_PATH=%%i"

echo.
echo ╔════════════════════════════════════════╗
echo ║           部署完成！                   ║
echo ╚════════════════════════════════════════╝
echo.
echo 📋 下一步操作:
echo.
echo   1️⃣  打开 Cherry Studio
echo   2️⃣  进入 设置 ^> MCP Servers ^> 添加服务器
echo   3️⃣  填入以下配置:
echo.
echo       名称: TrendRadar
echo       描述: 新闻热点聚合工具
echo       类型: STDIO
echo       命令: %UV_PATH%
echo       参数（每个占一行）:
echo         --directory
echo         %PROJECT_ROOT%
echo         run
echo         python
echo         -m
echo         mcp_server.server
echo.
echo   4️⃣  保存并启用 MCP 开关
echo.
echo 📖 详细教程请查看: README-Cherry-Studio.md，本窗口别关，待会儿用于填入参数
echo.
pause
