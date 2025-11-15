package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sansan0/TrendRadar/go/pkg/crawler"
)

func TestWriterSaveTitlesToFile(t *testing.T) {
	tmp := t.TempDir()
	writer := NewWriter(tmp)

	result := &crawler.CrawlOutput{
		Results: map[string]map[string]*crawler.TitleInfo{
			"toutiao": {
				"Breaking News\n": {
					Ranks:     []int{1},
					URL:       "https://example.com",
					MobileURL: "https://m.example.com",
				},
				"Another Title": {
					Ranks: []int{2},
				},
			},
		},
		IDToName: map[string]string{
			"toutiao": "今日头条",
		},
		FailedIDs: []string{"fail-id"},
	}

	path, err := writer.SaveTitlesToFile(result)
	if err != nil {
		t.Fatalf("SaveTitlesToFile error = %v", err)
	}

	tmpAbs, err := filepath.Abs(tmp)
	if err != nil {
		t.Fatalf("Abs temp dir error = %v", err)
	}

	if !strings.HasPrefix(path, tmpAbs) {
		t.Fatalf("expected file within temp dir, got %s", path)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile error = %v", err)
	}

	expected := "" +
		"toutiao | 今日头条\n" +
		"1. Breaking News [URL:https://example.com] [MOBILE:https://m.example.com]\n" +
		"2. Another Title\n\n" +
		"==== 以下ID请求失败 ====\n" +
		"fail-id\n"

	if string(content) != expected {
		t.Fatalf("unexpected file content:\n--- got ---\n%s\n--- want ---\n%s", string(content), expected)
	}
}
