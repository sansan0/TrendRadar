# TrendRadar MCP 与 AI 分析新闻 — 实现说明

> 本文档梳理 TrendRadar 项目中「AI 分析新闻」相关的代码，重点说明 MCP（Model Context Protocol）服务在其中的角色与实现机制。

---

## 目录

1. [核心结论](#1-核心结论)
2. [项目中的两套「AI 分析新闻」能力](#2-项目中的两套-ai-分析新闻能力)
3. [主动 AI 分析：`trendradar/ai/` 目录](#3-主动-ai-分析trendradarai-目录)
4. [MCP 服务中的 AI 分析实现](#4-mcp-服务中的-ai-分析实现)
5. [两者的关系与协作流程](#5-两者的关系与协作流程)
6. [配置项说明](#6-配置项说明)
7. [关键代码索引](#7-关键代码索引)

---

## 1. 核心结论

TrendRadar 项目里存在**两套角色完全不同**的「AI 分析新闻」能力，二者代码位置不同、调用 LLM 的方式也不同：

| 能力 | 代码位置 | 谁调用 LLM | 触发方式 | 产出去向 |
|------|----------|-----------|----------|----------|
| **主动 AI 分析** | [`trendradar/ai/`](trendradar/ai/) | TrendRadar **主程序自己**调用（LiteLLM） | 定时任务（scheduler）自动触发 | 分析报告推送到通知渠道 |
| **MCP 被动分析** | [`mcp_server/`](mcp_server/) | **MCP 客户端**（外部的 LLM，如 Claude、Cursor、Cherry Studio） | 用户/助手通过 MCP 工具调用 | 返回给调用方展示 |

> 一句话总结：
> - **`trendradar/ai/` 是"内置 AI"** —— 程序自己调大模型，自动完成分析、筛选、翻译。
> - **`mcp_server/` 是"外挂工具"** —— 它**不直接调用 LLM**，而是把新闻数据、提示词、文章正文「递」给外部 AI 助手，由助手的 LLM 完成最终分析。

---

## 2. 项目中的两套「AI 分析新闻」能力

### 2.1 主动 AI 分析（主程序）

位于 [`trendradar/ai/`](trendradar/ai/)，基于 **LiteLLM** 统一接口，是 TrendRadar 定时任务的一部分：

- **AI 深度分析**（`AIAnalyzer`）：把热榜 + RSS 新闻喂给大模型，产出 6 大板块的结构化分析报告。
- **AI 智能筛选**（`AIFilter` / `AIFilterPipeline`）：从兴趣描述中提取标签，再对新闻标题批量打标签分类。
- **AI 翻译**（`AITranslator`）：把推送标题翻译成目标语言。

### 2.2 MCP 服务

位于 [`mcp_server/`](mcp_server/)，基于 **FastMCP 2.0**，是一个标准的 MCP 工具服务器（支持 stdio / HTTP 两种传输）。它对外暴露 26 个工具，其中与「AI 分析新闻」直接相关的有：

- `analyze_sentiment` —— 情感分析（**生成 AI 提示词**，而非自己分析）
- `read_article` / `read_articles_batch` —— 读取文章正文（通过 **Jina AI Reader**）
- 以及一系列数据查询工具（`get_latest_news`、`search_news`、`aggregate_news` 等），为外部 AI 提供分析原料。

---

## 3. 主动 AI 分析：`trendradar/ai/` 目录

这是「真正调用 LLM 分析新闻」的核心代码。目录结构：

```
trendradar/ai/
├── client.py            # AIClient：LiteLLM 统一客户端
├── analyzer.py          # AIAnalyzer：AI 深度分析（核心）
├── filter.py            # AIFilter：AI 智能筛选（标签提取/分类）
├── filter_pipeline.py   # AIFilterPipeline：筛选流水线编排
├── translator.py        # AITranslator：AI 多语言翻译
├── formatter.py         # 分析结果渲染为各渠道样式
└── prompt_loader.py     # 提示词模板加载
```

### 3.1 `AIClient` — 统一 AI 客户端

文件：[`client.py`](trendradar/ai/client.py)

- 基于 `litellm.completion`，支持 100+ 提供商（DeepSeek、OpenAI、Gemini、Claude、Ollama 等）。
- 核心方法 `chat(messages)`：构建请求参数（model、api_key、api_base、temperature、max_tokens、timeout、num_retries、fallbacks），调用 LiteLLM，统一提取响应内容（兼容 list 类型的 content）。
- `validate_config()`：校验模型格式（必须是 `provider/model` 形式）与 API Key 是否存在。

关键代码位置：
- `AIClient` 类：[`client.py#L15`](trendradar/ai/client.py#L15)
- `chat()` 方法：[`client.py#L42`](trendradar/ai/client.py#L42)

### 3.2 `AIAnalyzer` — AI 深度分析（核心）

文件：[`analyzer.py`](trendradar/ai/analyzer.py)

这是 AI 分析新闻的**主入口**，流程如下：

```
analyze(stats, rss_stats, ...)
  ├─ 校验 API Key
  ├─ _prepare_news_content()   # 1. 把热榜/RSS 新闻拼成文本（受 max_news 上限控制）
  ├─ 填充提示词模板            # 2. 替换 {keywords}/{platforms}/{news_content} 等占位符
  ├─ _call_ai()               # 3. system + user 两条消息，调 LiteLLM
  ├─ _parse_response()        # 4. 解析 JSON（含 json_repair 本地修复）
  ├─ _retry_fix_json()        # 5. JSON 解析失败时，让 AI 修复一次
  └─ 填充统计字段              # 6. 返回 AIAnalysisResult
```

关键类与结构：

- **`AIAnalysisResult`**（dataclass，[`analyzer.py#L17`](trendradar/ai/analyzer.py#L17)）——分析结果，采用「按事件/主题聚合的内容总结」结构：

  | 字段 | 含义 |
  |------|------|
  | `overview` | 本期热点总体概述 |
  | `topics` | 事件列表 `[{title, summary, platforms, key_points}]`，按综合热度降序排列 |
  | 元数据字段 | `total_news` / `analyzed_news` / `hotlist_count` / `rss_count` 等统计信息 |

- **`AIAnalyzer`**（[`analyzer.py#L58`](trendradar/ai/analyzer.py#L58)）：
  - `analyze()`（[`analyzer.py#L103`](trendradar/ai/analyzer.py#L103)）——主入口。
  - `_prepare_news_content()`（[`analyzer.py#L255`](trendradar/ai/analyzer.py#L255)）——新闻内容拼接：保留标题 + 来源 + 出现次数（作为综合热度排序信号），去掉排名/时间/轨迹。
  - `_call_ai()`（[`analyzer.py#L373`](trendradar/ai/analyzer.py#L373)）——构造 messages 并调用 `client.chat()`。
  - `_parse_response()`（[`analyzer.py#L557`](trendradar/ai/analyzer.py#L557)）——三级兜底解析：标准 `json.loads` → `json_repair` 本地修复 → 提取纯文本兜底；解析成功后用 `_normalize_topics()` 规范化 topics。
  - `_retry_fix_json()`（[`analyzer.py#L382`](trendradar/ai/analyzer.py#L382)）——JSON 解析失败时，用一个轻量「JSON 修复」prompt 让 AI 重试一次。

### 3.3 `AIFilter` / `AIFilterPipeline` — AI 智能筛选

文件：[`filter.py`](trendradar/ai/filter.py)、[`filter_pipeline.py`](trendradar/ai/filter_pipeline.py)

两阶段 + 一次增量更新：

- **阶段 A：`extract_tags()`**（[`filter.py#L119`](trendradar/ai/filter.py#L119)）——从 `config/ai_interests.txt` 兴趣描述中提取结构化标签 `[{tag, description}]`。
- **阶段 A'：`update_tags()`**（[`filter.py#L181`](trendradar/ai/filter.py#L181)）——兴趣描述变更时，AI 对比旧标签给出「保留/新增/移除」方案（含 `change_ratio`）。
- **阶段 B：`classify_batch()`**（[`filter.py#L310`](trendradar/ai/filter.py#L310)）——把新闻标题按标签批量分类，每条新闻只保留最高分的标签。

`AIFilterPipeline.run()`（[`filter_pipeline.py#L64`](trendradar/ai/filter_pipeline.py#L64)）编排完整流程：

```
读取兴趣描述 → 计算 hash → 对比数据库 hash
  ├─ 首次/变更超过阈值 → 提取/更新标签
  ├─ 收集待分类新闻（去重 + RSS 新鲜度过滤）
  ├─ 按 batch_size 分组调用 AI 分类
  ├─ 保存分类结果到存储
  └─ 转换为与关键词匹配一致的数据结构（convert_to_report_data）
```

### 3.4 `AITranslator` — AI 多语言翻译

文件：[`translator.py`](trendradar/ai/translator.py)

- `translate()`（[`translator.py#L65`](trendradar/ai/translator.py#L65)）——单条翻译。
- `translate_batch()`（[`translator.py#L110`](trendradar/ai/translator.py#L110)）——批量翻译（单次 API 调用，用 `[1] [2] [3]` 编号格式，按编号回填避免错位）。

### 3.5 格式化与提示词加载

- [`formatter.py`](trendradar/ai/formatter.py)——把 `AIAnalysisResult` 渲染为各推送渠道样式：通用 Markdown、飞书卡片、钉钉、Telegram HTML、纯文本、丰富 HTML。统一入口 `get_ai_analysis_renderer(channel)`（[`formatter.py#L268`](trendradar/ai/formatter.py#L268)）。
- [`prompt_loader.py`](trendradar/ai/prompt_loader.py)——`load_prompt_template()`（[`prompt_loader.py#L16`](trendradar/ai/prompt_loader.py#L16)）解析 `[system]` / `[user]` 格式的提示词文件，供 analyzer / translator / filter 共用。

---

## 4. MCP 服务中的 AI 分析实现

### 4.1 关键事实：MCP 服务不直接调用 LLM

经过代码审查，[`mcp_server/`](mcp_server/) 中**没有任何**对 `trendradar.ai`、`AIClient`、`litellm`、`AIAnalyzer` 的引用。

MCP 服务对 `trendradar` 的复用，全部是**非 AI** 的底层工具函数：

| 复用点 | 用途 | 位置 |
|--------|------|------|
| `trendradar.core.analyzer.calculate_news_weight` | 新闻权重计算（用于排序，非 AI） | [`analytics.py#L16`](mcp_server/tools/analytics.py#L16) |
| `trendradar.core.frequency` | 关键词匹配 / 关注词加载 | `data_service.py`、`parser_service.py` |
| `trendradar.core.loader` | 配置 / webhook 配置加载 | `data_service.py`、`notification.py` |
| `trendradar.crawler.fetcher` | 手动触发爬取 | [`system.py#L214`](mcp_server/tools/system.py#L214) |
| `trendradar.notification.*` | 通知发送 / 格式化 | `notification.py` |
| `trendradar.storage.*` | 本地 / 远程存储 | `storage_sync.py`、`system.py` |

因此，MCP 里的「AI 分析」是**间接**的：MCP 提供数据、提示词和正文，最终分析由**调用 MCP 的那个外部 LLM** 完成。

### 4.2 MCP 中的 AI 相关工具

#### 4.2.1 `analyze_sentiment` — 生成 AI 提示词（非自己分析）

文件：[`mcp_server/tools/analytics.py`](mcp_server/tools/analytics.py)

- 工具注册：`analyze_sentiment`（[`server.py#L484`](mcp_server/server.py#L484)）
- 实现方法：`analyze_sentiment()`（[`analytics.py#L657`](mcp_server/tools/analytics.py#L657)）

它的工作方式：

1. 收集新闻数据（可按 topic、platforms、date_range 过滤，支持跨天）。
2. 去重（同一标题跨平台只保留一次）。
3. 按权重排序（复用 `calculate_news_weight`）。
4. 调用 `_create_sentiment_analysis_prompt()`（[`analytics.py#L845`](mcp_server/tools/analytics.py#L845)）**生成一段结构化的 AI 提示词**。
5. 返回结果中带一个 `ai_prompt` 字段和 `usage_note`：

   ```json
   {
     "success": true,
     "method": "ai_prompt_generation",
     "ai_prompt": "请分析以下关于「特斯拉」的新闻标题的情感倾向...",
     "data": [ ...新闻列表... ],
     "usage_note": "请将 ai_prompt 字段的内容发送给 AI 进行情感分析"
   }
   ```

   **MCP 服务到此为止，不实际调用任何 LLM。** 情感分析由调用方（外部 AI 助手）读取 `ai_prompt` 和 `data` 后自行完成。

#### 4.2.2 `read_article` / `read_articles_batch` — 通过 Jina AI Reader 读取正文

文件：[`mcp_server/tools/article_reader.py`](mcp_server/tools/article_reader.py)

- `ArticleReaderTools` 类（[`article_reader.py#L24`](mcp_server/tools/article_reader.py#L24)）
- 通过 **Jina AI Reader**（`https://r.jina.ai`）把网页 URL 转成干净的 Markdown，供 LLM 阅读正文后再做分析。
- `read_article()`（[`article_reader.py#L58`](mcp_server/tools/article_reader.py#L58)）：单篇读取，内置 5 秒速率控制。
- `read_articles_batch()`（[`article_reader.py#L139`](mcp_server/tools/article_reader.py#L139)）：批量读取，单次上限 5 篇。

典型流程（在工具 docstring 里也写明了）：

```
1. search_news(include_url=True)     → 搜索新闻拿链接
2. read_article(url=链接)            → 读取正文 Markdown
3. 外部 LLM 对正文做分析/摘要/翻译
```

### 4.3 MCP 服务的完整工具清单

MCP 工具按功能分组的注册与启动日志见 [`server.py#L1117`](mcp_server/server.py#L1117)（`run_server`），共 26 个工具：

- **日期解析**：`resolve_date_range`
- **基础查询**：`get_latest_news`、`get_news_by_date`、`get_trending_topics`
- **RSS 查询**：`get_latest_rss`、`search_rss`、`get_rss_feeds_status`
- **智能检索**：`search_news`、`find_related_news`
- **高级分析**：`analyze_topic_trend`、`analyze_data_insights`、`analyze_sentiment`、`aggregate_news`、`compare_periods`、`generate_summary_report`
- **配置与系统**：`get_current_config`、`get_system_status`、`check_version`、`trigger_crawl`
- **存储同步**：`sync_from_remote`、`get_storage_status`、`list_available_dates`
- **文章读取**：`read_article`、`read_articles_batch`
- **通知推送**：`get_channel_format_guide`、`get_notification_channels`、`send_notification`

> 注意：`analyze_topic_trend`、`analyze_data_insights`、`aggregate_news`、`compare_periods`、`generate_summary_report` 等「分析」工具，实现的是**基于规则的统计/聚合**（词频、相似度、生命周期、增长率等），并**不涉及 LLM 调用**，只有 `analyze_sentiment` 是生成供 LLM 使用的提示词。

---

## 5. 两者的关系与协作流程

两套能力**互不依赖**，但可以配合使用：

```
┌─────────────────────────────────────────────────────────┐
│  TrendRadar 主程序（定时任务）                             │
│  crawler → analyzer/filter/translator (trendradar/ai/)  │
│  自己调 LiteLLM → 生成报告 → 推送通知                      │
└─────────────────────────────────────────────────────────┘
                         │ 共享数据（本地/远程存储）
                         ▼
┌─────────────────────────────────────────────────────────┐
│  MCP Server（mcp_server/）                               │
│  不调 LLM，只提供：                                        │
│   - 数据查询工具（get_latest_news / search_news ...）       │
│   - 提示词生成（analyze_sentiment → ai_prompt）            │
│   - 正文读取（read_article → Jina Reader）                 │
└─────────────────────────────────────────────────────────┘
                         │ MCP 协议
                         ▼
┌─────────────────────────────────────────────────────────┐
│  外部 AI 助手（Claude / Cursor / Cherry Studio ...）       │
│  调用 MCP 工具 → 拿到数据/提示词/正文 → 用自己的 LLM 分析   │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 配置项说明

所有 AI 相关配置集中在 [`config/config.yaml`](config/config.yaml)：

| 配置段 | 作用 | 位置 |
|--------|------|------|
| `ai` | 模型配置（LiteLLM）：`model`、`api_key`、`api_base`、`timeout`、`temperature`、`max_tokens`、`num_retries`、`fallback_models` | [`config.yaml#L354`](config/config.yaml#L354) |
| `ai_analysis` | AI 深度分析开关：`enabled`、`language`、`prompt_file`、`mode`、`max_news_for_analysis`、`include_rss`、`include_standalone`、`include_rank_timeline` | [`config.yaml#L413`](config/config.yaml#L413) |
| `ai_translation` | AI 翻译开关：`enabled`、`language`、`prompt_file`、`batch_size`、`batch_interval`、`scope` | [`config.yaml#L442`](config/config.yaml#L442) |
| `ai_filter` | AI 智能筛选：`batch_size`、`batch_interval`、`min_score`、`reclassify_threshold` | [`config.yaml#L192`](config/config.yaml#L192) |
| `filter.method` | 筛选方式（`keyword` / `ai`），选 `ai` 时启用智能筛选 | [`config.yaml#L175`](config/config.yaml#L175) |

提示词模板文件：

| 文件 | 用途 |
|------|------|
| [`config/ai_analysis_prompt.txt`](config/ai_analysis_prompt.txt) | AI 深度分析（按事件/主题聚合的内容总结，`[system]`/`[user]` 格式） |
| [`config/ai_translation_prompt.txt`](config/ai_translation_prompt.txt) | AI 翻译 |
| [`config/ai_filter/prompt.txt`](config/ai_filter/prompt.txt) | 新闻分类 |
| [`config/ai_filter/extract_prompt.txt`](config/ai_filter/extract_prompt.txt) | 标签提取 |
| [`config/ai_filter/update_tags_prompt.txt`](config/ai_filter/update_tags_prompt.txt) | 标签增量更新 |
| [`config/ai_interests.txt`](config/ai_interests.txt) | 兴趣描述（智能筛选的输入） |

---

## 7. 关键代码索引

### 主动 AI 分析（`trendradar/ai/`）

| 组件 | 文件 | 关键位置 |
|------|------|----------|
| AI 客户端（LiteLLM） | [`client.py`](trendradar/ai/client.py) | `AIClient` [#L15](trendradar/ai/client.py#L15)、`chat()` [#L42](trendradar/ai/client.py#L42) |
| AI 深度分析 | [`analyzer.py`](trendradar/ai/analyzer.py) | `AIAnalysisResult` [#L17](trendradar/ai/analyzer.py#L17)、`AIAnalyzer` [#L58](trendradar/ai/analyzer.py#L58)、`analyze()` [#L103](trendradar/ai/analyzer.py#L103)、`_parse_response()` [#L557](trendradar/ai/analyzer.py#L557) |
| AI 智能筛选 | [`filter.py`](trendradar/ai/filter.py) | `AIFilter` [#L36](trendradar/ai/filter.py#L36)、`extract_tags()` [#L119](trendradar/ai/filter.py#L119)、`classify_batch()` [#L310](trendradar/ai/filter.py#L310) |
| 筛选流水线 | [`filter_pipeline.py`](trendradar/ai/filter_pipeline.py) | `AIFilterPipeline` [#L20](trendradar/ai/filter_pipeline.py#L20)、`run()` [#L64](trendradar/ai/filter_pipeline.py#L64) |
| AI 翻译 | [`translator.py`](trendradar/ai/translator.py) | `AITranslator` [#L37](trendradar/ai/translator.py#L37)、`translate_batch()` [#L110](trendradar/ai/translator.py#L110) |
| 结果渲染 | [`formatter.py`](trendradar/ai/formatter.py) | `get_ai_analysis_renderer()` [#L268](trendradar/ai/formatter.py#L268) |
| 提示词加载 | [`prompt_loader.py`](trendradar/ai/prompt_loader.py) | `load_prompt_template()` [#L16](trendradar/ai/prompt_loader.py#L16) |

### MCP 服务（`mcp_server/`）

| 组件 | 文件 | 关键位置 |
|------|------|----------|
| MCP 服务器入口 | [`server.py`](mcp_server/server.py) | `run_server()` [#L1117](mcp_server/server.py#L1117) |
| 情感分析（生成提示词） | [`analytics.py`](mcp_server/tools/analytics.py) | `analyze_sentiment()` [#L657](mcp_server/tools/analytics.py#L657)、`_create_sentiment_analysis_prompt()` [#L845](mcp_server/tools/analytics.py#L845) |
| 权重计算（复用，非 AI） | [`analytics.py`](mcp_server/tools/analytics.py) | `calculate_news_weight()` [#L82](mcp_server/tools/analytics.py#L82) |
| 文章正文读取（Jina） | [`article_reader.py`](mcp_server/tools/article_reader.py) | `read_article()` [#L58](mcp_server/tools/article_reader.py#L58)、`read_articles_batch()` [#L139](mcp_server/tools/article_reader.py#L139) |

---

## 附：如何快速判断某段代码是否「真正调用 LLM」

在 `mcp_server/` 或 `trendradar/` 中检索以下任一符号即可判断：

- `from trendradar.ai` / `import trendradar.ai` —— 是否引入主动 AI 模块
- `AIClient` / `AIAnalyzer` / `AITranslator` / `AIFilter` —— 是否实例化 AI 类
- `litellm` / `completion(` —— 是否调用 LiteLLM 底层

结论：这些符号**只出现在 `trendradar/ai/` 内部**，`mcp_server/` 完全不含。因此「AI 分析新闻」的真正实现集中在 `trendradar/ai/`，而 MCP 服务是面向外部 AI 助手的**数据与工具接口层**。
