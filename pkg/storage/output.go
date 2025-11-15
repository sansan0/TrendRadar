package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/sansan0/TrendRadar/pkg/crawler"
)

var beijing *time.Location

func init() {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	beijing = loc
}

// Writer 负责将抓取结果输出到 output/ 日期目录。
type Writer struct {
	BaseDir string
}

func NewWriter(base string) *Writer {
	if base == "" {
		base = "output"
	}
	return &Writer{BaseDir: base}
}

// SaveTitlesToFile 复制 Python save_titles_to_file 的格式，返回写入的绝对路径。
func (w *Writer) SaveTitlesToFile(result *crawler.CrawlOutput) (string, error) {
	if result == nil {
		return "", fmt.Errorf("result 为空")
	}

	dateFolder := time.Now().In(beijing).Format("2006年01月02日")
	timeFile := time.Now().In(beijing).Format("15时04分")

	outputDir := filepath.Join(w.BaseDir, dateFolder, "txt")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", fmt.Errorf("创建目录失败: %w", err)
	}

	filePath := filepath.Join(outputDir, fmt.Sprintf("%s.txt", timeFile))
	file, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	ids := make([]string, 0, len(result.Results))
	for id := range result.Results {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	for _, id := range ids {
		titles := result.Results[id]
		name := result.IDToName[id]
		if name != "" && name != id {
			fmt.Fprintf(file, "%s | %s\n", id, name)
		} else {
			fmt.Fprintf(file, "%s\n", id)
		}

		type titleLine struct {
			Rank      int
			Title     string
			URL       string
			MobileURL string
		}

		lines := make([]titleLine, 0, len(titles))
		for title, info := range titles {
			rank := 1
			if len(info.Ranks) > 0 {
				rank = info.Ranks[0]
			}
			lines = append(lines, titleLine{
				Rank:      rank,
				Title:     cleanTitle(title),
				URL:       info.URL,
				MobileURL: info.MobileURL,
			})
		}

		sort.Slice(lines, func(i, j int) bool {
			if lines[i].Rank == lines[j].Rank {
				return lines[i].Title < lines[j].Title
			}
			return lines[i].Rank < lines[j].Rank
		})

		for _, line := range lines {
			record := fmt.Sprintf("%d. %s", line.Rank, line.Title)
			if line.URL != "" {
				record += fmt.Sprintf(" [URL:%s]", line.URL)
			}
			if line.MobileURL != "" {
				record += fmt.Sprintf(" [MOBILE:%s]", line.MobileURL)
			}
			record += "\n"
			if _, err := file.WriteString(record); err != nil {
				return "", err
			}
		}

		if _, err := file.WriteString("\n"); err != nil {
			return "", err
		}
	}

	if len(result.FailedIDs) > 0 {
		if _, err := file.WriteString("==== 以下ID请求失败 ====\n"); err != nil {
			return "", err
		}
		for _, id := range result.FailedIDs {
			if _, err := file.WriteString(id + "\n"); err != nil {
				return "", err
			}
		}
	}

	return filepath.Abs(filePath)
}

func cleanTitle(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	return strings.TrimSpace(s)
}
