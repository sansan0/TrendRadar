UV ?= uv
GO_DIR := TrendRader_go
GO_BIN := $(GO_DIR)/bin

.PHONY: setup go-build go-run go-mcp go-test go-fmt docker-go-build docker-go-run docker-go-mcp clean

setup:
	@if ! command -v $(UV) >/dev/null 2>&1; then \
		echo "uv 未安装，请参考 https://docs.astral.sh/uv/getting-started/installation/"; \
		exit 1; \
	fi
	$(UV) sync
	@echo "依赖安装完成，可运行 make go-run 或 make go-build"

go-build:
	@mkdir -p $(GO_BIN)
	cd $(GO_DIR) && go build -o ../bin/trendradar ./cmd/trendradar
	cd $(GO_DIR) && go build -o ../bin/mcpserver ./cmd/mcpserver
	@echo "二进制已生成在 $(GO_BIN)"

go-run:
	cd $(GO_DIR) && CONFIG_PATH=./config/config.yaml FREQUENCY_WORDS_PATH=./config/frequency_words.txt go run ./cmd/trendradar

go-mcp:
	cd $(GO_DIR) && CONFIG_PATH=./config/config.yaml FREQUENCY_WORDS_PATH=./config/frequency_words.txt go run ./cmd/mcpserver

go-test:
	cd $(GO_DIR) && go test ./...

go-fmt:
	cd $(GO_DIR) && gofmt -w $$(find . -name "*.go")

docker-go-build:
	docker build -f $(GO_DIR)/Dockerfile -t trendradar-go .

docker-go-run:
	docker run --rm \
		-v $$(pwd)/$(GO_DIR)/config:/app/config:ro \
		-v $$(pwd)/$(GO_DIR)/output:/app/output \
		trendradar-go

docker-go-mcp:
	docker run --rm \
		-e GO_APP=mcpserver \
		-v $$(pwd)/$(GO_DIR)/config:/app/config:ro \
		-v $$(pwd)/$(GO_DIR)/output:/app/output \
		trendradar-go

clean:
	rm -rf $(GO_BIN) TrendRader_go/output
