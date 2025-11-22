@echo off
:: 使用系统默认编码而不是强制 UTF-8
setlocal enabledelayedexpansion

echo ==========================================
echo   TrendRadar MCP Setup (Windows)
echo ==========================================
echo:

REM Get current directory
set "PROJECT_ROOT=%CD%"
echo Project Directory: %PROJECT_ROOT%
echo:

REM Check Python
echo Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not detected. Please install Python 3.10+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo Python OK
echo:

REM Check UV
echo Checking UV...
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] UV not installed, installing automatically...
    echo:
    
    REM Use Bypass execution policy
    powershell -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"
    
    if %errorlevel% neq 0 (
        echo [ERROR] UV installation failed
        echo:
        echo Please install UV manually:
        echo   Method 1: Visit https://docs.astral.sh/uv/getting-started/installation/
        echo   Method 2: Use pip install uv
        pause
        exit /b 1
    )
    
    echo:
    echo [SUCCESS] UV installed successfully
    echo [IMPORTANT] Please follow these steps:
    echo   1. Close this window
    echo   2. Reopen Command Prompt or PowerShell
    echo   3. Navigate to project directory: cd "%PROJECT_ROOT%"
    echo   4. Run this script again: setup-windows.bat
    echo:
    pause
    exit /b 0
) else (
    echo [1/3] UV already installed
    uv --version
)
echo:

echo [2/3] Installing project dependencies...
echo:

REM Install dependencies with UV
uv sync
if %errorlevel% neq 0 (
    echo [ERROR] Dependency installation failed
    echo:
    echo Possible causes:
    echo   - Missing pyproject.toml file
    echo   - Network connection issues
    echo   - Incompatible Python version
    pause
    exit /b 1
)
echo:

echo [3/3] Checking configuration file...
if not exist "config\config.yaml" (
    echo [WARNING] Configuration file not found: config\config.yaml
    if exist "config\config.example.yaml" (
        echo Tip: Example config found, please copy and modify:
        echo   copy config\config.example.yaml config\config.yaml
    )
    echo:
)

REM Get UV path
for /f "tokens=*" %%i in ('where uv 2^>nul') do set "UV_PATH=%%i"
if not defined UV_PATH (
    echo [WARNING] Unable to get UV path, please find it manually
    set "UV_PATH=uv"
)

echo:
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo:
echo MCP Server Configuration:
echo:
echo   Command: %UV_PATH%
echo   Working Directory: %PROJECT_ROOT%
echo:
echo   Arguments (one per line):
echo     --directory
echo     %PROJECT_ROOT%
echo     run
echo     python
echo     -m
echo     mcp_server.server
echo:
echo Documentation: README-Cherry-Studio.md
echo:
pause