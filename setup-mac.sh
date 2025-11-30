#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  TrendRadar MCP One-Click Setup (Mac)  ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "📍 Project Directory: ${BLUE}${PROJECT_ROOT}${NC}"
echo ""

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}[1/3] 🔧 UV not found, installing automatically...${NC}"
    echo "Info: UV is a fast Python package manager and needs to be installed only once."
    echo ""
    curl -LsSf https://astral.sh/uv/install.sh | sh

    echo ""
    echo "Refreshing PATH environment variable..."
    echo ""

    # Add UV to PATH
    export PATH="$HOME/.cargo/bin:$PATH"

    # Verify if UV is now available
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ [ERROR] UV installation failed${NC}"
        echo ""
        echo "Possible reasons:"
        echo "  1. Network issues preventing download of the installation script"
        echo "  2. Insufficient permissions in the installation path"
        echo "  3. The installation script failed to execute properly"
        echo ""
        echo "Solutions:"
        echo "  1. Check your internet connection"
        echo "  2. Install manually: https://docs.astral.sh/uv/getting-started/installation/"
        echo "  3. Or run: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi

    echo -e "${GREEN}✅ [SUCCESS] UV has been installed${NC}"
    echo -e "${YELLOW}⚠️  Please re-run this script to continue${NC}"
    exit 0
else
    echo -e "${GREEN}[1/3] ✅ UV is already installed${NC}"
    uv --version
fi

echo ""
echo "[2/3] 📦 Installing project dependencies..."
echo "Info: This might take 1-2 minutes, please wait."
echo ""

# Create a virtual environment and install dependencies
uv sync

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ [ERROR] Failed to install dependencies${NC}"
    echo "Please check your network connection and try again."
    exit 1
fi

echo ""
echo -e "${GREEN}[3/3] ✅ Checking for configuration file...${NC}"
echo ""

# Check for the configuration file
if [ ! -f "config/config.yaml" ]; then
    echo -e "${YELLOW}⚠️  [WARNING] Configuration file not found: config/config.yaml${NC}"
    echo "Please ensure the configuration file exists."
    echo ""
fi

# Add execution permissions
chmod +x start-http.sh 2>/dev/null || true

# Get the path to UV
UV_PATH=$(which uv)

echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           Setup Complete!              ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo "📋 Next Steps:"
echo ""
echo "  1️⃣  Open Cherry Studio"
echo "  2️⃣  Go to Settings > MCP Servers > Add Server"
echo "  3️⃣  Fill in the following configuration:"
echo ""
echo "      Name: TrendRadar"
echo "      Description: Trending News Aggregation Tool"
echo "      Type: STDIO"
echo -e "      Command: ${BLUE}${UV_PATH}${NC}"
echo "      Arguments (one per line):"
echo -e "        ${BLUE}--directory${NC}"
echo -e "        ${BLUE}${PROJECT_ROOT}${NC}"
echo -e "        ${BLUE}run${NC}"
echo -e "        ${BLUE}python${NC}"
echo -e "        ${BLUE}-m${NC}"
echo -e "        ${BLUE}mcp_server.server${NC}"
echo ""
echo "  4️⃣  Save and enable the MCP switch"
echo ""
echo "📖 For a detailed guide, please see: README-Cherry-Studio.md. Keep this window open to copy the parameters."
echo ""
