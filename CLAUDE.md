# CLAUDE.md - TrendRadar AI Assistant Guide

> **Version**: 3.0.5
> **Last Updated**: 2025-11-13
> **Purpose**: Comprehensive guide for AI assistants working with the TrendRadar codebase

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Architecture](#codebase-architecture)
3. [Core Components](#core-components)
4. [Development Workflows](#development-workflows)
5. [Configuration Management](#configuration-management)
6. [MCP Server Details](#mcp-server-details)
7. [Common Tasks](#common-tasks)
8. [Code Conventions](#code-conventions)
9. [Deployment Options](#deployment-options)
10. [Testing & Debugging](#testing--debugging)

---

## 🎯 Project Overview

**TrendRadar** is a lightweight news aggregation and hot-spot tracking tool that:
- Aggregates trending news from 11+ Chinese platforms (Weibo, Zhihu, Douyin, Baidu, etc.)
- Supports AI-powered analysis via MCP (Model Context Protocol) server
- Provides automated notifications through multiple channels (Feishu, DingTalk, WeWork, Telegram, Email, ntfy)
- Offers three deployment modes: GitHub Actions, Docker, and local/MCP server

### Key Features

1. **Multi-platform News Aggregation**: Crawls trending news from 11+ platforms
2. **Smart Filtering**: Uses frequency words to filter relevant news
3. **Three Report Modes**:
   - `daily`: Daily summary with cumulative data
   - `current`: Current trending topics
   - `incremental`: Only new matching news
4. **MCP Integration**: FastMCP 2.0-based server for AI-powered analysis
5. **Multiple Deployment Options**: GitHub Actions, Docker, MCP server

### Technology Stack

- **Language**: Python 3.10+
- **Key Dependencies**:
  - `requests` (2.32.5+): HTTP requests
  - `pytz` (2025.2+): Timezone handling
  - `PyYAML` (6.0.3+): Configuration management
  - `fastmcp` (2.12.0+): MCP server framework
  - `websockets` (13.0+): WebSocket support
- **Package Manager**: UV (fast Python package manager)
- **Build System**: Hatchling

---

## 🏗️ Codebase Architecture

### Directory Structure

```
TrendRadar/
├── main.py                      # Main crawler script (news aggregation & notification)
├── pyproject.toml              # Python project configuration (UV/pip)
├── requirements.txt            # Python dependencies
├── version                     # Current version (3.0.5)
│
├── config/
│   ├── config.yaml            # Main configuration file
│   └── frequency_words.txt    # Keywords for filtering news
│
├── mcp_server/                # MCP server for AI analysis
│   ├── __init__.py
│   ├── server.py              # FastMCP 2.0 server entry point (13 tools)
│   │
│   ├── services/              # Core business logic
│   │   ├── cache_service.py   # In-memory caching (TTL-based)
│   │   ├── data_service.py    # Data access layer (news retrieval, config)
│   │   └── parser_service.py  # File parsing (txt, yaml)
│   │
│   ├── tools/                 # MCP tool implementations
│   │   ├── data_query.py      # Basic data queries (3 tools)
│   │   ├── search_tools.py    # Smart search (2 tools)
│   │   ├── analytics.py       # Advanced analytics (5 tools)
│   │   ├── config_mgmt.py     # Configuration management (1 tool)
│   │   └── system.py          # System operations (2 tools)
│   │
│   └── utils/                 # Shared utilities
│       ├── date_parser.py     # Natural language date parsing
│       ├── validators.py      # Input validation
│       └── errors.py          # Custom exceptions
│
├── docker/                    # Docker deployment
│   ├── manage.py              # Container management (supercronic)
│   └── Dockerfile             # (in root, not shown)
│
├── .github/workflows/
│   ├── crawler.yml            # GitHub Actions crawler (hourly)
│   └── docker.yml             # Docker image build
│
├── setup-mac.sh               # macOS setup script (UV + dependencies)
├── setup-windows.bat          # Windows setup script (Chinese)
├── setup-windows-en.bat       # Windows setup script (English)
├── start-http.sh              # Start MCP server (HTTP mode)
├── start-http.bat             # Start MCP server (Windows)
│
├── index.html                 # Web interface for news display
├── readme.md                  # Main documentation (Chinese)
├── README-Cherry-Studio.md    # Cherry Studio MCP client guide
└── README-MCP-FAQ.md          # MCP FAQ
```

---

## 🔧 Core Components

### 1. Main Crawler (`main.py`)

**Purpose**: News aggregation and notification engine

**Key Functions**:
- `load_config()`: Load configuration from `config/config.yaml`
- `fetch_news()`: Fetch news from API endpoints
- `calculate_weight()`: Calculate news ranking weight
- `filter_news_by_keywords()`: Filter news using frequency words
- `send_notification()`: Send notifications to configured channels
- `check_version()`: Check for version updates

**Key Constants**:
- `VERSION = "3.0.5"`
- `SMTP_CONFIGS`: Email provider configurations

**Workflow**:
1. Load configuration from YAML
2. Fetch news from configured platforms
3. Calculate weights and rank news
4. Filter by frequency words
5. Generate report (daily/current/incremental)
6. Send notifications if enabled
7. Save output to files

### 2. MCP Server (`mcp_server/server.py`)

**Purpose**: FastMCP 2.0-based tool server for AI analysis

**Architecture**: 13 MCP tools organized into 4 categories

#### Category 1: Basic Data Queries (3 tools)
1. `get_latest_news()` - Get latest crawled news
2. `get_news_by_date()` - Query news by date (supports natural language)
3. `get_trending_topics()` - Get frequency word statistics

#### Category 2: Smart Search (2 tools)
4. `search_news()` - Unified search (keyword/fuzzy/entity modes)
5. `search_related_news_history()` - Historical related news search

#### Category 3: Advanced Analytics (5 tools)
6. `analyze_topic_trend()` - Topic trend analysis (4 sub-modes)
7. `analyze_data_insights()` - Data insights (3 sub-modes)
8. `analyze_sentiment()` - Sentiment analysis
9. `find_similar_news()` - Similar news detection
10. `generate_summary_report()` - Daily/weekly report generation

#### Category 4: System Management (3 tools)
11. `get_current_config()` - Get system configuration
12. `get_system_status()` - System health check
13. `trigger_crawl()` - Manual crawl trigger

**Key Features**:
- Singleton pattern for tool instances
- Supports both stdio and HTTP transport modes
- Comprehensive error handling
- Token optimization (default `include_url=False`)

### 3. Services Layer

#### `data_service.py` (DataService)
**Responsibilities**:
- News data retrieval from `output/` directory
- Date range queries
- Platform filtering
- Configuration access

**Key Methods**:
- `get_latest_news()`: Read latest news from output files
- `get_news_by_date()`: Query news for specific date
- `search_news_by_keyword()`: Keyword-based search
- `get_trending_topics()`: Frequency word statistics
- `get_available_date_range()`: Get available data date range

#### `parser_service.py` (ParserService)
**Responsibilities**:
- Parse news data files (txt format)
- Parse configuration files (yaml)
- Clean and normalize text

**Key Methods**:
- `parse_txt_file()`: Parse news txt files
- `parse_yaml_config()`: Parse config.yaml
- `parse_frequency_words()`: Parse frequency_words.txt
- `clean_title()`: Clean news titles

**File Format** (news data):
```
[Platform Name] News Title (Rank: 1, Hotness: 12345)
```

#### `cache_service.py` (CacheService)
**Responsibilities**:
- In-memory caching with TTL
- Cache statistics
- Automatic cleanup

**Key Methods**:
- `get(key, ttl)`: Get cached value
- `set(key, value)`: Cache value
- `cleanup_expired(ttl)`: Remove expired entries
- `get_stats()`: Get cache statistics

### 4. Utilities Layer

#### `date_parser.py`
**Purpose**: Natural language date parsing

**Supports**:
- Natural language: "今天", "昨天", "前天", "3天前"
- ISO format: "2024-01-15"
- Slash format: "2024/01/15"

**Key Function**: `parse_date_query(date_query) -> datetime`

#### `validators.py`
**Purpose**: Input validation

**Key Functions**:
- `validate_platforms()`: Validate platform IDs
- `validate_limit()`: Validate pagination limits
- `validate_threshold()`: Validate similarity thresholds
- `validate_date_range()`: Validate date range objects

#### `errors.py`
**Purpose**: Custom exception classes

**Exception Hierarchy**:
- `TrendRadarError` (base)
  - `ConfigurationError`
  - `DataNotFoundError`
  - `ValidationError`
  - `APIError`

---

## 🔄 Development Workflows

### Typical Workflow for New Features

1. **Understand Requirements**
   - Read feature request carefully
   - Check if related to crawler (`main.py`) or MCP server (`mcp_server/`)
   - Review relevant configuration in `config/config.yaml`

2. **Code Location**
   - **News crawling**: Modify `main.py`
   - **New MCP tool**: Add to `mcp_server/tools/` and register in `server.py`
   - **Data access**: Extend `mcp_server/services/data_service.py`
   - **Configuration**: Update `config/config.yaml`

3. **Implementation Steps**
   - Create new functions in appropriate modules
   - Follow existing code patterns (see [Code Conventions](#code-conventions))
   - Add input validation using `utils/validators.py`
   - Handle errors with custom exceptions from `utils/errors.py`
   - Add docstrings with clear examples

4. **Testing**
   - Test main crawler: `python main.py`
   - Test MCP server (stdio): `uv run python -m mcp_server.server`
   - Test MCP server (HTTP): `uv run python -m mcp_server.server --transport http --port 3333`
   - Verify configuration changes don't break existing functionality

5. **Documentation**
   - Update docstrings
   - Update README.md if needed
   - Update this CLAUDE.md for significant changes

### Version Control Workflow

**Branch Naming**:
- Feature: `claude/claude-md-{session-id}`
- Development work MUST be done on feature branches starting with `claude/`

**Commit Messages**:
```bash
# Pattern observed in git log
feat: 添加新功能
fix: 修复问题
docs: 更新文档
chore: 日常维护
```

**Git Commands**:
```bash
# Push with retry on network errors (exponential backoff)
git push -u origin claude/branch-name

# Fetch specific branch
git fetch origin branch-name

# Always use -u flag for first push
```

---

## ⚙️ Configuration Management

### Main Configuration File: `config/config.yaml`

**Structure**:

```yaml
app:
  version_check_url: "..."
  show_version_update: true

crawler:
  request_interval: 1000          # ms
  enable_crawler: true
  use_proxy: false
  default_proxy: "http://127.0.0.1:10086"

report:
  mode: "daily"                   # daily|incremental|current
  rank_threshold: 5               # Highlight rank threshold

notification:
  enable_notification: true
  message_batch_size: 4000
  dingtalk_batch_size: 20000
  feishu_batch_size: 29000
  batch_send_interval: 3          # seconds

  push_window:
    enabled: false
    time_range:
      start: "20:00"
      end: "22:00"
    once_per_day: true
    push_record_retention_days: 7

  webhooks:
    feishu_url: ""
    dingtalk_url: ""
    wework_url: ""
    telegram_bot_token: ""
    telegram_chat_id: ""
    email_from: ""
    email_password: ""
    email_to: ""
    ntfy_server_url: "https://ntfy.sh"
    ntfy_topic: ""

weight:
  rank_weight: 0.6
  frequency_weight: 0.3
  hotness_weight: 0.1

platforms:
  - id: "toutiao"
    name: "今日头条"
  - id: "baidu"
    name: "百度热搜"
  # ... 11+ platforms
```

### Frequency Words Configuration: `config/frequency_words.txt`

**Format**: One keyword per line (Chinese/English)

**Purpose**: Filter news matching these keywords

**Example**:
```
人工智能
ChatGPT
科技
经济
```

### Environment Variables (Priority Order)

**Crawler Configuration**:
- `CONFIG_PATH`: Path to config.yaml (default: `config/config.yaml`)
- `REPORT_MODE`: Override report mode (daily|incremental|current)
- `ENABLE_CRAWLER`: Override enable_crawler (true|false)
- `ENABLE_NOTIFICATION`: Override enable_notification (true|false)

**Notification Webhooks** (GitHub Secrets):
- `FEISHU_WEBHOOK_URL`
- `DINGTALK_WEBHOOK_URL`
- `WEWORK_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `EMAIL_FROM`, `EMAIL_PASSWORD`, `EMAIL_TO`
- `EMAIL_SMTP_SERVER`, `EMAIL_SMTP_PORT`
- `NTFY_TOPIC`, `NTFY_SERVER_URL`, `NTFY_TOKEN`

**Push Window Override**:
- `PUSH_WINDOW_ENABLED`
- `PUSH_WINDOW_START`, `PUSH_WINDOW_END`
- `PUSH_WINDOW_ONCE_PER_DAY`
- `PUSH_WINDOW_RETENTION_DAYS`

---

## 🤖 MCP Server Details

### Overview

TrendRadar includes a production-ready MCP server built with **FastMCP 2.0** that provides AI assistants with 13 tools for news analysis.

### Server Architecture

**Entry Point**: `mcp_server/server.py`

**Startup Modes**:
1. **STDIO Mode** (default): For MCP clients like Cherry Studio
   ```bash
   uv run python -m mcp_server.server
   ```

2. **HTTP Mode**: For remote access
   ```bash
   uv run python -m mcp_server.server --transport http --port 3333
   ```

### Tool Categories & Design Patterns

#### 1. Data Query Tools (Basic)
**Pattern**: Simple data retrieval with filtering

**Tools**:
- `get_latest_news(platforms, limit, include_url)`
- `get_news_by_date(date_query, platforms, limit, include_url)`
- `get_trending_topics(top_n, mode)`

**Key Convention**: Always support natural language dates

#### 2. Search Tools (Intelligent)
**Pattern**: Multi-mode search with relevance scoring

**Tools**:
- `search_news(query, search_mode, date_range, platforms, limit, sort_by, threshold, include_url)`
  - Modes: keyword, fuzzy, entity
- `search_related_news_history(reference_text, time_preset, threshold, limit, include_url)`

**Key Convention**: Use threshold for similarity filtering

#### 3. Analytics Tools (Advanced)
**Pattern**: Unified tools with multiple analysis types

**Tools**:
- `analyze_topic_trend(topic, analysis_type, date_range, ...)`
  - Types: trend, lifecycle, viral, predict
- `analyze_data_insights(insight_type, topic, date_range, ...)`
  - Types: platform_compare, platform_activity, keyword_cooccur
- `analyze_sentiment(topic, platforms, date_range, limit, sort_by_weight, include_url)`
- `find_similar_news(reference_title, threshold, limit, include_url)`
- `generate_summary_report(report_type, date_range)`

**Key Convention**: Unified interfaces reduce tool count

#### 4. System Tools (Management)
**Pattern**: Configuration and operational control

**Tools**:
- `get_current_config(section)`
- `get_system_status()`
- `trigger_crawl(platforms, save_to_local, include_url)`

### MCP Tool Design Principles

1. **Token Optimization**
   - Default `include_url=False` to save tokens
   - Use `limit` parameters with sensible defaults (50)
   - Return JSON for structured data

2. **User-Friendly Parameters**
   - Support natural language dates ("今天", "昨天", "3天前")
   - Accept both Chinese and English platform names
   - Provide helpful docstrings with examples

3. **Data Display Strategy**
   - Return complete results (don't summarize by default)
   - Let AI decide whether to summarize based on user intent
   - Include metadata for AI decision-making

4. **Error Handling**
   - Use custom exceptions from `utils/errors.py`
   - Return helpful error messages in JSON
   - Validate inputs before processing

### MCP Client Configuration

#### Cherry Studio (STDIO Mode)

**Configuration**:
```
Name: TrendRadar
Description: 新闻热点聚合工具
Type: STDIO
Command: /path/to/uv
Arguments (one per line):
  --directory
  /path/to/TrendRadar
  run
  python
  -m
  mcp_server.server
```

**Setup Script**: `setup-mac.sh` (macOS) or `setup-windows.bat` (Windows)

#### HTTP Mode (Remote Access)

**Start Server**:
```bash
./start-http.sh  # Or start-http.bat on Windows
```

**Endpoint**: `http://0.0.0.0:3333/mcp`

---

## 📝 Common Tasks

### Task 1: Add New Platform

**Files to Modify**:
1. `config/config.yaml` - Add platform to `platforms` list
2. `main.py` - Add platform endpoint in `fetch_news()`

**Example**:
```yaml
# config/config.yaml
platforms:
  - id: "new-platform"
    name: "新平台名称"
```

```python
# main.py (in fetch_news function)
if platform_id == "new-platform":
    url = "https://api.example.com/trending"
    # Fetch and parse
```

### Task 2: Add New MCP Tool

**Steps**:
1. Choose appropriate category in `mcp_server/tools/`
2. Implement tool logic in the category module
3. Register tool in `mcp_server/server.py`

**Example** (Add to `data_query.py`):
```python
# In mcp_server/tools/data_query.py
class DataQueryTools:
    def get_custom_data(self, custom_param: str) -> dict:
        """Your tool logic"""
        # Implementation
        return result

# In mcp_server/server.py
@mcp.tool
async def get_custom_data(custom_param: str) -> str:
    """
    Tool description for AI

    Args:
        custom_param: Description

    Returns:
        JSON result
    """
    tools = _get_tools()
    result = tools['data'].get_custom_data(custom_param)
    return json.dumps(result, ensure_ascii=False, indent=2)
```

### Task 3: Modify Report Format

**File**: `main.py`

**Functions**:
- `generate_report_*()` - Report generation functions
- `format_message_*()` - Platform-specific formatting

**Key Variables**:
- `REPORT_MODE`: "daily", "current", or "incremental"

### Task 4: Add New Notification Channel

**Files to Modify**:
1. `config/config.yaml` - Add webhook configuration
2. `main.py` - Add send function

**Example**:
```python
# main.py
def send_slack_notification(webhook_url, content):
    """Send notification to Slack"""
    # Implementation
    pass

# In send_notification()
if config["SLACK_WEBHOOK_URL"]:
    send_slack_notification(config["SLACK_WEBHOOK_URL"], content)
```

### Task 5: Debug MCP Server

**Enable Debug Mode**:
```python
# In mcp_server/server.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Test Individual Tool**:
```python
# In mcp_server/server.py (bottom)
if __name__ == '__main__':
    # Test tool
    tools = _get_tools()
    result = tools['data'].get_latest_news(limit=5)
    print(json.dumps(result, ensure_ascii=False, indent=2))
```

**Check Logs**:
- MCP server outputs to stdout/stderr
- Cherry Studio logs: Check client console

---

## 📏 Code Conventions

### Python Style Guide

1. **Encoding**: Always use UTF-8
   ```python
   # coding=utf-8
   ```

2. **Imports**: Group in order
   ```python
   # Standard library
   import os
   import sys

   # Third-party
   import requests
   import yaml

   # Local modules
   from .services import DataService
   ```

3. **Constants**: UPPER_SNAKE_CASE
   ```python
   VERSION = "3.0.5"
   DEFAULT_LIMIT = 50
   ```

4. **Functions**: snake_case with descriptive names
   ```python
   def fetch_news_from_platform(platform_id: str) -> dict:
       """Fetch news from specific platform"""
       pass
   ```

5. **Classes**: PascalCase
   ```python
   class DataService:
       """Service for data access"""
       pass
   ```

6. **Type Hints**: Use for function signatures
   ```python
   def get_news(limit: int = 50) -> List[Dict]:
       pass
   ```

### Documentation Style

1. **Module Docstrings**: Triple quotes at top
   ```python
   """
   TrendRadar MCP Server - FastMCP 2.0 实现

   使用 FastMCP 2.0 提供生产级 MCP 工具服务器。
   支持 stdio 和 HTTP 两种传输模式。
   """
   ```

2. **Function Docstrings**: Google style
   ```python
   def search_news(query: str, limit: int = 50) -> dict:
       """
       Search news by keyword

       Args:
           query: Search keyword
           limit: Maximum results (default: 50)

       Returns:
           Dictionary with search results

       Examples:
           result = search_news("人工智能", limit=10)
       """
       pass
   ```

3. **MCP Tool Docstrings**: Include AI usage guidance
   ```python
   @mcp.tool
   async def get_latest_news(...) -> str:
       """
       获取最新一批爬取的新闻数据

       Args:
           platforms: 平台ID列表
           limit: 返回条数限制

       Returns:
           JSON格式的新闻列表

       **重要：数据展示建议**
       本工具会返回完整的新闻列表给你。但请注意：
       - **工具返回**：完整的50条数据 ✅
       - **建议展示**：向用户展示全部数据
       """
       pass
   ```

### Error Handling

1. **Custom Exceptions**: Use from `utils/errors.py`
   ```python
   from mcp_server.utils.errors import ValidationError, DataNotFoundError

   if not valid:
       raise ValidationError("Invalid input")
   ```

2. **Try-Except**: Specific exceptions
   ```python
   try:
       result = fetch_data()
   except requests.RequestException as e:
       logging.error(f"Network error: {e}")
       return {"error": str(e)}
   ```

3. **Return Error Objects**: For MCP tools
   ```python
   return {
       "success": False,
       "error": "Data not found",
       "details": error_details
   }
   ```

### Configuration Access Pattern

1. **Load Once**: In main or service init
   ```python
   config = load_config()
   ```

2. **Access via Keys**: Use get() for optional
   ```python
   mode = config.get("REPORT_MODE", "daily")
   ```

3. **Environment Priority**: Check env vars first
   ```python
   mode = os.environ.get("REPORT_MODE", config["REPORT_MODE"])
   ```

### File Path Handling

1. **Use Path Objects**: From pathlib
   ```python
   from pathlib import Path

   output_dir = Path("output")
   file_path = output_dir / "2025-11-13" / "news.txt"
   ```

2. **Check Existence**: Before reading
   ```python
   if not file_path.exists():
       raise DataNotFoundError(f"File not found: {file_path}")
   ```

3. **Relative to Project Root**: In services
   ```python
   self.project_root = Path(project_root or Path.cwd())
   config_path = self.project_root / "config" / "config.yaml"
   ```

---

## 🚀 Deployment Options

### Option 1: GitHub Actions (Automated)

**Configuration**: `.github/workflows/crawler.yml`

**Schedule**: Hourly (adjustable)
```yaml
on:
  schedule:
    - cron: "0 * * * *"  # Every hour
```

**Setup Steps**:
1. Fork repository
2. Add secrets to GitHub repository settings:
   - `FEISHU_WEBHOOK_URL`
   - `TELEGRAM_BOT_TOKEN`
   - etc.
3. Enable GitHub Actions
4. Crawler runs automatically

**Output**:
- Saved to `output/` directory
- Auto-committed to repository
- Accessible via GitHub Pages

### Option 2: Docker (Self-Hosted)

**Configuration**: `docker/manage.py` (supercronic scheduler)

**Build**:
```bash
docker build -t trendradar .
```

**Run**:
```bash
docker run -d \
  -v ./config:/app/config \
  -v ./output:/app/output \
  -e FEISHU_WEBHOOK_URL="..." \
  trendradar
```

**Docker Hub**: `wantcat/trendradar`

**Cron Schedule**: Configurable in container

### Option 3: Local/MCP Server

**Setup**:
```bash
# macOS
./setup-mac.sh

# Windows
setup-windows.bat
```

**Run Crawler**:
```bash
uv run python main.py
```

**Run MCP Server**:
```bash
# STDIO mode
uv run python -m mcp_server.server

# HTTP mode
uv run python -m mcp_server.server --transport http --port 3333
```

**Use Cases**:
- Manual crawling
- AI-powered analysis via Cherry Studio
- Custom integrations

---

## 🧪 Testing & Debugging

### Manual Testing

1. **Test Main Crawler**:
   ```bash
   # Disable notifications for testing
   export ENABLE_NOTIFICATION=false
   python main.py
   ```

2. **Test MCP Server**:
   ```bash
   # STDIO mode (sends output to stdout)
   uv run python -m mcp_server.server

   # HTTP mode (access via HTTP client)
   uv run python -m mcp_server.server --transport http --port 3333
   curl http://localhost:3333/mcp
   ```

3. **Test Specific Tool**:
   ```python
   # In mcp_server/server.py
   if __name__ == '__main__':
       tools = _get_tools()
       result = tools['data'].get_latest_news(limit=5)
       print(json.dumps(result, ensure_ascii=False, indent=2))
   ```

### Common Issues & Solutions

#### Issue 1: "配置文件不存在"
**Cause**: Missing `config/config.yaml`

**Solution**:
```bash
# Ensure config file exists
ls config/config.yaml
```

#### Issue 2: "No news data found"
**Cause**: `output/` directory empty

**Solution**:
```bash
# Run crawler first
python main.py
ls output/
```

#### Issue 3: MCP Server Not Responding
**Cause**: Port already in use (HTTP mode)

**Solution**:
```bash
# Use different port
uv run python -m mcp_server.server --transport http --port 3334
```

#### Issue 4: Cherry Studio Connection Failed
**Cause**: Incorrect UV path or project directory

**Solution**:
```bash
# Find UV path
which uv

# Use absolute paths in Cherry Studio config
Command: /path/to/uv
Arguments:
  --directory
  /absolute/path/to/TrendRadar
  run
  python
  -m
  mcp_server.server
```

### Debugging Tips

1. **Enable Verbose Output**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. **Check Data Files**:
   ```bash
   # View latest news file
   cat output/$(date +%Y-%m-%d)/news.txt
   ```

3. **Validate Configuration**:
   ```python
   import yaml
   with open("config/config.yaml") as f:
       config = yaml.safe_load(f)
       print(config)
   ```

4. **Test Date Parsing**:
   ```python
   from mcp_server.utils.date_parser import parse_date_query
   print(parse_date_query("昨天"))
   ```

---

## 📌 Key Reminders for AI Assistants

### When Working on This Codebase

1. **Always check file structure first**: Use `ls`, `tree`, or `find` to understand layout
2. **Read configuration before modifying**: Check `config/config.yaml` for current settings
3. **Follow existing patterns**: Match coding style of surrounding code
4. **Test incrementally**: Run `main.py` or MCP server after each change
5. **Check git branch**: Always work on `claude/*` branches
6. **Use environment variables for secrets**: Never hardcode webhooks in config files
7. **Preserve backward compatibility**: Don't break existing MCP tools
8. **Document AI-specific features**: MCP tool docstrings should guide AI behavior

### When Adding Features

1. **Determine scope**: Crawler feature (main.py) vs. MCP tool (mcp_server/)
2. **Check dependencies**: Review `requirements.txt` and `pyproject.toml`
3. **Add validation**: Use `utils/validators.py` for input checks
4. **Handle errors gracefully**: Use custom exceptions from `utils/errors.py`
5. **Update documentation**: Modify README.md and this CLAUDE.md
6. **Test both modes**: GitHub Actions simulation and local execution

### When Debugging

1. **Check logs first**: stdout/stderr for errors
2. **Verify data files**: Ensure `output/` has recent data
3. **Test configuration**: Validate YAML syntax and required fields
4. **Isolate issues**: Test crawler and MCP server separately
5. **Review recent commits**: Check git log for related changes

---

## 📚 Additional Resources

### Documentation Files
- `readme.md`: Main project documentation (Chinese)
- `README-Cherry-Studio.md`: Cherry Studio MCP client setup guide
- `README-MCP-FAQ.md`: MCP frequently asked questions

### External Resources
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [UV Package Manager](https://github.com/astral-sh/uv)
- [NewsNow API](https://github.com/ourongxing/newsnow) (data source)

### Project Links
- **GitHub Repository**: https://github.com/sansan0/TrendRadar
- **Docker Hub**: https://hub.docker.com/r/wantcat/trendradar
- **GitHub Pages**: https://sansan0.github.io/TrendRadar

---

## 🔄 Version History

- **v3.0.5** (Current): Latest stable version
- See `version` file for current version
- Check git log for detailed changelog

---

## ✅ Checklist for AI Assistants

Before making changes:
- [ ] Understand the feature request scope (crawler vs. MCP)
- [ ] Review relevant code sections
- [ ] Check configuration requirements
- [ ] Verify git branch (claude/*)

During implementation:
- [ ] Follow code conventions
- [ ] Add appropriate error handling
- [ ] Include docstrings with examples
- [ ] Validate inputs
- [ ] Preserve backward compatibility

After implementation:
- [ ] Test locally (main.py or MCP server)
- [ ] Verify no breaking changes
- [ ] Update documentation if needed
- [ ] Commit with descriptive message
- [ ] Push to correct branch

---

**End of CLAUDE.md**

For questions or clarifications, refer to the main `readme.md` or specific README files in the repository.
