package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/sansan0/TrendRadar/go/pkg/app"
	"github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/mcp"
	"github.com/sansan0/TrendRadar/go/pkg/mcptools"
)

func main() {
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	env := app.NewEnvironment(cfg)
	server := mcp.NewServer(os.Stdin, os.Stdout)

	registerTools(server, env)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	fmt.Println("TrendRadar Go MCP Server 已启动，等待 MCP 客户端连接...")
	if err := server.Serve(ctx); err != nil {
		log.Fatalf("MCP Server 运行出错: %v", err)
	}
}

func registerTools(server *mcp.Server, env *app.Environment) {
	server.Register(&mcptools.LatestNewsTool{Env: env})
	server.Register(&mcptools.NewsByDateTool{Env: env})
	server.Register(&mcptools.TrendingTopicsTool{Env: env})
	server.Register(&mcptools.ConfigTool{Env: env})
}
