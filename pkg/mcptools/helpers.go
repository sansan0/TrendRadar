package mcptools

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/pkg/analysis"
	"github.com/sansan0/TrendRadar/pkg/app"
	"github.com/sansan0/TrendRadar/pkg/parser"
)

var ErrInvalidQuery = fmt.Errorf("查询条件不能为空")

type newsItem struct {
	Title        string
	PlatformID   string
	PlatformName string
	Rank         int
	Timestamp    string
	URL          string
	MobileURL    string
}

func buildNewsItems(res *parser.AllTitlesResult) []newsItem {
	items := make([]newsItem, 0, 64)

	for platformID, titles := range res.Titles {
		platformName := platformID
		if v, ok := res.SourceName[platformID]; ok && strings.TrimSpace(v) != "" {
			platformName = v
		}

		for title, entry := range titles {
			rank := 999
			if len(entry.Ranks) > 0 {
				rank = entry.Ranks[0]
			}

			timestamp := ""
			if info, ok := res.TitleInfo[platformID][title]; ok {
				if strings.TrimSpace(info.LastTime) != "" {
					timestamp = info.LastTime
				} else if strings.TrimSpace(info.FirstTime) != "" {
					timestamp = info.FirstTime
				}
			}

			items = append(items, newsItem{
				Title:        title,
				PlatformID:   platformID,
				PlatformName: platformName,
				Rank:         rank,
				Timestamp:    timestamp,
				URL:          entry.URL,
				MobileURL:    entry.MobileURL,
			})
		}
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Rank == items[j].Rank {
			if items[i].PlatformID == items[j].PlatformID {
				return items[i].Title < items[j].Title
			}
			return items[i].PlatformID < items[j].PlatformID
		}
		return items[i].Rank < items[j].Rank
	})

	return items
}

func limitNewsItems(items []newsItem, limit int) []newsItem {
	if limit <= 0 || limit >= len(items) {
		return items
	}
	return items[:limit]
}

func makeNewsResponse(items []newsItem, includeURL bool) []map[string]interface{} {
	out := make([]map[string]interface{}, len(items))
	for i, item := range items {
		entry := map[string]interface{}{
			"title":         item.Title,
			"platform":      item.PlatformID,
			"platform_name": item.PlatformName,
			"rank":          item.Rank,
			"timestamp":     item.Timestamp,
		}
		if includeURL {
			entry["url"] = item.URL
			entry["mobile_url"] = item.MobileURL
		}
		out[i] = entry
	}
	return out
}

func clampLimit(limit, fallback, maxLimit int) int {
	if limit <= 0 {
		return fallback
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}

func formatDate(date time.Time) string {
	return date.Format("2006-01-02")
}

func chooseTimestamp(info *analysis.NewsEntry) string {
	if info == nil {
		return ""
	}
	if strings.TrimSpace(info.LastTime) != "" {
		return info.LastTime
	}
	return info.FirstTime
}

type TitleRecord struct {
	Title       string `json:"title"`
	SourceName  string `json:"source_name"`
	Date        string `json:"date"`
	TimeDisplay string `json:"time_display"`
	Rank        int    `json:"rank"`
	URL         string `json:"url"`
}

type DateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

func resolveDateRange(dr *DateRange) (time.Time, time.Time, error) {
	now := time.Now()
	if dr == nil || (strings.TrimSpace(dr.Start) == "" && strings.TrimSpace(dr.End) == "") {
		date := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return date, date, nil
	}

	parse := func(v string) (time.Time, error) {
		v = strings.TrimSpace(v)
		if v == "" {
			return time.Time{}, fmt.Errorf("日期不能为空")
		}
		v = strings.ReplaceAll(v, "/", "-")
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			return time.Time{}, fmt.Errorf("无法解析日期: %s", v)
		}
		return t, nil
	}

	start, err := parse(dr.Start)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end, err := parse(dr.End)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("结束日期不能早于开始日期")
	}
	return start, end, nil
}

type dailyData struct {
	Date   time.Time
	Values *parser.AllTitlesResult
}

func loadDailyData(env *app.Environment, start, end time.Time, platforms []string) ([]dailyData, error) {
	results := []dailyData{}
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		res, err := env.Parser.ReadAllTitles(day, platforms)
		if err != nil {
			continue
		}
		results = append(results, dailyData{
			Date:   day,
			Values: res,
		})
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("指定日期范围没有可用数据")
	}
	return results, nil
}
