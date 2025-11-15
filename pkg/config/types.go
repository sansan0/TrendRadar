package config

// Config 代表 config/config.yaml 的结构以及必要的运行期信息。
type Config struct {
	App          AppConfig          `yaml:"app"`
	Crawler      CrawlerConfig      `yaml:"crawler"`
	Report       ReportConfig       `yaml:"report"`
	Notification NotificationConfig `yaml:"notification"`
	Weight       WeightConfig       `yaml:"weight"`
	Platforms    []PlatformConfig   `yaml:"platforms"`

	SourcePath string `yaml:"-"`
}

type AppConfig struct {
	VersionCheckURL   string `yaml:"version_check_url"`
	ShowVersionUpdate bool   `yaml:"show_version_update"`
}

type CrawlerConfig struct {
	RequestInterval int    `yaml:"request_interval"`
	EnableCrawler   bool   `yaml:"enable_crawler"`
	UseProxy        bool   `yaml:"use_proxy"`
	DefaultProxy    string `yaml:"default_proxy"`
}

type ReportConfig struct {
	Mode          string `yaml:"mode"`
	RankThreshold int    `yaml:"rank_threshold"`
}

type NotificationConfig struct {
	EnableNotification     bool             `yaml:"enable_notification"`
	MessageBatchSize       int              `yaml:"message_batch_size"`
	DingtalkBatchSize      int              `yaml:"dingtalk_batch_size"`
	FeishuBatchSize        int              `yaml:"feishu_batch_size"`
	BatchSendInterval      int              `yaml:"batch_send_interval"`
	FeishuMessageSeparator string           `yaml:"feishu_message_separator"`
	PushWindow             PushWindowConfig `yaml:"push_window"`
	Webhooks               WebhookConfig    `yaml:"webhooks"`
	Channels               ChannelConfig    `yaml:"-"`
}

type PushWindowConfig struct {
	Enabled             bool            `yaml:"enabled"`
	TimeRange           TimeRangeConfig `yaml:"time_range"`
	OncePerDay          bool            `yaml:"once_per_day"`
	RecordRetentionDays int             `yaml:"push_record_retention_days"`
}

type TimeRangeConfig struct {
	Start string `yaml:"start"`
	End   string `yaml:"end"`
}

type WebhookConfig struct {
	FeishuURL        string `yaml:"feishu_url"`
	DingtalkURL      string `yaml:"dingtalk_url"`
	WeworkURL        string `yaml:"wework_url"`
	TelegramBotToken string `yaml:"telegram_bot_token"`
	TelegramChatID   string `yaml:"telegram_chat_id"`
	EmailFrom        string `yaml:"email_from"`
	EmailPassword    string `yaml:"email_password"`
	EmailTo          string `yaml:"email_to"`
	EmailSMTPServer  string `yaml:"email_smtp_server"`
	EmailSMTPPort    string `yaml:"email_smtp_port"`
	NTFYServerURL    string `yaml:"ntfy_server_url"`
	NTFYTopic        string `yaml:"ntfy_topic"`
	NTFYToken        string `yaml:"ntfy_token"`
}

type ChannelConfig struct {
	FeishuWebhookURL   string
	DingtalkWebhookURL string
	WeworkWebhookURL   string
	TelegramBotToken   string
	TelegramChatID     string
	EmailFrom          string
	EmailPassword      string
	EmailTo            string
	EmailSMTPServer    string
	EmailSMTPPort      string
	NTFYServerURL      string
	NTFYTopic          string
	NTFYToken          string
}

type WeightConfig struct {
	RankWeight      float64 `yaml:"rank_weight"`
	FrequencyWeight float64 `yaml:"frequency_weight"`
	HotnessWeight   float64 `yaml:"hotness_weight"`
}

type PlatformConfig struct {
	ID   string `yaml:"id"`
	Name string `yaml:"name"`
}
