package parser

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParseFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.txt")
	content := "" +
		"weibo | 微博\n" +
		"1. 标题一 [URL:https://a] [MOBILE:https://ma]\n" +
		"2. 标题一 [URL:https://b]\n" +
		"\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file error = %v", err)
	}

	titles, idToName, err := ParseFile(path)
	if err != nil {
		t.Fatalf("ParseFile error = %v", err)
	}

	if idToName["weibo"] != "微博" {
		t.Fatalf("expected name 微博, got %s", idToName["weibo"])
	}

	info := titles["weibo"]["标题一"]
	if len(info.Ranks) != 2 || info.URL != "https://a" || info.MobileURL != "https://ma" {
		t.Fatalf("unexpected parsed info %#v", info)
	}
}

func TestReadAllTitlesAggregates(t *testing.T) {
	dir := t.TempDir()
	p := New(dir)
	date := time.Date(2025, 1, 2, 0, 0, 0, 0, beijing)
	dateFolder := p.dateFolder(date)
	txtDir := filepath.Join(dir, dateFolder, "txt")
	if err := os.MkdirAll(txtDir, 0o755); err != nil {
		t.Fatalf("mkdir error = %v", err)
	}

	writeTxt := func(name, content string) {
		if err := os.WriteFile(filepath.Join(txtDir, name), []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	writeTxt("10时00分.txt", ""+
		"weibo | 微博\n"+
		"1. 标题A\n"+
		"\n")
	writeTxt("11时00分.txt", ""+
		"weibo | 微博\n"+
		"1. 标题A\n"+
		"2. 标题B [URL:https://b]\n"+
		"\n")

	res, err := p.ReadAllTitles(date, nil)
	if err != nil {
		t.Fatalf("ReadAllTitles error = %v", err)
	}

	if len(res.Titles["weibo"]) != 2 {
		t.Fatalf("expected 2 titles, got %d", len(res.Titles["weibo"]))
	}

	info := res.TitleInfo["weibo"]["标题A"]
	if info.Count != 2 || info.FirstTime != "10时00分" || info.LastTime != "11时00分" {
		t.Fatalf("unexpected title info %#v", info)
	}
}

func TestDetectLatestNewTitles(t *testing.T) {
	dir := t.TempDir()
	p := New(dir)
	dateFolder := p.dateFolder(time.Time{})
	txtDir := filepath.Join(dir, dateFolder, "txt")
	if err := os.MkdirAll(txtDir, 0o755); err != nil {
		t.Fatalf("mkdir error = %v", err)
	}

	writeTxt := func(name, content string) {
		if err := os.WriteFile(filepath.Join(txtDir, name), []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	writeTxt("10时00分.txt", ""+
		"weibo\n"+
		"1. 标题A\n"+
		"\n")
	writeTxt("11时00分.txt", ""+
		"weibo\n"+
		"1. 标题A\n"+
		"2. 标题C\n"+
		"\n")

	news, err := p.DetectLatestNewTitles(nil)
	if err != nil {
		t.Fatalf("DetectLatestNewTitles error = %v", err)
	}

	if _, ok := news["weibo"]["标题C"]; !ok {
		t.Fatalf("expected 标题C as new, got %v", news)
	}
	if len(news["weibo"]) != 1 {
		t.Fatalf("expected only one new title, got %d", len(news["weibo"]))
	}
}
