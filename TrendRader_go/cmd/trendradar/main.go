package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/app"
	"github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/crawler"
	"github.com/sansan0/TrendRadar/go/pkg/storage"
)

func main() {
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	printConfigSummary(cfg)

	if !cfg.Crawler.EnableCrawler {
		fmt.Println("配置禁用了爬虫（enable_crawler=false），直接退出")
		return
	}

	env := app.NewEnvironment(cfg)
	if err := runFullFlow(env); err != nil {
		log.Fatalf("执行流程失败: %v", err)
	}
}

func runFullFlow(env *app.Environment) error {
	fmt.Println("开始抓取配置中的平台...")
	fetcher, err := crawler.NewFetcher(env.Config)
	if err != nil {
		return err
	}

	ctx := context.Background()
	result, err := fetcher.CrawlPlatforms(ctx, env.Config.Platforms)
	if err != nil {
		return err
	}

	writer := storage.NewWriter(env.OutputDir)
	path, err := writer.SaveTitlesToFile(result)
	if err != nil {
		return err
	}
	fmt.Printf("抓取完成，已写入 %s\n", path)
	if len(result.FailedIDs) > 0 {
		fmt.Printf("请求失败的ID: %v\n", result.FailedIDs)
	}

	parser := env.Parser
	platformIDs := env.CollectPlatformIDs()
	allTitles, err := parser.ReadAllTitles(time.Time{}, platformIDs)
	if err != nil {
		return fmt.Errorf("读取当天数据失败: %w", err)
	}

	wordList := env.LoadKeywordList()
	newTitles, err := parser.DetectLatestNewTitles(platformIDs)
	if err != nil {
		fmt.Printf("检测新增新闻失败: %v\n", err)
		newTitles = nil
	}

	opts := analysis.CountOptions{
		Results:       allTitles.Titles,
		WordList:      wordList,
		SourceNames:   allTitles.SourceName,
		TitleInfo:     allTitles.TitleInfo,
		RankThreshold: env.Config.Report.RankThreshold,
		NewTitles:     newTitles,
		Mode:          env.AnalysisMode(),
		IsFirstCrawl:  env.IsFirstCrawlToday(),
		Weight:        env.Config.Weight,
	}

	stats, total := analysis.CountWordFrequency(opts)
	printAnalysis(stats, total, opts.Mode)
	return nil
}

func printAnalysis(stats []analysis.GroupStat, total int, mode analysis.Mode) {
	fmt.Printf("=== 统计结果 (mode=%s，总计 %d 条) ===\n", mode, total)
	for _, stat := range stats {
		fmt.Printf("词组: %s，匹配 %d 条，占比 %.2f%%\n", stat.Word, stat.Count, stat.Percentage)
		for _, title := range stat.Titles {
			newFlag := ""
			if title.IsNew {
				newFlag = "🆕 "
			}
			fmt.Printf("  - %s[%s] %s (rank=%v, count=%d)\n",
				newFlag,
				title.SourceName,
				title.Title,
				title.Ranks,
				title.Count,
			)
		}
	}
}

func printConfigSummary(cfg *config.Config) {
	data := map[string]interface{}{
		"config":      cfg.SourcePath,
		"report_mode": cfg.Report.Mode,
		"platforms":   len(cfg.Platforms),
		"crawler": map[string]interface{}{
			"interval_ms": cfg.Crawler.RequestInterval,
			"use_proxy":   cfg.Crawler.UseProxy,
		},
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		fmt.Printf("打印配置摘要失败: %v\n", err)
	}
}
