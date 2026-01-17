#!/bin/bash
set -e

echo "🚀 TrendRadar 启动中..."
echo "📦 版本: $(cat /app/version 2>/dev/null || echo 'unknown')"

# 检查配置文件
CONFIG_DIR="/app/config"
OUTPUT_DIR="/app/output"
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

# 检查是否需要数据库迁移（从旧的 per-date 格式迁移到新格式）
check_and_migrate_db() {
    local db_dir="${OUTPUT_DIR}"
    echo "🔍 检查数据库格式... (目录: ${db_dir})"

    # 新格式结构:
    #   output/news/current.db (rolling window 热数据)
    #   output/news/archive.db (rolling window 冷数据)
    # 旧格式结构:
    #   output/news/YYYY-MM-DD.db (per-date 格式)

    # 计算旧格式数据库文件数量
    local old_news_count=0
    local old_rss_count=0

    if [ -d "${db_dir}/news" ]; then
        # 匹配 YYYY-MM-DD.db 格式的文件，排除 current.db 和 archive.db
        old_news_count=$(find "${db_dir}/news" -maxdepth 1 -type f -name "????-??-??.db" 2>/dev/null | wc -l | tr -d ' ')
    fi

    if [ -d "${db_dir}/rss" ]; then
        old_rss_count=$(find "${db_dir}/rss" -maxdepth 1 -type f -name "????-??-??.db" 2>/dev/null | wc -l | tr -d ' ')
    fi

    local old_db_count=$((old_news_count + old_rss_count))
    echo "   旧格式文件数: ${old_db_count} (news: ${old_news_count}, rss: ${old_rss_count})"

    # 检查是否已有新格式的数据库（news/current.db 或 rss/current.db）
    local has_news_current=false
    local has_rss_current=false

    if [ -f "${db_dir}/news/current.db" ]; then
        has_news_current=true
        echo "   新格式 news/current.db: 存在"
    else
        echo "   新格式 news/current.db: 不存在"
    fi

    if [ -f "${db_dir}/rss/current.db" ]; then
        has_rss_current=true
        echo "   新格式 rss/current.db: 存在"
    else
        echo "   新格式 rss/current.db: 不存在"
    fi

    # 任一 current.db 存在即视为已迁移
    local has_current_db=false
    if [ "$has_news_current" = true ] || [ "$has_rss_current" = true ]; then
        has_current_db=true
    fi

    if [ "$old_db_count" -gt 0 ] && [ "$has_current_db" = false ]; then
        echo "🔄 检测到旧格式数据库文件 (${old_db_count} 个 per-date 文件)"
        echo "📦 正在自动迁移到新的 rolling window 格式..."

        # 运行迁移脚本
        if [ -f "/app/scripts/migrate_to_rolling_window.py" ]; then
            /usr/local/bin/python /app/scripts/migrate_to_rolling_window.py \
                --data-dir "${db_dir}" \
                --backup

            if [ $? -eq 0 ]; then
                echo "✅ 数据库迁移完成"
            else
                echo "⚠️ 数据库迁移失败，将继续使用旧格式"
            fi
        else
            echo "⚠️ 迁移脚本不存在，跳过迁移"
        fi
    elif [ "$old_db_count" -gt 0 ] && [ "$has_current_db" = true ]; then
        echo "ℹ️ 检测到混合数据库格式（旧文件: ${old_db_count}，新格式: 已存在）"
        echo "   如需完全迁移，请手动运行: python /app/scripts/migrate_to_rolling_window.py --data-dir ${db_dir}"
    else
        echo "✅ 数据库格式检查完成（无需迁移）"
    fi
}

# 执行数据库迁移检查
check_and_migrate_db

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