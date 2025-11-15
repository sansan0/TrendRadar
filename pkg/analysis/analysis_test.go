package analysis

import (
	"testing"

	cfgpkg "github.com/sansan0/TrendRadar/pkg/config"
	"github.com/sansan0/TrendRadar/pkg/keywords"
)

func TestCountWordFrequency_DefaultAllNews(t *testing.T) {
	results := map[string]map[string]*NewsEntry{
		"weibo": {
			"AI 新闻": {
				Ranks: []int{2},
				URL:   "https://example.com",
			},
		},
	}

	opts := CountOptions{
		Results:       results,
		WordList:      nil,
		SourceNames:   map[string]string{"weibo": "微博"},
		RankThreshold: 5,
		Mode:          ModeDaily,
		IsFirstCrawl:  true,
		Weight: cfgpkg.WeightConfig{
			RankWeight:      0.6,
			FrequencyWeight: 0.3,
			HotnessWeight:   0.1,
		},
	}

	stats, total := CountWordFrequency(opts)
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(stats) != 1 || len(stats[0].Titles) != 1 {
		t.Fatalf("unexpected stats %+v", stats)
	}
	if stats[0].Titles[0].SourceName != "微博" {
		t.Fatalf("expected source name 微博, got %s", stats[0].Titles[0].SourceName)
	}
}

func TestCountWordFrequency_FilterAndNew(t *testing.T) {
	wordList := keywords.DefaultAllNews()
	wordList.FilterWords = []string{"屏蔽"}
	wordList.Rebuild()

	results := map[string]map[string]*NewsEntry{
		"zhihu": {
			"有效标题": {Ranks: []int{1}},
			"需要屏蔽": {Ranks: []int{3}},
		},
	}
	newTitles := map[string]map[string]*NewsEntry{
		"zhihu": {
			"有效标题": {Ranks: []int{1}},
		},
	}

	opts := CountOptions{
		Results:       results,
		WordList:      wordList,
		SourceNames:   map[string]string{"zhihu": "知乎"},
		RankThreshold: 5,
		NewTitles:     newTitles,
		Mode:          ModeIncremental,
		IsFirstCrawl:  false,
		Weight: cfgpkg.WeightConfig{
			RankWeight:      0.6,
			FrequencyWeight: 0.3,
			HotnessWeight:   0.1,
		},
	}

	stats, total := CountWordFrequency(opts)
	if total != 1 {
		t.Fatalf("expected total titles 1, got %d", total)
	}
	if len(stats) != 1 || len(stats[0].Titles) != 1 {
		t.Fatalf("unexpected stats %+v", stats)
	}
	if !stats[0].Titles[0].IsNew {
		t.Fatalf("expected title marked as new")
	}
	if stats[0].Titles[0].Title != "有效标题" {
		t.Fatalf("expected 有效标题, got %s", stats[0].Titles[0].Title)
	}
}

func TestCountWordFrequency_CurrentModeUsesLatest(t *testing.T) {
	wordList := keywords.DefaultAllNews()

	results := map[string]map[string]*NewsEntry{
		"weibo": {
			"标题A": {Ranks: []int{1}},
			"标题B": {Ranks: []int{2}},
		},
	}

	titleInfo := map[string]map[string]*NewsEntry{
		"weibo": {
			"标题A": {LastTime: "2025-01-01 10:00", Ranks: []int{1}},
			"标题B": {LastTime: "2025-01-01 11:00", Ranks: []int{2}},
		},
	}

	opts := CountOptions{
		Results:       results,
		WordList:      wordList,
		SourceNames:   map[string]string{"weibo": "微博"},
		TitleInfo:     titleInfo,
		RankThreshold: 5,
		Mode:          ModeCurrent,
		IsFirstCrawl:  false,
		Weight: cfgpkg.WeightConfig{
			RankWeight:      0.6,
			FrequencyWeight: 0.3,
			HotnessWeight:   0.1,
		},
	}

	stats, total := CountWordFrequency(opts)
	if total != 1 {
		t.Fatalf("expected total 1 after filtering latest, got %d", total)
	}
	if len(stats) != 1 || len(stats[0].Titles) != 1 {
		t.Fatalf("unexpected stats %+v", stats)
	}
	if stats[0].Titles[0].Title != "标题B" {
		t.Fatalf("expected latest title B, got %s", stats[0].Titles[0].Title)
	}
}
