FROM python:3.10-slim

WORKDIR /app

# 1. 直接从本地复制已经下载好的 supercronic
# 确保文件已重命名为 supercronic 并位于 Dockerfile 同级目录
COPY supercronic /usr/local/bin/supercronic

# 2. 设置执行权限并验证版本
RUN chmod +x /usr/local/bin/supercronic && \
    supercronic -version

# 3. 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 复制项目文件
COPY docker/manage.py .
COPY trendradar/ ./trendradar/

# 5. 复制并处理 entrypoint.sh (处理 Windows 换行符问题)
COPY docker/entrypoint.sh /entrypoint.sh.tmp
RUN sed -i 's/\r$//' /entrypoint.sh.tmp && \
    mv /entrypoint.sh.tmp /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    chmod +x manage.py && \
    mkdir -p /app/config /app/output

# 6. 环境变量设置
ENV PYTHONUNBUFFERED=1 \
    CONFIG_PATH=/app/config/config.yaml \
    FREQUENCY_WORDS_PATH=/app/config/frequency_words.txt

# 7. 启动
ENTRYPOINT ["/entrypoint.sh"]