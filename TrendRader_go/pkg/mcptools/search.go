package mcptools

import (
	"math"
	"sort"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/analysis"
	"github.com/sansan0/TrendRadar/go/pkg/app"
)

type SearchArgs struct {
	Query      string     `json:"query"`
	SearchMode string     `json:"search_mode"`
	DateRange  *DateRange `json:"date_range"`
	Platforms  []string   `json:"platforms"`
	Limit      int        `json:"limit"`
	SortBy     string     `json:"sort_by"`
	Threshold  float64    `json:"threshold"`
	IncludeURL bool       `json:"include_url"`
}

type RelatedArgs struct {
	ReferenceText string  `json:"reference_text"`
	TimePreset    string  `json:"time_preset"`
	Threshold     float64 `json:"threshold"`
	Limit         int     `json:"limit"`
	IncludeURL    bool    `json:"include_url"`
}

func SearchNews(env *app.Environment, args SearchArgs) (map[string]interface{}, error) {
	if strings.TrimSpace(args.Query) == "" {
		return nil, ErrInvalidQuery
	}
	start, end, err := resolveDateRange(args.DateRange)
	if err != nil {
		return nil, err
	}
	data, err := loadDailyData(env, start, end, args.Platforms)
	if err != nil {
		return nil, err
	}
	queryLower := strings.ToLower(args.Query)
	results := []map[string]interface{}{}

	for _, day := range data {
		for platformID, titles := range day.Values.Titles {
			for title, info := range titles {
				score := matchScore(title, queryLower)
				if score < args.Threshold {
					continue
				}
				record := map[string]interface{}{
					"title":         title,
					"platform":      platformID,
					"platform_name": day.Values.SourceName[platformID],
					"score":         score,
					"date":          day.Date.Format("2006-01-02"),
					"rank":          firstRank(info),
				}
				if args.IncludeURL {
					record["url"] = info.URL
					record["mobile_url"] = info.MobileURL
				}
				results = append(results, record)
			}
		}
	}

	sortSearchResults(results, args.SortBy)
	limit := clampLimit(args.Limit, 20, 200)
	if len(results) > limit {
		results = results[:limit]
	}

	return map[string]interface{}{
		"query":   args.Query,
		"results": results,
		"total":   len(results),
		"date_span": map[string]string{
			"start": start.Format("2006-01-02"),
			"end":   end.Format("2006-01-02"),
		},
	}, nil
}

func SearchRelatedNews(env *app.Environment, args RelatedArgs) (map[string]interface{}, error) {
	if strings.TrimSpace(args.ReferenceText) == "" {
		return nil, ErrInvalidQuery
	}

	var dr DateRange
	switch args.TimePreset {
	case "7d":
		dr = defaultRange(-7)
	case "30d":
		dr = defaultRange(-30)
	default:
		dr = DateRange{}
	}

	return SearchNews(env, SearchArgs{
		Query:      args.ReferenceText,
		DateRange:  &dr,
		Threshold:  args.Threshold,
		Limit:      args.Limit,
		IncludeURL: args.IncludeURL,
	})
}

func matchScore(title, query string) float64 {
	titleLower := strings.ToLower(title)
	if strings.Contains(titleLower, query) {
		return 1.0
	}
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return 0
	}
	matchCount := 0.0
	for _, part := range parts {
		if strings.Contains(titleLower, part) {
			matchCount++
		}
	}
	return matchCount / float64(len(parts))
}

func sortSearchResults(results []map[string]interface{}, sortBy string) {
	switch sortBy {
	case "rank":
		sortByRank(results)
	default:
		sortByScore(results)
	}
}

func sortByScore(results []map[string]interface{}) {
	sort.Slice(results, func(i, j int) bool {
		si := results[i]["score"].(float64)
		sj := results[j]["score"].(float64)
		if si == sj {
			return results[i]["rank"].(int) < results[j]["rank"].(int)
		}
		return si > sj
	})
}

func sortByRank(results []map[string]interface{}) {
	sort.Slice(results, func(i, j int) bool {
		return results[i]["rank"].(int) < results[j]["rank"].(int)
	})
}

func firstRank(entry *analysis.NewsEntry) int {
	if len(entry.Ranks) > 0 {
		return entry.Ranks[0]
	}
	return math.MaxInt32
}

func defaultRange(days int) DateRange {
	end := time.Now()
	start := end.AddDate(0, 0, days)
	return DateRange{
		Start: start.Format("2006-01-02"),
		End:   end.Format("2006-01-02"),
	}
}
