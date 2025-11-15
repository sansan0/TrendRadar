package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadWithEnvOverrides(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yaml")

	content := `
app:
  version_check_url: "https://example.com/version"
  show_version_update: true
crawler:
  request_interval: 500
  enable_crawler: true
  use_proxy: false
  default_proxy: "http://localhost:1111"
report:
  mode: "daily"
  rank_threshold: 9
notification:
  enable_notification: true
  message_batch_size: 4000
  dingtalk_batch_size: 0
  feishu_batch_size: 0
  batch_send_interval: 3
  feishu_message_separator: "----"
  push_window:
    enabled: false
    time_range:
      start: "09:00"
      end: "18:00"
    once_per_day: true
    push_record_retention_days: 5
  webhooks:
    feishu_url: "cfg_feishu"
    ntfy_server_url: "https://custom.ntfy"
    ntfy_topic: "cfg-topic"
weight:
  rank_weight: 0.6
  frequency_weight: 0.3
  hotness_weight: 0.1
platforms:
  - id: "demo"
    name: "Demo"
`
	if err := os.WriteFile(configPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	t.Setenv("REPORT_MODE", "current")
	t.Setenv("ENABLE_CRAWLER", "false")
	t.Setenv("PUSH_WINDOW_ENABLED", "true")
	t.Setenv("PUSH_WINDOW_START", "10:00")
	t.Setenv("PUSH_WINDOW_RETENTION_DAYS", "30")
	t.Setenv("FEISHU_WEBHOOK_URL", "env_feishu")
	t.Setenv("NTFY_TOPIC", "env-topic")

	cfg, err := Load(configPath)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Report.Mode != "current" {
		t.Fatalf("report mode override failed, got %s", cfg.Report.Mode)
	}
	if cfg.Crawler.EnableCrawler {
		t.Fatalf("ENABLE_CRAWLER override failed, expected false")
	}
	if !cfg.Notification.PushWindow.Enabled {
		t.Fatalf("PUSH_WINDOW_ENABLED override failed")
	}
	if cfg.Notification.PushWindow.TimeRange.Start != "10:00" {
		t.Fatalf("push window start override failed, got %s", cfg.Notification.PushWindow.TimeRange.Start)
	}
	if cfg.Notification.PushWindow.RecordRetentionDays != 30 {
		t.Fatalf("retention override failed, got %d", cfg.Notification.PushWindow.RecordRetentionDays)
	}
	if cfg.Notification.Channels.FeishuWebhookURL != "env_feishu" {
		t.Fatalf("Feishu channel override failed, got %s", cfg.Notification.Channels.FeishuWebhookURL)
	}
	if cfg.Notification.Channels.NTFYTopic != "env-topic" {
		t.Fatalf("NTFY topic override failed, got %s", cfg.Notification.Channels.NTFYTopic)
	}
	if cfg.Notification.Channels.NTFYServerURL != "https://custom.ntfy" {
		t.Fatalf("NTFY server fallback failed, got %s", cfg.Notification.Channels.NTFYServerURL)
	}
	if cfg.SourcePath == "" {
		t.Fatalf("expected source path to be populated")
	}
}
