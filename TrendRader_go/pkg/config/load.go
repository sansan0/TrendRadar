package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	defaultConfigPath = "config/config.yaml"
	defaultNTFYServer = "https://ntfy.sh"
	defaultStartHour  = "08:00"
	defaultEndHour    = "22:00"
)

// Load 解析 YAML 配置，并应用环境变量覆盖。
// path 为空时优先读取 CONFIG_PATH，其次退回至 config/config.yaml。
func Load(path string) (*Config, error) {
	if strings.TrimSpace(path) == "" {
		path = strings.TrimSpace(os.Getenv("CONFIG_PATH"))
	}
	if path == "" {
		path = defaultConfigPath
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(content, &cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	cfg.SourcePath = abs
	applyDefaults(&cfg)

	if err := applyEnvOverrides(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func applyDefaults(cfg *Config) {
	if cfg.Notification.DingtalkBatchSize == 0 {
		cfg.Notification.DingtalkBatchSize = 20000
	}
	if cfg.Notification.FeishuBatchSize == 0 {
		cfg.Notification.FeishuBatchSize = 29000
	}
	if cfg.Notification.PushWindow.TimeRange.Start == "" {
		cfg.Notification.PushWindow.TimeRange.Start = defaultStartHour
	}
	if cfg.Notification.PushWindow.TimeRange.End == "" {
		cfg.Notification.PushWindow.TimeRange.End = defaultEndHour
	}
	if cfg.Notification.PushWindow.RecordRetentionDays == 0 {
		cfg.Notification.PushWindow.RecordRetentionDays = 7
	}
}

func applyEnvOverrides(cfg *Config) error {
	if val, ok := lookupEnvTrimmed("REPORT_MODE"); ok && val != "" {
		cfg.Report.Mode = val
	}
	if val, ok := lookupEnvTrimmed("ENABLE_CRAWLER"); ok && val != "" {
		cfg.Crawler.EnableCrawler = parseBool(val)
	}
	if val, ok := lookupEnvTrimmed("ENABLE_NOTIFICATION"); ok && val != "" {
		cfg.Notification.EnableNotification = parseBool(val)
	}
	if val, ok := lookupEnvTrimmed("PUSH_WINDOW_ENABLED"); ok && val != "" {
		cfg.Notification.PushWindow.Enabled = parseBool(val)
	}
	if val, ok := lookupEnvTrimmed("PUSH_WINDOW_START"); ok && val != "" {
		cfg.Notification.PushWindow.TimeRange.Start = val
	}
	if val, ok := lookupEnvTrimmed("PUSH_WINDOW_END"); ok && val != "" {
		cfg.Notification.PushWindow.TimeRange.End = val
	}
	if val, ok := lookupEnvTrimmed("PUSH_WINDOW_ONCE_PER_DAY"); ok && val != "" {
		cfg.Notification.PushWindow.OncePerDay = parseBool(val)
	}
	if val, ok := lookupEnvTrimmed("PUSH_WINDOW_RETENTION_DAYS"); ok {
		if strings.TrimSpace(val) != "" {
			days, err := strconv.Atoi(val)
			if err != nil {
				return fmt.Errorf("解析 PUSH_WINDOW_RETENTION_DAYS 失败: %w", err)
			}
			if days != 0 {
				cfg.Notification.PushWindow.RecordRetentionDays = days
			}
		}
	}

	applyChannelOverrides(cfg)
	return nil
}

func applyChannelOverrides(cfg *Config) {
	channels := ChannelConfig{
		FeishuWebhookURL:   pickNonEmpty(os.Getenv("FEISHU_WEBHOOK_URL"), cfg.Notification.Webhooks.FeishuURL),
		DingtalkWebhookURL: pickNonEmpty(os.Getenv("DINGTALK_WEBHOOK_URL"), cfg.Notification.Webhooks.DingtalkURL),
		WeworkWebhookURL:   pickNonEmpty(os.Getenv("WEWORK_WEBHOOK_URL"), cfg.Notification.Webhooks.WeworkURL),
		TelegramBotToken:   pickNonEmpty(os.Getenv("TELEGRAM_BOT_TOKEN"), cfg.Notification.Webhooks.TelegramBotToken),
		TelegramChatID:     pickNonEmpty(os.Getenv("TELEGRAM_CHAT_ID"), cfg.Notification.Webhooks.TelegramChatID),
		EmailFrom:          pickNonEmpty(os.Getenv("EMAIL_FROM"), cfg.Notification.Webhooks.EmailFrom),
		EmailPassword:      pickNonEmpty(os.Getenv("EMAIL_PASSWORD"), cfg.Notification.Webhooks.EmailPassword),
		EmailTo:            pickNonEmpty(os.Getenv("EMAIL_TO"), cfg.Notification.Webhooks.EmailTo),
		EmailSMTPServer:    pickNonEmpty(os.Getenv("EMAIL_SMTP_SERVER"), cfg.Notification.Webhooks.EmailSMTPServer),
		EmailSMTPPort:      pickNonEmpty(os.Getenv("EMAIL_SMTP_PORT"), cfg.Notification.Webhooks.EmailSMTPPort),
		NTFYServerURL:      pickNonEmpty(os.Getenv("NTFY_SERVER_URL"), cfg.Notification.Webhooks.NTFYServerURL, defaultNTFYServer),
		NTFYTopic:          pickNonEmpty(os.Getenv("NTFY_TOPIC"), cfg.Notification.Webhooks.NTFYTopic),
		NTFYToken:          pickNonEmpty(os.Getenv("NTFY_TOKEN"), cfg.Notification.Webhooks.NTFYToken),
	}

	cfg.Notification.Channels = channels
}

func lookupEnvTrimmed(key string) (string, bool) {
	val, ok := os.LookupEnv(key)
	return strings.TrimSpace(val), ok
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func pickNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
