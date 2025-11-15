package mcptools

import (
	"context"
	"encoding/json"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type TrendingTopicsTool struct {
	Env *app.Environment
}

type trendingArgs struct {
	Limit int    `json:"limit"`
	Mode  string `json:"mode"`
}

func (t *TrendingTopicsTool) Name() string {
	return "get_trending_topics"
}

func (t *TrendingTopicsTool) Description() string {
	return "根据 frequency_words.txt 统计词频，返回匹配的新闻分组。"
}

func (t *TrendingTopicsTool) InputSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"limit": map[string]interface{}{
				"type":        "integer",
				"default":     10,
				"description": "返回的词组数量上限",
			},
			"mode": map[string]interface{}{
				"type":        "string",
				"default":     "daily",
				"enum":        []string{"daily", "current", "incremental"},
				"description": "统计模式，与 config.report.mode 一致",
			},
		},
		"additionalProperties": false,
	}
}

func (t *TrendingTopicsTool) Call(ctx context.Context, raw json.RawMessage) (interface{}, error) {
	var args trendingArgs
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return nil, err
		}
	}

	mode := t.Env.AnalysisMode()
	if args.Mode != "" {
		switch args.Mode {
		case "incremental":
			mode = analysis.ModeIncremental
		case "current":
			mode = analysis.ModeCurrent
		case "daily":
			mode = analysis.ModeDaily
		}
	}

	data, err := t.Env.Parser.ReadAllTitles(time.Time{}, nil)
	if err != nil {
		return nil, err
	}

	wordList := t.Env.LoadKeywordList()
	opts := analysis.CountOptions{
		Results:       data.Titles,
		WordList:      wordList,
		SourceNames:   data.SourceName,
		TitleInfo:     data.TitleInfo,
		RankThreshold: t.Env.Config.Report.RankThreshold,
		Mode:          mode,
		IsFirstCrawl:  t.Env.IsFirstCrawlToday(),
		Weight:        t.Env.Config.Weight,
	}

	stats, _ := analysis.CountWordFrequency(opts)
	limit := clampLimit(args.Limit, 10, 50)
	if len(stats) > limit {
		stats = stats[:limit]
	}

	return map[string]interface{}{
		"generated_at": time.Now().Format(time.RFC3339),
		"mode":         mode,
		"groups":       stats,
	}, nil
}
