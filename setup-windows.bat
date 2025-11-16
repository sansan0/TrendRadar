@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ╔════════════════════════════════════════╗
echo ║  TrendRadar MCP 원클릭 배포 (Windows) ║
echo ╚════════════════════════════════════════╝
echo.

REM 현재 디렉터리 가져오기
set "PROJECT_ROOT=%CD%"
echo 📍 프로젝트 디렉터리: %PROJECT_ROOT%
echo.

REM Python 확인
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python이 감지되지 않습니다. Python 3.10+ 설치가 필요합니다
    echo 다운로드 주소: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM UV 확인
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] 🔧 UV가 설치되지 않음, 자동 설치 중...
    echo.

    REM Bypass 실행 정책 사용
    powershell -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex"

    if %errorlevel% neq 0 (
        echo ❌ UV 설치 실패
        echo.
        echo UV를 수동으로 설치하세요:
        echo   방법1: https://docs.astral.sh/uv/getting-started/installation/ 방문
        echo   방법2: pip install uv 사용
        pause
        exit /b 1
    )

    echo.
    echo ✅ UV 설치 완료
    echo ⚠️  중요: 다음 단계를 따르세요:
    echo   1. 이 창 닫기
    echo   2. 명령 프롬프트(또는 PowerShell) 다시 열기
    echo   3. 프로젝트 디렉터리로 이동: cd "%PROJECT_ROOT%"
    echo   4. 이 스크립트 다시 실행: setup-windows.bat
    echo.
    pause
    exit /b 0
) else (
    echo [1/3] ✅ UV가 이미 설치되어 있습니다
    uv --version
)

echo.
echo [2/3] 📦 프로젝트 의존성 설치 중...
echo.

REM UV를 사용하여 의존성 설치
uv sync
if %errorlevel% neq 0 (
    echo ❌ 의존성 설치 실패
    echo.
    echo 가능한 원인:
    echo   - pyproject.toml 파일 누락
    echo   - 네트워크 연결 문제
    echo   - Python 버전 불일치
    pause
    exit /b 1
)

echo.
echo [3/3] ✅ 설정 파일 확인 중...

if not exist "config\config.yaml" (
    echo ⚠️  설정 파일이 존재하지 않음: config\config.yaml
    if exist "config\config.example.yaml" (
        echo 팁: 예제 설정 파일 발견, 복사하여 수정하세요:
        echo   copy config\config.example.yaml config\config.yaml
    )
    echo.
)

REM UV 경로 가져오기
for /f "tokens=*" %%i in ('where uv 2^>nul') do set "UV_PATH=%%i"

if not defined UV_PATH (
    echo ⚠️  UV 경로를 가져올 수 없습니다. 수동으로 찾으세요
    set "UV_PATH=uv"
)

echo.
echo ╔════════════════════════════════════════╗
echo ║           배포 완료!                   ║
echo ╚════════════════════════════════════════╝
echo.
echo 📋 MCP 서버 설정 정보:
echo.
echo   명령: %UV_PATH%
echo   작업 디렉터리: %PROJECT_ROOT%
echo.
echo   매개변수 (한 줄에 하나씩):
echo     --directory
echo     %PROJECT_ROOT%
echo     run
echo     python
echo     -m
echo     mcp_server.server
echo.
echo 📖 자세한 튜토리얼: README-Cherry-Studio.md
echo.
pause
