#!/bin/bash

# TrendRadar VPS 一键部署脚本
# 适用于已安装 Docker 的 Linux 服务器

set -e

echo "=================================="
echo "   TrendRadar VPS 部署脚本"
echo "=================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
        echo "安装命令: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        echo -e "${RED}❌ Docker 服务未运行或当前用户没有权限${NC}"
        echo "请运行: sudo usermod -aG docker $USER"
        echo "然后重新登录或运行: newgrp docker"
        exit 1
    fi

    echo -e "${GREEN}✓ Docker 已安装并运行${NC}"
}

# 检查配置文件
check_config() {
    if [ ! -f "config/config.yaml" ]; then
        echo -e "${RED}❌ 配置文件不存在: config/config.yaml${NC}"
        exit 1
    fi

    if [ ! -f "config/frequency_words.txt" ]; then
        echo -e "${RED}❌ 配置文件不存在: config/frequency_words.txt${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ 配置文件检查通过${NC}"
}

# 创建必要的目录
create_directories() {
    mkdir -p output
    echo -e "${GREEN}✓ 创建输出目录${NC}"
}

# 检查环境变量文件
check_env() {
    if [ -f ".env" ]; then
        echo -e "${YELLOW}⚠ 发现 .env 文件，将使用其中的配置${NC}"
    else
        echo -e "${YELLOW}💡 未找到 .env 文件${NC}"
        echo "如果需要通过环境变量配置，请参考 .env.example 创建 .env 文件"
    fi
}

# 拉取最新镜像
pull_image() {
    echo ""
    echo "正在拉取最新镜像..."
    docker pull wantcat/trendradar:latest
    echo -e "${GREEN}✓ 镜像拉取成功${NC}"
}

# 停止并删除旧容器
stop_old_container() {
    if docker ps -a | grep -q trend-radar; then
        echo ""
        echo "停止并删除旧容器..."
        docker stop trend-radar 2>/dev/null || true
        docker rm trend-radar 2>/dev/null || true
        echo -e "${GREEN}✓ 旧容器已清理${NC}"
    fi
}

# 启动容器
start_container() {
    echo ""
    echo "启动 TrendRadar 容器..."

    if [ -f ".env" ]; then
        docker compose -f docker/docker-compose.yml up -d
    else
        docker run -d \
            --name trend-radar \
            --restart unless-stopped \
            -v "$(pwd)/config:/app/config:ro" \
            -v "$(pwd)/output:/app/output" \
            -e TZ=Asia/Shanghai \
            -e CRON_SCHEDULE="${CRON_SCHEDULE:-*/30 * * * *}" \
            -e IMMEDIATE_RUN=true \
            wantcat/trendradar:latest
    fi

    echo -e "${GREEN}✓ 容器启动成功${NC}"
}

# 显示状态
show_status() {
    echo ""
    echo "=================================="
    echo "   部署完成！"
    echo "=================================="
    echo ""
    echo "容器状态:"
    docker ps | grep trend-radar || echo -e "${RED}容器未运行${NC}"
    echo ""
    echo "查看日志: docker logs -f trend-radar"
    echo "停止服务: docker stop trend-radar"
    echo "重启服务: docker restart trend-radar"
    echo "删除容器: docker rm -f trend-radar"
    echo ""
    echo "配置文件位置: ./config/config.yaml"
    echo "输出文件位置: ./output/"
    echo ""
}

# 主流程
main() {
    check_docker
    check_config
    create_directories
    check_env
    pull_image
    stop_old_container
    start_container
    show_status
}

main
