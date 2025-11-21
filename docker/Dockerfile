FROM python:3.10-slim

WORKDIR /app

# https://github.com/aptible/supercronic
ARG TARGETARCH
ENV SUPERCRONIC_VERSION=v0.2.34

# Install supercronic with retry/verify logic
COPY docker/install_supercronic.sh /usr/local/bin/install_supercronic.sh
RUN chmod +x /usr/local/bin/install_supercronic.sh && \
    /usr/local/bin/install_supercronic.sh "${TARGETARCH}" && \
    rm /usr/local/bin/install_supercronic.sh

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
