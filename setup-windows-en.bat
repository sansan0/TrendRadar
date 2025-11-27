@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   TrendRadar MCP Setup (Windows)
echo ==========================================
echo:

REM Fix: Use script location instead of current working directory
set "PROJECT_ROOT=%~dp0"
REM Remove trailing backslash
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo Project Directory: %PROJECT_ROOT%
echo:

REM Change to project directory
cd /d "%PROJECT_ROOT%"
if %errorlevel% neq 0 (
    echo [ERROR] Cannot access project directory
    pause
    exit /b 1
)

REM Validate project structure
echo [0/4] Validating project structure...
if not exist "pyproject.toml" (
    echo [ERROR] pyproject.toml not found in: %PROJECT_ROOT%
    echo:
    echo This should not happen! Please check:
    echo   1. Is setup-windows.bat in the project root?
    echo   2. Was the project properly cloned/downloaded?
    echo:
    echo Files in current directory:
    dir /b
    echo:
    pause
    exit /b 1
)
echo [OK] pyproject.toml found
echo:

REM Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not detected. Please install Python 3.10+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] %%i
echo:

REM Check UV
echo [2/4] Checking UV...
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo UV not installed, installing automatically...
    echo:
    
    echo Trying installation method 1: PowerShell...
    powershell -ExecutionPolicy Bypass -Command "try { irm https://astral.sh/uv/install.ps1 | iex; exit 0 } catch { Write-Host 'PowerShell method failed'; exit 1 }"
    
    if %errorlevel% neq 0 (
        echo:
        echo Method 1 failed. Trying method 2: pip...
        python -m pip install --upgrade uv
        
        if %errorlevel% neq 0 (
            echo:
            echo [ERROR] Automatic installation failed
            echo:
            echo Please install UV manually using one of these methods:
            echo:
            echo   Method 1 - pip:
            echo     python -m pip install uv
            echo:
            echo   Method 2 - pipx:
            echo     pip install pipx
            echo     pipx install uv
            echo:
            echo   Method 3 - Manual download:
            echo     Visit: https://docs.astral.sh/uv/getting-started/installation/
            echo:
            pause
            exit /b 1
        )
    )
    
    echo:
    echo [SUCCESS] UV installed successfully!
    echo:
    echo [IMPORTANT] Please restart your terminal:
    echo   1. Close this window
    echo   2. Open a new Command Prompt
    echo   3. Navigate to: %PROJECT_ROOT%
    echo   4. Run: setup-windows.bat
    echo:
    pause
    exit /b 0
) else (
    for /f "tokens=*" %%i in ('uv --version') do echo [OK] %%i
)
echo:

echo [3/4] Installing dependencies...
echo Working directory: %PROJECT_ROOT%
echo:

REM Ensure we're in the project directory
cd /d "%PROJECT_ROOT%"
uv sync
if %errorlevel% neq 0 (
    echo:
    echo [ERROR] Dependency installation failed
    echo:
    echo Troubleshooting steps:
    echo   1. Check your internet connection
    echo   2. Verify Python version ^>= 3.10: python --version
    echo   3. Try with verbose output: uv sync --verbose
    echo   4. Check if pyproject.toml is valid
    echo:
    echo Project directory: %PROJECT_ROOT%
    echo:
    pause
    exit /b 1
)
echo:
echo [OK] Dependencies installed successfully
echo:

echo [4/4] Checking configuration file...
if not exist "config\config.yaml" (
    echo [WARNING] config\config.yaml not found
    if exist "config\config.example.yaml" (
        echo:
        echo To create your configuration:
        echo   1. Copy: copy config\config.example.yaml config\config.yaml
        echo   2. Edit: notepad config\config.yaml
        echo   3. Add your API keys
    )
    echo:
) else (
    echo [OK] config\config.yaml exists
)
echo:

REM Get UV path
for /f "tokens=*" %%i in ('where uv 2^>nul') do set "UV_PATH=%%i"
if not defined UV_PATH (
    set "UV_PATH=uv"
)

echo:
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo:
echo MCP Server Configuration for Claude Desktop:
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
echo Configuration guide: README-Cherry-Studio.md
echo:
echo:
pause