package mcptools

import (
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type LatestNewsArgs struct {
	Platforms  []string `json:"platforms"`
	Limit      int      `json:"limit"`
	IncludeURL bool     `json:"include_url"`
}

func LatestNews(env *app.Environment, args LatestNewsArgs) (map[string]interface{}, error) {
	limit := clampLimit(args.Limit, 50, 500)

	data, err := env.Parser.ReadAllTitles(time.Time{}, args.Platforms)
	if err != nil {
		return nil, err
	}

	items := buildNewsItems(data)
	items = limitNewsItems(items, limit)
	result := makeNewsResponse(items, args.IncludeURL)

	return map[string]interface{}{
		"generated_at": time.Now().Format(time.RFC3339),
		"platforms":    len(data.Titles),
		"items":        result,
	}, nil
}
