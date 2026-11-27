import type { FieldChange } from './config-changes.ts'
import { isSensitiveField } from './exporter.ts'
import type { ConfigFileKey, Lang } from './types.ts'
import { getInObject, type YamlPath } from './yaml-doc.ts'
import { formatFieldPath, type YamlField } from './yaml-fields.ts'
import { tr } from '../i18n/translate.ts'

type Copy = [zh: string, en: string]
const switches = new Map<string, { on: Copy; off: Copy }>(Object.entries({
  'app.show_version_update': {
    on: ['GitHub Actions 运行检测到新版本时，会在报告顶部显示升级提示。', 'Shows an upgrade notice at the top of reports on GitHub Actions when a new version is available.'],
    off: ['隐藏报告顶部的版本升级提示。', 'Hides version update notices from generated reports.'],
  },
  'schedule.enabled': {
    on: ['每次运行会读取 timeline.yaml，按当前时段决定是否采集、分析和推送。', 'Each run consults timeline.yaml to decide whether to collect, analyze and send news in the current time window.'],
    off: ['每次运行直接使用主配置里的采集、分析和推送设置，跳过时间线。', 'Each run uses the main collection, analysis and delivery settings and skips the timeline.'],
  },
  'web_search.enabled': {
    on: ['采集时会按搜索任务文件里的主题联网查询，结果按主题归集。执行搜索需要可用的搜索密钥。', 'Collection searches the web for the topics in your search task file and groups the results by topic. A working search API key is required.'],
    off: ['采集时会跳过联网搜索，搜索任务文件里的主题将暂停查询。', 'Collection skips web search, pausing queries for the topics in your search task file.'],
  },
  'web_search.allow_unknown_authority': {
    on: ['没有权威度评分的新发布网页也会被保留，避免误杀刚发布的新闻。', 'Pages without an authority score are kept so newly published articles are not dropped.'],
    off: ['没有权威度评分的网页会被直接过滤，仅保留已有评级的站点。', 'Pages without an authority rating are filtered out.'],
  },
  'web_search.need_content': {
    on: ['搜索时会额外抓取网页全文，适合需要深度正文的场景，耗时略增。', 'Fetches full article content alongside search snippets.'],
    off: ['仅拉取标题与摘要，普通展示与 AI 分析已足够且速度更快。', 'Fetches titles and snippets only for faster execution.'],
  },
  'web_search.notification_show_snippet': {
    on: ['发送到飞书、钉钉、企微等群消息时，会在联网搜索标题下附带摘要。', 'Includes search result snippets in instant-messaging notifications.'],
    off: ['群消息中只显示联网搜索标题（HTML 网页报告仍显示完整摘要）。', 'Shows titles only in IM notifications while keeping snippets in HTML reports.'],
  },
  'report.sort_by_position_first': {
    on: ['按关键词分组时，严格按照 frequency_words.txt 中词组的先后顺序排列。', 'Orders keyword groups strictly by their position in frequency_words.txt.'],
    off: ['按关键词分组时，按各词组匹配到的热点条数从多到少排序。', 'Orders keyword groups by matched headline count descending.'],
  },
  'filter.priority_sort_enabled': {
    on: ['使用 AI 筛选时，按 ai_interests.txt 中兴趣方向的先后顺序排列。', 'Orders AI filter tags by their priority order in ai_interests.txt.'],
    off: ['使用 AI 筛选时，按各兴趣标签命中的新闻条数从多到少排序。', 'Orders AI filter tags by matched story count descending.'],
  },
  'ai_analysis.include_rss': {
    on: ['运行 AI 分析时，会把符合条件的 RSS 文章和热榜新闻一起交给模型分析。', 'When AI analysis runs, eligible RSS articles join hotlist stories in the material sent to the model.'],
    off: ['运行 AI 分析时会跳过 RSS 文章。RSS 订阅仍按来源设置采集。', 'AI analysis skips RSS articles. Feed collection still follows your source settings.'],
  },
  'ai_analysis.include_web_search': {
    on: ['运行 AI 分析时，会把联网搜索命中的结果与摘要一并交给模型研判。', 'Includes matched web search results and snippets in AI analysis.'],
    off: ['运行 AI 分析时跳过联网搜索结果。', 'Excludes web search results from AI analysis.'],
  },
  'ai_analysis.include_standalone': {
    on: ['运行 AI 分析时，会为独立展示区的平台/RSS 数据补充去重概括。', 'Includes standalone showcase sources in AI analysis summaries.'],
    off: ['运行 AI 分析时不纳入独立展示区的数据。', 'Excludes standalone showcase sources from AI analysis.'],
  },
  'ai_analysis.include_rank_timeline': {
    on: ['向 AI 传入完整排名变化轨迹，趋势判断更准确（约增加 0.5~1 倍 Token 消耗）。', 'Sends full rank history to the model for sharper trend detection (uses ~0.5-1x more tokens).'],
    off: ['向 AI 传入简化的排名区间与出现次数，节省 Token 消耗。', 'Sends simplified rank ranges to save LLM tokens.'],
  },
  'platforms.enabled': {
    on: ['采集时会抓取平台列表中已启用的热榜。', 'Collection fetches the enabled hotlists in your platform list.'],
    off: ['采集时会跳过所有热榜平台。', 'Collection skips all hotlist platforms.'],
  },
  'rss.enabled': {
    on: ['采集时会读取已启用的 RSS 订阅，保存获取到的文章。', 'Collection reads enabled RSS feeds and saves the articles it finds.'],
    off: ['采集时会跳过 RSS 订阅，暂停获取新文章。', 'Collection skips RSS feeds and stops fetching new articles from them.'],
  },
  'rss.freshness_filter.enabled': {
    on: ['推送 RSS 文章时会按文章年龄筛选，采集到的旧文章仍会入库。', 'RSS delivery filters articles by age. Older articles are still collected and stored.'],
    off: ['推送 RSS 文章时会跳过文章年龄检查。', 'RSS delivery skips the article age check.'],
  },
  'notification.enabled': {
    on: ['符合推送条件的报告会发送到已配置的通知渠道。', 'Reports that meet the delivery conditions are sent to your configured channels.'],
    off: ['所有通知渠道暂停发送报告。', 'Report delivery is paused for all notification channels.'],
  },
  'ai_analysis.enabled': {
    on: ['符合分析条件时，会调用配置的 AI 模型生成新闻分析。', 'When the analysis conditions are met, the configured AI model produces a news analysis.'],
    off: ['每次运行都会跳过 AI 新闻分析。', 'Runs skip AI news analysis.'],
  },
  'ai_translation.enabled': {
    on: ['翻译范围内的标题会交给 AI 翻译成目标语言。', 'AI translates titles within the selected scope into the target language.'],
    off: ['各板块保留原标题，跳过 AI 翻译。', 'Sections keep their original titles and skip AI translation.'],
  },
  'storage.formats.sqlite': {
    on: ['保持主数据库开启，正常记录采集历史与去重状态。', 'Keeps primary SQLite storage enabled for history and deduplication.'],
    off: ['关闭主数据库会导致去重与历史归档异常，请务必保持开启。', 'Disabling primary SQLite storage breaks deduplication and archiving; keep it enabled.'],
  },
  'storage.formats.html': {
    on: ['每次运行会生成可视化 HTML 网页报告，并供邮件渠道作为正文发送。', 'Generates HTML reports and supplies rich content for email notifications.'],
    off: ['停止生成 HTML 网页报告。若已配置邮件推送，关闭此项会导致邮件发送失败。', 'Stops generating HTML reports. Note that email delivery requires HTML output to be enabled.'],
  },
  'storage.formats.txt': {
    on: ['额外保存纯文本快照文件到输出目录。', 'Saves plain-text snapshot files alongside SQLite records.'],
    off: ['不额外生成纯文本快照文件，仅保留数据库与所选报告格式。', 'Skips plain-text snapshot files.'],
  },
  'storage.pull.enabled': {
    on: ['启动时自动从远程 S3 云存储拉取近期历史数据到本地，便于 MCP 查询。', 'Automatically pulls recent archives from remote S3 storage on startup.'],
    off: ['启动时不自动从远程存储拉取历史数据。', 'Skips automatic remote archive pulling on startup.'],
  },
  'advanced.debug': {
    on: ['输出详细的调试日志，便于排查网络请求、筛选与推送异常。', 'Enables verbose debug logging for troubleshooting.'],
    off: ['保持常规精简日志输出。', 'Uses standard concise logging.'],
  },
} satisfies Record<string, { on: Copy; off: Copy }>))

const fieldPurposes = new Map<string, Copy>(Object.entries({
  'app.timezone': ['统一控制时间显示、按日归档边界以及定时调度的时区基准。', 'Sets the timezone used for timestamps, daily archiving, and schedule windows.'],
  'schedule.preset': ['定时调度开启后，每次运行采用这套时间线中定义的日计划。', 'When scheduling is enabled, each run follows the day plans in this timeline preset.'],
  'platforms.api_url': ['热榜采集将请求此自定义 API 地址，留空则使用默认公共接口。', 'Hotlist collection fetches data from this custom endpoint (blank uses the default API).'],
  'rss.freshness_filter.max_age_days': ['全局限制只推送最近 N 天内发布的 RSS 文章（0 表示不限天数）。', 'Limits RSS delivery to articles published within N days (0 = unlimited).'],
  'web_search.provider': ['指定默认使用的联网搜索引擎服务商。', 'Selects the default web search engine provider.'],
  'web_search.queries_file': ['指定联网搜索读取的主题任务文件，留空使用默认的 config/search_queries.txt。', 'Selects the search query file (blank uses config/search_queries.txt).'],
  'web_search.query_mode': ['直接模式使用原搜索词，智能模式可以先让 AI 提炼较长的查询。', 'Direct mode uses the original query. Smart mode can use AI to shorten long queries before searching.'],
  'web_search.fetch_count': ['决定每次搜索先取回多少条候选结果，再按质量、时效和展示条数筛选。', 'Sets how many candidates each search fetches before quality, freshness and display limits are applied.'],
  'web_search.freshness_days': ['限制联网搜索只保留最近 N 天内发布的结果（0 表示不限时间）。', 'Keeps web search results published within the last N days (0 = unlimited).'],
  'web_search.dedup_days': ['控制在 N 天内已经搜到过的相同链接不再重复标记为新增。', 'Prevents URLs seen within the last N days from being marked as new again.'],
  'web_search.min_score': ['过滤低于该质量分门槛（0.0~1.0）的搜索结果，提高信噪比。', 'Filters out search results below this quality threshold (0.0-1.0).'],
  'web_search.min_authority': ['设置来源网站最低权威度等级门槛（-1 表示不限制）。', 'Sets the minimum site authority level for search results (-1 = no limit).'],
  'web_search.providers.deepseek.api_base': ['联网搜索会向此地址发送 DeepSeek 搜索请求。', 'Web search sends its DeepSeek search requests to this endpoint.'],
  'web_search.providers.deepseek.api_key': ['这个密钥用于向 DeepSeek 搜索服务验证身份（留空时可读取 WEB_SEARCH_API_KEY 或复用 DeepSeek 主模型密钥）。', 'Authenticates requests to DeepSeek Search (falls back to WEB_SEARCH_API_KEY or DeepSeek AI_API_KEY).'],
  'web_search.providers.deepseek.localization': ['向搜索引擎传递地区 IP 偏好以优化本地化搜索结果。', 'Passes a regional IP hint to tailor localized search results.'],
  'report.display_mode': ['报告可以按关键词或来源归类，同一批新闻会按所选方式分组。', 'Reports group the same matching news by keyword or by source according to this setting.'],
  'report.rank_threshold': ['排名处于前 N 名的热点会在报告与推送中重点高亮标出。', 'Highlights headlines ranked within the top N positions.'],
  'report.max_news_per_keyword': ['限制每个关键词词组或 AI 标签最多展示多少条新闻（0 表示不限制）。', 'Caps how many stories are shown under each keyword group or AI tag (0 = unlimited).'],
  'ai_filter.batch_size': ['控制 AI 智能筛选每次打包发送给模型的标题数量上限。', 'Sets the maximum number of headlines sent per AI filtering batch.'],
  'ai_filter.batch_interval': ['设置 AI 智能筛选相邻批次之间的等待秒数，防止触发接口限流。', 'Sets the pause in seconds between AI filtering batches to avoid rate limits.'],
  'ai_filter.min_score': ['AI 智能筛选只保留相关度评分达到此门槛（0.0~1.0）的新闻。', 'Keeps only stories whose AI relevance score meets this threshold (0.0-1.0).'],
  'ai_filter.interests_file': ['指定从 config/custom/ai/ 读取的自定义兴趣描述文件；留空使用默认的 config/ai_interests.txt。', 'Reads custom AI interests from config/custom/ai/; blank uses config/ai_interests.txt.'],
  'ai_filter.reclassify_threshold': ['控制兴趣变更时触发全量重新分类与增量标签更新的灵敏度阈值。', 'Controls when tag changes trigger a full reclassification versus an incremental update.'],
  'ai_filter.prompt_file': ['使用 AI 筛选时，模型会按这份提示词给新闻分类。', 'AI filtering uses this prompt to classify news.'],
  'ai_filter.extract_prompt_file': ['首次运行 AI 筛选时，使用该提示词模板从兴趣描述提取分类标签。', 'AI filtering uses this prompt to extract initial topic tags from your interests.'],
  'ai_filter.update_tags_prompt_file': ['修改兴趣描述后，AI 使用该提示词模板比对并平滑更新分类标签。', 'AI filtering uses this prompt to reconcile updated interests with existing tags.'],
  'display.standalone.max_items': ['限制独立展示区中每个平台或 RSS 源最多输出的条数（0 表示全部展示）。', 'Caps how many items each standalone platform or RSS feed displays (0 = all).'],
  'storage.backend': ['决定采集数据写入本地数据库还是远程存储，自动模式按运行环境选择。', 'Selects local or remote storage for collected data. Automatic mode chooses based on the runtime environment.'],
  'storage.local.data_dir': ['指定本地数据库与生成报告存放的文件夹路径。', 'Sets the local directory where SQLite databases and reports are stored.'],
  'storage.local.retention_days': ['自动清理超过指定天数的本地历史归档（0 表示永久保留）。', 'Automatically prunes local archives older than N days (0 = keep forever).'],
  'storage.remote.retention_days': ['自动清理远程 S3 云存储中超过指定天数的归档（0 表示永久保留）。', 'Automatically prunes remote cloud archives older than N days (0 = keep forever).'],
  'storage.remote.endpoint_url': ['远程云存储的 S3 兼容服务端点地址（如 Cloudflare R2 / 阿里云 OSS / AWS S3）。', 'S3-compatible endpoint URL for remote cloud storage.'],
  'storage.remote.bucket_name': ['远程对象存储使用的存储桶（Bucket）名称。', 'Target bucket name in remote S3-compatible storage.'],
  'storage.remote.access_key_id': ['访问远程 S3 云存储所需的 Access Key ID（也可通过环境变量 S3_ACCESS_KEY_ID 注入）。', 'Access Key ID for authenticating with remote S3 storage.'],
  'storage.remote.secret_access_key': ['访问远程 S3 云存储所需的 Secret Access Key（建议通过环境变量或 Secrets 注入）。', 'Secret Access Key for authenticating with remote S3 storage.'],
  'storage.remote.region': ['指定远程对象存储所属的区域标识（部分云厂商需要）。', 'Optional region identifier for the remote S3 storage service.'],
  'storage.pull.days': ['启动自动拉取开启时，同步最近 N 天的云端历史数据到本地。', 'Number of recent days to pull from remote storage on startup.'],
  'ai.model': ['AI 分析、筛选和翻译共用这里指定的「提供商/模型名」标识。', 'AI analysis, filtering and translation share the "provider/model" selected here.'],
  'ai.api_key': ['调用大模型使用的 API 密钥（留空时自动从环境变量 AI_API_KEY 读取）。', 'API key for LLM requests (automatically reads AI_API_KEY when left blank).'],
  'ai.api_base': ['自定义大模型接口或第三方中转站地址（使用中转站时模型名通常需加 openai/ 前缀）。', 'Custom API base URL for relays or local Ollama endpoints.'],
  'ai.timeout': ['单次大模型请求的最长等待秒数，超时后自动重试或回退。', 'Maximum wait time in seconds per LLM API request.'],
  'ai.temperature': ['控制大模型输出的随机度（0.0~2.0）；注意部分推理模型（如 GPT-5）要求必须保持为 1.0。', 'Controls sampling randomness (0.0-2.0). Note that some reasoning models require 1.0.'],
  'ai.max_tokens': ['限制大模型单次生成的最大 Token 数（若接口报 HTTP 400 不支持此参数，设为 0 即可跳过发送）。', 'Caps generated output tokens (set to 0 to omit the parameter if your relay returns HTTP 400).'],
  'ai.num_retries': ['大模型请求遇到网络波动或限流时的自动重试次数。', 'Number of automatic retries when an LLM call fails transiently.'],
  'ai_analysis.language': ['指定 AI 深度分析报告输出所使用的语言。', 'Sets the output language of the AI analysis summary.'],
  'ai_analysis.mode': ['决定 AI 分析的数据范围是跟随报告模式，还是单独固定为当日汇总、当前榜单或增量。', 'Controls whether AI analysis follows report.mode or uses its own fixed scope.'],
  'ai_analysis.max_news_for_analysis': ['限制单次送入大模型分析的新闻总条数上限，是控制 Token 费用的核心参数。', 'Caps how many headlines are sent to AI analysis per run to control token cost.'],
  'ai_analysis.search_summary_max_chars': ['限制每条联网搜索结果附带给 AI 分析的最大摘要字数，控制上下文开销。', 'Caps the snippet length per web search item sent to AI analysis.'],
  'ai_analysis.prompt_file': ['AI 生成分析报告时，会读取这份文件中的分析要求。', 'AI reads this file’s instructions when generating a news analysis.'],
  'ai_translation.language': ['指定新闻标题与摘要被 AI 翻译成的目标语言。', 'Sets the target language for AI headline translation.'],
  'ai_translation.batch_size': ['控制每次打包发送给 AI 翻译的标题数量上限。', 'Maximum number of titles sent per AI translation batch.'],
  'ai_translation.batch_interval': ['设置翻译相邻批次之间的等待秒数，避免触发 API 限流。', 'Pause in seconds between translation batches to prevent rate limiting.'],
  'ai_translation.prompt_file': ['模型翻译新闻时，会按这份文件中的要求生成译文。', 'The model follows this file’s instructions when translating news.'],
  'notification.channels.feishu.webhook_url': ['配置飞书群机器人 Webhook 地址（支持用分号分隔配置多个群）。', 'Configures Feishu bot webhook URL(s) for report delivery.'],
  'notification.channels.dingtalk.webhook_url': ['配置钉钉群机器人 Webhook 地址（支持分号分隔多账号）。', 'Configures DingTalk bot webhook URL(s) for report delivery.'],
  'notification.channels.wework.webhook_url': ['配置企业微信群机器人 Webhook 地址（支持分号分隔多账号）。', 'Configures WeCom bot webhook URL(s) for report delivery.'],
  'notification.channels.wework.msg_type': ['选择企业微信消息格式：markdown 适合群聊查看，text 兼容微信插件转发到个人微信。', 'Selects WeCom format: markdown for group chats or text for personal WeChat forwarding.'],
  'notification.channels.telegram.bot_token': ['配置 Telegram 机器人 Token，需与下方 Chat ID 按相同数量一一配对。', 'Configures Telegram Bot Token(s), paired one-to-one with Chat IDs.'],
  'notification.channels.telegram.chat_id': ['配置接收推送的 Telegram 会话或频道 Chat ID，需与 Bot Token 数量一致。', 'Configures target Telegram Chat ID(s), matching the Bot Token count.'],
  'notification.channels.email.from': ['设置发送报告邮件的发件人邮箱地址。', 'Sets the sender email address for HTML report delivery.'],
  'notification.channels.email.password': ['设置发件邮箱的 SMTP 授权码或密码（建议通过 EMAIL_PASSWORD 注入）。', 'Sets the SMTP password or app-specific authorization code.'],
  'notification.channels.email.to': ['设置接收报告的收件人邮箱地址（多个收件人用英文逗号分隔）。', 'Sets recipient email address(es), separated by commas.'],
  'notification.channels.email.smtp_server': ['手动指定 SMTP 服务器地址；留空时按邮箱域名自动识别。', 'Custom SMTP server host (blank auto-detects from sender domain).'],
  'notification.channels.email.smtp_port': ['手动指定 SMTP 端口号；留空时自动匹配标准加密端口。', 'Custom SMTP port (blank auto-detects standard TLS/SSL port).'],
  'notification.channels.ntfy.server_url': ['指定 ntfy 推送服务器地址（默认官方 ntfy.sh，可改为自建实例）。', 'Sets the ntfy server URL (defaults to https://ntfy.sh or self-hosted).'],
  'notification.channels.ntfy.topic': ['设置订阅和接收消息的 ntfy 主题名称。', 'Sets the ntfy topic name to publish notifications to.'],
  'notification.channels.ntfy.token': ['可选填写私有 ntfy 主题的访问令牌（Token）。', 'Optional access token for protected ntfy topics.'],
  'notification.channels.bark.url': ['配置 iOS Bark 推送地址（含设备 Key，支持分号分隔多设备）。', 'Configures iOS Bark push URL(s) with device key.'],
  'notification.channels.slack.webhook_url': ['配置 Slack Incoming Webhook 地址以接收频道推送。', 'Configures Slack Incoming Webhook URL(s).'],
  'notification.channels.generic_webhook.webhook_url': ['配置通用 Webhook 地址（可对接 Discord、Matrix、Home Assistant、IFTTT 等）。', 'Configures a generic webhook URL (Discord, Matrix, IFTTT, etc.).'],
  'notification.channels.generic_webhook.payload_template': ['自定义通用 Webhook 的 JSON 请求体模板，支持 {title} 与 {content} 占位符。', 'Custom JSON payload template using {title} and {content} placeholders.'],
  'advanced.version_check_url': ['检查主程序更新时，会从这个地址读取版本号。', 'Main application update checks read the version from this URL.'],
  'advanced.mcp_version_check_url': ['检查 MCP 服务更新时，会从这个地址读取版本号。', 'MCP server update checks read the version from this URL.'],
  'advanced.configs_version_check_url': ['检查配置模板更新时，会从这个地址读取版本信息。', 'Configuration template update checks read version information from this URL.'],
  'advanced.crawler.request_interval': ['设置相邻热榜平台抓取之间的间隔毫秒数，避免请求过快被限流。', 'Delay in milliseconds between hotlist platform requests.'],
  'advanced.crawler.use_proxy': ['控制抓取热榜平台时是否走代理服务器（GitHub Actions 云端运行会自动忽略）。', 'Controls whether hotlist requests use a proxy locally.'],
  'advanced.crawler.default_proxy': ['开启代理的采集请求可使用此地址作为默认代理。', 'Collection requests with proxying enabled can use this address as their default proxy.'],
  'advanced.rss.request_interval': ['设置相邻 RSS 订阅源抓取之间的间隔毫秒数。', 'Delay in milliseconds between RSS feed requests.'],
  'advanced.rss.timeout': ['单个 RSS 订阅源请求的最长等待秒数。', 'Timeout in seconds for fetching each RSS feed.'],
  'advanced.rss.use_proxy': ['控制抓取 RSS 订阅源时是否启用代理（注意云端 Actions 请保持关闭）。', 'Controls whether RSS requests use a proxy (keep off on GitHub Actions).'],
  'advanced.rss.proxy_url': ['为 RSS 抓取单独指定代理地址；留空时复用热榜默认代理。', 'Dedicated proxy URL for RSS feeds (blank falls back to default_proxy).'],
  'advanced.web_search.request_interval': ['两次联网搜索请求之间的间隔毫秒数，防止触发搜索引擎频率限制。', 'Delay in milliseconds between web search queries.'],
  'advanced.web_search.timeout': ['单次联网搜索请求的最长等待秒数。', 'Timeout in seconds per web search request.'],
  'advanced.web_search.max_retries': ['联网搜索遇到超时或限流时的最大自动重试次数。', 'Maximum retries when a web search request times out or hits rate limits.'],
  'advanced.web_search.use_proxy': ['控制联网搜索请求是否走代理服务器（云端 Actions 请保持关闭）。', 'Controls whether web search requests use a proxy.'],
  'advanced.web_search.proxy_url': ['为联网搜索单独指定代理地址；留空时复用默认代理。', 'Dedicated proxy URL for web search (blank falls back to default_proxy).'],
  'advanced.weight.rank': ['调整热榜综合排序中「平台内名次高低」所占的权重比例（三项权重之和应为 1.0）。', 'Weight given to rank position when scoring hotlist headlines (sum should be 1.0).'],
  'advanced.weight.frequency': ['调整热榜综合排序中「跨时段持续上榜频次」所占的权重比例。', 'Weight given to appearance frequency when scoring hotlist headlines.'],
  'advanced.weight.hotness': ['调整热榜综合排序中「高排名出现占比」所占的权重比例。', 'Weight given to top-rank prominence when scoring hotlist headlines.'],
  'advanced.max_accounts_per_channel': ['限制单个通知渠道最多允许用分号并联配置的账号数量。', 'Maximum number of semicolon-separated accounts allowed per channel.'],
  'advanced.batch_send_interval': ['长消息拆分为多批发送时，批次之间的等待秒数，防止触发群机器人限流。', 'Pause in seconds between split notification batches.'],
  'advanced.feishu_message_separator': ['飞书推送使用这段文字分隔消息中的内容板块。', 'Feishu messages use this text to separate content sections.'],
} satisfies Record<string, Copy>))

const FIELD_TITLES = new Map<string, Copy>(Object.entries({
  'app.timezone': ['运行时区', 'Runtime Timezone'],
  'app.show_version_update': ['版本更新提示', 'Version Update Notice'],
  'schedule.enabled': ['启用定时调度', 'Enable Schedule'],
  'schedule.preset': ['当前调度预设模板', 'Active Schedule Preset'],
  'platforms.enabled': ['启用热榜平台采集', 'Enable Hotlist Platforms'],
  'platforms.api_url': ['热榜自定义 API 地址', 'Hotlist API URL'],
  'platforms.sources': ['热榜平台列表', 'Hotlist Platform List'],
  'rss.enabled': ['启用 RSS 订阅采集', 'Enable RSS Feeds'],
  'rss.freshness_filter.enabled': ['RSS 文章新鲜度过滤', 'RSS Freshness Filter'],
  'rss.freshness_filter.max_age_days': ['RSS 最大文章年龄（天）', 'RSS Max Article Age (Days)'],
  'rss.feeds': ['RSS 订阅源列表', 'RSS Feed List'],
  'web_search.enabled': ['启用定时联网搜索', 'Enable Web Search'],
  'web_search.provider': ['默认搜索引擎', 'Search Provider'],
  'web_search.queries_file': ['自定义搜索任务文件', 'Custom Search Queries File'],
  'web_search.query_mode': ['搜索词处理模式', 'Search Query Mode'],
  'web_search.fetch_count': ['单次候选拉取条数', 'Search Candidate Fetch Count'],
  'web_search.max_items_per_topic': ['每主题最多展示条数', 'Max Items per Search Topic'],
  'web_search.freshness_days': ['搜索结果时效天数', 'Search Freshness Days'],
  'web_search.dedup_days': ['搜索结果去重周期（天）', 'Search Deduplication Days'],
  'web_search.min_score': ['搜索最低质量分门槛', 'Minimum Search Quality Score'],
  'web_search.min_authority': ['网站最低权威度等级', 'Minimum Site Authority'],
  'web_search.allow_unknown_authority': ['保留无权威度评级网页', 'Allow Unrated Domains'],
  'web_search.need_content': ['顺带抓取网页正文', 'Fetch Full Page Content'],
  'web_search.notification_show_snippet': ['群消息附带搜索摘要', 'Show Search Snippets in IM'],
  'report.mode': ['报告推送范围模式', 'Report Delivery Mode'],
  'report.display_mode': ['报告内容分组方式', 'Report Grouping Mode'],
  'report.sort_by_position_first': ['按关键词词组顺序排列', 'Sort by Keyword Position'],
  'report.rank_threshold': ['前排高亮名次阈值', 'Top Rank Highlight Threshold'],
  'report.max_news_per_keyword': ['单组最大新闻条数', 'Max Stories per Group'],
  'filter.method': ['内容筛选方式', 'Content Filtering Method'],
  'filter.priority_sort_enabled': ['按 AI 兴趣优先级排序', 'Sort by AI Interest Priority'],
  'ai_filter.min_score': ['AI 筛选最低相关度分', 'AI Filter Minimum Score'],
  'ai_filter.interests_file': ['自定义 AI 兴趣文件', 'Custom AI Interests File'],
  'ai_filter.batch_size': ['AI 筛选单批标题数', 'AI Filter Batch Size'],
  'ai_filter.batch_interval': ['AI 筛选批次间隔（秒）', 'AI Filter Batch Interval'],
  'ai_filter.reclassify_threshold': ['AI 全量重分类阈值', 'AI Reclassify Threshold'],
  'ai_filter.prompt_file': ['AI 分类提示词文件', 'AI Classify Prompt File'],
  'ai_filter.extract_prompt_file': ['AI 标签提取提示词文件', 'AI Tag Extract Prompt File'],
  'ai_filter.update_tags_prompt_file': ['AI 标签更新提示词文件', 'AI Tag Update Prompt File'],
  'display.region_order': ['报告板块上下排列顺序', 'Report Section Order'],
  'display.regions.new_items': ['显示「新增热点」板块', 'Show New Items Section'],
  'display.regions.hotlist': ['显示「热榜」板块', 'Show Hotlist Section'],
  'display.regions.rss': ['显示「RSS 订阅」板块', 'Show RSS Section'],
  'display.regions.web_search': ['显示「联网搜索」板块', 'Show Web Search Section'],
  'display.regions.standalone': ['显示「独立展示区」板块', 'Show Standalone Section'],
  'display.regions.ai_analysis': ['显示「AI 分析」板块', 'Show AI Analysis Section'],
  'display.standalone.platforms': ['独立展示区热榜平台', 'Standalone Hotlist Platforms'],
  'display.standalone.rss_feeds': ['独立展示区 RSS 源', 'Standalone RSS Feeds'],
  'display.standalone.max_items': ['独立展示区单源条数上限', 'Standalone Max Items'],
  'notification.enabled': ['推送通知总开关', 'Notifications Master Switch'],
  'storage.backend': ['数据存储后端模式', 'Storage Backend Mode'],
  'storage.formats.sqlite': ['SQLite 主数据库存储', 'SQLite Primary Database'],
  'storage.formats.html': ['生成 HTML 网页报告', 'Generate HTML Report'],
  'storage.formats.txt': ['生成 TXT 文本快照', 'Generate TXT Snapshot'],
  'storage.local.data_dir': ['本地数据存储目录', 'Local Storage Directory'],
  'storage.local.retention_days': ['本地归档保留天数', 'Local Retention Days'],
  'storage.remote.retention_days': ['远程云存储保留天数', 'Remote Retention Days'],
  'storage.remote.endpoint_url': ['S3 远程存储端点地址', 'S3 Endpoint URL'],
  'storage.remote.bucket_name': ['S3 存储桶名称', 'S3 Bucket Name'],
  'storage.remote.access_key_id': ['S3 Access Key ID', 'S3 Access Key ID'],
  'storage.remote.secret_access_key': ['S3 Secret Access Key', 'S3 Secret Access Key'],
  'storage.remote.region': ['S3 存储区域 (Region)', 'S3 Region'],
  'storage.pull.enabled': ['启动时自动从云端拉取', 'Pull Remote Data on Startup'],
  'storage.pull.days': ['启动拉取最近天数', 'Startup Pull Days'],
  'ai.model': ['共享 AI 模型标识', 'Shared AI Model'],
  'ai.api_key': ['AI 模型 API 密钥', 'AI API Key'],
  'ai.api_base': ['AI 自定义接口 / 中转地址', 'Custom AI API Base URL'],
  'ai.timeout': ['AI 请求超时时间（秒）', 'AI Request Timeout'],
  'ai.temperature': ['AI 采样温度 (Temperature)', 'AI Sampling Temperature'],
  'ai.max_tokens': ['AI 最大输出 Token 数', 'AI Max Output Tokens'],
  'ai.num_retries': ['AI 失败自动重试次数', 'AI Retry Count'],
  'ai.fallback_models': ['AI 备用回退模型列表', 'AI Fallback Models'],
  'ai_analysis.enabled': ['启用 AI 深度分析', 'Enable AI Analysis'],
  'ai_analysis.language': ['AI 分析输出语言', 'AI Analysis Language'],
  'ai_analysis.prompt_file': ['AI 分析提示词文件', 'AI Analysis Prompt File'],
  'ai_analysis.mode': ['AI 分析范围模式', 'AI Analysis Scope Mode'],
  'ai_analysis.max_news_for_analysis': ['AI 分析最大新闻条数', 'Max Stories for AI Analysis'],
  'ai_analysis.include_rss': ['AI 分析纳入 RSS 文章', 'Include RSS in AI Analysis'],
  'ai_analysis.include_web_search': ['AI 分析纳入联网搜索', 'Include Web Search in AI Analysis'],
  'ai_analysis.search_summary_max_chars': ['联网搜索送审摘要字数上限', 'Max Search Snippet Chars for AI'],
  'ai_analysis.include_standalone': ['AI 分析纳入独立展示区', 'Include Standalone in AI Analysis'],
  'ai_analysis.include_rank_timeline': ['AI 分析附带完整排名轨迹', 'Include Rank Timeline in AI Analysis'],
  'ai_translation.enabled': ['启用 AI 多语言翻译', 'Enable AI Translation'],
  'ai_translation.language': ['AI 翻译目标语言', 'AI Translation Target Language'],
  'ai_translation.prompt_file': ['AI 翻译提示词文件', 'AI Translation Prompt File'],
  'ai_translation.batch_size': ['AI 翻译单批条数', 'AI Translation Batch Size'],
  'ai_translation.batch_interval': ['AI 翻译批次间隔（秒）', 'AI Translation Batch Interval'],
  'ai_translation.scope.hotlist': ['翻译热榜标题', 'Translate Hotlist Titles'],
  'ai_translation.scope.rss': ['翻译 RSS 订阅标题', 'Translate RSS Titles'],
  'ai_translation.scope.web_search': ['翻译联网搜索结果', 'Translate Web Search Results'],
  'ai_translation.scope.standalone': ['翻译独立展示区标题', 'Translate Standalone Titles'],
  'advanced.debug': ['调试日志模式', 'Debug Logging Mode'],
  'advanced.weight.rank': ['热榜排名权重 (rank)', 'Rank Position Weight'],
  'advanced.weight.frequency': ['热榜频次权重 (frequency)', 'Appearance Frequency Weight'],
  'advanced.weight.hotness': ['热榜高排热度权重 (hotness)', 'Top-Rank Hotness Weight'],
}))

const CHANNEL_NAMES: Record<string, Copy> = {
  feishu: ['飞书机器人', 'Feishu'],
  dingtalk: ['钉钉机器人', 'DingTalk'],
  wework: ['企业微信', 'WeCom'],
  telegram: ['Telegram', 'Telegram'],
  email: ['邮件推送', 'Email'],
  ntfy: ['ntfy 推送', 'ntfy'],
  bark: ['Bark 推送', 'Bark'],
  slack: ['Slack', 'Slack'],
  generic_webhook: ['通用 Webhook', 'Generic Webhook'],
}

export function describeFieldTitle(
  file: ConfigFileKey,
  path: YamlPath,
  originalPath: YamlPath,
  baseData: unknown,
  editedData: unknown,
  lang: Lang,
  isReorder?: boolean,
): string {
  const pick = (pair: Copy) => tr(lang, pair[0], pair[1])
  const key = formatFieldPath(path)
  if (isReorder) {
    const direct = FIELD_TITLES.get(key)
    const baseTitle = direct ? pick(direct) : key
    return tr(lang, '{base} · 排列顺序', '{base} · Order', { base: baseTitle })
  }
  const direct = file === 'config.yaml' ? FIELD_TITLES.get(key) : undefined
  if (direct) return pick(direct)

  if (file === 'config.yaml') {
    if ((path[0] === 'platforms' && path[1] === 'sources') || (path[0] === 'rss' && path[1] === 'feeds')) {
      const groupLabel = path[0] === 'platforms'
        ? tr(lang, '热榜平台', 'Hotlist')
        : tr(lang, 'RSS 订阅', 'RSS Feed')
      if (typeof path[2] === 'number') {
        const currEntry = getInObject<Record<string, unknown> | null>(editedData, path.slice(0, 3), null)
        const baseEntry = getInObject<Record<string, unknown> | null>(baseData, originalPath.slice(0, 3), null)
        const entryName = String(currEntry?.name || baseEntry?.name || currEntry?.id || baseEntry?.id || `#${path[2] + 1}`)
        if (path.length === 3) return `${groupLabel} · ${entryName}`
        const attrLabels: Record<string, Copy> = {
          enabled: ['启用状态', 'Enabled'],
          name: ['显示名称', 'Display Name'],
          id: ['唯一标识 ID', 'Source ID'],
          expected_domain: ['安全校验域名', 'Expected Domain'],
          url: ['订阅地址', 'Feed URL'],
          max_age_days: ['单源新鲜度天数', 'Max Age Days'],
          max_items: ['单源最大条数', 'Max Items'],
        }
        const attrPair = attrLabels[String(path[3])]
        const attr = attrPair ? pick(attrPair) : String(path[3])
        return `${groupLabel} · ${entryName} · ${attr}`
      }
    }
    if (path[0] === 'notification' && path[1] === 'channels' && typeof path[2] === 'string') {
      const chPair = CHANNEL_NAMES[path[2]]
      const ch = chPair ? pick(chPair) : path[2]
      const fieldLabels: Record<string, Copy> = {
        webhook_url: ['Webhook 地址', 'Webhook URL'],
        msg_type: ['消息格式', 'Message Format'],
        bot_token: ['Bot Token', 'Bot Token'],
        chat_id: ['Chat ID', 'Chat ID'],
        from: ['发件人邮箱', 'Sender Address'],
        password: ['邮箱密码/授权码', 'Password / App Code'],
        to: ['收件人邮箱', 'Recipients'],
        smtp_server: ['SMTP 服务器', 'SMTP Server'],
        smtp_port: ['SMTP 端口', 'SMTP Port'],
        server_url: ['服务器地址', 'Server URL'],
        topic: ['主题 (Topic)', 'Topic'],
        token: ['访问令牌', 'Access Token'],
        url: ['推送地址', 'Push URL'],
        payload_template: ['请求体模板', 'Payload Template'],
      }
      const subPair = path[3] ? fieldLabels[String(path[3])] : undefined
      const sub = path[3] ? (subPair ? pick(subPair) : String(path[3])) : ''
      return sub ? `${ch} · ${sub}` : ch
    }
    if (path[0] === 'web_search' && path[1] === 'providers' && typeof path[2] === 'string') {
      const prov = path[2] === 'deepseek' ? 'DeepSeek Search' : path[2]
      return path[3] ? `${prov} · ${String(path[3])}` : prov
    }
    if (path[0] === 'ai' && path[1] === 'extra_params') {
      return path[2]
        ? tr(lang, 'AI 额外透传参数 · {param}', 'AI Extra Param · {param}', { param: String(path[2]) })
        : tr(lang, 'AI 额外透传参数', 'AI Extra Parameters')
    }
  }

  if (file === 'timeline.yaml') {
    const presetName = path[0] === 'custom'
      ? tr(lang, '自定义时间线 (custom)', 'Custom Timeline')
      : path[0] === 'presets' && path[1]
        ? tr(lang, '时间线预设 ({name})', 'Preset ({name})', { name: String(path[1]) })
        : 'timeline.yaml'
    const rest = path[0] === 'presets' ? path.slice(2) : path[0] === 'custom' ? path.slice(1) : path
    if (rest.length === 0) return presetName
    if (rest[0] === 'default') {
      const sub = rest.slice(1).join('.')
      const defLabel = tr(lang, '静默期默认', 'Default')
      return sub ? `${presetName} · ${defLabel} · ${sub}` : `${presetName} · ${defLabel}`
    }
    if (rest[0] === 'periods' && rest[1]) {
      const sub = rest.slice(2).join('.')
      const periodLabel = tr(lang, '时段 {name}', 'Period {name}', { name: String(rest[1]) })
      return sub ? `${presetName} · ${periodLabel} · ${sub}` : `${presetName} · ${periodLabel}`
    }
    return `${presetName} · ${rest.join('.')}`
  }

  return key || file
}

function templateField(root: YamlField, path: YamlPath) {
  let field: YamlField | undefined = root
  for (const key of path) {
    field = typeof key === 'number' && field.kind === 'list'
      ? field.children[key] ?? field.children[0]
      : field.children.find((child) => child.name === key)
    if (!field) return undefined
  }
  return field
}

function timelinePurpose(path: YamlPath, after?: string): Copy | undefined {
  const nested = path[0] === 'presets' ? path.slice(2) : path[0] === 'custom' ? path.slice(1) : null
  if (!nested) return
  const [area] = nested
  if (area === 'name' || area === 'description') return ['更改这套时间线在预设列表中显示的名称或说明。', 'Changes the name or description shown for this timeline preset.']
  if (area === 'overlap' && nested[1] === 'policy') {
    if (after === '"last_wins"') return ['时段重叠时，采用日计划列表中排在后面的时段。', 'When time windows overlap, the later entry in the day plan takes precedence.']
    return ['这个策略决定遇到重叠时段时，调度要报错还是采用后列出的时段。', 'This policy determines whether overlapping windows raise an error or the later entry takes precedence.']
  }
  if (area === 'week_map') return ['调度启用并选中这套时间线时，星期映射决定当天采用哪份日计划。', 'With this timeline active, the weekday mapping selects the day plan for that day.']
  if (area === 'day_plans') return ['选用这份日计划的日期会按这里列出的时段先后顺序安排运行。', 'Days using this plan follow the time windows listed here in order.']
  if (area === 'periods' || area === 'default') {
    const field = area === 'periods' ? nested.slice(2) : nested.slice(1)
    const scope: Copy = area === 'default' ? ['调度未命中具体时段时', 'Outside a named time window'] : ['调度命中这个时段时', 'During this time window']
    if (field[0] === 'name') return ['调度日志和时间线使用这个名称标识对应的时段。', 'The timeline and schedule logs use this name to identify the time window.']
    if (field[0] === 'report_mode') return [`${scope[0]}，这项设置决定报告展示当前、当天或本次新增的新闻。`, `${scope[1]}, this setting selects current, daily or newly found news for the report.`]
    if (field[0] === 'ai_mode') return [`${scope[0]}，这项设置决定 AI 分析哪一批新闻，以及是否跟随报告范围。`, `${scope[1]}, this setting determines which news AI analyzes and whether it follows the report scope.`]
    if (field[0] === 'filter_method') return [`${scope[0]}，覆盖筛选方式（关键词或 AI 筛选；使用 AI 筛选需主配置同时开启）。`, `${scope[1]}, overrides the content filtering method (keyword or AI).`]
    if (field[0] === 'frequency_file') return [`${scope[0]}，切换读取指定的自定义关键词规则文件。`, `${scope[1]}, switches keyword matching to this custom frequency file.`]
    if (field[0] === 'interests_file') return [`${scope[0]}，切换读取 config/custom/ai/ 下的自定义兴趣描述文件。`, `${scope[1]}, switches AI filtering to this custom interests file.`]
    if (field[0] === 'search_file') return [`${scope[0]}，切换读取指定的自定义联网搜索任务文件。`, `${scope[1]}, switches web search to this custom search queries file.`]
    if (field[0] === 'once') return [`${scope[0]}，这个限制决定同一项操作在该时段能执行几次。`, `${scope[1]}, this limit controls how often the action can run.`]
    if (field[0] === 'start' || field[0] === 'end') return ['启用这套时间线后，起止时间决定哪些运行落在这个时段内。', 'When this timeline is active, the start and end times determine which runs fall in this window.']
    const actions: Record<string, Copy> = {
      collect: ['采集新闻', 'collection'], search: ['联网搜索', 'web search'], analyze: ['执行 AI 分析', 'AI analysis'], push: ['发送通知', 'notification delivery'],
    }
    const action = field.length === 1 && Object.hasOwn(actions, field[0]) ? actions[String(field[0])] : undefined
    if (action) return [`${scope[0]}，此开关决定是否${action[0]}。对应功能还需在主配置中启用。`, `${scope[1]}, this switch controls ${action[1]}. The feature must also be enabled in the main configuration.`]
    if (!field.length) return ['启用这套时间线时，这组设置决定匹配时段内执行哪些任务。', 'When this timeline is active, these settings determine which tasks run in the matching time window.']
  }
  if (nested.length === 0) return ['调度选择这套预设后，会使用其中的日计划和时段运行。', 'Selecting this schedule preset makes runs follow its day plans and time windows.']
}

function sourceListPurpose(path: YamlPath, kind: FieldChange['kind'], isReorder?: boolean): Copy | undefined {
  const rss = path[0] === 'rss' && path[1] === 'feeds'
  if (!rss && !(path[0] === 'platforms' && path[1] === 'sources')) return
  if (isReorder) {
    return rss
      ? ['调整了 RSS 订阅源的排列顺序，按来源展示时会使用新的先后次序。', 'Reorders RSS feeds for source-grouped reports.']
      : ['调整了热榜平台的排列优先级，按平台展示与抓取顺序会随之更新。', 'Reorders hotlist platform priority for collection and source-grouped reports.']
  }
  if (path.length < 3 || (path.length === 3 && typeof path[2] === 'number')) {
    if (kind === 'removed') return ['移出的来源将从采集列表中删除。', 'Removed sources are dropped from the collection list.']
    return ['采集启用的来源时，会使用更新后的来源列表。', 'Collection uses the updated list of enabled sources.']
  }
  if (typeof path[2] !== 'number' || path.length !== 4) return
  const fields: Record<string, Copy> = {
    id: ['这个标识用于在配置和采集数据中识别该来源。', 'This identifier links the source to its configuration and collected data.'],
    name: ['报告将使用这个名称标注来源。', 'Reports use this name to label the source.'],
    enabled: ['这项设置决定采集时是否读取这一来源。', 'This setting determines whether collection reads this source.'],
  }
  if (rss && path[3] === 'url') return ['订阅地址决定采集时从哪里读取这个来源的文章。', 'The feed URL determines where collection reads this source’s articles.']
  if (rss && path[3] === 'max_age_days') return ['这个天数覆盖全局 RSS 新鲜度设置，决定该订阅的文章能保留多久用于推送。', 'This feed-specific age limit overrides the global RSS freshness setting for delivery.']
  if (rss && path[3] === 'max_items') return ['限制该 RSS 订阅源单次抓取保留的最大文章条数。', 'Caps how many articles are kept per fetch from this RSS feed.']
  if (!rss && path[3] === 'expected_domain') return ['热榜采集会按这个域名核对返回的数据来源，防范链接劫持。', 'Hotlist collection checks returned URLs against this domain to guard against hijacking.']
  return Object.hasOwn(fields, path[3]) ? fields[path[3]] : undefined
}

export function explainFieldChange(file: ConfigFileKey, change: FieldChange, baseTree: YamlField, config: unknown, lang: Lang): string {
  const pick = (pair: Copy) => tr(lang, pair[0], pair[1])
  const { path, after, kind, isReorder } = change
  const key = formatFieldPath(path)

  if (isReorder) {
    const sourceReorder = file === 'config.yaml' ? sourceListPurpose(path, kind, true) : undefined
    if (sourceReorder) return pick(sourceReorder)
    if (file === 'config.yaml' && path[0] === 'display' && path[1] === 'region_order') {
      return tr(lang, '报告与推送消息将按调整后的上下顺序依次渲染已启用的板块。', 'Reports and notifications render enabled sections in this updated top-to-bottom order.')
    }
    return tr(lang, '调整了列表项的先后顺序，运行时按新顺序读取。', 'Updated the order of items in this list.')
  }

  const toggle = file === 'config.yaml' ? switches.get(key) : undefined
  if (toggle && (after === 'true' || after === 'false')) {
    const effect = pick(after === 'true' ? toggle.on : toggle.off)
    if (key === 'ai_analysis.include_rss' && after === 'true' && getInObject<boolean>(config, ['ai_analysis', 'enabled'], true) === false) {
      return effect + tr(lang, '当前 AI 分析总开关已关闭。', ' AI analysis is currently switched off.')
    }
    return effect
  }
  if (file === 'config.yaml' && path[0] === 'display' && path[1] === 'regions' && typeof path[2] === 'string' && (after === 'true' || after === 'false')) {
    const on = after === 'true'
    if (path[2] === 'ai_analysis' && !on && getInObject<boolean>(config, ['ai_analysis', 'enabled'], false)) {
      return tr(
        lang,
        '推送消息将隐藏 AI 分析板块；注意当前 AI 分析总开关仍开启，后台仍会调用大模型消耗 Token。',
        'Hides the AI analysis block from notifications. Note that ai_analysis.enabled is still on and will consume tokens.',
      )
    }
    return on
      ? tr(lang, '在报告与通知推送中显示该内容板块（需同时保留在 region_order 排序列表中）。', 'Shows this content section in reports and notifications.')
      : tr(lang, '在报告与通知推送中隐藏该内容板块。', 'Hides this content section from reports and notifications.')
  }
  if (file === 'config.yaml' && path[0] === 'ai_translation' && path[1] === 'scope' && typeof path[2] === 'string' && (after === 'true' || after === 'false')) {
    return after === 'true'
      ? tr(lang, '开启 AI 翻译后，该板块中的新闻标题会被自动翻译为目标语言。', 'Translates headlines in this section when AI translation is enabled.')
      : tr(lang, '该板块保留原始语言标题，不进行 AI 翻译。', 'Keeps original headlines in this section without translation.')
  }

  const source = file === 'config.yaml' ? sourceListPurpose(path, kind) : undefined
  if (source && (kind !== 'removed' || path.length <= 3)) return pick(source)
  const field = templateField(baseTree, change.originalPath)
  let purpose = file === 'timeline.yaml' ? timelinePurpose(path, after) : fieldPurposes.get(key)
  if (file === 'config.yaml') {
    if (path[0] === 'display' && path[1] === 'standalone' && (path[2] === 'platforms' || path[2] === 'rss_feeds')) {
      purpose = ['独立展示区会从这份名单选择热榜或订阅源，绕过关键词过滤单独展示。', 'The standalone section uses this list to select hotlists or RSS feeds to display unfiltered.']
    }
    if (path[0] === 'advanced' && path[1] === 'batch_size' && path.length === 3 && field) {
      purpose = ['发送较长的通知时，程序按这个字节上限把内容拆成多条消息。', 'Long notifications are split into messages using this size limit in bytes.']
    }
    if (path[0] === 'ai' && path[1] === 'extra_params') {
      purpose = ['向 LiteLLM 底层请求原样透传额外的模型参数（如 top_p、presence_penalty 等）。', 'Passes extra request parameters directly through to LiteLLM.']
    }
    if (path[0] === 'web_search' && path[1] === 'providers' && path.length >= 3 && !purpose) {
      if (path[3] === 'api_key') purpose = ['用于向所选联网搜索引擎服务验证身份。', 'Authenticates requests to the configured web search provider.']
      else if (path[3] === 'api_base') purpose = ['联网搜索会向此接口地址发送查询请求。', 'Web search sends queries to this provider endpoint.']
      else purpose = ['配置该联网搜索引擎的连接参数。', 'Configures connection settings for this web search provider.']
    }
  }
  const sensitive = isSensitiveField(file, path)
  const note = path.length > 1 && !sensitive ? field?.comment.split('\n').find((line) => /[\p{L}]/u.test(line) && !/^[-=─#]/u.test(line)) : undefined
  if (sensitive && field && !purpose) {
    purpose = ['更新对应服务的连接密钥。运行时会使用这里的设置或已配置的环境变量。', 'Updates the service credential. Runs use this setting or its configured environment variable.']
  }
  if (kind === 'removed') {
    if (file === 'config.yaml' && ((path[0] === 'platforms' && path[1] === 'sources') || (path[0] === 'rss' && path[1] === 'feeds')) && path[3] === 'enabled') {
      return tr(lang, '恢复默认启用状态，采集时会正常读取该来源。', 'Restores the default enabled state so collection reads this source.')
    }
    const removed = tr(lang, '配置文件不再指定此项。', 'The configuration no longer sets this option.')
    const detail = (purpose ? pick(purpose) : undefined) ?? (source ? pick(source) : undefined) ?? note
    return detail ? `${removed} ${detail}` : removed
  }
  if (file === 'config.yaml') {
    if (key === 'web_search.max_items_per_topic' && after && /^\d+$/.test(after)) {
      if (after === '0') return tr(lang, '没有单独设置条数的搜索主题，将展示所有通过筛选的结果。', 'Topics without their own limit show all search results that pass the filters.')
      return tr(lang, '没有单独设置条数的搜索主题，每个最多展示 {count} 条结果。', 'Each topic without its own limit shows up to {count} search results.', { count: after })
    }
    if (key === 'filter.method' && after === '"ai"') return tr(lang, '默认改用 AI 按兴趣描述筛选新闻，运行时需要可用的 AI 模型。', 'By default, AI filters news using your interests. A working AI model is required.')
    if (key === 'filter.method' && after === '"keyword"') return tr(lang, '默认按关键词文件中的词组和排除规则筛选新闻。', 'By default, news is filtered using groups and exclusions in the keyword file.')
    if (key === 'report.mode') {
      const modes: Record<string, Copy> = {
        '"current"': ['报告默认展示当前在榜的匹配新闻。', 'Reports show currently ranked matches by default.'],
        '"incremental"': ['报告默认只展示本次新增的匹配新闻，没有新增时不重复推送。', 'Reports show only newly found matches by default, skipping quiet runs.'],
        '"daily"': ['报告默认汇总当天的匹配新闻，包括先前已出现的内容。', 'Reports summarize the day’s matches by default, including earlier items.'],
      }
      if (after && Object.hasOwn(modes, after)) return pick(modes[after])
    }
    if (path[0] === 'display' && path[1] === 'region_order') return tr(lang, '报告按这份列表从上到下排列已开启的板块。', 'Reports display enabled sections in the order of this list.')
    if (path[0] === 'ai' && path[1] === 'fallback_models') return tr(lang, '主模型调用失败时，会按这个顺序尝试备用模型。', 'If the primary model fails, fallback models are tried in this order.')
  }
  if (purpose) return pick(purpose)
  if (note) return note
  if (toggle) return tr(lang, '这项开关接受 true 或 false，当前值需要检查。', 'This switch expects true or false. Check the current value.')
  if (field && field.kind === 'map') return tr(lang, '这一组配置已整体替换，组内的设置随之变化。', 'This group has been replaced, changing the settings it contains.')
  return tr(lang, '随附模板没有提供此项的作用说明，具体行为取决于运行版本如何读取它。', 'The bundled template does not document this option. Its effect depends on how your version reads it.')
}

/**
 * Returns a localized description for a YAML field in ProYamlFields when
 * the raw YAML comment language differs from the active UI language.
 */
export function describeYamlFieldHint(
  file: 'config.yaml' | 'timeline.yaml',
  path: YamlPath,
  value: unknown,
  rawComment: string,
  lang: Lang,
): string {
  const commentFirstLines = rawComment.split('\n').slice(0, 2).join(' ').trim()
  const hasCjk = /[\u4e00-\u9fa5]/.test(commentFirstLines)
  if (commentFirstLines && ((lang === 'zh' && hasCjk) || (lang === 'en' && !hasCjk))) {
    return commentFirstLines
  }

  const pick = (pair: Copy) => tr(lang, pair[0], pair[1])
  const key = formatFieldPath(path)

  if (file === 'config.yaml') {
    const toggle = switches.get(key)
    if (toggle) return pick(value === false ? toggle.off : toggle.on)
    const direct = fieldPurposes.get(key)
    if (direct) return pick(direct)
    const source = sourceListPurpose(path, 'changed')
    if (source) return pick(source)
    const title = FIELD_TITLES.get(key)
    if (title) return pick(title)
  } else {
    const tl = timelinePurpose(path)
    if (tl) return pick(tl)
  }

  return commentFirstLines
}
