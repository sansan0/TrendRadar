#!/bin/bash
set -e

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*"
}

CONFIG_PATH="${CONFIG_PATH:-/app/config/config.yaml}"
FREQUENCY_WORDS_PATH="${FREQUENCY_WORDS_PATH:-/app/config/frequency_words.txt}"

# 检查配置文件
if [ ! -f "${CONFIG_PATH}" ] || [ ! -f "${FREQUENCY_WORDS_PATH}" ]; then
    log "❌ 配置文件缺失"
    exit 1
fi

# 保存环境变量
env >> /etc/environment

case "${RUN_MODE:-cron}" in
"once")
    log "🔄 单次执行"
    exec /usr/local/bin/python main.py
    ;;
"cron")
    # 生成 crontab
    echo "${CRON_SCHEDULE:-*/5 * * * *} cd /app && /usr/local/bin/python main.py" > /tmp/crontab
    
    log "📅 生成的crontab内容:"
    cat /tmp/crontab

    if ! /usr/local/bin/supercronic -test /tmp/crontab; then
        log "❌ crontab格式验证失败"
        exit 1
    fi

    # 立即执行一次（如果配置了）
    if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
        log "▶️ 立即执行一次"
        /usr/local/bin/python main.py
    fi

    log "⏰ 启动supercronic: ${CRON_SCHEDULE:-*/5 * * * *}"
    log "🎯 supercronic 将作为 PID 1 运行"
    
    exec /usr/local/bin/supercronic -passthrough-logs /tmp/crontab
    ;;
*)
    exec "$@"
    ;;
esac
