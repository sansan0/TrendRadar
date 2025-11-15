package crawler

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	cfgpkg "github.com/sansan0/TrendRadar/pkg/config"
)

func TestFetcherCrawlPlatforms(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/s" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}

		id := r.URL.Query().Get("id")
		switch id {
		case "ok":
			fmt.Fprintln(w, `{"status":"success","items":[{"title":"Hello","url":"https://a","mobileUrl":"https://ma"}]}`)
		case "dup":
			fmt.Fprintln(w, `{"status":"success","items":[{"title":"Same","url":"https://a"},{"title":"Same","url":"https://b"}]}`)
		default:
			http.Error(w, "error", http.StatusInternalServerError)
		}
	}))
	defer server.Close()

	cfg := &cfgpkg.Config{
		Crawler: cfgpkg.CrawlerConfig{
			RequestInterval: 0,
			EnableCrawler:   true,
			UseProxy:        false,
		},
		Platforms: []cfgpkg.PlatformConfig{
			{ID: "ok", Name: "OK"},
			{ID: "dup", Name: "Duplicate"},
			{ID: "fail", Name: "Fail"},
		},
	}

	fetcher, err := newFetcherWithBaseURL(cfg, server.URL)
	if err != nil {
		t.Fatalf("newFetcherWithBaseURL error = %v", err)
	}

	ctx := context.Background()
	result, err := fetcher.CrawlPlatforms(ctx, cfg.Platforms)
	if err != nil {
		t.Fatalf("CrawlPlatforms error = %v", err)
	}

	if len(result.Results) != 2 {
		t.Fatalf("expected 2 successful platforms, got %d", len(result.Results))
	}

	if got := result.IDToName["ok"]; got != "OK" {
		t.Fatalf("id to name mismatch, got %s", got)
	}

	dupInfo := result.Results["dup"]["Same"]
	if dupInfo == nil || len(dupInfo.Ranks) != 2 {
		t.Fatalf("expected duplicate title to merge ranks, got %#v", dupInfo)
	}

	if len(result.FailedIDs) != 1 || result.FailedIDs[0] != "fail" {
		t.Fatalf("expected failed ids [fail], got %v", result.FailedIDs)
	}
}
