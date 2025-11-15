package analysis

import (
	cfgpkg "github.com/sansan0/TrendRadar/go/pkg/config"
	"github.com/sansan0/TrendRadar/go/pkg/keywords"
)

// Mode 定义统计模式。
type Mode string

const (
	ModeDaily       Mode = "daily"
	ModeIncremental Mode = "incremental"
	ModeCurrent     Mode = "current"
)

// NewsEntry 表示单条新闻及其元数据。
type NewsEntry struct {
	Ranks     []int
	URL       string
	MobileURL string
	FirstTime string
	LastTime  string
	Count     int
}

// TitleStat 为报告提供的结构化数据。
type TitleStat struct {
	Title         string
	SourceID      string
	SourceName    string
	TimeDisplay   string
	Count         int
	Ranks         []int
	RankThreshold int
	URL           string
	MobileURL     string
	IsNew         bool
}

// GroupStat 汇总同一个词组匹配的统计信息。
type GroupStat struct {
	Word       string
	Count      int
	Percentage float64
	Titles     []TitleStat
}

// CountOptions 控制词频统计行为。
type CountOptions struct {
	Results       map[string]map[string]*NewsEntry
	WordList      *keywords.List
	SourceNames   map[string]string
	TitleInfo     map[string]map[string]*NewsEntry
	RankThreshold int
	NewTitles     map[string]map[string]*NewsEntry
	Mode          Mode
	IsFirstCrawl  bool
	Weight        cfgpkg.WeightConfig
}
