# TrendRadar 配置指南

## 配置文件概览

```
config/
├── config.yaml              # 主配置文件
├── frequency_words.txt      # 关键词配置
├── ai_analysis_prompt.txt   # AI分析提示词
└── ai_translation_prompt.txt # AI翻译提示词
```

## config.yaml 完整说明

### 1. 基础设置 (app)

```yaml
app:
  timezone: "Asia/Shanghai"    # 时区配置
  show_version_update: true    # 是否显示版本更新提示
```

**支持的时区**（常用）:
- `Asia/Shanghai` - 北京时间 (UTC+8)
- `America/New_York` - 美东时间 (UTC-5/-4)
- `Europe/London` - 伦敦时间 (UTC+0/+1)
- `Asia/Tokyo` - 东京时间 (UTC+9)

完整时区列表: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### 2. 数据源配置

#### 热榜平台 (platforms)

```yaml
platforms:
  enabled: true               # 是否启用热榜抓取
  sources:
    - id: "toutiao"           # 平台唯一标识（勿修改）
      name: "今日头条"        # 显示名称（可自定义）
    - id: "baidu"
      name: "百度热搜"
    - id: "weibo"
      name: "微博"
    # ... 更多平台
```

**支持的平台ID**:
- `toutiao` - 今日头条
- `baidu` - 百度热搜
- `wallstreetcn-hot` - 华尔街见闻
- `thepaper` - 澎湃新闻
- `bilibili-hot-search` - B站
- `cls-hot` - 财联社
- `ifeng` - 凤凰网
- `tieba` - 贴吧
- `weibo` - 微博
- `douyin` - 抖音
- `zhihu` - 知乎

#### RSS订阅 (rss)

```yaml
rss:
  enabled: true                                    # 是否启用RSS

  # 文章新鲜度过滤（全局）
  freshness_filter:
    enabled: true                                  # 是否启用过滤
    max_age_days: 3                                # 最大文章年龄（天）
                                                    # 0 = 禁用过滤

  feeds:
    - id: "hacker-news"                            # 唯一标识
      name: "Hacker News"                          # 显示名称
      url: "https://hnrss.org/frontpage"           # RSS地址
      enabled: true                                # 是否启用
      max_age_days: 1                              # 覆盖全局设置

    - id: "ruanyifeng"
      name: "阮一峰的网络日志"
      url: "http://www.ruanyifeng.com/blog/atom.xml"
      # max_age_days: 7                            # 可选：单独设置

    # 自定义源示例
    # - id: "custom-feed"
    #   name: "自定义源"
    #   url: "https://example.com/feed.xml"
    #   enabled: false
```

**新鲜度过滤说明**:
- 过滤时机: 在推送阶段过滤
- 所有文章都会存入数据库（MCP Server仍可访问）
- 只有新鲜的文章会被推送到通知渠道

### 3. 报告模式 (report)

```yaml
report:
  # 报告模式
  mode: "current"           # 可选: daily | current | incremental

  # 分组维度
  display_mode: "keyword"   # keyword | platform

  # 关键词组排序
  sort_by_position_first: false  # true=按配置顺序, false=按匹配数

  rank_threshold: 5         # 排名高亮阈值

  max_news_per_keyword: 0   # 每个关键词最大显示数量（0=不限制）
```

**三种模式对比**:

| 模式 | 推送时机 | 显示内容 | 适用场景 |
|------|----------|----------|----------|
| `daily` | 按时推送 | 当日所有匹配新闻 | 日报总结 |
| `current` | 按时推送 | 当前榜单匹配新闻 | 实时追踪 |
| `incremental` | 有新增才推送 | 新出现的匹配新闻 | 避免干扰 |

### 4. 推送内容控制 (display)

```yaml
display:
  # 区域显示顺序（从上到下）
  region_order:
    - new_items         # 1️⃣ 新增热点区域
    - hotlist           # 2️⃣ 热榜区域（关键词匹配）
    - rss               # 3️⃣ RSS订阅区域
    - standalone        # 4️⃣ 独立展示区
    - ai_analysis       # 5️⃣ AI分析区域

  # 区域开关
  regions:
    hotlist: true           # 热榜区域
    new_items: true         # 新增热点区域
    rss: true               # RSS订阅区域
    standalone: false       # 独立展示区
    ai_analysis: true       # AI分析区域

  # 独立展示区配置
  standalone:
    platforms: []           # 热榜平台ID列表
    rss_feeds: []           # RSS源ID列表
    max_items: 20           # 每个源最多展示条数（0=不限制）
```

**独立展示区用途**:
- 完整查看某个平台的热榜排名
- RSS源内容较少，希望全部展示
- 不受关键词过滤影响

### 5. 推送通知 (notification)

```yaml
notification:
  enabled: true                           # 是否启用通知

  # 推送时间窗口
  push_window:
    enabled: false                        # 是否启用时间窗口控制
    start: "20:00"                        # 开始时间
    end: "22:00"                          # 结束时间
    once_per_day: true                    # 窗口内只推送一次

  channels:
    # 飞书
    feishu:
      webhook_url: ""                     # 飞书机器人webhook

    # 钉钉
    dingtalk:
      webhook_url: ""                     # 钉钉机器人webhook

    # 企业微信
    wework:
      webhook_url: ""                     # 企业微信webhook
      msg_type: "markdown"                # markdown(群) | text(个人)

    # Telegram
    telegram:
      bot_token: ""                       # Bot Token
      chat_id: ""                         # Chat ID

    # 邮件
    email:
      from: ""                            # 发件人邮箱
      password: ""                        # 邮箱密码或授权码
      to: ""                              # 收件人（逗号分隔多个）
      smtp_server: ""                     # SMTP服务器（可选）
      smtp_port: ""                       # SMTP端口（可选）

    # ntfy
    ntfy:
      server_url: "https://ntfy.sh"
      topic: ""                           # 主题名称
      token: ""                           # 访问令牌（可选）

    # Bark
    bark:
      url: ""                             # Bark推送URL

    # Slack
    slack:
      webhook_url: ""                     # Slack Incoming Webhook

    # 通用Webhook
    generic_webhook:
      webhook_url: ""                     # Webhook URL
      payload_template: ""                # JSON模板
                                          # 留空使用默认格式
```

**安全警告**:
⚠️ **请妥善保管webhooks，不要公开！**
⚠️ **Fork部署时，请将webhooks填入GitHub Secrets**

### 6. 存储配置 (storage)

```yaml
storage:
  # 存储后端选择
  backend: "auto"           # auto | local | remote

  # 数据格式
  formats:
    sqlite: true            # 主存储（必须启用）
    txt: false              # TXT快照
    html: true              # HTML报告（邮件推送必需）

  # 本地存储
  local:
    data_dir: "output"      # 数据目录
    retention_days: 0       # 保留天数（0=永久）

  # 远程存储（S3兼容）
  remote:
    retention_days: 0
    endpoint_url: ""        # 服务端点
                            # Cloudflare R2: https://<account_id>.r2.cloudflarestorage.com
                            # 阿里云OSS: https://oss-cn-hangzhou.aliyuncs.com
                            # 腾讯云COS: https://cos.ap-guangzhou.myqcloud.com
    bucket_name: ""         # 存储桶名称
    access_key_id: ""       # 访问密钥ID
    secret_access_key: ""   # 访问密钥
    region: ""              # 区域（可选）

  # 数据拉取
  pull:
    enabled: false          # 启动时自动拉取
    days: 7                 # 拉取最近N天
```

### 7. AI模型配置 (ai)

```yaml
ai:
  # LiteLLM模型格式: provider/model_name
  model: "deepseek/deepseek-chat"
                                  # 其他示例:
                                  # - openai/gpt-4o
                                  # - gemini/gemini-2.5-flash
                                  # - anthropic/claude-3-5-sonnet
                                  # - ollama/llama3

  api_key: ""                # API Key（建议使用环境变量AI_API_KEY）
  api_base: ""               # 自定义API端点（可选）

  timeout: 120               # 请求超时（秒）

  temperature: 1.0           # 采样温度
  max_tokens: 5000           # 最大token数

  num_retries: 1             # 失败重试次数
  fallback_models: []        # 备用模型列表
                              # ["openai/gpt-4o-mini", "..."]

  # 额外参数（高级选项，一般无需修改）
  # extra_params:
  #   top_p: 1.0
  #   presence_penalty: 0.0
  #   stop: ["END"]
```

**支持100+AI提供商**: https://docs.litellm.ai/docs/providers

**自定义API端点**:
```yaml
ai:
  api_base: "https://api.example.com/v1"
  model: "openai/custom-model-name"
```

### 8. AI分析功能 (ai_analysis)

```yaml
ai_analysis:
  enabled: true                     # 是否启用AI分析

  language: "Chinese"               # 输出语言
                                      # English, Korean, 法语, etc.

  prompt_file: "ai_analysis_prompt.txt"

  max_news_for_analysis: 50         # 参与分析的新闻数量上限
                                    # 按默认推送频率和模型(deepseek)
                                    # GitHub Actions: ~0.1元/天
                                    # Docker: ~0.2元/天

  include_rss: false                # 是否包含RSS内容

  include_rank_timeline: true       # 是否传递完整排名时间线
                                    # false: 简化格式（排名范围+时间范围+出现次数）
                                    # true: 完整轨迹（如 1(09:30)→2(10:00)→0(11:00)）
                                    # 启用后额外增加0.5-1倍token消耗
```

### 9. AI翻译功能 (ai_translation)

```yaml
ai_translation:
  enabled: false                    # 是否启用翻译

  language: "English"               # 翻译目标语言

  prompt_file: "ai_translation_prompt.txt"
```

### 10. 高级设置 (advanced)

```yaml
advanced:
  debug: false                      # 调试模式

  # 版本检查
  version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version"
  mcp_version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_mcp"

  # 热榜爬虫
  crawler:
    request_interval: 2000           # 请求间隔（毫秒）
    use_proxy: false                 # 是否启用代理
    default_proxy: "http://127.0.0.1:10801"

  # RSS设置
  rss:
    request_interval: 1000           # 请求间隔（毫秒）
    timeout: 15                      # 请求超时（秒）
    use_proxy: false
    proxy_url: ""                    # RSS专属代理

  # 排序权重（合起来=1）
  weight:
    rank: 0.6                        # 排名权重
    frequency: 0.3                   # 频次权重
    hotness: 0.1                     # 热度权重

  max_accounts_per_channel: 3        # 每个渠道最大账号数

  # 消息分批（内部配置）
  batch_size:
    default: 4000
    dingtalk: 20000
    feishu: 30000
    bark: 4000
    slack: 4000
  batch_send_interval: 3             # 批次间隔（秒）
```

## frequency_words.txt 配置

这是关键词分组配置文件，用于过滤和分类新闻。

### 基本语法

```text
# 分组1名称
关键词1|关键词2|关键词3

# 分组2名称
关键词4
关键词5
关键词6

# 全局过滤词（不匹配任何新闻）
!过滤词1
!过滤词2
```

### 示例

```text
# AI技术
ChatGPT|GPT-4|Claude|文心一言
大模型|LLM|AIGC
人工智能|机器学习|深度学习

# 金融
股票|基金|债券|期货
牛市|熊市|涨停|跌停

# 全局过滤
广告
游戏
!娱乐八卦
```

### 配置说明

1. **分组**: 每个分组以 `#分组名` 开头
2. **关键词**:
   - 同行多个关键词用 `|` 分隔（OR关系）
   - 每行一个关键词
   - 支持正则表达式
3. **全局过滤**: 以 `!` 开头，匹配后排除该新闻

## 环境变量配置

敏感信息可以通过环境变量配置，优先级高于配置文件。

### 支持的环境变量

| 环境变量 | 说明 | 对应配置项 |
|----------|------|------------|
| `AI_API_KEY` | AI API密钥 | `ai.api_key` |
| `STORAGE_RETENTION_DAYS` | 数据保留天数 | `storage.retention_days` |
| `FEISHU_WEBHOOK_URL` | 飞书webhook | `notification.channels.feishu.webhook_url` |
| `DINGTALK_WEBHOOK_URL` | 钉钉webhook | `notification.channels.dingtalk.webhook_url` |
| `WEWORK_WEBHOOK_URL` | 企业微信webhook | `notification.channels.wework.webhook_url` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | `notification.channels.telegram.bot_token` |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | `notification.channels.telegram.chat_id` |
| `EMAIL_FROM` | 发件人邮箱 | `notification.channels.email.from` |
| `EMAIL_PASSWORD` | 邮箱密码 | `notification.channels.email.password` |
| `EMAIL_TO` | 收件人邮箱 | `notification.channels.email.to` |

### GitHub Actions配置示例

在仓库的 `Settings → Secrets and variables → Actions` 中添加：

1. 创建New repository secret
2. Name: `AI_API_KEY`
3. Value: `your-api-key-here`

## 多账号配置

所有通知渠道都支持多账号，使用分号(`;`)分隔。

### 示例

```yaml
notification:
  channels:
    # Telegram多账号
    telegram:
      bot_token: "token1;token2;token3"
      chat_id: "id1;id2;id3"

    # 邮件多收件人（逗号分隔）
    email:
      from: "sender@example.com"
      password: "password"
      to: "user1@example.com,user2@example.com,user3@example.com"
```

**注意事项**:
- 配对项（如Telegram的token和chat_id）数量必须一致
- 每个渠道最多支持3个账号
- 空字符串可用于占位

## AI提示词配置

### ai_analysis_prompt.txt

控制AI分析的内容和格式。

默认提示词结构：
```
你是一个新闻分析助手。请分析以下热点新闻，并提供：
1. 趋势总结
2. 重要事件
3. 相关性分析

新闻数据：
{news_data}

分析语言：{language}
```

### ai_translation_prompt.txt

控制AI翻译的行为。

默认提示词结构：
```
请将以下内容翻译成{language}：

{content}

要求：
- 保持专业术语
- 保持格式完整
```

## 配置验证

### 检查配置文件

```bash
# Python环境
python -m trendradar --check-config

# Docker环境
docker run --rm wantcat/trendradar --check-config
```

### 常见配置错误

1. **YAML格式错误**
   - 使用空格缩进，不要用Tab
   - 冒号后要有空格

2. **时区错误**
   - 使用IANA时区标识（如 `Asia/Shanghai`）
   - 不要使用缩写（如 `CST`）

3. **AI配置错误**
   - 模型格式: `provider/model_name`
   - API Key不要加引号

4. **多账号数量不匹配**
   - Telegram的token和chat_id数量必须一致

5. **Webhook格式错误**
   - 完整URL: `https://open.feishu.cn/open-apis/bot/v2/hook/xxx`

## 配置最佳实践

### 1. 安全性
- ✅ 使用环境变量存储敏感信息
- ✅ GitHub Actions使用Secrets
- ❌ 不要在配置文件中硬编码API密钥

### 2. 成本控制
- 根据需求调整 `max_news_for_analysis`
- `current` 模式比 `daily` 模式节省token
- 关闭 `include_rank_timeline` 可降低token消耗

### 3. 推送频率
- GitHub Actions: 默认每小时（20次/天）
- Docker: 默认每半小时（48次/天）
- 使用 `push_window` 控制推送时间

### 4. 关键词配置
- 分组不宜过多（建议<10组）
- 使用正则提高匹配精度
- 定期清理无效关键词

### 5. 存储管理
- 定期清理旧数据（设置 `retention_days`）
- 云存储注意流量费用
- HTML报告占用空间较大

## 配置调试

### 启用调试模式

```yaml
advanced:
  debug: true
```

调试模式会输出：
- 详细错误堆栈
- API请求/响应
- 数据处理过程

### 查看当前配置

```bash
# MCP服务器
mcp-client call config.get_current_config

# 或查看日志
tail -f output/*.log
```
