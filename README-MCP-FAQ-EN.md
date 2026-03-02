<div align="center">

**[中文](README-MCP-FAQ.md)** | **English**

</div>

# TrendRadar MCP Tool Usage Q&A

> AI Query Guide - How to Use News Trend Analysis Tools Through Natural Conversation (v3.1.7)

---

## 📋 Tools Overview

| Category | Tool Name | Description |
|:--------:|-----------|-------------|
| **Date** | `resolve_date_range` | Parse "this week", "last 7 days" to standard dates |
| **Query** | `get_latest_news` | Get the latest batch of trending news |
| | `get_news_by_date` | Query historical news by date range |
| | `get_trending_topics` | Get trending topics statistics (auto-extract supported) |
| **RSS** | `get_latest_rss` | Get latest RSS subscription content |
| | `search_rss` | Search keywords in RSS data |
| | `get_rss_feeds_status` | View RSS feed config and data status |
| **Search** | `search_news` | Unified search (keyword/fuzzy/entity, RSS optional) |
| | `find_related_news` | Find news similar to a given title |
| **Analysis** | `analyze_topic_trend` | Topic trend analysis (hotness/lifecycle/viral/predict) |
| | `analyze_data_insights` | Data insights (platform compare/activity/co-occurrence) |
| | `analyze_sentiment` | News sentiment analysis |
| | `aggregate_news` | Cross-platform news aggregation & dedup |
| | `compare_periods` | Period comparison (week-over-week/month-over-month) |
| | `generate_summary_report` | Generate daily/weekly summary reports |
| **System** | `get_current_config` | Get current system configuration |
| | `get_system_status` | Get system running status |
| | `check_version` | Check version updates (TrendRadar + MCP Server) |
| | `trigger_crawl` | Manually trigger a crawl task |
| **Storage** | `sync_from_remote` | Pull data from remote storage to local |
| | `get_storage_status` | Get storage config and status |
| | `list_available_dates` | List available dates (local/remote) |
| **Article** | `read_article` | Read single article content (Markdown format) |
| | `read_articles_batch` | Batch read multiple articles (max 5) |
| **Notification** | `get_notification_channels` | Get all configured notification channels and their status |
| | `send_notification` | Send messages to configured notification channels (auto format conversion) |

---

## ⚙️ Default Settings Explanation (Important!)

The following optimization strategies are adopted by default, mainly to save AI token consumption:

| Default Setting | Description | How to Adjust |
| -------------- | --------------------------------------- | ------------------------------------- |
| **Result Limit** | Default returns 50 news items | Say "return top 10" or "give me 100 items" in conversation |
| **Time Range** | Default queries today's data | Say "query yesterday", "last week" or "Jan 1 to 7" |
| **URL Links** | Default no links (saves ~160 tokens/item) | Say "need links" or "include URLs" |
| **Keyword List** | Default does not use frequency_words.txt to filter news | Only used when calling "trending topics" tool |

**⚠️ Important:** The choice of AI model directly affects the tool call effectiveness. The smarter the AI, the more accurate the calls. When you remove the above restrictions, for example, from querying today to querying a week, first you need to have a week's data locally, and secondly, token consumption may multiply.

**💡 Tip:** This project provides a dedicated date parsing tool that can accurately parse natural language date expressions like "last 7 days", "this week", ensuring all AI models get consistent date ranges. See Q18 below for details.


## 💰 AI Models

Below I use the **[SiliconFlow](https://cloud.siliconflow.cn)** platform as an example, which has many large models to choose from. During the development and testing of this project, I used this platform for many functional tests and validations.

### 📊 Registration Method Comparison

| Registration Method | Direct Registration Without Referral | Registration With Referral Link |
|:-------:|:-------:|:-----------------:|
| Registration Link | [siliconflow.cn](https://cloud.siliconflow.cn) | [Referral Link](https://cloud.siliconflow.cn/i/fqnyVaIU) |
| Free Quota | 0 tokens | **20 million tokens** (≈$2) |
| Extra Benefits | ❌ | ✅ Referrer also gets 20 million tokens |

> 💡 **Tip**: The above gift quota should allow for **200+ queries**


### 🚀 Quick Start

#### 1️⃣ Register and Get API Key

1. Complete registration using the link above
2. Visit [API Key Management Page](https://cloud.siliconflow.cn/me/account/ak)
3. Click "Create New API Key"
4. Copy the generated key (please keep it safe)

#### 2️⃣ Configure in Cherry Studio

1. Open **Cherry Studio**
2. Go to "Model Service" settings
3. Find "SiliconFlow"
4. Paste the copied key into the **[API Key]** input box
5. Ensure the checkbox in the top right corner shows **green** when enabled ✅

---

### ✨ Configuration Complete!

Now you can start using this project and enjoy stable and fast AI services!

After testing one query, please immediately check the [SiliconFlow Billing](https://cloud.siliconflow.cn/me/bills) to see the consumption and have an estimate in mind.


---

## Basic Queries

### Q1: How to view the latest news?

**You can ask like this:**

- "Show me the latest news"
- "Query today's trending news"
- "Get the latest 10 news from Zhihu and Weibo"
- "View latest news, need links included"

**Tool return behavior:**

- Tool returns the latest 50 news items from all platforms
- Does not include URL links by default (saves tokens)

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial news (like TOP 10-20 items)
- ✅ If you want to see all 50 items, need to explicitly request: "show all news" or "list all 50 items completely"
- 💡 This is the AI model's natural behavior, not a tool limitation

**Can be adjusted:**

- Specify platform: like "only Zhihu"
- Adjust quantity: like "return top 20"
- Include links: like "need links"
- **Request full display**: like "show all, don't summarize"

---

### Q2: How to query news from a specific date?

**You can ask like this:**

- "Query yesterday's news"
- "Check Zhihu news from 3 days ago"
- "What news was there on 2025-10-10"
- "News from last Monday"
- "Show me the latest news" (automatically queries today)

**Supported date formats:**

- Relative dates: today, yesterday, day before yesterday, 3 days ago
- Days of week: last Monday, this Wednesday
- Absolute dates: 2025-10-10, October 10

**Tool return behavior:**

- Automatically queries today when date not specified (saves tokens)
- Tool returns 50 news items from all platforms
- Does not include URL links by default

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial news (like TOP 10-20 items)
- ✅ If you want to see all, need to explicitly request: "show all news, don't summarize"

---

### Q3: How to view trending topic statistics?

**You can ask like this:**

- "How many times did my followed words appear today" (using preset keywords)
- "Automatically analyze what hot topics are in today's news" (auto extract)
- "See what are the hottest words in the news" (auto extract)

**Two extraction modes:**

| Mode | Description | Example Question |
|------|------|---------|
| **Preset keywords** | Count preset followed words (based on config file, default) | "How many times did my followed words appear" |
| **Auto extract** | Auto-extract high-frequency words from news titles (no preset needed) | "Auto-analyze hot topics" |

---

## RSS Feed Queries

### Q4.1: How to view latest RSS feed content?

**You can ask like this:**

- "Show me the latest RSS feed content"
- "Get the latest articles from Hacker News"
- "View latest 20 items from all RSS feeds"
- "Get RSS feeds, need to include summaries"
- "Show me RSS content from the last week" (multi-day query support)
- "Get Hacker News articles from last 7 days"

**Tool return behavior:**

- Returns today's RSS items by default (up to 50)
- Supports `days` parameter for multi-day queries (1-30 days)
- Does not include summaries by default (saves tokens)
- Sorted by publication time in descending order
- Auto-deduplication across dates (by URL)

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial items
- ✅ If you want to see all, need to explicitly request: "show all RSS content"

**Can be adjusted:**

- Specify RSS feed: like "only Hacker News"
- Specify days: like "last 7 days", "past week"
- Adjust quantity: like "return top 20"
- Include summary: like "need summaries"

---

### Q4.2: How to search content in RSS feeds?

**You can ask like this:**

- "Search for 'AI' related articles in RSS"
- "Search RSS content about 'machine learning' from last 7 days"
- "Search 'Python' in Hacker News"

**Tool return behavior:**

- Searches RSS item titles using keywords
- Default searches last 7 days of data
- Tool returns up to 50 results

**Can be adjusted:**

- Specify RSS feed: like "only search Hacker News"
- Adjust days: like "search last 14 days"
- Include summary: like "need summaries"

---

### Q4.3: How to view RSS feed status?

**You can ask like this:**

- "View RSS feed status"
- "How much data has RSS crawled"
- "Which RSS feeds have data"

**Return information:**

| Field | Description |
|-------|-------------|
| **Available dates** | List of dates with RSS data |
| **Total date count** | How many days of data total |
| **Today's feed stats** | Today's data statistics by RSS feed |
| **Generation time** | Status generation time |

---

## Search and Retrieval

### Q4: How to search for news containing specific keywords?

**You can ask like this:**

- "Search for news containing 'artificial intelligence'"
- "Find reports about 'Tesla price cut'"
- "Search for news about Musk, return top 20"
- "Find news about 'iPhone 16' in the last 7 days"
- "Find news about 'Tesla' from January 1 to 7, 2025"
- "Find the link to the news 'iPhone 16 release'"

**Tool return behavior:**

- Uses keyword mode search
- Default searches today's data
- AI automatically converts relative time like "last 7 days", "last week" to specific date ranges
- Tool returns up to 50 results
- Does not include URL links by default

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial search results
- ✅ If you want to see all, need to explicitly request: "show all search results"

**Can be adjusted:**

- Specify time range:
  - Relative way: "search last week" (AI automatically calculates dates)
  - Absolute dates: "search from January 1 to 7, 2025"
- Specify platform: like "only search Zhihu"
- Adjust sorting: like "sort by weight"
- Include links: like "need links"

---

### Q4.4: How to search both hot news and RSS content simultaneously?

**You can ask like this:**

- "Search for 'AI' content, including RSS"
- "Find news about 'artificial intelligence', also search RSS subscriptions"
- "Search for 'Tesla', both hot news and RSS"

**Tool return behavior:**

- Hot news results and RSS results are **displayed separately**
- Hot news sorted by rank/relevance, RSS sorted by publish time
- RSS results do not affect hot news ranking display
- Default returns 50 hot news + 20 RSS items

**Can be adjusted:**

- RSS count: like "return 10 RSS items"
- Only search hot news: don't say "including RSS" (default behavior)
- Only search RSS: say "only search in RSS"

---

### Q5: How to find related news?

**You can ask like this:**

- "Find news similar to 'Tesla price cut'" (today)
- "Find news related to 'AI breakthrough' from yesterday" (history)
- "Search for historical reports about 'Tesla' from last week" (history)
- "See if there are reports similar to this news in the last 7 days" (history)

**Supported time ranges:**

| Method | Description | Example |
|--------|-------------|---------|
| Not specified | Only query today's data (default) | "Find similar news" |
| Preset values | yesterday, last week, last month | "Find related news from yesterday" |
| Date range | Specify start and end dates | "Find related reports from Jan 1 to 7" |

**Tool return behavior:**

- Similarity threshold 0.5 (adjustable)
- Tool returns up to 50 results
- Sorted by similarity
- Does not include URL links by default

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial related news
- ✅ If you want to see all, need to explicitly request: "show all related news"

**Can be adjusted:**

- Specify time: like "find from last week"
- Adjust threshold: like "similarity above 0.3"
- Include links: say "need links"

---

## Trend Analysis

### Q6: How to analyze topic heat trends?

**You can ask like this:**

- "Analyze the heat trend of 'artificial intelligence' in the last week"
- "See if 'Tesla' topic is a flash in the pan or sustained hot topic"
- "Detect which topics suddenly went viral today"
- "Predict potential hot topics coming up"
- "Analyze the lifecycle of 'Bitcoin' in December 2024"

**Four analysis modes:**

| Mode | Description | Example Question |
|------|------|---------|
| **Heat trend** | Track topic heat changes | "Analyze 'AI' heat trend" |
| **Lifecycle** | Complete cycle from emergence to disappearance | "See if 'XX' is a flash in the pan or sustained hot topic" |
| **Anomaly detection** | Identify suddenly viral topics | "What topics suddenly went viral today" |
| **Prediction** | Predict future hot topics | "Predict upcoming hot topics" |

**Tool return behavior:**

- AI automatically converts relative time like "last week" to specific date ranges
- Default analyzes last 7 days of data
- Statistics by day granularity

---

## Data Insights

### Q7: How to compare different platforms' attention to topics?

**You can ask like this:**

- "Compare different platforms' attention to 'artificial intelligence' topic"
- "See which platform updates most frequently"
- "Analyze which keywords often appear together"

**Three insight modes:**

| Mode | Function | Example Question |
| -------------- | ---------------- | -------------------------- |
| **Platform Compare** | Compare platform attention | "Compare platforms' attention to 'AI'" |
| **Activity Stats** | Count platform posting frequency | "See which platform updates most frequently" |
| **Keyword Co-occurrence** | Analyze keyword associations | "Which keywords often appear together" |

**Tool return behavior:**

- Default uses platform compare mode
- Analyzes today's data
- Keyword co-occurrence minimum frequency 3 times

---

## Sentiment Analysis

### Q8: How to analyze news sentiment?

**You can ask like this:**

- "Analyze today's news sentiment"
- "See if 'Tesla' related news is positive or negative"
- "Analyze different platforms' sentiment towards 'artificial intelligence'"
- "See the sentiment of 'Bitcoin' within a week, choose the top 20 most important"

**Tool return behavior:**

- Default analyzes today's data
- Tool returns up to 50 news items
- Sorted by weight (prioritizing important news)
- Does not include URL links by default

**AI display behavior (Important):**

- ⚠️ This tool returns **AI prompts**, not direct sentiment analysis results
- AI generates sentiment analysis reports based on prompts
- Usually displays sentiment distribution, key findings, and representative news

**Can be adjusted:**

- Specify topic: like "about 'Tesla'"
- Specify time: like "last week"
- Adjust quantity: like "return top 20"

---

### Q9: How to get deduplicated cross-platform news?

**You can ask like this:**

- "Help me aggregate today's news, remove duplicates"
- "See which news is reported on multiple platforms"
- "Show me deduplicated hotspot news"
- "Which news are cross-platform hot topics"

**Tool functionality:**

- Automatically identifies the same event reported by different platforms
- Merges similar news into one aggregated news item
- Shows platform coverage for each news item
- Calculates comprehensive heat weight

**Return information:**

| Field | Description |
|-------|-------------|
| **Representative title** | Representative title of this news group |
| **Covered platforms** | Which platforms reported this news |
| **Platform count** | How many platforms covered |
| **Is cross-platform** | Whether it's a cross-platform hot topic |
| **Best rank** | Best ranking across platforms |
| **Comprehensive weight** | Comprehensive heat score |
| **Platform sources** | Detailed info from each platform |

**Can be adjusted:**

- Specify time: like "from last week"
- Adjust similarity threshold: like "stricter matching" or "looser matching"
- Specify platform: like "only Zhihu and Weibo"

---

### Q10: How to generate daily or weekly hotspot summaries?

**You can ask like this:**

- "Generate today's news summary report"
- "Give me a weekly hotspot summary"
- "Generate news analysis report for the past 7 days"

**Report types:**

- Daily summary: Summarizes the day's hotspot news
- Weekly summary: Summarizes a week's hotspot trends

---

### Q11: How to compare hotspot changes across different periods?

**You can ask like this:**

- "Compare this week and last week's hotspot changes"
- "See what's different between this month and last month"
- "Analyze 'artificial intelligence' heat difference in two periods"
- "Compare platform activity changes"

**Three comparison modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| **Overview** | News count change, keyword change, TOP news comparison | Quick understanding of overall changes |
| **Topic shift** | Rising topics, falling topics, newly appeared topics | Analyze hotspot migration |
| **Platform activity** | News count change by platform | Understand platform dynamics |

**Time period presets:**

- Today / Yesterday
- This week / Last week
- This month / Last month
- Or use custom date range

---

## System Management

### Q12: How to view system configuration?

**You can ask like this:**

- "View current system configuration"
- "Display configuration file content"
- "What platforms are available?"
- "What's the current weight configuration?"

**Can query:**

- Available platform list
- Crawler configuration (request interval, timeout settings)
- Weight configuration (ranking weight, frequency weight)
- Notification configuration (Feishu, DingTalk, WeCom, Telegram, Email, ntfy, Bark, Slack, Generic Webhook)

---

### Q13: How to check system running status?

**You can ask like this:**

- "Check system status"
- "Is the system running normally?"
- "When was the last crawl?"
- "How many days of historical data?"

**Return information:**

- System version and status
- Last crawl time
- Historical data days
- Health check results

---

### Q13.1: How to check for version updates?

**You can ask like this:**

- "Check for version updates"
- "Is there a new version?"
- "Is the current version up to date?"

**Return information:**

Will check both components' versions simultaneously:

| Component | Description |
|-----------|-------------|
| **TrendRadar** | Core crawler and analysis engine |
| **MCP Server** | AI conversation tool service |

For each component, you'll get:
- Currently installed version
- Latest available version
- Whether an update is needed
- Update recommendation

**Can be adjusted:**

- If GitHub access is slow, say "check version updates, use proxy http://127.0.0.1:10801"

---

### Q14: How to manually trigger a crawl task?

**You can ask like this:**

- "Please crawl current Toutiao news" (temporary query)
- "Help me fetch latest news from Zhihu and Weibo and save" (persistent)
- "Trigger a crawl and save data" (persistent)
- "Get real-time data from 36Kr but don't save" (temporary query)

**Two modes:**

| Mode | Purpose | Example |
| -------------- | -------------------- | -------------------- |
| **Temporary Crawl** | Only return data without saving | "Crawl Toutiao news" |
| **Persistent Crawl** | Save to output folder | "Fetch and save Zhihu news" |

**Tool return behavior:**

- Default is temporary crawl mode (no save)
- Default crawls all platforms
- Does not include URL links by default

**AI display behavior (Important):**

- ⚠️ **AI usually summarizes crawl results**, only showing partial news
- ✅ If you want to see all, need to explicitly request: "show all crawled news"

**Can be adjusted:**

- Specify platform: like "only crawl Zhihu"
- Save data: say "and save" or "save locally"
- Include links: say "need links"

---

## Storage Sync

### Q15: How to sync data from remote storage to local?

**You can ask like this:**

- "Sync last 7 days data from remote"
- "Pull data from remote storage to local"
- "Sync last 30 days of news data"

**Use cases:**

- Crawler deployed in the cloud (e.g., GitHub Actions), data stored remotely (e.g., Cloudflare R2)
- MCP Server deployed locally, needs to pull data from remote for analysis

**Return information:**

- Number of successfully synced files
- List of successfully synced dates
- Skipped dates (already exist locally)
- Failed dates and error information

**Prerequisites:**

Need to configure remote storage in config file or set environment variables:
- Service endpoint URL
- Bucket name
- Access key ID
- Secret access key

---

### Q16: How to view storage status?

**You can ask like this:**

- "View current storage status"
- "What's the storage configuration"
- "How much data is stored locally"
- "Is remote storage configured"

**Return information:**

| Category | Information |
|----------|-------------|
| **Local Storage** | Data directory, total size, date count, date range |
| **Remote Storage** | Whether configured, endpoint URL, bucket name, date count |
| **Pull Config** | Whether auto-pull enabled, pull days |

---

### Q17: How to view available data dates?

**You can ask like this:**

- "What dates are available locally"
- "What dates are in remote storage"
- "Compare local and remote data dates"
- "Which dates only exist remotely"

**Three query modes:**

| Mode | Description | Example Question |
|------|-------------|------------------|
| **Local** | View local only | "What dates are available locally" |
| **Remote** | View remote only | "What dates are in remote" |
| **Compare** | Compare both (default) | "Compare local and remote data" |

**Return information (compare mode):**

- Dates only existing locally
- Dates only existing remotely (useful for deciding which dates to sync)
- Dates existing in both places

---

### Q18: How to parse natural language date expressions? (Recommended to use first)

**You can ask like this:**

- "Parse what days 'this week' is"
- "What date range does 'last 7 days' correspond to"
- "Last month's date range"
- "Help me convert 'last 30 days' to specific dates"

**Why is this tool needed?**

Users often use natural language like "this week", "last 7 days" to express dates, but different AI models calculating dates on their own will produce inconsistent results. This tool uses server-side precise time calculations to ensure all AI models get consistent date ranges.

**Supported date expressions:**

| Type | Chinese Expression | English Expression |
|------|---------|---------|
| Single Day | 今天、昨天 | today, yesterday |
| Week | 本周、上周 | this week, last week |
| Month | 本月、上月 | this month, last month |
| Last N Days | 最近7天、最近30天 | last 7 days, last 30 days |
| Dynamic | 最近N天 (any number) | last N days |

**Usage advantages:**

- ✅ **Consistency**: All AI models get the same date range
- ✅ **Accuracy**: Based on server-side precise time calculation
- ✅ **Standardization**: Returns standard date format
- ✅ **Flexibility**: Supports Chinese/English, dynamic days

---

## Article Content Reading

### Q19: How to read the full content of a news article?

**You can ask like this:**

- "Help me read the content of this news: https://example.com/news/123"
- "Get the article body from this link"
- "Read the detailed content of this report"

**Tool functionality:**

- Converts web pages to clean Markdown format via Jina AI Reader
- Automatically removes ads, navigation bars, sidebars, and other noise
- Returns LLM-friendly structured content

**Typical workflow:**

1. First use `search_news(include_url=True)` to search news and get links
2. Then use `read_article(url=link)` to read the article body
3. AI analyzes, summarizes, translates the Markdown content

**Return information:**

| Field | Description |
|-------|-------------|
| **content** | Article body in Markdown format |
| **url** | Original link |
| **content_length** | Content length (characters) |

**Can be adjusted:**

- Timeout: like "set timeout to 60 seconds" (default 30 seconds, max 60 seconds)

**Notes:**

- 5-second interval between requests (built-in rate control)
- Uses Jina AI Reader free service (100 RPM limit)
- Some paywalled/login-required pages may not be fully accessible

---

### Q20: How to batch read multiple articles?

**You can ask like this:**

- "Help me read the content of these news articles"
- "Batch get the article bodies from these links"
- "Read the detailed content of the first 3 search results"

**Typical workflow:**

1. First use `search_news(include_url=True)` to search news and get multiple links
2. Then use `read_articles_batch(urls=[...])` to batch read article bodies
3. AI performs comparative analysis, comprehensive reports on multiple articles

**Tool limits:**

| Limit | Value |
|-------|-------|
| Max articles per batch | **5** |
| Request interval | **5 seconds** |
| Estimated time (5 articles) | **25-30 seconds** |

**Return information:**

| Field | Description |
|-------|-------------|
| **summary** | Statistics of batch reading |
| **articles** | Content and status of each article |
| **note** | If any articles were skipped, explains why |

**Notes:**

- Articles beyond 5 will be automatically skipped
- Single article failure doesn't affect other articles
- More articles mean longer wait time, please be patient

---

## Notification Push

### Q21: How to send notification messages via MCP?

**You can ask like this:**

- "Show me which notification channels are configured"
- "Send a test message to all channels"
- "Push this content to Feishu"
- "Send today's news summary to DingTalk and Telegram"

**Supported notification channels (9):**

| Channel | Message Format | Configuration |
|---------|---------------|---------------|
| **Feishu** | Plain text | `FEISHU_WEBHOOK_URL` |
| **DingTalk** | Markdown | `DINGTALK_WEBHOOK_URL` |
| **WeCom** | Markdown | `WEWORK_WEBHOOK_URL` |
| **Telegram** | HTML | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| **Email** | HTML | `EMAIL_FROM` + `EMAIL_PASSWORD` + `EMAIL_TO` |
| **ntfy** | Markdown | `NTFY_SERVER_URL` + `NTFY_TOPIC` |
| **Bark** | Markdown | `BARK_URL` |
| **Slack** | mrkdwn | `SLACK_WEBHOOK_URL` |
| **Generic Webhook** | Markdown | `GENERIC_WEBHOOK_URL` |

**Configuration methods:**

- Configure channels in `config.yaml` under `notification.channels`
- Or set corresponding environment variables in `.env` file (higher priority)
- Both sources are automatically merged, `.env` values override `config.yaml` values

**Two tools:**

| Tool | Function | Example Question |
|------|----------|------------------|
| `get_notification_channels` | Detect configured channels and status | "View notification channel config" |
| `send_notification` | Send message to specified or all channels | "Send message to Feishu" |

**Typical workflow:**

1. Check channel status first: "Show me which notification channels are configured"
2. Send after confirming availability: "Push the following to DingTalk: today's hotspot summary..."
3. Or specify multiple channels: "Send to Feishu and Telegram"
4. Without specifying channels, sends to all configured channels

**Message format:**

- The tool accepts messages in **Markdown format**
- Automatically converts to each channel's required format (Feishu to plain text, Telegram to HTML, Slack to mrkdwn, etc.)
- No need to manually handle format differences

**Multi-account support:**

- Separate multiple URLs/Tokens with `;` in config values to send to multiple accounts
- For example: `FEISHU_WEBHOOK_URL=url1;url2` sends to two Feishu groups simultaneously

---

## 💡 Usage Tips

### 1. How to make AI display all data instead of auto-summarizing?

**Background**: Sometimes AI automatically summarizes data, only showing partial content, even if the tool returned complete 50 items of data.

**If AI still summarizes, you can**:

- **Method 1 - Explicit request**: "Please show all news, don't summarize"
- **Method 2 - Specify quantity**: "Show all 50 news items"
- **Method 3 - Question the behavior**: "Why only showed 15? I want to see all"
- **Method 4 - State upfront**: "Query today's news, fully display all results"

**Note**: AI may still adjust display method based on context.


### 2. How to combine multiple tools?

**Example: In-depth analysis of a topic**

1. Search first: "Search for news about 'artificial intelligence'"
2. Then analyze trends: "Analyze the heat trend of 'artificial intelligence'"
3. Finally sentiment analysis: "Analyze sentiment of 'artificial intelligence' news"

**Example: Track an event**

1. View latest: "Query today's news about 'iPhone'"
2. Find history: "Find historical news related to 'iPhone' from last week"
3. Find similar reports: "Find news similar to 'iPhone launch event'"
