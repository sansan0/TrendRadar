package keywords

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadAndMatch(t *testing.T) {
	content := `
火星
登月

+必需
科技

!广告
`
	dir := t.TempDir()
	path := filepath.Join(dir, "words.txt")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file error = %v", err)
	}

	list, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if list.Len() != 2 {
		t.Fatalf("expected 2 groups, got %d", list.Len())
	}

	group, ok := list.Match("火星计划发射成功")
	if !ok || group.Key != "火星 登月" {
		t.Fatalf("match failed for 火星，group=%v", group)
	}

	if _, ok := list.Match("这是一个广告"); ok {
		t.Fatalf("filter word should block title")
	}

	if _, ok := list.Match("必需 科技 快讯"); !ok {
		t.Fatalf("required+normal words should match")
	}
}

func TestDefaultAllNews(t *testing.T) {
	list := DefaultAllNews()
	if !list.IsAllNews() {
		t.Fatalf("expected default list to be all news")
	}

	if _, ok := list.Match("任意标题"); !ok {
		t.Fatalf("default list should match all")
	}
}
