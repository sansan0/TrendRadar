#!/bin/bash
set -e

# 检查配置文件
if [ ! -f "/app/config/config.yaml" ] || [ ! -f "/app/config/frequency_words.txt" ]; then
    echo "❌ 配置文件缺失"
    exit 1
fi

case "${RUN_MODE:-cron}" in
"once")
    echo "🔄 单次执行"
    exec python -m trendradar
    ;;
"daemon")
    echo "🔄 守护进程模式（内置调度器，可恢复睡眠错过任务）"
    if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
        python /app/docker/scheduler_daemon.py "${CRON_SCHEDULE:-*/30 * * * *}" --immediate &
    else
        python /app/docker/scheduler_daemon.py "${CRON_SCHEDULE:-*/30 * * * *}" &
    fi
    DAEMON_PID=$!
    echo "📅 调度守护进程 PID: $DAEMON_PID"

    # 启动 Web 服务器
    echo "🌐 启动 Web 服务器..."
    python manage.py start_webserver

    # 等待守护进程
    trap "kill $DAEMON_PID 2>/dev/null" EXIT INT TERM
    wait $DAEMON_PID
    ;;
"cron")
    # 校验 CRON_SCHEDULE 格式（仅允许 cron 表达式合法字符）
    CRON_EXPR="${CRON_SCHEDULE:-*/30 * * * *}"
    if ! echo "$CRON_EXPR" | grep -qE '^[0-9*/,[:space:]-]+$'; then
        echo "❌ CRON_SCHEDULE 格式非法: $CRON_EXPR"
        exit 1
    fi

    # 生成 crontab
    echo "$CRON_EXPR cd /app && python -m trendradar" > /tmp/crontab
    
    echo "📅 生成的crontab内容:"
    cat /tmp/crontab

    if ! /usr/local/bin/supercronic -test /tmp/crontab; then
        echo "❌ crontab格式验证失败"
        exit 1
    fi

    # 立即执行一次（如果配置了）
    if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
        echo "▶️ 立即执行一次"
        python -m trendradar
    fi

    # 启动 Web 服务器
    echo "🌐 启动 Web 服务器..."
    python manage.py start_webserver

    echo "⏰ 启动supercronic: $CRON_EXPR"
    echo "🎯 supercronic 将作为 PID 1 运行"

    exec /usr/local/bin/supercronic -passthrough-logs /tmp/crontab
    ;;
*)
    exec "$@"
    ;;
esac
