package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/sansan0/TrendRadar/go/pkg/config"
)

func main() {
	configPath := flag.String("config", "", "配置文件路径（默认读取 CONFIG_PATH 或 config/config.yaml）")
	outputJSON := flag.Bool("json", false, "以 JSON 格式输出配置摘要")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	if *outputJSON {
		printJSON(cfg)
		return
	}

	printSummary(cfg)
}

func printSummary(cfg *config.Config) {
	fmt.Printf("配置文件: %s\n", cfg.SourcePath)
	fmt.Printf("版本检查: %s (show update: %t)\n", cfg.App.VersionCheckURL, cfg.App.ShowVersionUpdate)
	fmt.Printf("爬虫：%dms interval, enabled=%t, proxy=%s (use_proxy=%t)\n",
		cfg.Crawler.RequestInterval, cfg.Crawler.EnableCrawler, cfg.Crawler.DefaultProxy, cfg.Crawler.UseProxy)
	fmt.Printf("推送模式: %s, 通知启用=%t\n", cfg.Report.Mode, cfg.Notification.EnableNotification)
	fmt.Printf("平台数量: %d\n", len(cfg.Platforms))
	fmt.Printf("通知通道: 飞书=%t, 钉钉=%t, 企业微信=%t, Telegram=%t, Email=%t, ntfy=%t\n",
		cfg.Notification.Channels.FeishuWebhookURL != "",
		cfg.Notification.Channels.DingtalkWebhookURL != "",
		cfg.Notification.Channels.WeworkWebhookURL != "",
		cfg.Notification.Channels.TelegramBotToken != "" && cfg.Notification.Channels.TelegramChatID != "",
		cfg.Notification.Channels.EmailFrom != "" && cfg.Notification.Channels.EmailTo != "",
		cfg.Notification.Channels.NTFYServerURL != "" && cfg.Notification.Channels.NTFYTopic != "",
	)
}

func printJSON(cfg *config.Config) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(map[string]interface{}{
		"source":     cfg.SourcePath,
		"reportMode": cfg.Report.Mode,
		"platforms":  cfg.Platforms,
		"crawler":    cfg.Crawler,
		"notification": map[string]interface{}{
			"enabled":  cfg.Notification.EnableNotification,
			"channels": cfg.Notification.Channels,
			"window":   cfg.Notification.PushWindow,
		},
	}); err != nil {
		log.Fatalf("输出 JSON 失败: %v", err)
	}
}
