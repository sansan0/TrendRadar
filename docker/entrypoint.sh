#!/bin/bash
set -e

# 检查配置文件
CONFIG_DIR="/app/config"
MISSING_FILES=""

if [ ! -f "${CONFIG_DIR}/config.yaml" ]; then
    MISSING_FILES="${MISSING_FILES} ${CONFIG_DIR}/config.yaml"
fi

if [ ! -f "${CONFIG_DIR}/frequency_words.txt" ]; then
    MISSING_FILES="${MISSING_FILES} ${CONFIG_DIR}/frequency_words.txt"
fi

if [ -n "${MISSING_FILES}" ]; then
    echo "❌ 配置文件缺失: ${MISSING_FILES}"
    echo ""
    echo "请确保已挂载配置文件目录:"
    echo "  - ${CONFIG_DIR}/config.yaml (主配置文件)"
    echo "  - ${CONFIG_DIR}/frequency_words.txt (关键词配置文件)"
    echo ""
    echo "参考配置示例:"
    echo "  volumes:"
    echo "    - /path/to/your/config:/app/config:ro"
    exit 1
fi

# 保存环境变量
env >> /etc/environment

case "${RUN_MODE:-cron}" in
"once")
    echo "🔄 单次执行"
    exec /usr/local/bin/python -m trendradar
    ;;
"cron")
    # 生成 crontab
    echo "${CRON_SCHEDULE:-*/30 * * * *} cd /app && /usr/local/bin/python -m trendradar" > /tmp/crontab
    
    echo "📅 生成的crontab内容:"
    cat /tmp/crontab

    if ! /usr/local/bin/supercronic -test /tmp/crontab; then
        echo "❌ crontab格式验证失败"
        exit 1
    fi

    # 立即执行一次（如果配置了）
    if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
        echo "▶️ 立即执行一次"
        /usr/local/bin/python -m trendradar
    fi

    # 启动 Web 服务器（如果配置了）
    if [ "${ENABLE_WEBSERVER:-false}" = "true" ]; then
        echo "🌐 启动 Web 服务器..."
        /usr/local/bin/python manage.py start_webserver
    fi

    echo "⏰ 启动supercronic: ${CRON_SCHEDULE:-*/30 * * * *}"
    echo "🎯 supercronic 将作为 PID 1 运行"

    exec /usr/local/bin/supercronic -passthrough-logs /tmp/crontab
    ;;
*)
    exec "$@"
    ;;
esac