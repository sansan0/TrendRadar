GO_BIN := bin
CONFIG_PATH ?= ./config/config.yaml
FREQUENCY_PATH ?= ./config/frequency_words.txt

.PHONY: setup go-build go-run go-mcp go-test go-fmt docker-go-build docker-go-run docker-go-mcp clean

setup:
	go mod download

go-build:
	@mkdir -p $(GO_BIN)
	go build -o $(GO_BIN)/trendradar ./cmd/trendradar
	go build -o $(GO_BIN)/mcpserver ./cmd/mcpserver
	@echo "二进制已生成在 $(GO_BIN)"

go-run:
	CONFIG_PATH=$(CONFIG_PATH) FREQUENCY_WORDS_PATH=$(FREQUENCY_PATH) go run ./cmd/trendradar

go-mcp:
	CONFIG_PATH=$(CONFIG_PATH) FREQUENCY_WORDS_PATH=$(FREQUENCY_PATH) go run ./cmd/mcpserver

go-test:
	go test ./...

go-fmt:
	gofmt -w $$(find . -name "*.go")

docker-go-build:
	docker build -f Dockerfile -t trendradar-go .

docker-go-run:
	docker run --rm \
		-v $$(pwd)/config:/app/config:ro \
		-v $$(pwd)/output:/app/output \
		trendradar-go

docker-go-mcp:
	docker run --rm \
		-e GO_APP=mcpserver \
		-v $$(pwd)/config:/app/config:ro \
		-v $$(pwd)/output:/app/output \
		trendradar-go

clean:
	rm -rf $(GO_BIN) output
