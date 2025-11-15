package mcptools

import (
	"fmt"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/pkg/app"
)

type NewsByDateArgs struct {
	DateQuery  string   `json:"date_query"`
	Platforms  []string `json:"platforms"`
	Limit      int      `json:"limit"`
	IncludeURL bool     `json:"include_url"`
}

func NewsByDate(env *app.Environment, args NewsByDateArgs) (map[string]interface{}, error) {
	targetDate, err := parseDateQuery(args.DateQuery)
	if err != nil {
		return nil, err
	}

	data, err := env.Parser.ReadAllTitles(targetDate, args.Platforms)
	if err != nil {
		return nil, err
	}

	items := buildNewsItems(data)
	items = limitNewsItems(items, clampLimit(args.Limit, 50, 500))
	result := makeNewsResponse(items, args.IncludeURL)

	return map[string]interface{}{
		"date":         targetDate.Format("2006-01-02"),
		"platforms":    len(data.Titles),
		"items":        result,
		"generated_at": time.Now().Format(time.RFC3339),
	}, nil
}

func parseDateQuery(query string) (time.Time, error) {
	now := time.Now()
	if strings.TrimSpace(query) == "" {
		return now, nil
	}

	switch strings.ToLower(strings.TrimSpace(query)) {
	case "今天", "today":
		return now, nil
	case "昨天", "yesterday":
		return now.AddDate(0, 0, -1), nil
	case "前天":
		return now.AddDate(0, 0, -2), nil
	}

	if strings.Contains(query, "/") {
		query = strings.ReplaceAll(query, "/", "-")
	}

	tm, err := time.Parse("2006-01-02", query)
	if err != nil {
		return time.Time{}, fmt.Errorf("无法解析日期: %s", query)
	}
	return tm, nil
}
