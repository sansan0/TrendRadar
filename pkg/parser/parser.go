package parser

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/pkg/analysis"
)

var beijing *time.Location

func init() {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	beijing = loc
}

// Parser 负责解析 output 目录下的 txt 数据文件。
type Parser struct {
	RootDir string
}

func New(root string) *Parser {
	if strings.TrimSpace(root) == "" {
		root = "output"
	}
	return &Parser{RootDir: root}
}

// AllTitlesResult 集合 read 操作结果。
type AllTitlesResult struct {
	Titles     map[string]map[string]*analysis.NewsEntry
	SourceName map[string]string
	Timestamps map[string]time.Time
	TitleInfo  map[string]map[string]*analysis.NewsEntry
}

// ReadAllTitles 读取指定日期（默认今日）的所有 txt 文件。
func (p *Parser) ReadAllTitles(date time.Time, platformIDs []string) (*AllTitlesResult, error) {
	folder := p.dateFolder(date)
	txtDir := filepath.Join(p.RootDir, folder, "txt")

	entries, err := os.ReadDir(txtDir)
	if err != nil {
		return nil, fmt.Errorf("读取目录失败 %s: %w", txtDir, err)
	}

	txtFiles := filterTxt(entries)
	if len(txtFiles) == 0 {
		return nil, fmt.Errorf("%s 没有数据文件", txtDir)
	}

	platformFilter := toSet(platformIDs)
	result := &AllTitlesResult{
		Titles:     make(map[string]map[string]*analysis.NewsEntry),
		SourceName: make(map[string]string),
		Timestamps: make(map[string]time.Time),
		TitleInfo:  make(map[string]map[string]*analysis.NewsEntry),
	}

	for _, name := range txtFiles {
		fullPath := filepath.Join(txtDir, name)
		titles, idToName, err := ParseFile(fullPath)
		if err != nil {
			fmt.Printf("Warning: 解析 %s 失败: %v\n", fullPath, err)
			continue
		}

		for k, v := range idToName {
			result.SourceName[k] = v
		}

		filtered := filterPlatforms(titles, platformFilter)

		for sourceID, sourceTitles := range filtered {
			for title, info := range sourceTitles {
				processSourceData(sourceID, title, info, strings.TrimSuffix(name, filepath.Ext(name)), result)
			}
		}

		info, err := os.Stat(fullPath)
		if err == nil {
			result.Timestamps[name] = info.ModTime()
		}
	}

	if len(result.Titles) == 0 {
		return nil, errors.New("没有有效的数据")
	}

	return result, nil
}

// DetectLatestNewTitles 返回最新文件相对于历史文件的新增标题。
func (p *Parser) DetectLatestNewTitles(platformIDs []string) (map[string]map[string]*analysis.NewsEntry, error) {
	folder := p.dateFolder(time.Time{})
	txtDir := filepath.Join(p.RootDir, folder, "txt")

	entries, err := os.ReadDir(txtDir)
	if err != nil {
		return nil, fmt.Errorf("读取目录失败 %s: %w", txtDir, err)
	}

	txtFiles := filterTxt(entries)
	if len(txtFiles) < 2 {
		return map[string]map[string]*analysis.NewsEntry{}, nil
	}

	latestPath := filepath.Join(txtDir, txtFiles[len(txtFiles)-1])
	latestTitles, _, err := ParseFile(latestPath)
	if err != nil {
		return nil, err
	}

	filter := toSet(platformIDs)
	latestTitles = filterPlatforms(latestTitles, filter)

	historical := make(map[string]map[string]struct{})
	for _, name := range txtFiles[:len(txtFiles)-1] {
		path := filepath.Join(txtDir, name)
		titles, _, err := ParseFile(path)
		if err != nil {
			continue
		}
		titles = filterPlatforms(titles, filter)
		for sourceID, sourceTitles := range titles {
			if _, ok := historical[sourceID]; !ok {
				historical[sourceID] = make(map[string]struct{})
			}
			for title := range sourceTitles {
				historical[sourceID][title] = struct{}{}
			}
		}
	}

	newTitles := make(map[string]map[string]*analysis.NewsEntry)
	for sourceID, titles := range latestTitles {
		histSet := historical[sourceID]
		for title, info := range titles {
			if _, exists := histSet[title]; exists {
				continue
			}
			if _, ok := newTitles[sourceID]; !ok {
				newTitles[sourceID] = make(map[string]*analysis.NewsEntry)
			}
			newTitles[sourceID][title] = info
		}
	}
	return newTitles, nil
}

// ParseFile 解析单个 txt 文件。
func ParseFile(path string) (map[string]map[string]*analysis.NewsEntry, map[string]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()

	titles := make(map[string]map[string]*analysis.NewsEntry)
	idToName := make(map[string]string)

	scanner := bufio.NewScanner(file)
	var currentID string

	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		raw := strings.TrimSpace(line)

		if raw == "" {
			currentID = ""
			continue
		}
		if strings.HasPrefix(raw, "====") {
			currentID = ""
			continue
		}

		if currentID == "" {
			sourceID, name := parseHeader(raw)
			if sourceID == "" {
				continue
			}
			currentID = sourceID
			if _, ok := titles[sourceID]; !ok {
				titles[sourceID] = make(map[string]*analysis.NewsEntry)
			}
			if name == "" {
				name = sourceID
			}
			idToName[sourceID] = name
			continue
		}

		entry, err := parseTitleLine(raw)
		if err != nil {
			continue
		}
		if entry.Title == "" {
			continue
		}

		if _, ok := titles[currentID][entry.Title]; !ok {
			titles[currentID][entry.Title] = &analysis.NewsEntry{
				Ranks:     []int{entry.Rank},
				URL:       entry.URL,
				MobileURL: entry.MobileURL,
			}
		} else {
			info := titles[currentID][entry.Title]
			info.Ranks = append(info.Ranks, entry.Rank)
			if info.URL == "" {
				info.URL = entry.URL
			}
			if info.MobileURL == "" {
				info.MobileURL = entry.MobileURL
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, nil, err
	}

	return titles, idToName, nil
}

func (p *Parser) dateFolder(t time.Time) string {
	if t.IsZero() {
		t = time.Now().In(beijing)
	} else {
		t = t.In(beijing)
	}
	return t.Format("2006年01月02日")
}

func filterTxt(entries []os.DirEntry) []string {
	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(strings.ToLower(name), ".txt") {
			files = append(files, name)
		}
	}
	sort.Strings(files)
	return files
}

func toSet(ids []string) map[string]struct{} {
	if len(ids) == 0 {
		return nil
	}
	set := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id != "" {
			set[id] = struct{}{}
		}
	}
	return set
}

func filterPlatforms(src map[string]map[string]*analysis.NewsEntry, filter map[string]struct{}) map[string]map[string]*analysis.NewsEntry {
	if filter == nil {
		return src
	}
	result := make(map[string]map[string]*analysis.NewsEntry)
	for id, titles := range src {
		if _, ok := filter[id]; ok {
			result[id] = titles
		}
	}
	return result
}

type parsedTitle struct {
	Rank      int
	Title     string
	URL       string
	MobileURL string
}

func parseHeader(line string) (id string, name string) {
	if strings.Contains(line, "|") {
		parts := strings.SplitN(line, "|", 2)
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(line), strings.TrimSpace(line)
}

func parseTitleLine(line string) (*parsedTitle, error) {
	rank := 1
	remainder := strings.TrimSpace(line)

	if idx := strings.Index(remainder, ". "); idx > 0 {
		if n, err := strconv.Atoi(strings.TrimSpace(remainder[:idx])); err == nil {
			rank = n
			remainder = remainder[idx+2:]
		}
	}

	trimmed, mobile := extractTag(remainder, "[MOBILE:")
	trimmed, url := extractTag(trimmed, "[URL:")

	title := cleanTitle(strings.TrimSpace(trimmed))
	return &parsedTitle{
		Rank:      rank,
		Title:     title,
		URL:       strings.TrimSpace(url),
		MobileURL: strings.TrimSpace(mobile),
	}, nil
}

func extractTag(s, token string) (string, string) {
	idx := strings.LastIndex(s, token)
	if idx == -1 {
		return s, ""
	}
	value := s[idx+len(token):]
	if !strings.HasSuffix(value, "]") {
		return s, ""
	}
	value = strings.TrimSuffix(value, "]")
	return strings.TrimSpace(s[:idx]), strings.TrimSpace(value)
}

func cleanTitle(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	return strings.TrimSpace(s)
}

func processSourceData(sourceID, title string, data *analysis.NewsEntry, timeInfo string, result *AllTitlesResult) {
	if _, ok := result.Titles[sourceID]; !ok {
		result.Titles[sourceID] = make(map[string]*analysis.NewsEntry)
	}
	if _, ok := result.TitleInfo[sourceID]; !ok {
		result.TitleInfo[sourceID] = make(map[string]*analysis.NewsEntry)
	}

	if existing, ok := result.Titles[sourceID][title]; !ok {
		result.Titles[sourceID][title] = cloneEntry(data)
		result.TitleInfo[sourceID][title] = &analysis.NewsEntry{
			Ranks:     cloneInts(data.Ranks),
			URL:       data.URL,
			MobileURL: data.MobileURL,
			FirstTime: timeInfo,
			LastTime:  timeInfo,
			Count:     1,
		}
	} else {
		result.Titles[sourceID][title] = mergeEntries(existing, data)
		info := result.TitleInfo[sourceID][title]
		info.LastTime = timeInfo
		info.Count++
		info.Ranks = mergeRanks(info.Ranks, data.Ranks)
		if info.URL == "" {
			info.URL = data.URL
		}
		if info.MobileURL == "" {
			info.MobileURL = data.MobileURL
		}
	}
}

func cloneEntry(e *analysis.NewsEntry) *analysis.NewsEntry {
	if e == nil {
		return &analysis.NewsEntry{}
	}
	return &analysis.NewsEntry{
		Ranks:     cloneInts(e.Ranks),
		URL:       e.URL,
		MobileURL: e.MobileURL,
		Count:     e.Count,
		FirstTime: e.FirstTime,
		LastTime:  e.LastTime,
	}
}

func mergeEntries(existing, incoming *analysis.NewsEntry) *analysis.NewsEntry {
	out := &analysis.NewsEntry{
		Ranks:     mergeRanks(existing.Ranks, incoming.Ranks),
		URL:       pickFirst(existing.URL, incoming.URL),
		MobileURL: pickFirst(existing.MobileURL, incoming.MobileURL),
		Count:     existing.Count + max(incoming.Count, len(incoming.Ranks)),
		FirstTime: pickFirst(existing.FirstTime, incoming.FirstTime),
		LastTime:  pickLast(existing.LastTime, incoming.LastTime),
	}
	return out
}

func mergeRanks(a, b []int) []int {
	set := make(map[int]struct{}, len(a)+len(b))
	var merged []int
	for _, value := range append(a, b...) {
		if _, ok := set[value]; ok {
			continue
		}
		set[value] = struct{}{}
		merged = append(merged, value)
	}
	sort.Ints(merged)
	return merged
}

func cloneInts(src []int) []int {
	if len(src) == 0 {
		return nil
	}
	dst := make([]int, len(src))
	copy(dst, src)
	return dst
}

func pickFirst(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return strings.TrimSpace(b)
}

func pickLast(a, b string) string {
	if strings.TrimSpace(b) != "" {
		return b
	}
	return strings.TrimSpace(a)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
