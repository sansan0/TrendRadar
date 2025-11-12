ARG BASE_IMAGE=python:3.10-slim

FROM ${BASE_IMAGE}
ARG TARGETARCH

ARG DEPENDENCIES="      \
        ca-certificates \
        wget"

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    set -e \
    && rm -f /etc/apt/apt.conf.d/docker-clean \
    && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' >/etc/apt/apt.conf.d/keep-cache \
    && apt-get update \
    && apt-get -y install --no-install-recommends ${DEPENDENCIES}

ARG SUPERCRONIC_VERSION=v0.2.39

RUN set -e \
    && wget -qO /usr/local/bin/supercronic https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${TARGETARCH} \
    && chmod +x /usr/local/bin/supercronic \
    && supercronic -version

WORKDIR /app

ARG PIP_EXTRA_INDEX_URL
ARG UV_EXTRA_INDEX_URL

RUN --mount=type=cache,target=/root/.cache \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    set -e \
    && mkdir -p /app/config /app/output \
    && pip install uv \
    && uv pip install --system -r requirements.txt

COPY main.py docker/entrypoint.sh docker/manage.py .

ENV PYTHONUNBUFFERED=1 \
    CONFIG_PATH=/app/config/config.yaml \
    FREQUENCY_WORDS_PATH=/app/config/frequency_words.txt

ENTRYPOINT ["./entrypoint.sh"]
