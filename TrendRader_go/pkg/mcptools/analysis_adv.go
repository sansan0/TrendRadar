package mcptools

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/go/pkg/app"
)

var positiveKeywords = []string{"上涨", "增长", "突破", "创新", "利好", "喜迎", "大涨", "好转", "乐观", "领先"}
var negativeKeywords = []string{"下跌", "暴跌", "亏损", "危机", "风险", "受挫", "暴雷", "裁员", "预警", "亏本"}

type TopicTrendArgs struct {
	Topic          string     `json:"topic"`
	AnalysisType   string     `json:"analysis_type"`
	DateRange      *DateRange `json:"date_range"`
	Threshold      float64    `json:"threshold"`
	TimeWindow     int        `json:"time_window"`
	LookaheadHours int        `json:"lookahead_hours"`
	Limit          int        `json:"limit"`
}

type DataInsightsArgs struct {
	DateRange *DateRange `json:"date_range"`
	Platforms []string   `json:"platforms"`
}

type SentimentArgs struct {
	Topic      string     `json:"topic"`
	DateRange  *DateRange `json:"date_range"`
	Platforms  []string   `json:"platforms"`
	IncludeRaw bool       `json:"include_raw"`
}

func AnalyzeTopicTrend(env *app.Environment, args TopicTrendArgs) (map[string]interface{}, error) {
	if strings.TrimSpace(args.Topic) == "" {
		return nil, fmt.Errorf("topic 不能为空")
	}

	start, end, err := resolveDateRange(args.DateRange)
	if err != nil {
		return nil, err
	}

	data, err := loadDailyData(env, start, end, nil)
	if err != nil {
		return nil, err
	}

	topicLower := strings.ToLower(args.Topic)
	timeline := make([]map[string]interface{}, 0, len(data))
	var total int
	firstSeen := ""
	lastSeen := ""
	sample := []TitleRecord{}

	for _, day := range data {
		count := 0
		for sourceID, titles := range day.Values.Titles {
			for title := range titles {
				if strings.Contains(strings.ToLower(title), topicLower) {
					count++
					total++
					if firstSeen == "" {
						firstSeen = day.Date.Format("2006-01-02")
					}
					lastSeen = day.Date.Format("2006-01-02")
					if len(sample) < clampLimit(args.Limit, 5, 20) {
						rec := TitleRecord{
							Title:       title,
							SourceName:  day.Values.SourceName[sourceID],
							Date:        day.Date.Format("2006-01-02"),
							TimeDisplay: "",
							Rank:        0,
							URL:         titles[title].URL,
						}
						sample = append(sample, rec)
					}
				}
			}
		}
		timeline = append(timeline, map[string]interface{}{
			"date":  day.Date.Format("2006-01-02"),
			"count": count,
		})
	}

	summary := map[string]interface{}{
		"topic":      args.Topic,
		"total_hits": total,
		"first_seen": firstSeen,
		"last_seen":  lastSeen,
	}

	switch strings.ToLower(args.AnalysisType) {
	case "lifecycle":
		summary["lifecycle_days"] = daysBetween(firstSeen, lastSeen)
	case "viral":
		peak := findPeak(timeline)
		summary["peak_date"] = peak.date
		summary["peak_count"] = peak.count
		summary["threshold_exceeded"] = float64(peak.count) >= args.Threshold && args.Threshold > 0
	case "predict":
		prediction := float64(timeline[len(timeline)-1]["count"].(int))
		if len(timeline) >= 2 {
			prev := float64(timeline[len(timeline)-2]["count"].(int))
			prediction = (prediction + prev) / 2
		}
		summary["predicted_next_window"] = prediction
	default:
		// trend 默认
	}

	return map[string]interface{}{
		"analysis_type": args.AnalysisType,
		"summary":       summary,
		"timeline":      timeline,
		"samples":       sample,
	}, nil
}

func AnalyzeDataInsights(env *app.Environment, args DataInsightsArgs) (map[string]interface{}, error) {
	start, end, err := resolveDateRange(args.DateRange)
	if err != nil {
		return nil, err
	}

	data, err := loadDailyData(env, start, end, args.Platforms)
	if err != nil {
		return nil, err
	}

	totalTitles := 0
	platformStats := map[string]int{}
	newTitles := 0

	for _, day := range data {
		for platformID, titles := range day.Values.Titles {
			count := len(titles)
			totalTitles += count
			platformStats[platformID] += count
		}
		for _, titles := range day.Values.Titles {
			for _, info := range titles {
				if strings.TrimSpace(info.FirstTime) == strings.TrimSpace(info.LastTime) {
					newTitles++
				}
			}
		}
	}

	return map[string]interface{}{
		"date_range": map[string]string{
			"start": start.Format("2006-01-02"),
			"end":   end.Format("2006-01-02"),
		},
		"total_titles":   totalTitles,
		"new_titles":     newTitles,
		"platform_stats": platformStats,
	}, nil
}

func AnalyzeSentiment(env *app.Environment, args SentimentArgs) (map[string]interface{}, error) {
	start, end, err := resolveDateRange(args.DateRange)
	if err != nil {
		return nil, err
	}

	data, err := loadDailyData(env, start, end, args.Platforms)
	if err != nil {
		return nil, err
	}

	pos, neg, neu := 0, 0, 0
	var records []map[string]interface{}
	topic := strings.ToLower(args.Topic)

	for _, day := range data {
		for platformID, titles := range day.Values.Titles {
			sourceName := day.Values.SourceName[platformID]
			for title := range titles {
				if topic != "" && !strings.Contains(strings.ToLower(title), topic) {
					continue
				}
				label := classifySentiment(title)
				switch label {
				case "positive":
					pos++
				case "negative":
					neg++
				default:
					neu++
				}
				if args.IncludeRaw {
					records = append(records, map[string]interface{}{
						"title":       title,
						"sentiment":   label,
						"source_name": sourceName,
						"date":        day.Date.Format("2006-01-02"),
					})
				}
			}
		}
	}

	total := pos + neg + neu
	return map[string]interface{}{
		"topic":    args.Topic,
		"positive": pos,
		"negative": neg,
		"neutral":  neu,
		"total":    total,
		"records":  records,
	}, nil
}

func classifySentiment(title string) string {
	lower := strings.ToLower(title)
	for _, w := range positiveKeywords {
		if strings.Contains(lower, strings.ToLower(w)) {
			return "positive"
		}
	}
	for _, w := range negativeKeywords {
		if strings.Contains(lower, strings.ToLower(w)) {
			return "negative"
		}
	}
	return "neutral"
}

func daysBetween(start, end string) int {
	if start == "" || end == "" {
		return 0
	}
	st, err := time.Parse("2006-01-02", start)
	if err != nil {
		return 0
	}
	et, err := time.Parse("2006-01-02", end)
	if err != nil {
		return 0
	}
	return int(math.Abs(et.Sub(st).Hours()/24)) + 1
}

type peakInfo struct {
	date  string
	count int
}

func findPeak(timeline []map[string]interface{}) peakInfo {
	maxCount := 0
	maxDate := ""
	for _, entry := range timeline {
		val := entry["count"].(int)
		if val > maxCount {
			maxCount = val
			maxDate = entry["date"].(string)
		}
	}
	return peakInfo{date: maxDate, count: maxCount}
}
