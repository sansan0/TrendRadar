package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/pkg/analysis"
	"github.com/sansan0/TrendRadar/pkg/config"
	"github.com/sansan0/TrendRadar/pkg/keywords"
	"github.com/sansan0/TrendRadar/pkg/parser"
)

const (
	DefaultOutputDir     = "output"
	DefaultKeywordsPath  = "config/frequency_words.txt"
	keywordsEnvOverride  = "FREQUENCY_WORDS_PATH"
	defaultTimezoneLabel = "Asia/Shanghai"
)

var beijingLocation = func() *time.Location {
	loc, err := time.LoadLocation(defaultTimezoneLabel)
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

// Environment 集中管理配置、解析器以及常用工具函数。
type Environment struct {
	Config       *config.Config
	OutputDir    string
	KeywordsPath string
	Parser       *parser.Parser
}

// NewEnvironment 根据配置创建运行时上下文。
func NewEnvironment(cfg *config.Config) *Environment {
	outputDir := DefaultOutputDir
	keywordsPath := DefaultKeywordsPath

	if envVal := strings.TrimSpace(os.Getenv(keywordsEnvOverride)); envVal != "" {
		keywordsPath = envVal
	}

	return &Environment{
		Config:       cfg,
		OutputDir:    outputDir,
		KeywordsPath: keywordsPath,
		Parser:       parser.New(outputDir),
	}
}

// CollectPlatformIDs 返回配置中所有平台 ID。
func (e *Environment) CollectPlatformIDs() []string {
	ids := make([]string, 0, len(e.Config.Platforms))
	for _, p := range e.Config.Platforms {
		ids = append(ids, p.ID)
	}
	return ids
}

// ResolvePlatforms 如果传入为空则使用配置中的平台。
func (e *Environment) ResolvePlatforms(platforms []string) []string {
	if len(platforms) > 0 {
		return platforms
	}
	return e.CollectPlatformIDs()
}

// AnalysisMode 根据配置返回分析模式。
func (e *Environment) AnalysisMode() analysis.Mode {
	switch strings.ToLower(strings.TrimSpace(e.Config.Report.Mode)) {
	case "incremental":
		return analysis.ModeIncremental
	case "current":
		return analysis.ModeCurrent
	case "daily":
		return analysis.ModeDaily
	default:
		return analysis.ModeDaily
	}
}

// LoadKeywordList 读取频率词列表，如失败则回退为显示全部新闻。
func (e *Environment) LoadKeywordList() *keywords.List {
	path := e.KeywordsPath
	list, err := keywords.Load(path)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("未找到频率词文件 %s，默认显示全部新闻\n", path)
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

// IsFirstCrawlToday 通过 output 目录判断今日是否首次爬取。
func (e *Environment) IsFirstCrawlToday() bool {
	dateFolder := time.Now().In(beijingLocation).Format("2006年01月02日")
	txtDir := filepath.Join(e.OutputDir, dateFolder, "txt")

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
