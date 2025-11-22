#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  TrendRadar MCP 一键部署 (Mac)        ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "📍 项目目录: ${BLUE}${PROJECT_ROOT}${NC}"
echo ""

# 检查 UV 是否已安装
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}[1/3] 🔧 UV 未安装，正在自动安装...${NC}"
    echo "提示: UV 是一个快速的 Python 包管理器，只需安装一次"
    echo ""
    curl -LsSf https://astral.sh/uv/install.sh | sh

    echo ""
    echo "正在刷新 PATH 环境变量..."
    echo ""

    # 添加 UV 到 PATH
    export PATH="$HOME/.cargo/bin:$PATH"

    # 验证 UV 是否真正可用
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ [错误] UV 安装失败${NC}"
        echo ""
        echo "可能的原因："
        echo "  1. 网络连接问题，无法下载安装脚本"
        echo "  2. 安装路径权限不足"
        echo "  3. 安装脚本执行异常"
        echo ""
        echo "解决方案："
        echo "  1. 检查网络连接是否正常"
        echo "  2. 手动安装: https://docs.astral.sh/uv/getting-started/installation/"
        echo "  3. 或运行: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi

    echo -e "${GREEN}✅ [成功] UV 已安装${NC}"
    echo -e "${YELLOW}⚠️  请重新运行此脚本以继续${NC}"
    exit 0
else
    echo -e "${GREEN}[1/3] ✅ UV 已安装${NC}"
    uv --version
fi

echo ""
echo "[2/3] 📦 安装项目依赖..."
echo "提示: 这可能需要 1-2 分钟，请耐心等待"
echo ""

# 创建虚拟环境并安装依赖
uv sync

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ [错误] 依赖安装失败${NC}"
    echo "请检查网络连接后重试"
    exit 1
fi

echo ""
echo -e "${GREEN}[3/3] ✅ 检查配置文件...${NC}"
echo ""

# 检查配置文件
if [ ! -f "config/config.yaml" ]; then
    echo -e "${YELLOW}⚠️  [警告] 未找到配置文件: config/config.yaml${NC}"
    echo "请确保配置文件存在"
    echo ""
fi

# 添加执行权限
chmod +x start-http.sh 2>/dev/null || true

# 获取 UV 路径
UV_PATH=$(which uv)

echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           部署完成！                   ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📋 下一步操作:"
echo ""
echo "  1️⃣  打开 Cherry Studio"
echo "  2️⃣  进入 设置 > MCP Servers > 添加服务器"
echo "  3️⃣  填入以下配置:"
echo ""
echo "      名称: TrendRadar"
echo "      描述: 新闻热点聚合工具"
echo "      类型: STDIO"
echo -e "      命令: ${BLUE}${UV_PATH}${NC}"
echo "      参数（每个占一行）:"
echo -e "        ${BLUE}--directory${NC}"
echo -e "        ${BLUE}${PROJECT_ROOT}${NC}"
echo -e "        ${BLUE}run${NC}"
echo -e "        ${BLUE}python${NC}"
echo -e "        ${BLUE}-m${NC}"
echo -e "        ${BLUE}mcp_server.server${NC}"
echo ""
echo "  4️⃣  保存并启用 MCP 开关"
echo ""
echo "📖 详细教程请查看: README-Cherry-Studio.md，本窗口别关，待会儿用于填入参数"
echo ""
