package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/crawler"
	"github.com/sansan0/TrendRadar/go/pkg/keywords"
	parserpkg "github.com/sansan0/TrendRadar/go/pkg/parser"
	"github.com/sansan0/TrendRadar/go/pkg/storage"
)

const (
	defaultOutputDir      = "output"
	defaultKeywordsPath   = "config/frequency_words.txt"
	frequencyWordsEnvKey  = "FREQUENCY_WORDS_PATH"
	defaultReportMode     = analysis.ModeDaily
	defaultConfigPathEnv  = "CONFIG_PATH"
	defaultAsiaShanghaiTZ = "Asia/Shanghai"
)

var beijingLocation = func() *time.Location {
	loc, err := time.LoadLocation(defaultAsiaShanghaiTZ)
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

func main() {
	cfg, err := config.Load(os.Getenv(defaultConfigPathEnv))
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	printConfigSummary(cfg)

	if !cfg.Crawler.EnableCrawler {
		fmt.Println("配置禁用了爬虫（enable_crawler=false），直接退出")
		return
	}

	if err := runFullFlow(cfg); err != nil {
		log.Fatalf("执行流程失败: %v", err)
	}
}

func runFullFlow(cfg *config.Config) error {
	fmt.Println("开始抓取配置中的平台...")
	fetcher, err := crawler.NewFetcher(cfg)
	if err != nil {
		return err
	}

	ctx := context.Background()
	result, err := fetcher.CrawlPlatforms(ctx, cfg.Platforms)
	if err != nil {
		return err
	}

	writer := storage.NewWriter(defaultOutputDir)
	path, err := writer.SaveTitlesToFile(result)
	if err != nil {
		return err
	}
	fmt.Printf("抓取完成，已写入 %s\n", path)
	if len(result.FailedIDs) > 0 {
		fmt.Printf("请求失败的ID: %v\n", result.FailedIDs)
	}

	parser := parserpkg.New(defaultOutputDir)
	platformIDs := collectPlatformIDs(cfg)
	allTitles, err := parser.ReadAllTitles(time.Time{}, platformIDs)
	if err != nil {
		return fmt.Errorf("读取当天数据失败: %w", err)
	}

	wordList := loadKeywordList()
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
		RankThreshold: cfg.Report.RankThreshold,
		NewTitles:     newTitles,
		Mode:          toAnalysisMode(cfg.Report.Mode),
		IsFirstCrawl:  isFirstCrawlToday(defaultOutputDir),
		Weight:        cfg.Weight,
	}

	stats, total := analysis.CountWordFrequency(opts)
	printAnalysis(stats, total, opts.Mode)
	return nil
}

func loadKeywordList() *keywords.List {
	wordsPath := strings.TrimSpace(os.Getenv(frequencyWordsEnvKey))
	if wordsPath == "" {
		wordsPath = defaultKeywordsPath
	}

	list, err := keywords.Load(wordsPath)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("未找到频率词文件 %s，默认显示全部新闻\n", wordsPath)
		} else {
			fmt.Printf("加载频率词失败: %v，默认显示全部新闻\n", err)
		}
		return keywords.DefaultAllNews()
	}

	list.Rebuild()
	if list.Len() == 0 {
		return keywords.DefaultAllNews()
	}
	return list
}

func collectPlatformIDs(cfg *config.Config) []string {
	ids := make([]string, 0, len(cfg.Platforms))
	for _, p := range cfg.Platforms {
		ids = append(ids, p.ID)
	}
	return ids
}

func toAnalysisMode(mode string) analysis.Mode {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "incremental":
		return analysis.ModeIncremental
	case "current":
		return analysis.ModeCurrent
	case "daily":
		return analysis.ModeDaily
	default:
		return defaultReportMode
	}
}

func isFirstCrawlToday(outputDir string) bool {
	dateFolder := time.Now().In(beijingLocation).Format("2006年01月02日")
	txtDir := filepath.Join(outputDir, dateFolder, "txt")
	entries, err := os.ReadDir(txtDir)
	if err != nil {
		return true
	}

	count := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := strings.ToLower(entry.Name())
		if strings.HasSuffix(name, ".txt") {
			count++
		}
	}

	return count <= 1
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
