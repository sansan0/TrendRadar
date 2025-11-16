#!/bin/bash
set -e

# 설정 파일 확인
if [ ! -f "/app/config/config.yaml" ] || [ ! -f "/app/config/frequency_words.txt" ]; then
    echo "❌ 설정 파일 누락"
    exit 1
fi

# 환경 변수 저장
env >> /etc/environment

case "${RUN_MODE:-cron}" in
"once")
    echo "🔄 단일 실행"
    exec /usr/local/bin/python main.py
    ;;
"cron")
    # crontab 생성
    echo "${CRON_SCHEDULE:-*/30 * * * *} cd /app && /usr/local/bin/python main.py" > /tmp/crontab

    echo "📅 생성된 crontab 내용:"
    cat /tmp/crontab

    if ! /usr/local/bin/supercronic -test /tmp/crontab; then
        echo "❌ crontab 형식 검증 실패"
        exit 1
    fi

    # 즉시 한 번 실행 (설정된 경우)
    if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
        echo "▶️ 즉시 한 번 실행"
        /usr/local/bin/python main.py
    fi

    echo "⏰ supercronic 시작: ${CRON_SCHEDULE:-*/30 * * * *}"
    echo "🎯 supercronic이 PID 1로 실행됩니다"

    exec /usr/local/bin/supercronic -passthrough-logs /tmp/crontab
    ;;
*)
    exec "$@"
    ;;
esac