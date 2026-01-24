# TrendRadar API 参考文档

## 目录

- [MCP服务器API](#mcp服务器api)
- [核心类API](#核心类api)
- [数据结构](#数据结构)
- [工具函数](#工具函数)

## MCP服务器API

TrendRadar MCP Server基于FastMCP 2.0实现，提供丰富的数据查询和分析工具。

### 数据查询工具

#### `query_news_by_date`

查询指定日期的新闻数据。

**参数**:
- `date` (str): 日期，格式 `YYYY-MM-DD`
- `keyword` (str, optional): 关键词过滤
- `platform` (str, optional): 平台过滤

**返回**:
```json
{
  "success": true,
  "data": {
    "date": "2025-01-21",
    "total_count": 150,
    "news": [
      {
        "title": "新闻标题",
        "platform": "知乎",
        "rank": 1,
        "url": "https://...",
        "first_seen": "09:30",
        "last_seen": "10:00"
      }
    ]
  }
}
```

**使用示例**:
```python
# MCP客户端调用
result = mcp_client.call_tool("query_news_by_date", {
    "date": "2025-01-21",
    "keyword": "AI"
})
```

#### `query_rss_by_date`

查询指定日期的RSS数据。

**参数**:
- `date` (str): 日期
- `feed_id` (str, optional): RSS源ID
- `max_age_days` (int, optional): 最大文章年龄

**返回**:
```json
{
  "success": true,
  "data": {
    "date": "2025-01-21",
    "total_count": 50,
    "items": [
      {
        "title": "文章标题",
        "feed_name": "Hacker News",
        "url": "https://...",
        "published_at": "2025-01-21T10:30:00Z",
        "author": "作者"
      }
    ]
  }
}
```

#### `get_latest_data`

获取最新的数据（热榜+RSS）。

**参数**:
- `mode` (str, optional): 报告模式 (`current`|`daily`|`incremental`)
- `limit` (int, optional): 返回数量限制

**返回**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-21 10:30:00",
    "mode": "current",
    "hotlist": [...],
    "rss": [...]
  }
}
```

### 分析工具

#### `analyze_keywords`

分析关键词统计。

**参数**:
- `date` (str): 日期
- `group_by` (str): 分组方式 (`keyword`|`platform`)
- `min_count` (int, optional): 最小出现次数

**返回**:
```json
{
  "success": true,
  "data": {
    "date": "2025-01-21",
    "stats": [
      {
        "word": "AI",
        "count": 15,
        "platforms": ["知乎", "微博", "百度"],
        "sample_titles": ["标题1", "标题2"]
      }
    ]
  }
}
```

#### `get_statistics`

获取统计信息。

**参数**:
- `start_date` (str): 开始日期
- `end_date` (str): 结束日期
- `platform` (str, optional): 平台过滤

**返回**:
```json
{
  "success": true,
  "data": {
    "period": "2025-01-01 to 2025-01-21",
    "total_news": 5000,
    "total_platforms": 11,
    "avg_daily_news": 238,
    "platform_stats": [
      {
        "platform": "知乎",
        "count": 1000,
        "percentage": 20.0
      }
    ]
  }
}
```

#### `compare_dates`

对比不同日期的数据。

**参数**:
- `dates` (List[str]): 日期列表
- `metric` (str): 指标 (`count`|`keywords`|`platforms`)

**返回**:
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "date": "2025-01-20",
        "count": 200
      },
      {
        "date": "2025-01-21",
        "count": 250,
        "change": "+25%"
      }
    ]
  }
}
```

### 搜索工具

#### `search_news`

全文搜索新闻。

**参数**:
- `query` (str): 搜索关键词
- `start_date` (str, optional): 开始日期
- `end_date` (str, optional): 结束日期
- `platform` (str, optional): 平台过滤
- `limit` (int, optional): 返回数量限制

**返回**:
```json
{
  "success": true,
  "data": {
    "query": "AI",
    "total_matches": 50,
    "results": [
      {
        "title": "AI技术突破",
        "platform": "知乎",
        "date": "2025-01-21",
        "snippet": "..."
      }
    ]
  }
}
```

#### `search_by_platform`

按平台搜索。

**参数**:
- `platform` (str): 平台ID
- `date` (str, optional): 日期
- `keyword` (str, optional): 关键词

**返回**:
```json
{
  "success": true,
  "data": {
    "platform": "知乎",
    "date": "2025-01-21",
    "count": 50,
    "news": [...]
  }
}
```

### 配置管理工具

#### `get_config`

获取当前配置。

**参数**:
- `section` (str, optional): 配置节 (`app`|`platforms`|`notification`|`ai`)

**返回**:
```json
{
  "success": true,
  "data": {
    "config": {
      "timezone": "Asia/Shanghai",
      "platforms": [...]
    }
  }
}
```

#### `update_keywords`

更新关键词配置。

**参数**:
- `action` (str): 操作 (`add`|`remove`|`update`)
- `group` (str): 分组名称
- `keywords` (List[str]): 关键词列表

**返回**:
```json
{
  "success": true,
  "message": "关键词已更新",
  "data": {
    "group": "AI技术",
    "keywords": ["ChatGPT", "GPT-4"]
  }
}
```

#### `list_platforms`

列出所有支持的平台。

**返回**:
```json
{
  "success": true,
  "data": {
    "platforms": [
      {
        "id": "zhihu",
        "name": "知乎",
        "enabled": true
      }
    ]
  }
}
```

### 系统管理工具

#### `get_status`

获取系统状态。

**返回**:
```json
{
  "success": true,
  "data": {
    "version": "5.3.0",
    "uptime": "2 hours",
    "storage_backend": "local",
    "available_dates": ["2025-01-19", "2025-01-20", "2025-01-21"],
    "last_update": "2025-01-21 10:30:00"
  }
}
```

#### `cleanup_data`

清理过期数据。

**参数**:
- `retention_days` (int, optional): 保留天数

**返回**:
```json
{
  "success": true,
  "data": {
    "deleted_count": 100,
    "freed_space": "10MB"
  }
}
```

### 存储同步工具

#### `pull_from_remote`

从远程存储拉取数据。

**参数**:
- `days` (int, optional): 拉取最近N天

**返回**:
```json
{
  "success": true,
  "data": {
    "pulled_files": 10,
    "total_size": "50MB"
  }
}
```

#### `push_to_remote`

推送数据到远程存储。

**参数**:
- `date` (str, optional): 指定日期

**返回**:
```json
{
  "success": true,
  "data": {
    "pushed_files": 5,
    "total_size": "25MB"
  }
}
```

### MCP资源

#### `config://platforms`

获取平台列表配置。

**返回**: JSON格式的平台配置

#### `config://rss-feeds`

获取RSS订阅源配置。

**返回**: JSON格式的RSS源配置

#### `config://keywords`

获取关键词配置。

**返回**: JSON格式的关键词分组

#### `data://available-dates`

获取可用日期列表。

**返回**: JSON格式的日期列表

## 核心类API

### NewsAnalyzer

主分析器类，位于 [`trendradar/__main__.py:70-340`](trendradar/__main__.py#L70-L340)。

#### `__init__()`

初始化分析器。

```python
analyzer = NewsAnalyzer()
```

#### `run()`

执行完整的分析流程。

```python
analyzer.run()
```

### AppContext

应用上下文，位于 [`trendradar/context.py`](trendradar/context.py)。

#### `get_storage_manager()`

获取存储管理器。

```python
manager = ctx.get_storage_manager()
```

#### `get_time()`

获取当前时间（带时区）。

```python
now = ctx.get_time()
```

#### `format_time()`

格式化时间。

```python
time_str = ctx.format_time()  # "10:30:00"
```

#### `format_date()`

格式化日期。

```python
date_str = ctx.format_date()  # "2025-01-21"
```

### StorageManager

存储管理器，位于 [`trendradar/storage/manager.py`](trendradar/storage/manager.py)。

#### `save_news_data(data)`

保存新闻数据。

```python
from trendradar.core.data import NewsData

success = manager.save_news_data(news_data)
```

#### `load_news_data(date)`

加载新闻数据。

```python
data = manager.load_news_data("2025-01-21")
```

#### `save_rss_data(data)`

保存RSS数据。

```python
success = manager.save_rss_data(rss_data)
```

#### `get_rss_data(date)`

获取RSS数据。

```python
rss_data = manager.get_rss_data("2025-01-21")
```

### AIAnalyzer

AI分析器，位于 [`trendradar/ai/analyzer.py`](trendradar/ai/analyzer.py)。

#### `analyze(stats, rss_stats, ...)`

执行AI分析。

```python
from trendradar.ai.analyzer import AIAnalysisResult

result = analyzer.analyze(
    stats=stats,
    rss_stats=rss_items,
    report_mode="current",
    report_type="当前榜单",
    platforms=["知乎", "微博"],
    keywords=["AI", "大模型"]
)

if result.success:
    print(result.content)
else:
    print(f"分析失败: {result.error}")
```

### NotificationDispatcher

通知分发器，位于 [`trendradar/notification/dispatcher.py`](trendradar/notification/dispatcher.py)。

#### `dispatch_all(...)`

分发到所有渠道。

```python
results = dispatcher.dispatch_all(
    report_data=report_data,
    report_type="当前榜单",
    update_info=None,
    proxy_url=None,
    mode="current",
    html_file_path="output/html/2025-01-21/current.html",
    rss_items=rss_items,
    rss_new_items=rss_new_items,
    ai_analysis=ai_result,
    standalone_data=standalone_data
)

# results: {"feishu": True, "telegram": False, ...}
```

## 数据结构

### NewsData

新闻数据结构，位于 [`trendradar/core/data.py`](trendradar/core/data.py)。

```python
@dataclass
class NewsData:
    """新闻数据"""
    date: str                              # 日期 YYYY-MM-DD
    time: str                              # 时间 HH:MM:SS
    results: Dict[str, Dict]               # {platform_id: {title: data}}
    id_to_name: Dict[str, str]             # {platform_id: platform_name}
    failed_ids: List[str]                  # 失败的平台ID
```

**示例**:
```python
news_data = NewsData(
    date="2025-01-21",
    time="10:30:00",
    results={
        "zhihu": {
            "新闻标题1": {
                "ranks": [1, 2],
                "url": "https://...",
                "mobileUrl": "https://..."
            }
        }
    },
    id_to_name={"zhihu": "知乎"},
    failed_ids=[]
)
```

### TitleInfo

标题元信息。

```python
@dataclass
class TitleInfo:
    """标题元信息"""
    first_time: str              # 首次出现时间
    last_time: str               # 最后出现时间
    count: int                   # 出现次数
    ranks: List[int]             # 排名历史
    url: str                     # 链接
    mobileUrl: str               # 移动端链接
```

### RSSData

RSS数据结构。

```python
@dataclass
class RSSData:
    """RSS数据"""
    date: str
    time: str
    id_to_name: Dict[str, str]
    items: Dict[str, List[RSSItem]]
```

### RSSItem

RSS条目。

```python
@dataclass
class RSSItem:
    """RSS条目"""
    title: str
    url: str
    published_at: Optional[str]
    summary: Optional[str]
    author: Optional[str]
```

### AIAnalysisResult

AI分析结果。

```python
@dataclass
class AIAnalysisResult:
    """AI分析结果"""
    success: bool
    content: Optional[str]       # 分析内容（Markdown格式）
    error: Optional[str]         # 错误信息
```

### 统计结果

关键词统计结果。

```python
{
    "word": "AI",                        # 关键词
    "count": 15,                         # 出现次数
    "platforms": ["知乎", "微博"],       # 出现平台
    "titles": [                          # 匹配的新闻
        {
            "title": "新闻标题",
            "platform": "知乎",
            "rank": 1,
            "url": "https://...",
            "is_new": false               # 是否新增
        }
    ]
}
```

## 工具函数

### 配置加载

#### `load_config(path)`

加载配置文件。

```python
from trendradar.core import load_config

config = load_config("config/config.yaml")
```

#### `parse_multi_account_config(value, separator)`

解析多账号配置。

```python
from trendradar.core.config import parse_multi_account_config

accounts = parse_multi_account_config("url1;url2;url3")
# ['url1', 'url2', 'url3']
```

### 关键词分析

#### `count_frequency(...)`

统计关键词频率。

```python
from trendradar.core.analyzer import count_frequency

stats, total = count_frequency(
    data_source=results,
    word_groups=word_groups,
    filter_words=filter_words,
    id_to_name=id_to_name,
    title_info=title_info,
    new_titles=new_titles,
    mode="current"
)
```

### 数据转换

#### `convert_crawl_results_to_news_data(...)`

转换爬取结果为NewsData。

```python
from trendradar.storage import convert_crawl_results_to_news_data

news_data = convert_crawl_results_to_news_data(
    results=results,
    id_to_name=id_to_name,
    failed_ids=failed_ids,
    crawl_time="10:30:00",
    crawl_date="2025-01-21"
)
```

### 时间处理

#### `is_within_days(date_str, days, timezone)`

检查日期是否在指定天数内。

```python
from trendradar.utils.time import is_within_days

is_recent = is_within_days("2025-01-20", days=3, timezone="Asia/Shanghai")
```

### URL处理

#### `format_url(url, mobile_url)`

格式化URL（优先返回移动端URL）。

```python
from trendradar.utils.url import format_url

url = format_url(
    url="https://example.com/article",
    mobile_url="https://m.example.com/article"
)
```

## 错误处理

### MCPError

MCP服务器错误基类。

```python
from mcp_server.utils.errors import MCPError

class DataNotFoundError(MCPError):
    """数据未找到错误"""
    pass
```

### 异常示例

```python
try:
    data = manager.load_news_data("2025-01-21")
except FileNotFoundError as e:
    print(f"数据不存在: {e}")
except Exception as e:
    print(f"加载失败: {e}")
```

## 使用示例

### 完整流程示例

```python
from trendradar.__main__ import NewsAnalyzer
from trendradar.core import load_config

# 加载配置
config = load_config()

# 创建分析器
analyzer = NewsAnalyzer()

# 执行分析
analyzer.run()

# 或单独调用某个步骤
results, id_to_name, failed_ids = analyzer._crawl_data()
rss_items, rss_new_items, raw_rss_items = analyzer._crawl_rss_data()
```

### MCP客户端示例

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# 连接MCP服务器
server_params = StdioServerParameters(
    command="python",
    args=["-m", "mcp_server.server"]
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        # 初始化
        await session.initialize()

        # 调用工具
        result = await session.call_tool(
            "query_news_by_date",
            arguments={"date": "2025-01-21"}
        )

        print(result.content[0].text)
```

## 最佳实践

### 1. 错误处理

```python
result = await session.call_tool("query_news_by_date", {...})
if not result.content[0].text:
    print("查询失败")
    return

data = json.loads(result.content[0].text)
if not data.get("success"):
    print(f"错误: {data.get('error')}")
    return
```

### 2. 资源清理

```python
analyzer = NewsAnalyzer()
try:
    analyzer.run()
finally:
    analyzer.ctx.cleanup()
```

### 3. 配置验证

```python
config = load_config()
if not config.get("platforms", {}).get("enabled"):
    print("热榜平台未启用")
```

## 相关资源

- [架构设计](02-architecture.md)
- [开发指南](04-development.md)
- [配置指南](03-configuration.md)
