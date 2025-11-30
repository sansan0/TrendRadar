@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo   TrendRadar MCP One-Click Deployment (Windows)
echo ==========================================
echo.

REM Fix: Use the script's directory, not the current working directory
set "PROJECT_ROOT=%~dp0"
REM Remove trailing backslash
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo 📍 Project Directory: %PROJECT_ROOT%
echo.

REM Change to the project directory
cd /d "%PROJECT_ROOT%"
if %errorlevel% neq 0 (
    echo ❌ Cannot access project directory
    pause
    exit /b 1
)

REM Verify project structure
echo [0/4] 🔍 Verifying project structure...
if not exist "pyproject.toml" (
    echo ❌ pyproject.toml not found: %PROJECT_ROOT%
    echo.
    echo Please check:
    echo   1. Is setup-windows.bat in the project root directory?
    echo   2. Are the project files complete?
    echo.
    echo Current directory contents:
    dir /b
    echo.
    pause
    exit /b 1
)
echo ✅ pyproject.toml found
echo.

REM Check for Python
echo [1/4] 🐍 Checking for Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not detected. Please install Python 3.10+
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo ✅ %%i
echo.

REM Check for UV
echo [2/4] 🔧 Checking for UV...
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo UV not installed, attempting automatic installation...
    echo.
    
    echo Method 1: PowerShell installation...
    powershell -ExecutionPolicy Bypass -Command "try { irm https://astral.sh/uv/install.ps1 | iex; exit 0 } catch { Write-Host 'PowerShell installation failed'; exit 1 }"
    
    if %errorlevel% neq 0 (
        echo.
        echo Method 1 failed, trying Method 2: pip installation...
        python -m pip install --upgrade uv
        
        if %errorlevel% neq 0 (
            echo.
            echo ❌ Automatic installation failed
            echo.
            echo Please install UV manually. Options:
            echo.
            echo   Method 1 - pip:
            echo     python -m pip install uv
            echo.
            echo   Method 2 - pipx:
            echo     pip install pipx
            echo     pipx install uv
            echo.
            echo   Method 3 - Manual download:
            echo     Visit: https://docs.astral.sh/uv/getting-started/installation/
            echo.
            pause
            exit /b 1
        )
    )
    
    echo.
    echo ✅ UV installation complete!
    echo.
    echo ⚠️ Important: Please follow these steps:
    echo   1. Close this window
    echo   2. Re-open Command Prompt (or PowerShell)
    echo   3. Navigate back to the project directory: %PROJECT_ROOT%
    echo   4. Re-run this script: setup-windows.bat
    echo.
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%i in ('uv --version') do echo ✅ %%i
)
echo.

echo [3/4] 📦 Installing project dependencies...
echo Working directory: %PROJECT_ROOT%
echo.

REM Ensure execution in the project directory
cd /d "%PROJECT_ROOT%"
uv sync
if %errorlevel% neq 0 (
    echo.
    echo ❌ Dependency installation failed
    echo.
    echo Possible reasons:
    echo   1. Network connection issue
    echo   2. Incompatible Python version (requires ^>= 3.10)
    echo   3. pyproject.toml file format error
    echo.
    echo Troubleshooting:
    echo   - Check your network connection
    echo   - Verify Python version: python --version
    echo   - Try for detailed output: uv sync --verbose
    echo.
    echo Project directory: %PROJECT_ROOT%
    echo.
    pause
    exit /b 1
)
echo.
echo ✅ Dependencies installed successfully
echo.

echo [4/4] ⚙️  Checking configuration files...
if not exist "config\config.yaml" (
    echo ⚠️  Configuration file not found: config\config.yaml
    if exist "config\config.example.yaml" (
        echo.
        echo To create a configuration file:
        echo   1. Copy: copy config\config.example.yaml config\config.yaml
        echo   2. Edit: notepad config\config.yaml
        echo   3. Fill in your API keys
    )
    echo.
) else (
    echo ✅ config\config.yaml already exists
)
echo.

REM Get UV path
for /f "tokens=*" %%i in ('where uv 2^>nul') do set "UV_PATH=%%i"
if not defined UV_PATH (
    set "UV_PATH=uv"
)

echo.
echo ==========================================
echo            Deployment Complete!
echo ==========================================
echo.
echo 📋 MCP Server Configuration (for Claude Desktop):
echo.
echo   Command: %UV_PATH%
echo   Working Directory: %PROJECT_ROOT%
echo.
echo   Arguments (enter one per line):
echo     --directory
echo     %PROJECT_ROOT%
echo     run
echo     python
echo     -m
echo     mcp_server.server
echo.
echo 📖 Detailed Tutorial: README-Cherry-Studio.md
echo.
echo.
pause
