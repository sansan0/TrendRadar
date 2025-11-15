package analysis

import (
	"math"
	"sort"
	"strings"

	cfgpkg "github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/keywords"
)

// CountWordFrequency 统计词频并生成分组结果。
func CountWordFrequency(opts CountOptions) ([]GroupStat, int) {
	wordList := opts.WordList
	if wordList == nil || wordList.Len() == 0 {
		wordList = keywords.DefaultAllNews()
	}

	resultsToProcess, allNewsAreNew := selectResults(opts)

	totalTitles := 0
	groupStats := make(map[string]*groupAccumulator)
	processedTitles := make(map[string]map[string]bool)

	for sourceID, titles := range resultsToProcess {
		totalTitles += len(titles)

		if _, ok := processedTitles[sourceID]; !ok {
			processedTitles[sourceID] = make(map[string]bool)
		}

		for title, data := range titles {
			if processedTitles[sourceID][title] {
				continue
			}

			group, matched := wordList.Match(title)
			if !matched {
				continue
			}

			processedTitles[sourceID][title] = true

			isNew := isTitleNew(allNewsAreNew, opts.NewTitles, sourceID, title)
			stat := buildTitleStat(sourceID, title, data, opts, isNew)

			groupKey := groupKeyOrDefault(group)
			if _, ok := groupStats[groupKey]; !ok {
				groupStats[groupKey] = &groupAccumulator{}
			}
			groupStats[groupKey].count++
			groupStats[groupKey].titles = append(groupStats[groupKey].titles, stat)
		}
	}

	stats := make([]GroupStat, 0, len(groupStats))
	for key, acc := range groupStats {
		if acc.count == 0 {
			continue
		}

		sortTitles(acc.titles, opts.Weight)

		percentage := 0.0
		if totalTitles > 0 {
			percentage = math.Round((float64(acc.count)/float64(totalTitles))*10000) / 100
		}

		stats = append(stats, GroupStat{
			Word:       key,
			Count:      acc.count,
			Percentage: percentage,
			Titles:     acc.titles,
		})
	}

	sort.Slice(stats, func(i, j int) bool {
		if stats[i].Count == stats[j].Count {
			return stats[i].Word < stats[j].Word
		}
		return stats[i].Count > stats[j].Count
	})

	return stats, totalTitles
}

func selectResults(opts CountOptions) (map[string]map[string]*NewsEntry, bool) {
	switch opts.Mode {
	case ModeIncremental:
		if opts.IsFirstCrawl {
			return opts.Results, true
		}
		if len(opts.NewTitles) == 0 {
			return map[string]map[string]*NewsEntry{}, true
		}
		return opts.NewTitles, true
	case ModeCurrent:
		latest := findLatestTime(opts.TitleInfo)
		if latest == "" {
			return opts.Results, false
		}

		filtered := make(map[string]map[string]*NewsEntry)
		for sourceID, titles := range opts.Results {
			historical := opts.TitleInfo[sourceID]
			if len(titles) == 0 || len(historical) == 0 {
				continue
			}

			for title, data := range titles {
				info := historical[title]
				if info == nil || info.LastTime != latest {
					continue
				}
				if _, ok := filtered[sourceID]; !ok {
					filtered[sourceID] = make(map[string]*NewsEntry)
				}
				filtered[sourceID][title] = data
			}
		}

		if len(filtered) == 0 {
			return opts.Results, false
		}

		return filtered, false
	default:
		return opts.Results, false
	}
}

func findLatestTime(titleInfo map[string]map[string]*NewsEntry) string {
	var latest string
	for _, titles := range titleInfo {
		for _, info := range titles {
			if info == nil || info.LastTime == "" {
				continue
			}
			if latest == "" || info.LastTime > latest {
				latest = info.LastTime
			}
		}
	}
	return latest
}

func isTitleNew(allNewsAreNew bool, newTitles map[string]map[string]*NewsEntry, sourceID, title string) bool {
	if allNewsAreNew {
		return true
	}
	if newTitles == nil {
		return false
	}
	if titles, ok := newTitles[sourceID]; ok {
		if _, exists := titles[title]; exists {
			return true
		}
	}
	return false
}

func buildTitleStat(sourceID, title string, data *NewsEntry, opts CountOptions, isNew bool) TitleStat {
	sourceName := sourceID
	if opts.SourceNames != nil && opts.SourceNames[sourceID] != "" {
		sourceName = opts.SourceNames[sourceID]
	}

	ranks := cloneInts(data.Ranks)
	if len(ranks) == 0 {
		ranks = []int{99}
	}
	url := data.URL
	mobile := data.MobileURL
	count := data.Count
	if count <= 0 {
		count = len(data.Ranks)
		if count == 0 {
			count = 1
		}
	}

	firstTime := data.FirstTime
	lastTime := data.LastTime

	if info := getTitleInfo(opts.TitleInfo, sourceID, title); info != nil {
		if len(info.Ranks) > 0 {
			ranks = cloneInts(info.Ranks)
		}
		if info.URL != "" {
			url = info.URL
		}
		if info.MobileURL != "" {
			mobile = info.MobileURL
		}
		if info.Count > 0 {
			count = info.Count
		}
		if info.FirstTime != "" {
			firstTime = info.FirstTime
		}
		if info.LastTime != "" {
			lastTime = info.LastTime
		}
	}

	return TitleStat{
		Title:         title,
		SourceID:      sourceID,
		SourceName:    sourceName,
		TimeDisplay:   formatTimeDisplay(firstTime, lastTime),
		Count:         count,
		Ranks:         ranks,
		RankThreshold: opts.RankThreshold,
		URL:           url,
		MobileURL:     mobile,
		IsNew:         isNew,
	}
}

func getTitleInfo(titleInfo map[string]map[string]*NewsEntry, sourceID, title string) *NewsEntry {
	if titleInfo == nil {
		return nil
	}
	if titles, ok := titleInfo[sourceID]; ok {
		return titles[title]
	}
	return nil
}

func groupKeyOrDefault(group *keywords.Group) string {
	if group == nil || strings.TrimSpace(group.Key) == "" {
		return "全部新闻"
	}
	return group.Key
}

func formatTimeDisplay(first, last string) string {
	if first == "" {
		return ""
	}
	if first == last || last == "" {
		return first
	}
	return "[" + first + " ~ " + last + "]"
}

func cloneInts(src []int) []int {
	if len(src) == 0 {
		return nil
	}
	dst := make([]int, len(src))
	copy(dst, src)
	return dst
}

type groupAccumulator struct {
	count  int
	titles []TitleStat
}

func sortTitles(titles []TitleStat, weightCfg cfgpkg.WeightConfig) {
	sort.SliceStable(titles, func(i, j int) bool {
		wi := calculateNewsWeight(titles[i], weightCfg)
		wj := calculateNewsWeight(titles[j], weightCfg)

		if wi == wj {
			minRankI := minRank(titles[i].Ranks)
			minRankJ := minRank(titles[j].Ranks)
			if minRankI == minRankJ {
				if titles[i].Count == titles[j].Count {
					return titles[i].Title < titles[j].Title
				}
				return titles[i].Count > titles[j].Count
			}
			return minRankI < minRankJ
		}
		return wi > wj
	})
}

func calculateNewsWeight(stat TitleStat, weightCfg cfgpkg.WeightConfig) float64 {
	if len(stat.Ranks) == 0 {
		return 0
	}

	var rankScores float64
	for _, rank := range stat.Ranks {
		score := 11 - min(rank, 10)
		rankScores += float64(score)
	}
	rankWeight := rankScores / float64(len(stat.Ranks))

	frequencyWeight := float64(min(stat.Count, 10) * 10)

	var highRankCount float64
	for _, rank := range stat.Ranks {
		if rank <= stat.RankThreshold {
			highRankCount++
		}
	}
	hotnessRatio := highRankCount / float64(len(stat.Ranks))
	hotnessWeight := hotnessRatio * 100

	total := rankWeight*weightCfg.RankWeight +
		frequencyWeight*weightCfg.FrequencyWeight +
		hotnessWeight*weightCfg.HotnessWeight

	return total
}

func minRank(ranks []int) int {
	min := math.MaxInt32
	for _, r := range ranks {
		if r < min {
			min = r
		}
	}
	if min == math.MaxInt32 {
		return 999
	}
	return min
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
