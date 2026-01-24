# TrendRadar MCP 功能完整分析与使用指南

> **版本**: v1.0
> **更新日期**: 2025-01-21
> **适用范围**: TrendRadar v3.1.6+

---

## 📋 目录

1. [MCP 是什么](#mcp-是什么)
2. [TrendRadar MCP 架构](#trendradar-mcp-架构)
3. [核心功能详解](#核心功能详解)
4. [完整使用案例](#完整使用案例)
5. [部署方式](#部署方式)
6. [最佳实践](#最佳实践)

---

## MCP 是什么

### MCP 协议简介

**MCP (Model Context Protocol)** 是一个开放协议，用于连接 AI 应用与外部数据源和工具。

**核心价值**：
- 🔄 **标准化接口**: AI 模型通过统一协议调用工具
- 🔌 **即插即用**: 配置后 AI 可直接调用工具，无需编程
- 🎯 **智能决策**: AI 根据用户意图自动选择合适的工具

### TrendRadar MCP 的价值

TrendRadar MCP 将新闻热点聚合系统转化为 AI 的"工具箱"，让 AI 能够：

- 📰 **实时查询新闻**: 获取最新的热榜、RSS 订阅内容
- 🔍 **智能搜索**: 按关键词、相似度、实体检索新闻
- 📊 **数据分析**: 话题趋势、情感分析、平台对比
- 📈 **趋势预测**: 预测热点话题的未来走向
- 💾 **数据同步**: 从远程存储拉取数据进行分析

---

## TrendRadar MCP 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         AI 客户端                              │
│  (Cherry Studio / Claude Desktop / Cline / 其他 MCP 客户端)    │
└──────────────────────┬───────────────────────────────────────┘
                       │ MCP 协议
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   TrendRadar MCP Server                       │
│                    (FastMCP 2.0 实现)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 数据查询工具  │  │ 搜索检索工具  │  │   分析工具            │  │
│  │             │  │             │  │                     │  │
│  │ - 最新新闻   │  │ - 关键词搜索  │  │ - 趋势分析          │  │
│  │ - 日期查询   │  │ - 模糊搜索   │  │ - 情感分析          │  │
│  │ - RSS查询   │  │ - 相似新闻   │  │ - 平台对比          │  │
│  │ - 热点话题  │  │             │  │ - 时期对比          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                             │
│  │ 系统管理工具  │  │ 存储同步工具  │                             │
│  │             │  │             │                             │
│  │ - 配置查询   │  │ - 远程拉取   │                             │
│  │ - 状态检查  │  │ - 状态查询   │                             │
│  │ - 版本检测  │  │ - 日期列表   │                             │
│  │ - 触发爬取  │  │             │                             │
│  └─────────────┘  └─────────────┘                             │
├─────────────────────────────────────────────────────────────┤
│                    数据层                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ output/      │  │ config/      │  │ 远程存储          │   │
│  │              │  │              │  │ (R2/OSS/S3)      │   │
│  │ - hot_list/  │  │ - config.yaml│  │                  │   │
│  │ - rss/       │  │ - frequency_ │  └──────────────────┘   │
│  │ - archive/   │  │   words.txt  │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| **MCP 框架** | FastMCP | 2.0 |
| **异步运行时** | asyncio | - |
| **数据解析** | Python json | - |
| **传输协议** | stdio / HTTP | - |

---

## 核心功能详解

### 🛠️ 工具清单（21个工具）

#### 0️⃣ 日期解析工具（推荐优先调用）

**工具名**: `resolve_date_range`

**功能**: 将自然语言日期表达式解析为标准日期范围

**为什么需要这个工具？**
- 用户经常使用"本周"、"最近7天"等自然语言表达日期
- 不同 AI 模型自行计算日期会产生不一致的结果
- 此工具在服务器端使用精确时间计算，确保所有 AI 模型获得一致的日期范围

**输入参数**:
```python
expression: str  # 如 "本周"、"最近7天"、"this week"
```

**输出示例**:
```json
{
  "success": true,
  "expression": "本周",
  "date_range": {
    "start": "2025-01-20",
    "end": "2025-01-26"
  },
  "current_date": "2025-01-21",
  "description": "本周（周一到周日，01-20 至 01-26）"
}
```

**支持的表达式**:
- 单日: "今天"、"昨天"、"today"、"yesterday"
- 周: "本周"、"上周"、"this week"、"last week"
- 月: "本月"、"上月"、"this month"、"last month"
- 最近N天: "最近7天"、"最近30天"、"last 7 days"、"last 30 days"

---

#### 1️⃣ 基础数据查询工具（3个）

##### 1.1 `get_latest_news` - 获取最新新闻

**功能**: 获取最新一批爬取的热榜新闻，快速了解当前热点

**输入参数**:
```python
platforms: Optional[List[str]] = None  # 平台列表，如 ['zhihu', 'weibo']
limit: int = 50                        # 返回条数，默认50，最大1000
include_url: bool = False              # 是否包含URL链接（默认不包含，节省token）
```

**输出示例**:
```json
{
  "success": true,
  "count": 50,
  "news": [
    {
      "title": "OpenAI发布GPT-5",
      "platform": "知乎",
      "rank": 1,
      "score": 15000,
      "date": "2025-01-21"
    }
  ]
}
```

**使用场景**:
- 快速了解当前热点
- 获取特定平台的新闻
- 批量获取最新数据

##### 1.2 `get_news_by_date` - 按日期查询新闻

**功能**: 查询指定日期范围的历史新闻数据

**输入参数**:
```python
date_range: Optional[Union[Dict[str, str], str]] = None  # 日期范围
platforms: Optional[List[str]] = None                     # 平台列表
limit: int = 50                                           # 返回条数
include_url: bool = False                                 # 是否包含URL
```

**日期范围格式**:
- 范围对象: `{"start": "2025-01-01", "end": "2025-01-07"}`
- 自然语言: "今天"、"昨天"、"本周"、"最近7天"
- 单日字符串: "2025-01-15"
- 默认值: "今天"

##### 1.3 `get_trending_topics` - 获取热点话题统计

**功能**: 获取热点话题统计，支持两种提取模式

**输入参数**:
```python
top_n: int = 10          # 返回TOP N话题
mode: str = 'current'    # 时间模式："daily"(当日累计) / "current"(最新一批)
extract_mode: str = 'keywords'  # 提取模式："keywords"(预设关注词) / "auto_extract"(自动提取)
```

**两种提取模式对比**:

| 模式 | 说明 | 适用场景 | 示例 |
|------|------|---------|------|
| **keywords** | 统计预设关注词（基于 config/frequency_words.txt） | 关注特定领域新闻 | "我的关注词出现了多少次" |
| **auto_extract** | 自动从新闻标题提取高频词 | 发现未知热点 | "自动分析热门话题" |

---

#### 2️⃣ RSS 数据查询工具（3个）

##### 2.1 `get_latest_rss` - 获取最新 RSS 订阅数据

**功能**: 获取最新的 RSS 订阅数据（支持多日查询）

**输入参数**:
```python
feeds: Optional[List[str]] = None  # RSS源列表，如 ['hacker-news', '36kr']
days: int = 1                       # 获取最近N天，默认1（仅今天），最大30天
limit: int = 50                     # 返回条数
include_summary: bool = False       # 是否包含文章摘要
```

**特点**:
- RSS 数据与热榜新闻分开存储
- 按时间流展示（非排名）
- 支持跨日期自动去重（按URL）
- 适合获取特定来源的最新内容

##### 2.2 `search_rss` - 搜索 RSS 数据

**功能**: 在 RSS 订阅数据中搜索关键词

**输入参数**:
```python
keyword: str                        # 搜索关键词（必需）
feeds: Optional[List[str]] = None   # RSS源列表
days: int = 7                       # 搜索最近N天
limit: int = 50                     # 返回条数
include_summary: bool = False       # 是否包含摘要
```

##### 2.3 `get_rss_feeds_status` - 获取 RSS 源状态

**功能**: 查看当前配置的 RSS 源及其数据统计

**输出信息**:
- 可用日期列表
- 总日期数
- 今日各源数据统计
- 生成时间

---

#### 3️⃣ 智能检索工具（2个）

##### 3.1 `search_news` - 统一新闻搜索

**功能**: 支持多种搜索模式，可同时搜索热榜和RSS

**输入参数**:
```python
query: str                                           # 搜索关键词或内容片段
search_mode: str = "keyword"                         # 搜索模式："keyword"(精确) / "fuzzy"(模糊) / "entity"(实体)
date_range: Optional[Union[Dict[str, str], str]]     # 日期范围
platforms: Optional[List[str]] = None                # 平台列表
limit: int = 50                                      # 热榜返回条数
sort_by: str = "relevance"                           # 排序："relevance"(相关度) / "weight"(权重) / "date"(日期)
threshold: float = 0.6                               # 相似度阈值（仅fuzzy模式）
include_url: bool = False                            # 是否包含URL
include_rss: bool = False                            # 是否同时搜索RSS
rss_limit: int = 20                                  # RSS返回条数
```

**三种搜索模式**:
- **keyword**: 精确关键词匹配
- **fuzzy**: 模糊内容匹配（基于相似度）
- **entity**: 实体名称搜索（人物/地点/机构）

**输出结构**:
```json
{
  "hotlist_results": [...],  // 热榜搜索结果
  "rss_results": [...]       // RSS搜索结果（如果include_rss=True）
}
```

##### 3.2 `find_related_news` - 查找相关新闻

**功能**: 查找与指定新闻标题相关的其他新闻（支持历史数据）

**输入参数**:
```python
reference_title: str                                  # 参考新闻标题
date_range: Optional[Union[Dict[str, str], str]] = None  # 日期范围（不指定则查今天）
threshold: float = 0.5                                # 相似度阈值，0-1
limit: int = 50                                       # 返回条数
include_url: bool = False                             # 是否包含URL
```

**使用场景**:
- 追踪事件发展脉络
- 发现不同平台对同一事件的报道
- 查找历史相关新闻

---

#### 4️⃣ 高级数据分析工具（6个）

##### 4.1 `analyze_topic_trend` - 话题趋势分析

**功能**: 统一话题趋势分析，整合4种分析模式

**输入参数**:
```python
topic: str                                            # 话题关键词（必需）
analysis_type: str = "trend"                         # 分析类型
date_range: Optional[Union[Dict[str, str], str]]     # 日期范围，默认最近7天
granularity: str = "day"                             # 时间粒度
spike_threshold: float = 3.0                         # 热度突增倍数阈值（viral模式）
time_window: int = 24                                # 检测时间窗口小时数（viral模式）
lookahead_hours: int = 6                             # 预测未来小时数（predict模式）
confidence_threshold: float = 0.7                    # 置信度阈值（predict模式）
```

**四种分析模式**:

| 模式 | 说明 | 使用场景 | 示例 |
|------|------|---------|------|
| **trend** | 热度趋势分析 | 追踪话题热度变化 | "分析'AI'的热度趋势" |
| **lifecycle** | 生命周期分析 | 判断话题是昙花一现还是持续热点 | "看看'XX'是昙花一现还是持续热点" |
| **viral** | 异常热度检测 | 识别突然爆火的话题 | "今天有哪些突然爆火的话题" |
| **predict** | 话题预测 | 预测未来可能的热点 | "预测接下来可能的热点" |

##### 4.2 `analyze_data_insights` - 数据洞察分析

**功能**: 统一数据洞察分析，整合3种洞察模式

**输入参数**:
```python
insight_type: str = "platform_compare"               # 洞察类型
topic: Optional[str] = None                          # 话题关键词（platform_compare模式适用）
date_range: Optional[Union[Dict[str, str], str]] = None  # 日期范围（对象格式）
min_frequency: int = 3                               # 最小共现频次（keyword_cooccur模式）
top_n: int = 20                                      # 返回TOP N结果
```

**三种洞察模式**:

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| **platform_compare** | 平台对比分析 | 对比不同平台对话题的关注度 |
| **platform_activity** | 平台活跃度统计 | 统计各平台发布频率和活跃时间 |
| **keyword_cooccur** | 关键词共现分析 | 分析关键词同时出现的模式 |

##### 4.3 `analyze_sentiment` - 情感倾向分析

**功能**: 分析新闻的情感倾向和热度趋势

**输入参数**:
```python
topic: Optional[str] = None                          # 话题关键词（可选）
platforms: Optional[List[str]] = None                # 平台列表
date_range: Optional[Union[Dict[str, str], str]] = None  # 日期范围，默认今天
limit: int = 50                                      # 返回新闻数量
sort_by_weight: bool = True                          # 是否按热度权重排序
include_url: bool = False                            # 是否包含URL
```

**输出内容**:
- 情感分布统计
- 热度趋势数据
- 相关新闻列表
- AI 提示词（供 AI 生成情感分析报告）

##### 4.4 `aggregate_news` - 跨平台新闻聚合

**功能**: 将不同平台报道的同一事件合并为一条聚合新闻

**输入参数**:
```python
date_range: Optional[Union[Dict[str, str], str]] = None  # 日期范围，默认今天
platforms: Optional[List[str]] = None                     # 平台列表
similarity_threshold: float = 0.7                         # 相似度阈值，0.3-1.0
limit: int = 50                                           # 返回聚合新闻数量
include_url: bool = False                                 # 是否包含URL
```

**输出信息**:
- 代表性标题
- 覆盖平台列表
- 平台数量
- 是否跨平台热点
- 最佳排名
- 综合权重
- 各平台来源详情

##### 4.5 `compare_periods` - 时期对比分析

**功能**: 比较两个时间段的新闻数据

**输入参数**:
```python
period1: Union[Dict[str, str], str]                   # 第一个时间段（基准期）
period2: Union[Dict[str, str], str]                   # 第二个时间段（对比期）
topic: Optional[str] = None                           # 可选的话题关键词
compare_type: str = "overview"                        # 对比类型
platforms: Optional[List[str]] = None                 # 平台过滤列表
top_n: int = 10                                       # 返回TOP N结果
```

**三种对比类型**:
- **overview**: 总体概览 - 新闻数量、关键词变化、TOP新闻
- **topic_shift**: 话题变化分析 - 上升话题、下降话题、新出现话题
- **platform_activity**: 平台活跃度对比 - 各平台新闻数量变化

**时期格式支持**:
- 日期范围: `{"start": "2025-01-01", "end": "2025-01-07"}`
- 预设值: "today", "yesterday", "this_week", "last_week", "this_month", "last_month"

##### 4.6 `generate_summary_report` - 摘要报告生成

**功能**: 自动生成每日或每周的热点摘要报告

**输入参数**:
```python
report_type: str = "daily"                            # 报告类型："daily" / "weekly"
date_range: Optional[Union[Dict[str, str], str]] = None  # 自定义日期范围（对象格式）
```

---

#### 5️⃣ 配置与系统管理工具（4个）

##### 5.1 `get_current_config` - 获取当前系统配置

**输入参数**:
```python
section: str = "all"  # 配置节："all" / "crawler" / "push" / "keywords" / "weights"
```

##### 5.2 `get_system_status` - 获取系统运行状态

**返回信息**:
- 系统版本和状态
- 最后爬取时间
- 历史数据天数
- 健康检查结果

##### 5.3 `check_version` - 检查版本更新

**功能**: 同时检查 TrendRadar 和 MCP Server 的版本

**输入参数**:
```python
proxy_url: Optional[str] = None  # 可选的代理URL，用于访问GitHub
```

##### 5.4 `trigger_crawl` - 手动触发爬取任务

**输入参数**:
```python
platforms: Optional[List[str]] = None  # 平台列表
save_to_local: bool = False            # 是否保存到本地
include_url: bool = False              # 是否包含URL
```

**两种模式**:
- **临时爬取** (save_to_local=False): 只返回数据不保存
- **持久化爬取** (save_to_local=True): 保存到 output 文件夹

---

#### 6️⃣ 存储同步工具（3个）

##### 6.1 `sync_from_remote` - 从远程存储拉取数据

**功能**: 从远程存储（如 Cloudflare R2）拉取数据到本地

**输入参数**:
```python
days: int = 7  # 拉取最近N天的数据，默认7天
```

**使用场景**:
- 爬虫部署在云端（如 GitHub Actions）
- 数据存储到远程（如 Cloudflare R2）
- MCP Server 部署在本地，需要从远程拉取数据进行分析

**前提条件**: 需要配置远程存储或环境变量：
- S3_ENDPOINT_URL
- S3_BUCKET_NAME
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY

##### 6.2 `get_storage_status` - 获取存储状态

**返回信息**:
| 类别 | 信息 |
|------|------|
| **本地存储** | 数据目录、总大小、日期数量、日期范围 |
| **远程存储** | 是否配置、端点地址、存储桶名称、日期数量 |
| **拉取配置** | 是否启用自动拉取、拉取天数 |

##### 6.3 `list_available_dates` - 列出可用日期

**输入参数**:
```python
source: str = "both"  # "local" / "remote" / "both"
```

**三种查询模式**:
- **local**: 仅查看本地
- **remote**: 仅查看远程
- **both**: 同时列出并对比（默认）

---

## 完整使用案例

### 案例1：日常工作流程 - 晨间新闻概览

**场景**: 每天早上快速了解热点新闻

**对话流程**:

```
用户: 帮我看看今天有什么热点新闻

AI: [调用 get_latest_news(limit=50)]
根据最新数据，今天的热点新闻包括：
1. OpenAI发布GPT-5（知乎，排名第1）
2. 特斯拉发布新车型（微博，排名第2）
...

用户: 看看我的关注词出现了多少次

AI: [调用 get_trending_topics(mode="current", extract_mode="keywords")]
根据您的关注词配置，今天出现最多的是：
- AI: 15次
- 特斯拉: 12次
- 华为: 8次

用户: 自动分析一下还有什么其他热门话题

AI: [调用 get_trending_topics(extract_mode="auto_extract", top_n=10)]
从新闻标题中自动提取的热门话题：
- 人工智能: 23次
- 新能源汽车: 18次
- 芯片: 15次
...
```

**使用工具**:
1. `get_latest_news` - 获取最新新闻
2. `get_trending_topics(mode="keywords")` - 查看预设关注词
3. `get_trending_topics(mode="auto_extract")` - 自动提取热门话题

---

### 案例2：深度分析 - 追踪话题发展

**场景**: 深度分析某个话题的热度变化和发展趋势

**对话流程**:

```
用户: 分析"人工智能"最近一周的热度趋势

AI: [调用 resolve_date_range("最近7天")]
已解析日期范围：2025-01-14 至 2025-01-21

AI: [调用 analyze_topic_trend(topic="人工智能", analysis_type="trend", date_range={...})]
根据最近7天的数据分析，"人工智能"话题的热度趋势如下：
- 1月14日: 120次
- 1月15日: 135次
- 1月16日: 180次（激增50%）
- 1月17日: 195次
- 1月18日: 210次
- 1月19日: 225次
- 1月20日: 240次
- 1月21日: 255次

用户: 这个话题是昙花一现还是持续热点？

AI: [调用 analyze_topic_trend(topic="人工智能", analysis_type="lifecycle", date_range={...})]
根据生命周期分析，"人工智能"呈现：
- 持续增长模式（非昙花一现）
- 热度累计天数: 30+天
- 增长趋势: 稳定上升
- 预测: 未来一周仍将保持高热度

用户: 哪些平台对"人工智能"关注最多？

AI: [调用 analyze_data_insights(insight_type="platform_compare", topic="人工智能")]
各平台对"人工智能"的关注度对比：
1. 知乎: 85条（占比35%）
2. 微博: 72条（占比30%）
3. 36氪: 48条（占比20%）
4. 少数派: 36条（占比15%）

用户: 分析一下相关新闻的情感倾向

AI: [调用 analyze_sentiment(topic="人工智能", limit=50)]
"人工智能"相关新闻的情感分析：
- 正面: 65%（技术突破、应用落地）
- 中性: 28%（行业报告、市场分析）
- 负面: 7%（监管担忧、就业影响）

代表性新闻：
- [正面] OpenAI发布GPT-5，能力提升10倍
- [中性] 2024年AI行业投资报告发布
- [负面] AI可能导致3000万人失业
```

**使用工具**:
1. `resolve_date_range` - 解析日期范围
2. `analyze_topic_trend(analysis_type="trend")` - 热度趋势分析
3. `analyze_topic_trend(analysis_type="lifecycle")` - 生命周期分析
4. `analyze_data_insights(insight_type="platform_compare")` - 平台对比
5. `analyze_sentiment` - 情感分析

---

### 案例3：事件追踪 - 跨平台聚合

**场景**: 查看某个事件在不同平台的报道情况

**对话流程**:

```
用户: 帮我聚合今天的新闻，看看哪些是跨平台热点

AI: [调用 aggregate_news()]
跨平台热点新闻聚合结果：

1. "OpenAI发布GPT-5"
   - 覆盖平台: 知乎、微博、36氪、少数派（4个平台）
   - 最佳排名: 知乎第1名
   - 综合权重: 9500

2. "特斯拉发布新车型"
   - 覆盖平台: 微博、知乎、36氪（3个平台）
   - 最佳排名: 微博第1名
   - 综合权重: 8200

...

用户: 找出和"特斯拉发布新车型"相似的其他报道

AI: [调用 find_related_news(reference_title="特斯拉发布新车型", threshold=0.6)]
找到 8 条相关新闻：
1. 特斯拉新车型提前曝光（相似度: 0.92）
2. 特斯拉发布会直播预告（相似度: 0.88）
3. 马斯克回应新车传闻（相似度: 0.75）
...
```

**使用工具**:
1. `aggregate_news` - 跨平台新闻聚合
2. `find_related_news` - 查找相关新闻

---

### 案例4：历史对比 - 周环比分析

**场景**: 对比本周和上周的热点变化

**对话流程**:

```
用户: 对比本周和上周的热点变化

AI: [调用 resolve_date_range("本周")]
本周日期范围：2025-01-20 至 2025-01-26

AI: [调用 resolve_date_range("上周")]
上周日期范围：2025-01-13 至 2025-01-19

AI: [调用 compare_periods(period1="上周", period2="本周", compare_type="overview")]
本周 vs 上周总体对比：

【新闻数量变化】
- 上周: 1250条
- 本周: 1380条
- 增长: +10.4%

【上升话题】
- "人工智能": 上周180次 → 本周255次（+41.7%）
- "新能源汽车": 上周120次 → 本周168次（+40.0%）

【下降话题】
- "春节": 上周95次 → 本周45次（-52.6%）
- "跨年": 上周68次 → 本周12次（-82.4%）

【新出现话题】
- "GPT-5": 本周首次出现，85次
- "特斯拉新车型": 本周首次出现，72次

【TOP新闻对比】
上周第1: "春节档电影票房破纪录"
本周第1: "OpenAI发布GPT-5"

用户: 详细分析一下话题变化情况

AI: [调用 compare_periods(period1="上周", period2="本周", compare_type="topic_shift", top_n=15)]
话题变化详细分析：
...
```

**使用工具**:
1. `resolve_date_range` - 解析日期范围（2次）
2. `compare_periods(compare_type="overview")` - 总体概览
3. `compare_periods(compare_type="topic_shift")` - 话题变化分析

---

### 案例5：RSS 订阅 - 技术资讯追踪

**场景**: 从 RSS 订阅源获取技术资讯

**对话流程**:

```
用户: 查看最新的 RSS 订阅内容

AI: [调用 get_latest_rss(days=1)]
最新 RSS 订阅内容（今天）：

【Hacker News - 15条】
1. How I built a million-dollar SaaS
2. The future of web development
...

【36氪 - 12条】
1. 字节跳动推出新AI产品
2. 阿里云发布季度财报
...

用户: 在 RSS 中搜索关于"AI"的文章

AI: [调用 search_rss(keyword="AI", days=7)]
找到 23 条关于"AI"的 RSS 文章（最近7天）：

1. "OpenAI releases GPT-5" (Hacker News, 2025-01-21)
2. "Google Gemini 2.0 发布" (36氪, 2025-01-20)
3. "AI in 2025: A comprehensive guide" (Hacker News, 2025-01-19)
...

用户: 查看 RSS 源的状态

AI: [调用 get_rss_feeds_status()]
RSS 源状态：
- 可用日期: 30天（2025-01-21 至 2024-12-23）
- 总日期数: 30

今日各源统计：
- Hacker News: 15条
- 36氪: 12条
- 少数派: 8条
```

**使用工具**:
1. `get_latest_rss` - 获取最新 RSS
2. `search_rss` - 搜索 RSS 内容
3. `get_rss_feeds_status` - 查看 RSS 源状态

---

### 案例6：智能搜索 - 关键词检索

**场景**: 搜索特定关键词的新闻

**对话流程**:

```
用户: 搜索最近7天关于"iPhone"的新闻

AI: [调用 resolve_date_range("最近7天")]
日期范围：2025-01-14 至 2025-01-21

AI: [调用 search_news(query="iPhone", date_range={...})]
找到 35 条关于"iPhone"的新闻（最近7天）：

1. "iPhone 16 Pro Max 深度评测"（少数派，权重9200）
2. "苹果发布会或于9月举办"（36氪，权重8800）
3. "iPhone销量下滑10%"（微博，权重8500）
...
（共35条，按权重排序）

用户: 再搜索一下RSS中关于"iPhone"的内容

AI: [调用 search_news(query="iPhone", date_range={...}, include_rss=True)]
热榜结果（35条）：
1. "iPhone 16 Pro Max 深度评测"（少数派）
...

RSS结果（12条）：
1. "iPhone 16 review roundup" (Hacker News)
2. "Apple's iPhone strategy in 2025" (36氪)
...

用户: 查找和"iPhone 16"相似的相关报道

AI: [调用 find_related_news(reference_title="iPhone 16", threshold=0.7)]
找到 18 条相关新闻（相似度≥0.7）：

1. "iPhone 16 Pro Max 评测"（相似度: 0.95）
2. "iPhone 16 系列参数对比"（相似度: 0.89）
3. "苹果iPhone 16预售开启"（相似度: 0.82）
...
```

**使用工具**:
1. `resolve_date_range` - 解析日期范围
2. `search_news` - 搜索热榜
3. `search_news(include_rss=True)` - 同时搜索热榜和RSS
4. `find_related_news` - 查找相关新闻

---

### 案例7：实时爬取 - 获取最新数据

**场景**: 手动触发爬取任务获取最新数据

**对话流程**:

```
用户: 请帮我爬取知乎的最新新闻

AI: [调用 trigger_crawl(platforms=['zhihu'], save_to_local=False)]
正在爬取知乎...
✅ 知乎: 成功获取50条新闻

爬取结果：
1. "OpenAI发布GPT-5"（排名第1）
2. "特斯拉发布新车型"（排名第2）
...
（共50条，数据未保存到本地）

用户: 这次请帮我爬取并保存数据

AI: [调用 trigger_crawl(platforms=['zhihu', 'weibo'], save_to_local=True)]
正在爬取并保存...
✅ 知乎: 成功获取50条新闻，已保存
✅ 微博: 成功获取50条新闻，已保存

数据已保存到 output 目录
```

**使用工具**:
1. `trigger_crawl(save_to_local=False)` - 临时爬取
2. `trigger_crawl(save_to_local=True)` - 持久化爬取

---

### 案例8：远程存储同步

**场景**: 从远程存储拉取数据进行分析

**对话流程**:

```
用户: 查看当前存储状态

AI: [调用 get_storage_status()]
存储状态：
【本地存储】
- 数据目录: /app/output
- 总大小: 256MB
- 日期数量: 5天
- 日期范围: 2025-01-17 至 2025-01-21

【远程存储】
- 是否配置: ✅ 是
- 端点地址: https://...
- 存储桶: trendradar-data
- 日期数量: 30天

【拉取配置】
- 自动拉取: 未启用

用户: 对比本地和远程的数据日期

AI: [调用 list_available_dates(source="both")]
数据日期对比：

仅本地存在: 无
仅远程存在: 25天（2024-12-23 至 2025-01-16）
两边都存在: 5天（2025-01-17 至 2025-01-21）

用户: 从远程同步最近7天的数据

AI: [调用 sync_from_remote(days=7)]
正在从远程同步...
✅ 成功同步: 7个文件
✅ 同步日期: 2025-01-15 至 2025-01-21
⏭️ 跳过日期: 5个（本地已存在）
❌ 失败日期: 无

同步完成！
```

**使用工具**:
1. `get_storage_status` - 查看存储状态
2. `list_available_dates(source="both")` - 对比本地和远程日期
3. `sync_from_remote` - 从远程拉取数据

---

### 案例9：系统管理 - 配置查询与版本检查

**场景**: 查看系统配置和检查更新

**对话流程**:

```
用户: 查看当前系统配置

AI: [调用 get_current_config(section="all")]
系统配置：
【爬虫配置】
- 平台数量: 12个
- 请求间隔: 2秒
- 超时设置: 10秒

【推送配置】
- 钉钉: 未配置
- 微信: 未配置
- Telegram: 未配置

【关键词配置】
- 词组数量: 8个
- 总关键词数: 45个

【权重配置】
- 排名权重: 10.0
- 频次权重: 5.0

用户: 检查系统状态

AI: [调用 get_system_status()]
系统状态：
- 版本: v3.1.6
- 状态: 运行正常 ✅
- 最后爬取: 2025-01-21 08:30
- 历史数据: 30天
- 健康检查: 通过

用户: 检查版本更新

AI: [调用 check_version()]
版本检查结果：

【TrendRadar 核心引擎】
- 当前版本: v3.1.6
- 最新版本: v3.1.6
- 状态: ✅ 已是最新版本

【MCP Server】
- 当前版本: v3.1.6
- 最新版本: v3.2.0
- 状态: ⚠️ 有新版本可用

更新建议: 建议升级 MCP Server 到 v3.2.0
```

**使用工具**:
1. `get_current_config` - 获取配置
2. `get_system_status` - 查看状态
3. `check_version` - 检查更新

---

## 部署方式

### 方式1: Docker Compose（推荐）

**优势**: 一键启动，自动配置，适合生产环境

**配置文件**: [docker/docker-compose.yml](../docker/docker-compose.yml)

```yaml
trendradar-mcp:
  image: wantcat/trendradar-mcp:latest
  container_name: trendradar-mcp
  restart: unless-stopped

  ports:
    - "127.0.0.1:3333:3333"

  volumes:
    - ../config:/app/config:ro
    - ../output:/app/output

  environment:
    - TZ=Asia/Shanghai
```

**启动步骤**:
```bash
cd docker
docker compose up -d trendradar-mcp
```

---

### 方式2: 本地 Python 环境

**优势**: 灵活开发，易于调试

**安装步骤**:
```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动 stdio 模式（用于 Cherry Studio）
python -m mcp_server.server

# 3. 启动 HTTP 模式（用于远程访问）
python -m mcp_server.server --transport http --host 0.0.0.0 --port 3333
```

---

### 方式3: 一键脚本（Windows/Mac）

**Windows**:
```bash
setup-windows.bat
```

**Mac**:
```bash
./setup-mac.sh
```

---

## 最佳实践

### 1. 日期解析优先使用

**推荐流程**:
```
用户: "分析AI本周的趋势"
   ↓
AI: 1. resolve_date_range("本周") → 获取精确日期
    2. analyze_topic_trend(topic="AI", date_range={...})
```

**优势**:
- ✅ 所有 AI 模型获得一致的日期范围
- ✅ 基于服务器端精确时间计算
- ✅ 支持中英文和动态天数

---

### 2. Token 节省策略

**默认设置**（节约 token）:
- 限制条数: 50条
- 不包含URL链接
- 不包含RSS摘要

**调整方式**:
```
用户: "返回前 10 条"
用户: "需要包含链接"
用户: "需要摘要"
```

---

### 3. 组合使用多个工具

**深度分析案例**:
```
1. search_news(query="AI") - 搜索AI相关新闻
2. analyze_topic_trend(topic="AI") - 分析热度趋势
3. analyze_sentiment(topic="AI") - 情感倾向分析
4. compare_periods(period1="上周", period2="本周", topic="AI") - 时期对比
```

---

### 4. 数据展示说明

**重要**: 工具返回完整数据，但 AI 可能会自动总结

**如果 AI 总结，你可以**:
- "展示所有新闻，不要总结"
- "展示所有 50 条"
- "为什么只展示了 15 条？我要看全部"

---

### 5. 存储同步策略

**典型架构**:
- 爬虫部署在云端（GitHub Actions）
- 数据存储到远程（Cloudflare R2）
- MCP Server 部署在本地
- 定期从远程拉取数据

**配置**:
```yaml
# config/config.yaml
storage:
  remote:
    endpoint_url: "https://..."
    bucket_name: "trendradar-data"
    access_key_id: "..."
    secret_access_key: "..."
```

---

## 快速参考

### 工具分类速查表

| 分类 | 工具数 | 主要用途 |
|------|--------|---------|
| 日期解析 | 1 | 解析自然语言日期 |
| 数据查询 | 3 | 获取最新/历史/热点新闻 |
| RSS查询 | 3 | 查询/搜索RSS订阅内容 |
| 智能检索 | 2 | 搜索关键词/相关新闻 |
| 数据分析 | 6 | 趋势/情感/对比/聚合分析 |
| 系统管理 | 4 | 配置/状态/版本/爬取管理 |
| 存储同步 | 3 | 本地/远程存储同步 |

---

## 总结

**TrendRadar MCP 的核心价值**:

1. **AI 驱动**: 通过自然语言对话完成复杂的数据查询和分析
2. **功能完整**: 21个工具覆盖查询、搜索、分析、管理等全流程
3. **灵活部署**: 支持本地、Docker、云端多种部署方式
4. **数据丰富**: 整合热榜、RSS、历史数据多源数据
5. **智能分析**: 趋势预测、情感分析、跨平台聚合等高级功能

**适用人群**:
- 📰 新闻从业者：追踪热点、分析趋势
- 📊 数据分析师：话题洞察、情感分析
- 🔬 研究人员：事件追踪、历史对比
- 💼 市场运营：竞品监控、舆情分析
- 🤖 AI 用户：让 AI 帮你智能处理新闻数据

**下一步**:
- 📘 查看完整FAQ: [README-MCP-FAQ.md](../README-MCP-FAQ.md)
- 🔧 Cherry Studio 配置: [README-Cherry-Studio.md](../README-Cherry-Studio.md)
- 🐳 Docker 部署: [08-docker-deployment-guide.md](08-docker-deployment-guide.md)

---

**享受 AI 驱动的新闻分析体验！🚀**
