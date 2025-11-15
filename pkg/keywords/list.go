package keywords

import (
	"fmt"
	"os"
	"strings"
)

// Group 表示一个频率词组。
type Group struct {
	Key      string
	Required []string
	Normal   []string

	requiredLower []string
	normalLower   []string
}

// List 包含所有词组以及全局过滤词。
type List struct {
	Groups      []Group
	FilterWords []string

	filterLower []string
}

// Load 从文件读取频率词配置。
func Load(path string) (*List, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return parse(string(data)), nil
}

// DefaultAllNews 返回一个显示全部新闻的词组列表。
func DefaultAllNews() *List {
	l := &List{
		Groups: []Group{
			{Key: "全部新闻"},
		},
	}
	l.buildCaches()
	return l
}

// Len 返回词组数量。
func (l *List) Len() int {
	if l == nil {
		return 0
	}
	return len(l.Groups)
}

// Rebuild 重新构建内部缓存（当外部修改 Groups 或 FilterWords 时调用）。
func (l *List) Rebuild() {
	l.buildCaches()
}

// Match 返回标题是否匹配词组以及对应的 Group。
func (l *List) Match(title string) (*Group, bool) {
	if l == nil {
		return nil, false
	}

	if len(l.filterLower) == 0 && len(l.Groups) == 0 {
		return nil, true
	}

	titleLower := strings.ToLower(title)
	for _, fw := range l.filterLower {
		if fw != "" && strings.Contains(titleLower, fw) {
			return nil, false
		}
	}

	for i := range l.Groups {
		if l.Groups[i].matches(titleLower) {
			return &l.Groups[i], true
		}
	}

	return nil, false
}

// IsAllNews 检查是否为显示全部新闻的模式。
func (l *List) IsAllNews() bool {
	if l == nil || len(l.Groups) != 1 {
		return false
	}
	g := l.Groups[0]
	return g.Key == "全部新闻" && len(g.Required) == 0 && len(g.Normal) == 0
}

func (g *Group) matches(titleLower string) bool {
	if g == nil {
		return true
	}

	if len(g.requiredLower) > 0 {
		for _, req := range g.requiredLower {
			if !strings.Contains(titleLower, req) {
				return false
			}
		}
	}

	if len(g.normalLower) > 0 {
		for _, word := range g.normalLower {
			if strings.Contains(titleLower, word) {
				return true
			}
		}
		return false
	}

	return true
}

func parse(content string) *List {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	blocks := strings.Split(normalized, "\n\n")

	var groups []Group
	var filters []string

	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}

		lines := strings.Split(block, "\n")
		var required []string
		var normal []string

		for _, line := range lines {
			word := strings.TrimSpace(line)
			if word == "" || strings.HasPrefix(word, "#") {
				continue
			}

			switch {
			case strings.HasPrefix(word, "!"):
				filter := strings.TrimSpace(word[1:])
				if filter != "" {
					filters = append(filters, filter)
				}
			case strings.HasPrefix(word, "+"):
				req := strings.TrimSpace(word[1:])
				if req != "" {
					required = append(required, req)
				}
			default:
				normal = append(normal, word)
			}
		}

		if len(required) == 0 && len(normal) == 0 {
			continue
		}

		key := strings.Join(normal, " ")
		if key == "" {
			key = strings.Join(required, " ")
		}
		if key == "" {
			key = fmt.Sprintf("group-%d", len(groups)+1)
		}

		groups = append(groups, Group{
			Key:      key,
			Required: required,
			Normal:   normal,
		})
	}

	list := &List{
		Groups:      groups,
		FilterWords: filters,
	}
	list.buildCaches()
	return list
}

func (l *List) buildCaches() {
	if l == nil {
		return
	}

	l.filterLower = make([]string, len(l.FilterWords))
	for i, fw := range l.FilterWords {
		l.filterLower[i] = strings.ToLower(strings.TrimSpace(fw))
	}

	for i := range l.Groups {
		g := &l.Groups[i]
		g.requiredLower = toLowerSlice(g.Required)
		g.normalLower = toLowerSlice(g.Normal)
	}
}

func toLowerSlice(items []string) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		result = append(result, strings.ToLower(item))
	}
	return result
}
