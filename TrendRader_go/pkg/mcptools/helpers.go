package mcptools

import (
	"sort"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/parser"
)

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
