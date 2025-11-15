package main

import (
	"encoding/json"
	"log"

	"github.com/metoro-io/mcp-golang"
	"github.com/metoro-io/mcp-golang/transport/stdio"

	"github.com/sansan0/TrendRadar/go/pkg/app"
	"github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/mcptools"
)

func main() {
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	env := app.NewEnvironment(cfg)

	server := mcp_golang.NewServer(stdio.NewStdioServerTransport())

	registerJSONTool(server, "get_latest_news", "获取最新抓取的新闻列表", func(args mcptools.LatestNewsArgs) (interface{}, error) {
		return mcptools.LatestNews(env, args)
	})

	registerJSONTool(server, "get_news_by_date", "按日期获取历史新闻", func(args mcptools.NewsByDateArgs) (interface{}, error) {
		return mcptools.NewsByDate(env, args)
	})

	registerJSONTool(server, "get_trending_topics", "根据频率词统计热点", func(args mcptools.TrendingTopicsArgs) (interface{}, error) {
		return mcptools.TrendingTopics(env, args)
	})

	registerJSONTool(server, "get_current_config", "返回当前配置内容", func(_ struct{}) (interface{}, error) {
		return mcptools.CurrentConfig(env), nil
	})

	if err := server.Serve(); err != nil {
		log.Fatalf("MCP server 运行失败: %v", err)
	}
}

func registerJSONTool[T any](server *mcp_golang.Server, name, description string, handler func(T) (interface{}, error)) {
	if err := server.RegisterTool(name, description, func(args T) (*mcp_golang.ToolResponse, error) {
		result, err := handler(args)
		if err != nil {
			return nil, err
		}
		payload, err := json.Marshal(result)
		if err != nil {
			return nil, err
		}
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(string(payload))), nil
	}); err != nil {
		log.Fatalf("注册工具 %s 失败: %v", name, err)
	}
}
