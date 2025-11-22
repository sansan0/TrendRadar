#!/usr/bin/env bash
set -euo pipefail

TARGET_ARCH="${1:-${TARGETARCH:-}}"
SUPERCRONIC_VERSION="${SUPERCRONIC_VERSION:-v0.2.34}"

if [[ -z "${TARGET_ARCH}" ]]; then
    echo "TARGETARCH is required (pass as arg or env TARGETARCH)" >&2
    exit 1
fi

apt-get update
apt-get install -y --no-install-recommends curl ca-certificates

case "${TARGET_ARCH}" in
    amd64)
        SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64"
        SUPERCRONIC_SHA1SUM="e8631edc1775000d119b70fd40339a7238eece14"
        SUPERCRONIC_BIN="supercronic-linux-amd64"
        ;;
    arm64)
        SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-arm64"
        SUPERCRONIC_SHA1SUM="4ab6343b52bf9da592e8b4bb7ae6eb5a8e21b71e"
        SUPERCRONIC_BIN="supercronic-linux-arm64"
        ;;
    *)
        echo "Unsupported architecture: ${TARGET_ARCH}" >&2
        exit 1
        ;;
esac

echo "Downloading supercronic ${SUPERCRONIC_VERSION} for ${TARGET_ARCH} from ${SUPERCRONIC_URL}"

for i in {1..5}; do
    echo "Download attempt ${i}/5"
    if curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --connect-timeout 30 --max-time 120 -o "${SUPERCRONIC_BIN}" "${SUPERCRONIC_URL}"; then
        echo "Download successful"
        break
    else
        echo "Download attempt ${i} failed, exit code: $?"
        if [[ ${i} -eq 5 ]]; then
            echo "All download attempts failed"
            exit 1
        fi
        sleep $((i * 2))
    fi
done

echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC_BIN}" | sha1sum -c -
chmod +x "${SUPERCRONIC_BIN}"
mv "${SUPERCRONIC_BIN}" "/usr/local/bin/${SUPERCRONIC_BIN}"
ln -sf "/usr/local/bin/${SUPERCRONIC_BIN}" /usr/local/bin/supercronic

# 验证安装
supercronic -version
apt-get remove -y curl
apt-get clean
rm -rf /var/lib/apt/lists/*
