FROM python:3.10-slim

WORKDIR /app

# https://github.com/aptible/supercronic
ARG TARGETARCH
ENV SUPERCRONIC_VERSION=v0.2.34

RUN set -ex && \
    apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    case ${TARGETARCH} in \
    amd64) \
    export SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64; \
    export SUPERCRONIC_SHA1SUM=e8631edc1775000d119b70fd40339a7238eece14; \
    export SUPERCRONIC=supercronic-linux-amd64; \
    ;; \
    arm64) \
    export SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-arm64; \
    export SUPERCRONIC_SHA1SUM=4ab6343b52bf9da592e8b4bb7ae6eb5a8e21b71e; \
    export SUPERCRONIC=supercronic-linux-arm64; \
    ;; \
    *) \
    echo "Unsupported architecture: ${TARGETARCH}"; \
    exit 1; \
    ;; \
    esac && \
    echo "Downloading supercronic for ${TARGETARCH} from ${SUPERCRONIC_URL}" && \
    # 添加重试机制和超时设置
    for i in 1 2 3 4 5; do \
    echo "Download attempt $i/5"; \
    if curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --connect-timeout 30 --max-time 120 -o "$SUPERCRONIC" "$SUPERCRONIC_URL"; then \
    echo "Download successful"; \
    break; \
    else \
    echo "Download attempt $i failed, exit code: $?"; \
    if [ $i -eq 5 ]; then \
    echo "All download attempts failed"; \
    exit 1; \
    fi; \
    sleep $((i * 2)); \
    fi; \
    done && \
    echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - && \
    chmod +x "$SUPERCRONIC" && \
    mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" && \
    ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic && \
    # 验证安装
    supercronic -version && \
    apt-get remove -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY docker/manage.py .

# 复制 entrypoint.sh 并强制转换为 LF 格式
COPY docker/entrypoint.sh /entrypoint.sh.tmp
RUN sed -i 's/\r$//' /entrypoint.sh.tmp && \
    mv /entrypoint.sh.tmp /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    chmod +x manage.py && \
    mkdir -p /app/config /app/output

ENV PYTHONUNBUFFERED=1 \
    CONFIG_PATH=/app/config/config.yaml \
    FREQUENCY_WORDS_PATH=/app/config/frequency_words.txt

ENTRYPOINT ["/entrypoint.sh"]