package mcptools

import (
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type TrendingTopicsArgs struct {
	Limit int    `json:"limit"`
	Mode  string `json:"mode"`
}

func TrendingTopics(env *app.Environment, args TrendingTopicsArgs) (map[string]interface{}, error) {
	mode := env.AnalysisMode()
	switch args.Mode {
	case "incremental":
		mode = analysis.ModeIncremental
	case "current":
		mode = analysis.ModeCurrent
	case "daily":
		mode = analysis.ModeDaily
	}

	data, err := env.Parser.ReadAllTitles(time.Time{}, nil)
	if err != nil {
		return nil, err
	}

	wordList := env.LoadKeywordList()
	opts := analysis.CountOptions{
		Results:       data.Titles,
		WordList:      wordList,
		SourceNames:   data.SourceName,
		TitleInfo:     data.TitleInfo,
		RankThreshold: env.Config.Report.RankThreshold,
		Mode:          mode,
		IsFirstCrawl:  env.IsFirstCrawlToday(),
		Weight:        env.Config.Weight,
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
