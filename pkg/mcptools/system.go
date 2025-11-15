package mcptools

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/sansan0/TrendRadar/pkg/app"
	"github.com/sansan0/TrendRadar/pkg/crawler"
	"github.com/sansan0/TrendRadar/pkg/storage"
)

type TriggerArgs struct {
	Platforms   []string `json:"platforms"`
	SaveToLocal bool     `json:"save_to_local"`
	IncludeURL  bool     `json:"include_url"`
}

func GetSystemStatus(env *app.Environment) (map[string]interface{}, error) {
	outputDir := env.OutputDir
	info, err := os.Stat(outputDir)
	if err != nil {
		return map[string]interface{}{
			"output_dir": outputDir,
			"exists":     false,
		}, nil
	}

	files := 0
	var lastFile string
	var lastMod time.Time

	filepath.WalkDir(outputDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(d.Name()) == ".txt" {
			files++
			fi, err := d.Info()
			if err == nil && fi.ModTime().After(lastMod) {
				lastMod = fi.ModTime()
				lastFile = path
			}
		}
		return nil
	})

	return map[string]interface{}{
		"output_dir": outputDir,
		"exists":     true,
		"modified":   info.ModTime().Format(time.RFC3339),
		"text_files": files,
		"last_file":  lastFile,
		"config": map[string]interface{}{
			"platforms": len(env.Config.Platforms),
			"report":    env.Config.Report.Mode,
		},
	}, nil
}

func TriggerCrawl(env *app.Environment, args TriggerArgs) (map[string]interface{}, error) {
	fetcher, err := crawler.NewFetcher(env.Config)
	if err != nil {
		return nil, err
	}

	platforms := env.ResolvePlatforms(args.Platforms)
	ctx := context.Background()
	result, err := fetcher.CrawlPlatforms(ctx, env.Config.Platforms)
	if err != nil {
		return nil, err
	}

	var filePath string
	if args.SaveToLocal {
		writer := storage.NewWriter(env.OutputDir)
		filePath, err = writer.SaveTitlesToFile(result)
		if err != nil {
			return nil, err
		}
	}

	items := []map[string]interface{}{}
	total := 0
	if args.IncludeURL {
		for platformID, titles := range result.Results {
			for title, info := range titles {
				total++
				items = append(items, map[string]interface{}{
					"title":    title,
					"platform": platformID,
					"ranks":    info.Ranks,
					"url":      info.URL,
					"mobile":   info.MobileURL,
				})
			}
		}
	}

	return map[string]interface{}{
		"platforms":        platforms,
		"failed_platforms": result.FailedIDs,
		"saved_file":       filePath,
		"total_news":       total,
		"items":            items,
	}, nil
}
