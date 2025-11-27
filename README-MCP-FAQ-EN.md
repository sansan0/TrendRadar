<div align="center">

**[中文](README-MCP-FAQ.md)** | **English**

</div>

# TrendRadar MCP Tool Usage Q&A

> AI Query Guide - How to Use News Trend Analysis Tools Through Conversation

## ⚙️ Default Settings Explanation (Important!)

The following optimization strategies are adopted by default, mainly to save AI token consumption:

| Default Setting | Description | How to Adjust |
| -------------- | --------------------------------------- | ------------------------------------- |
| **Result Limit** | Default returns 50 news items | Say "return top 10" or "give me 100 items" in conversation |
| **Time Range** | Default queries today's data | Say "query yesterday", "last week" or "Jan 1 to 7" |
| **URL Links** | Default no links (saves ~160 tokens/item) | Say "need links" or "include URLs" |
| **Keyword List** | Default does not use frequency_words.txt to filter news | Only used when calling "trending topics" tool |

**⚠️ Important:** The choice of AI model directly affects the tool call effectiveness. The smarter the AI, the more accurate the calls. When you remove the above restrictions, for example, from querying today to querying a week, first you need to have a week's data locally, and secondly, token consumption may multiply (why "may", for example, if I query "analyze 'Apple' trend in the last week", if there isn't much Apple news in that week, then token consumption may actually be less).

**💡 Tip:** This project provides a dedicated date parsing tool `resolve_date_range`, which can accurately parse natural language date expressions like "last 7 days", "this week", ensuring all AI models get consistent date ranges. Recommended to use this tool first, see Q14 below for details.


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


## Basic Queries

### Q1: How to view the latest news?

**You can ask like this:**

- "Show me the latest news"
- "Query today's trending news"
- "Get the latest 10 news from Zhihu and Weibo"
- "View latest news, need links included"

**Tool called:** `get_latest_news`

**Tool return behavior:**

- MCP tool returns the latest 50 news items from all platforms to AI
- Does not include URL links (saves tokens)

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

**Tool called:** `get_news_by_date`

**Supported date formats:**

- Relative dates: today, yesterday, day before yesterday, 3 days ago
- Days of week: last Monday, this Wednesday, last monday
- Absolute dates: 2025-10-10, October 10

**Tool return behavior:**

- Automatically queries today when date not specified (saves tokens)
- MCP tool returns 50 news items from all platforms to AI
- Does not include URL links

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial news (like TOP 10-20 items)
- ✅ If you want to see all, need to explicitly request: "show all news, don't summarize"

---

### Q3: How to view my followed topic frequency statistics?

**You can ask like this:**

- "How many times did my followed words appear today"
- "Check which words in my follow list are most popular"
- "Count the frequency of followed words in frequency_words.txt"

**Tool called:** `get_trending_topics`

**Important note:**

- This tool **does not** automatically extract news hotspots
- Rather, it counts your **personal followed words** set in `config/frequency_words.txt`
- This is a **customizable** list, you can add followed words based on your interests

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

**Tool called:** `search_news`

**Tool return behavior:**

- Uses keyword mode search
- Default searches today's data
- AI automatically converts relative time like "last 7 days", "last week" to specific date ranges
- MCP tool returns up to 50 results to AI
- Does not include URL links

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

**Recommended usage flow:**

```
User: Search for news about "AI breakthrough" in the last 7 days
Recommended steps:
1. First call resolve_date_range("last 7 days") to get precise date range
2. Then call search_news with the date range

User: Find "Tesla" reports from January 2025
AI: (date_range={"start": "2025-01-01", "end": "2025-01-31"})
```

---

### Q5: How to find historical related news?

**You can ask like this:**

- "Find news related to 'AI breakthrough' from yesterday"
- "Search for historical reports about 'Tesla' from last week"
- "Find news related to 'ChatGPT' from last month"
- "Look for historical news related to 'iPhone launch event'"

**Tool called:** `search_related_news_history`

**Tool return behavior:**

- Searches yesterday's data
- Similarity threshold 0.4
- MCP tool returns up to 50 results to AI
- Does not include URL links

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial related news
- ✅ If you want to see all, need to explicitly request: "show all related news"

---

## Trend Analysis

### Q6: How to analyze topic heat trends?

**You can ask like this:**

- "Analyze the heat trend of 'artificial intelligence' in the last week"
- "See if 'Tesla' topic is a flash in the pan or sustained hot topic"
- "Detect which topics suddenly went viral today"
- "Predict potential hot topics coming up"
- "Analyze the lifecycle of 'Bitcoin' in December 2024"

**Tool called:** `analyze_topic_trend`

**Tool return behavior:**

- Supports multiple analysis modes: heat trend, lifecycle, anomaly detection, prediction
- AI automatically converts relative time like "last week" to specific date ranges
- Default analyzes last 7 days of data
- Statistics by day granularity

**AI display behavior:**

- Usually displays trend analysis results and charts
- AI may summarize key findings

**Recommended usage flow:**

```
User: Analyze the lifecycle of 'artificial intelligence' in the last week
Recommended steps:
1. First call resolve_date_range("last week") to get precise date range
2. Then call analyze_topic_trend with the date range

User: See if 'Bitcoin' in December 2024 is a flash in the pan or sustained hot topic
AI: (date_range={"start": "2024-12-01", "end": "2024-12-31"})
```

---

## Data Insights

### Q7: How to compare different platforms' attention to topics?

**You can ask like this:**

- "Compare different platforms' attention to 'artificial intelligence' topic"
- "See which platform updates most frequently"
- "Analyze which keywords often appear together"

**Tool called:** `analyze_data_insights`

**Three insight modes:**

| Mode | Function | Example Question |
| -------------- | ---------------- | -------------------------- |
| **Platform Compare** | Compare platform attention | "Compare platforms' attention to 'AI'" |
| **Activity Stats** | Count platform posting frequency | "See which platform updates most frequently" |
| **Keyword Co-occurrence** | Analyze keyword associations | "Which keywords often appear together" |

**Tool return behavior:**

- Platform compare mode
- Analyzes today's data
- Keyword co-occurrence minimum frequency 3 times

**AI display behavior:**

- Usually displays analysis results and statistical data
- AI may summarize insight findings

---

## Sentiment Analysis

### Q8: How to analyze news sentiment?

**You can ask like this:**

- "Analyze today's news sentiment"
- "See if 'Tesla' related news is positive or negative"
- "Analyze different platforms' sentiment towards 'artificial intelligence'"
- "See the sentiment of 'Bitcoin' within a week, choose the top 20 most important"

**Tool called:** `analyze_sentiment`

**Tool return behavior:**

- Analyzes today's data
- MCP tool returns up to 50 news items to AI
- Sorted by weight (prioritizing important news)
- Does not include URL links

**AI display behavior (Important):**

- ⚠️ This tool returns **AI prompts**, not direct sentiment analysis results
- AI generates sentiment analysis reports based on prompts
- Usually displays sentiment distribution, key findings, and representative news

**Can be adjusted:**

- Specify topic: like "about 'Tesla'"
- Specify time: like "last week"
- Adjust quantity: like "return top 20"

---

### Q9: How to find similar news reports?

**You can ask like this:**

- "Find news similar to 'Tesla price cut'"
- "Find similar reports about iPhone launch"
- "See if there are reports similar to this news"
- "Find similar news, need links"

**Tool called:** `find_similar_news`

**Tool return behavior:**

- Similarity threshold 0.6
- MCP tool returns up to 50 results to AI
- Does not include URL links

**AI display behavior (Important):**

- ⚠️ **AI usually auto-summarizes**, only showing partial similar news
- ✅ If you want to see all, need to explicitly request: "show all similar news"

---

### Q10: How to generate daily or weekly hotspot summaries?

**You can ask like this:**

- "Generate today's news summary report"
- "Give me a weekly hotspot summary"
- "Generate news analysis report for the past 7 days"

**Tool called:** `generate_summary_report`

**Report types:**

- Daily summary: Summarizes the day's hotspot news
- Weekly summary: Summarizes a week's hotspot trends

---

## System Management

### Q11: How to view system configuration?

**You can ask like this:**

- "View current system configuration"
- "Display configuration file content"
- "What platforms are available?"
- "What's the current weight configuration?"

**Tool called:** `get_current_config`

**Can query:**

- Available platform list
- Crawler configuration (request interval, timeout settings)
- Weight configuration (ranking weight, frequency weight)
- Notification configuration (DingTalk, WeChat)

---

### Q12: How to check system running status?

**You can ask like this:**

- "Check system status"
- "Is the system running normally?"
- "When was the last crawl?"
- "How many days of historical data?"

**Tool called:** `get_system_status`

**Return information:**

- System version and status
- Last crawl time
- Historical data days
- Health check results

---

### Q13: How to manually trigger a crawl task?

**You can ask like this:**

- "Please crawl current Toutiao news" (temporary query)
- "Help me fetch latest news from Zhihu and Weibo and save" (persistent)
- "Trigger a crawl and save data" (persistent)
- "Get real-time data from 36Kr but don't save" (temporary query)

**Tool called:** `trigger_crawl`

**Two modes:**

| Mode | Purpose | Example |
| -------------- | -------------------- | -------------------- |
| **Temporary Crawl** | Only return data without saving | "Crawl Toutiao news" |
| **Persistent Crawl** | Save to output folder | "Fetch and save Zhihu news" |

**Tool return behavior:**

- Temporary crawl mode (no save)
- Crawls all platforms
- Does not include URL links

**AI display behavior (Important):**

- ⚠️ **AI usually summarizes crawl results**, only showing partial news
- ✅ If you want to see all, need to explicitly request: "show all crawled news"

**Can be adjusted:**

- Specify platform: like "only crawl Zhihu"
- Save data: say "and save" or "save locally"
- Include links: say "need links"

---

### Q14: How to parse natural language date expressions? (Recommended to use first)

**You can ask like this:**

- "Parse what days 'this week' is"
- "What date range does 'last 7 days' correspond to"
- "Last month's date range"
- "Help me convert 'last 30 days' to specific dates"

**Tool called:** `resolve_date_range`

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

**Return format:**

```json
{
  "success": true,
  "expression": "this week",
  "date_range": {
    "start": "2025-11-18",
    "end": "2025-11-26"
  },
  "current_date": "2025-11-26",
  "description": "This week (Monday to Sunday, 11-18 to 11-26)"
}
```

**Recommended usage flow:**

```
User: Analyze AI's sentiment this week
Recommended steps:
1. AI first calls resolve_date_range("this week") → gets {"start": "2025-11-18", "end": "2025-11-26"}
2. AI calls analyze_sentiment(topic="AI", date_range=date_range from previous step)

User: Check Tesla news from last 7 days
Recommended steps:
1. AI calls resolve_date_range("last 7 days") → gets precise date range
2. AI calls search_news(query="Tesla", date_range=date_range from previous step)
```

**Usage advantages:**

- ✅ **Consistency**: All AI models get the same date range
- ✅ **Accuracy**: Based on server-side Python `datetime.now()` calculation
- ✅ **Standardization**: Returns standard `YYYY-MM-DD` format
- ✅ **Flexibility**: Supports Chinese/English, dynamic days (last N days)

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
