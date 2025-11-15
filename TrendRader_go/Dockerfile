FROM golang:1.22 AS builder

WORKDIR /src

COPY TrendRader_go/go.mod TrendRader_go/go.sum ./
RUN go mod download

COPY TrendRader_go/ .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/trendradar ./cmd/trendradar && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/mcpserver ./cmd/mcpserver

FROM debian:bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /out/trendradar /usr/local/bin/trendradar
COPY --from=builder /out/mcpserver /usr/local/bin/mcpserver
COPY TrendRader_go/config ./config
COPY TrendRader_go/docker-entrypoint.sh /usr/local/bin/trend-entrypoint

RUN chmod +x /usr/local/bin/trend-entrypoint

ENV CONFIG_PATH=/app/config/config.yaml \
    FREQUENCY_WORDS_PATH=/app/config/frequency_words.txt \
    OUTPUT_PATH=/app/output \
    GO_APP=trendradar

VOLUME ["/app/output"]

ENTRYPOINT ["/usr/local/bin/trend-entrypoint"]
