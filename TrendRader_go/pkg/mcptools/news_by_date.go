package mcptools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type NewsByDateTool struct {
	Env *app.Environment
}

type newsByDateArgs struct {
	Date       string   `json:"date_query"`
	Platforms  []string `json:"platforms"`
	Limit      int      `json:"limit"`
	IncludeURL bool     `json:"include_url"`
}

func (t *NewsByDateTool) Name() string {
	return "get_news_by_date"
}

func (t *NewsByDateTool) Description() string {
	return "按指定日期获取新闻数据，日期格式支持 YYYY-MM-DD/今天/昨天。"
}

func (t *NewsByDateTool) InputSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"date_query": map[string]interface{}{
				"type":        "string",
				"description": "日期字符串，如 2025-01-15、今天、昨天，默认今天",
			},
			"platforms": map[string]interface{}{
				"type":        "array",
				"description": "可选的平台 ID 列表",
				"items":       map[string]interface{}{"type": "string"},
			},
			"limit": map[string]interface{}{
				"type":        "integer",
				"default":     50,
				"description": "返回新闻数量上限",
			},
			"include_url": map[string]interface{}{
				"type":        "boolean",
				"default":     false,
				"description": "是否包含URL字段",
			},
		},
		"additionalProperties": false,
	}
}

func (t *NewsByDateTool) Call(ctx context.Context, raw json.RawMessage) (interface{}, error) {
	var args newsByDateArgs
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return nil, err
		}
	}

	targetDate, err := parseDateQuery(args.Date)
	if err != nil {
		return nil, err
	}

	data, err := t.Env.Parser.ReadAllTitles(targetDate, args.Platforms)
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
