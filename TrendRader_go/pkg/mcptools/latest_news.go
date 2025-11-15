package mcptools

import (
	"context"
	"encoding/json"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type LatestNewsTool struct {
	Env *app.Environment
}

type latestNewsArgs struct {
	Platforms  []string `json:"platforms"`
	Limit      int      `json:"limit"`
	IncludeURL bool     `json:"include_url"`
}

func (t *LatestNewsTool) Name() string {
	return "get_latest_news"
}

func (t *LatestNewsTool) Description() string {
	return "获取最新一批爬取的新闻数据，需先执行抓取任务写入 output 目录。"
}

func (t *LatestNewsTool) InputSchema() map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"platforms": map[string]interface{}{
				"type":        "array",
				"description": "可选平台ID列表，默认全部平台",
				"items":       map[string]interface{}{"type": "string"},
			},
			"limit": map[string]interface{}{
				"type":        "integer",
				"default":     50,
				"description": "返回的最大新闻数量",
			},
			"include_url": map[string]interface{}{
				"type":        "boolean",
				"default":     false,
				"description": "是否包含URL与移动端链接",
			},
		},
		"additionalProperties": false,
	}
}

func (t *LatestNewsTool) Call(ctx context.Context, raw json.RawMessage) (interface{}, error) {
	var args latestNewsArgs
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return nil, err
		}
	}

	limit := clampLimit(args.Limit, 50, 500)

	data, err := t.Env.Parser.ReadAllTitles(time.Time{}, args.Platforms)
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
