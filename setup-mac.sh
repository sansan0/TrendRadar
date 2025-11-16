#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  TrendRadar MCP 원클릭 배포 (Mac)     ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# 프로젝트 루트 디렉터리 가져오기
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "📍 프로젝트 디렉터리: ${BLUE}${PROJECT_ROOT}${NC}"
echo ""

# UV가 설치되어 있는지 확인
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}[1/3] 🔧 UV가 설치되지 않음, 자동 설치 중...${NC}"
    echo "팁: UV는 빠른 Python 패키지 관리자로 한 번만 설치하면 됩니다"
    echo ""
    curl -LsSf https://astral.sh/uv/install.sh | sh

    echo ""
    echo "PATH 환경 변수 새로고침 중..."
    echo ""

    # UV를 PATH에 추가
    export PATH="$HOME/.cargo/bin:$PATH"

    # UV가 실제로 사용 가능한지 확인
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ [오류] UV 설치 실패${NC}"
        echo ""
        echo "가능한 원인:"
        echo "  1. 네트워크 연결 문제로 설치 스크립트를 다운로드할 수 없음"
        echo "  2. 설치 경로 권한 부족"
        echo "  3. 설치 스크립트 실행 오류"
        echo ""
        echo "해결 방법:"
        echo "  1. 네트워크 연결이 정상인지 확인"
        echo "  2. 수동 설치: https://docs.astral.sh/uv/getting-started/installation/"
        echo "  3. 또는 실행: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi

    echo -e "${GREEN}✅ [성공] UV가 설치되었습니다${NC}"
    echo -e "${YELLOW}⚠️  이 스크립트를 다시 실행하여 계속하세요${NC}"
    exit 0
else
    echo -e "${GREEN}[1/3] ✅ UV가 이미 설치되어 있습니다${NC}"
    uv --version
fi

echo ""
echo "[2/3] 📦 프로젝트 의존성 설치 중..."
echo "팁: 1-2분 정도 소요될 수 있으니 기다려 주세요"
echo ""

# 가상 환경 생성 및 의존성 설치
uv sync

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ [오류] 의존성 설치 실패${NC}"
    echo "네트워크 연결을 확인한 후 다시 시도하세요"
    exit 1
fi

echo ""
echo -e "${GREEN}[3/3] ✅ 설정 파일 확인 중...${NC}"
echo ""

# 설정 파일 확인
if [ ! -f "config/config.yaml" ]; then
    echo -e "${YELLOW}⚠️  [경고] 설정 파일을 찾을 수 없음: config/config.yaml${NC}"
    echo "설정 파일이 존재하는지 확인하세요"
    echo ""
fi

# 실행 권한 추가
chmod +x start-http.sh 2>/dev/null || true

# UV 경로 가져오기
UV_PATH=$(which uv)

echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           배포 완료!                   ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📋 다음 단계:"
echo ""
echo "  1️⃣  Cherry Studio 열기"
echo "  2️⃣  설정 > MCP Servers > 서버 추가로 이동"
echo "  3️⃣  다음 설정 입력:"
echo ""
echo "      이름: TrendRadar"
echo "      설명: 뉴스 핫이슈 집계 도구"
echo "      유형: STDIO"
echo -e "      명령: ${BLUE}${UV_PATH}${NC}"
echo "      매개변수 (각 줄에 하나씩):"
echo -e "        ${BLUE}--directory${NC}"
echo -e "        ${BLUE}${PROJECT_ROOT}${NC}"
echo -e "        ${BLUE}run${NC}"
echo -e "        ${BLUE}python${NC}"
echo -e "        ${BLUE}-m${NC}"
echo -e "        ${BLUE}mcp_server.server${NC}"
echo ""
echo "  4️⃣  저장하고 MCP 스위치 활성화"
echo ""
echo "📖 자세한 튜토리얼은 README-Cherry-Studio.md를 참조하세요. 이 창을 닫지 마세요. 나중에 매개변수 입력에 사용됩니다"
echo ""
