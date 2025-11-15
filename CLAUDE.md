# TrendRadar - AI Assistant Guide

This document provides comprehensive information about the TrendRadar codebase for AI assistants working on this project.

## Project Overview

**TrendRadar** is a lightweight news aggregation and monitoring tool designed to help users track trending topics across multiple Chinese social media and news platforms. It filters news based on user-defined keywords, provides intelligent push notifications, and offers AI-powered analytics through an MCP (Model Context Protocol) server.

**Version**: 3.0.5 (main.py:23)
**MCP Version**: 1.0.1 (pyproject.toml:3)
**License**: GPL-3.0
**Language**: Python 3.10+

### Key Features

1. **Multi-Platform News Aggregation** - Monitors 11+ platforms including Weibo, Zhihu, Bilibili, Baidu, Douyin, etc.
2. **Keyword-Based Filtering** - Uses frequency_words.txt to track specific topics
3. **Multiple Notification Channels** - Supports WeChat Work, Telegram, DingTalk, Feishu, Email, ntfy
4. **Three Push Modes** - Daily summary, current rankings, or incremental updates
5. **MCP Server Integration** - Provides AI-powered news analysis via FastMCP 2.0
6. **Flexible Deployment** - Supports GitHub Actions, Docker, and local Python execution

## Repository Structure

```
TrendRadar/
├── main.py                          # Main crawler script (171KB monolithic file)
├── config/
│   ├── config.yaml                  # Main configuration file
│   └── frequency_words.txt          # User-defined keywords for filtering
├── mcp_server/                      # MCP server implementation
│   ├── server.py                    # FastMCP 2.0 server entry point
│   ├── tools/                       # MCP tool implementations
│   │   ├── data_query.py           # News data query tools
│   │   ├── analytics.py            # Analytics and statistics tools
│   │   ├── search_tools.py         # Search functionality
│   │   ├── config_mgmt.py          # Configuration management
│   │   └── system.py               # System management tools
│   ├── services/                    # Service layer
│   │   ├── cache_service.py        # Caching logic
│   │   ├── data_service.py         # Data processing
│   │   └── parser_service.py       # Data parsing
│   └── utils/                       # Utility functions
│       ├── date_parser.py          # Date parsing and handling
│       ├── errors.py               # Error definitions
│       └── validators.py           # Input validation
├── docker/                          # Docker deployment files
│   ├── docker-compose.yml          # Standard Docker Compose
│   ├── docker-compose-build.yml    # Build configuration
│   ├── entrypoint.sh               # Container entry point
│   └── manage.py                   # Docker management script
├── .github/workflows/               # GitHub Actions
│   ├── crawler.yml                 # Main crawler workflow (hourly cron)
│   └── docker.yml                  # Docker build/push workflow
├── output/                          # Generated data (git-ignored)
│   ├── news_cache.json             # Current news cache
│   ├── news_cache_history.json     # Historical news data
│   └── push_record.json            # Push notification records
├── index.html                       # Static HTML news view (auto-generated)
├── requirements.txt                 # Python dependencies
├── pyproject.toml                   # Project metadata and MCP config
├── setup-windows.bat                # Windows setup script (Chinese)
├── setup-windows-en.bat             # Windows setup script (English)
├── setup-mac.sh                     # macOS setup script
├── start-http.bat                   # Start MCP HTTP server (Windows)
├── start-http.sh                    # Start MCP HTTP server (Unix)
├── readme.md                        # Main documentation (Chinese, 67KB)
├── README-MCP-FAQ.md                # MCP deployment FAQ
└── README-Cherry-Studio.md          # Cherry Studio integration guide
```

## Core Components

### 1. Main Crawler (`main.py`)

**Location**: `main.py` (5000+ lines)

This is the heart of the application - a monolithic script that handles:
- Configuration loading from YAML with environment variable overrides
- News fetching from multiple platforms via newsnow API
- Keyword filtering based on frequency_words.txt
- News ranking algorithm using weighted scoring (rank, frequency, hotness)
- Notification sending to multiple channels with batch support
- HTML generation for static web view
- Data caching and persistence
- Push time window management

**Key Functions**:
- `load_config()` - Loads config.yaml with env var overrides (main.py:55)
- `fetch_platform_news()` - Fetches news from specific platform
- `filter_news()` - Filters news by keywords
- `calculate_score()` - Ranks news using weighted algorithm
- `send_notifications()` - Sends to all configured channels
- `generate_html()` - Creates index.html view

**Important**: This file is very large. When making changes, be careful to:
- Maintain backward compatibility with existing config
- Test notification sending thoroughly (uses secrets)
- Avoid breaking the weighted ranking algorithm
- Ensure HTML generation still works

### 2. MCP Server (`mcp_server/`)

**Purpose**: Provides AI-powered interface for querying and analyzing news data.

**Technology**: Built with FastMCP 2.0 for production-grade MCP implementation.

**Architecture**:
```
server.py (entry point)
  ├── tools/ (MCP tool implementations)
  ├── services/ (business logic)
  └── utils/ (helpers)
```

**Available MCP Tools** (from mcp_server/server.py):
1. `get_latest_news` - Get latest batch of news (supports platform filtering)
2. `get_trending_topics` - Get frequency word statistics (daily/current mode)
3. `search_news` - Search news by keywords with date range support
4. `get_platform_stats` - Get platform statistics
5. `analyze_trends` - Analyze trend patterns
6. `get_config` - Read configuration
7. `update_config` - Update configuration
8. `manage_keywords` - Add/remove/list keywords
9. `get_system_status` - System health check

**Important Notes**:
- Tools return JSON strings (use `json.dumps(result, ensure_ascii=False)`)
- Date parsing supports natural language (e.g., "最近3天", "2025年1月")
- Data comes from `output/` directory (news_cache.json)
- MCP server uses singleton pattern for tool instances

### 3. Configuration System

**Main Config**: `config/config.yaml`

**Structure**:
```yaml
app:                    # Version check, update notifications
crawler:                # Request intervals, proxy settings
report:                 # Push mode (daily/current/incremental)
notification:           # Enable/disable, batch sizes, webhooks
  push_window:          # Optional time-window control
weight:                 # Ranking algorithm weights
platforms:              # Platform list with IDs and display names
```

**Keywords**: `config/frequency_words.txt`
- One keyword per line
- Supports Chinese and English
- Case-insensitive matching
- Empty lines ignored

**Environment Variables** (override config.yaml):
- `FEISHU_WEBHOOK_URL` - Feishu bot webhook
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Telegram chat ID
- `DINGTALK_WEBHOOK_URL` - DingTalk webhook
- `WEWORK_WEBHOOK_URL` - WeChat Work webhook
- `EMAIL_FROM` - Sender email
- `EMAIL_PASSWORD` - Email password/token
- `EMAIL_TO` - Recipient email(s)
- `EMAIL_SMTP_SERVER` - SMTP server (optional)
- `EMAIL_SMTP_PORT` - SMTP port (optional)
- `NTFY_TOPIC` - ntfy topic name
- `NTFY_SERVER_URL` - ntfy server URL
- `NTFY_TOKEN` - ntfy access token
- `REPORT_MODE` - Push mode override
- `ENABLE_CRAWLER` - Enable/disable crawler
- `ENABLE_NOTIFICATION` - Enable/disable notifications
- `PUSH_WINDOW_ENABLED` - Enable push time window
- `PUSH_WINDOW_START` - Window start time (HH:MM)
- `PUSH_WINDOW_END` - Window end time (HH:MM)
- `PUSH_WINDOW_ONCE_PER_DAY` - Once per day flag
- `PUSH_WINDOW_RETENTION_DAYS` - Record retention days

## Development Workflows

### Local Development

**Prerequisites**:
- Python 3.10 or higher
- pip package manager

**Setup**:
```bash
# Clone repository
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# Install dependencies
pip install -r requirements.txt

# Configure
cp config/config.yaml.example config/config.yaml  # If example exists
# Edit config/config.yaml and config/frequency_words.txt

# Run crawler
python main.py

# Run MCP server (stdio mode)
python -m mcp_server.server

# Run MCP server (HTTP mode)
./start-http.sh  # or start-http.bat on Windows
```

**Testing MCP Server**:
```bash
# After setup, test in MCP client (e.g., Cherry Studio, Claude Desktop)
# Sample queries:
# - "帮我爬取最新的新闻"
# - "搜索最近3天关于'人工智能'的新闻"
# - "分析'iPhone'的热度趋势"
```

### GitHub Actions Deployment

**Workflow**: `.github/workflows/crawler.yml`

**Schedule**: Runs every hour on the hour (`cron: "0 * * * *"`)

**Requirements**:
1. Fork the repository
2. Configure GitHub Secrets (do NOT put webhooks in config.yaml):
   - `FEISHU_WEBHOOK_URL`
   - `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`
   - `DINGTALK_WEBHOOK_URL`
   - `WEWORK_WEBHOOK_URL`
   - `EMAIL_FROM`, `EMAIL_PASSWORD`, `EMAIL_TO`
   - `NTFY_TOPIC`, `NTFY_SERVER_URL`, `NTFY_TOKEN`
3. Enable GitHub Actions in repository settings
4. Ensure `config/config.yaml` and `config/frequency_words.txt` exist

**Important**:
- GitHub Actions has resource limits - don't run too frequently (minimum 30min intervals recommended)
- The workflow auto-commits generated data back to the repository
- Execution time is unstable - leave 2+ hour buffer for time windows

### Docker Deployment

**Quick Start**:
```bash
# Pull and run
docker pull wantcat/trendradar
docker run -d \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/output:/app/output \
  -e FEISHU_WEBHOOK_URL="your_webhook" \
  wantcat/trendradar

# Or use docker-compose
cd docker
docker-compose up -d
```

**Build from Source**:
```bash
cd docker
docker-compose -f docker-compose-build.yml up -d
```

**Management**:
```bash
# View logs
docker logs -f trendradar

# Restart
docker restart trendradar

# Stop
docker stop trendradar
```

## Key Conventions & Best Practices

### Code Style

1. **Language**: All code comments and docstrings are in Chinese
2. **User-facing messages**: Chinese for console output
3. **Variable naming**:
   - Use descriptive English names in code
   - Use Chinese in user-facing strings
4. **File encoding**: UTF-8 with BOM support (`# coding=utf-8`)

### Configuration Guidelines

1. **Never commit secrets**: Use environment variables for webhooks/tokens
2. **Validate config**: Check required fields before running
3. **Default values**: Provide sensible defaults in config.yaml
4. **Environment priority**: Env vars always override config.yaml

### Data Handling

1. **Output directory**: Never commit `output/` to git (gitignored)
2. **Data persistence**:
   - `news_cache.json` - Current news cache
   - `news_cache_history.json` - Historical data
   - `push_record.json` - Push notification history
3. **File operations**: Use Path from pathlib, not string concatenation
4. **JSON encoding**: Always use `ensure_ascii=False` for Chinese characters

### Notification Best Practices

1. **Batch sending**: Large messages split by `MESSAGE_BATCH_SIZE`
2. **Rate limiting**: Use `BATCH_SEND_INTERVAL` between batches
3. **Error handling**: Continue on single channel failure, don't abort all
4. **Testing**: Test with small keyword lists before production use

### MCP Server Guidelines

1. **Tool naming**: Use snake_case for consistency with FastMCP
2. **Return format**: Always return JSON strings, not Python objects
3. **Error handling**: Use try-catch, return error messages in JSON
4. **Documentation**: Document expected behavior in docstrings (Chinese OK)
5. **Date parsing**: Support both absolute dates and relative expressions
6. **Data limits**: Default to reasonable limits (e.g., 50 items) to save tokens

### Git Workflow

**Branch Strategy**:
- `master` - Main branch (stable)
- Feature branches: `feature/*`, `fix/*`, etc.
- AI assistant branches: `claude/*` with session ID suffix

**Commit Messages**:
- Chinese or English acceptable
- Use conventional commits format: `type: description`
- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- Examples:
  - `feat: 增加邮件推送功能`
  - `fix: 修复时间窗口判断逻辑`
  - `docs: 更新 README 文档`

### Testing Considerations

**Before Committing**:
1. Test with sample config (don't use real webhooks in tests)
2. Verify HTML generation produces valid output
3. Check MCP tools return valid JSON
4. Ensure no secrets in code
5. Test with both Chinese and English keywords

**Common Issues**:
- Timezone handling (use Asia/Shanghai for Beijing time)
- Character encoding (ensure UTF-8)
- Proxy settings (test with and without proxy)
- Platform API changes (check if news fetch fails)

## Common Tasks for AI Assistants

### Adding a New Notification Channel

1. Add webhook/token fields to `config/config.yaml` under `notification.webhooks`
2. Add environment variable support in `load_config()` in main.py
3. Implement send function in main.py (follow existing pattern)
4. Add channel to `send_notifications()` function
5. Update README with configuration instructions
6. Test thoroughly with real webhook

### Adding a New Platform

1. Check [newsnow sources](https://github.com/ourongxing/newsnow/tree/main/server/sources) for platform ID
2. Add platform to `platforms` list in `config/config.yaml`:
   ```yaml
   - id: "platform-id"
     name: "显示名称"
   ```
3. No code changes needed - platform list is dynamic
4. Test that news fetching works for new platform

### Modifying Ranking Algorithm

**Location**: main.py (search for weight calculation logic)

**Current Algorithm**:
```
score = (rank_weight × rank_score) +
        (frequency_weight × frequency_score) +
        (hotness_weight × hotness_score)
```

**Weights** (must sum to 1.0):
- `rank_weight`: 0.6 (default)
- `frequency_weight`: 0.3 (default)
- `hotness_weight`: 0.1 (default)

**To Modify**:
1. Update `weight` section in config.yaml
2. Or modify calculation logic in main.py
3. Test with diverse news data
4. Document changes in commit message

### Adding a New MCP Tool

1. Decide which tool category (data_query, analytics, search, config, system)
2. Implement method in appropriate tools class (e.g., `mcp_server/tools/data_query.py`)
3. Register tool in `mcp_server/server.py` using `@mcp.tool` decorator
4. Follow existing pattern for JSON return format
5. Add comprehensive docstring (Chinese OK)
6. Test with MCP client

### Debugging Issues

**Common Problems**:

1. **News not fetching**:
   - Check `ENABLE_CRAWLER` setting
   - Verify proxy settings if using proxy
   - Check newsnow API availability
   - Look for rate limiting

2. **Notifications not sending**:
   - Verify `ENABLE_NOTIFICATION` is true
   - Check webhook URLs are correct
   - Look for batch size issues
   - Check time window settings

3. **MCP server not connecting**:
   - Verify Python version (3.10+)
   - Check dependencies installed
   - Look for port conflicts (HTTP mode)
   - Check project_root path is correct

4. **Keywords not matching**:
   - Verify encoding of frequency_words.txt (UTF-8)
   - Check for extra whitespace
   - Ensure case-insensitive matching

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  Trigger (Cron / Manual / GitHub Actions)          │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Load Configuration                                 │
│  - config.yaml                                      │
│  - frequency_words.txt                              │
│  - Environment variables                            │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Fetch News from Platforms                          │
│  - Loop through configured platforms                │
│  - Call newsnow API                                 │
│  - Handle rate limiting                             │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Filter by Keywords                                 │
│  - Match against frequency_words.txt                │
│  - Case-insensitive                                 │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Calculate Scores & Rank                            │
│  - Apply weighted algorithm                         │
│  - Sort by score                                    │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Determine What to Push                             │
│  - Check push mode (daily/current/incremental)      │
│  - Check time window                                │
│  - Compare with history                             │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Save Data                                          │
│  - output/news_cache.json (current)                 │
│  - output/news_cache_history.json (historical)      │
│  - output/push_record.json (push log)               │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Generate HTML                                      │
│  - Create index.html                                │
│  - Static web view                                  │
└────────────────┬────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────┐
│  Send Notifications                                 │
│  - Feishu, Telegram, DingTalk, etc.                 │
│  - Batch if needed                                  │
│  - Rate limit between batches                       │
└─────────────────────────────────────────────────────┘
```

## API & External Dependencies

### newsnow API

**Source**: https://github.com/ourongxing/newsnow
**Website**: https://newsnow.busiyi.world/

**Usage**: TrendRadar fetches news data from newsnow's API endpoints.

**Platform IDs** (common):
- `zhihu` - 知乎
- `weibo` - 微博
- `douyin` - 抖音
- `bilibili-hot-search` - Bilibili热搜
- `baidu` - 百度热搜
- `toutiao` - 今日头条
- `thepaper` - 澎湃新闻
- `wallstreetcn-hot` - 华尔街见闻
- `ifeng` - 凤凰网
- `cls-hot` - 财联社热门
- `tieba` - 贴吧

**Rate Limiting**: Use `REQUEST_INTERVAL` to avoid overwhelming the API.

### Python Dependencies

From `requirements.txt` and `pyproject.toml`:
- `requests>=2.32.5,<3.0.0` - HTTP client
- `pytz>=2025.2,<2026.0` - Timezone handling
- `PyYAML>=6.0.3,<7.0.0` - YAML parsing
- `fastmcp>=2.12.0,<2.14.0` - MCP server framework
- `websockets>=13.0,<14.0` - WebSocket support

**Installation**: `pip install -r requirements.txt`

## Security Considerations

### Secrets Management

**CRITICAL**: Never commit secrets to the repository!

**Safe Practices**:
1. Use GitHub Secrets for GitHub Actions deployment
2. Use environment variables for local/Docker deployment
3. Keep `config/config.yaml` webhooks empty in repository
4. Add `.env` to `.gitignore` if using dotenv

**Webhook URLs**: Treat as highly sensitive
- Can be used to spam users
- May contain organization information
- Could be abused for phishing

### Input Validation

**User-Controlled Inputs**:
- `frequency_words.txt` - User-defined keywords
- `config.yaml` - Configuration values
- MCP tool parameters - AI-generated queries

**Validation Points**:
- Sanitize HTML output generation
- Validate date range parameters
- Check platform IDs against whitelist
- Limit query result sizes

### Network Security

- **Proxy Support**: Use `USE_PROXY` and `DEFAULT_PROXY` in config
- **HTTPS**: All external APIs use HTTPS
- **SMTP**: Supports both SSL (465) and STARTTLS (587)

## Troubleshooting Guide

### Issue: No News Data

**Symptoms**: Empty news cache, no notifications

**Possible Causes**:
1. `ENABLE_CRAWLER` is false
2. Network connectivity issues
3. newsnow API unavailable
4. All keywords filtered out results
5. Proxy misconfiguration

**Solutions**:
- Check config.yaml settings
- Test network connection
- Try without proxy first
- Use broader keywords
- Check newsnow website status

### Issue: Notifications Not Received

**Symptoms**: News cached but no push notifications

**Possible Causes**:
1. `ENABLE_NOTIFICATION` is false
2. Incorrect webhook URLs
3. Outside push time window
4. No new news (incremental mode)
5. Webhook service blocking

**Solutions**:
- Verify ENABLE_NOTIFICATION setting
- Double-check webhook URLs (no extra spaces)
- Check time window configuration
- Try daily mode for testing
- Test webhook with curl

### Issue: MCP Server Connection Failed

**Symptoms**: AI client can't connect to MCP server

**Possible Causes**:
1. Wrong Python version
2. Dependencies not installed
3. Incorrect project_root path
4. Port already in use (HTTP mode)
5. Configuration error in client

**Solutions**:
- Verify Python 3.10+
- Run `pip install -r requirements.txt`
- Use absolute paths
- Check port 3333 availability
- Review client MCP configuration

### Issue: Chinese Characters Display as Gibberish

**Symptoms**: Garbled Chinese text in output

**Possible Causes**:
1. Wrong file encoding
2. Terminal doesn't support UTF-8
3. Missing `ensure_ascii=False` in JSON dumps

**Solutions**:
- Ensure files are UTF-8 encoded
- Set terminal encoding to UTF-8
- Check JSON serialization calls

## Version History & Migration

### Current Version: 3.0.5

**Major Features**:
- MCP server integration (v1.0.1)
- Email notification support
- Push time window control
- Multiple push modes

**Breaking Changes from 2.x**:
- Configuration structure changed
- MCP server added as separate component
- Output directory structure modified

**Migration Tips**:
- Review config.yaml structure
- Update notification webhook configuration
- Install new dependencies (fastmcp, websockets)

## Resources & References

### Documentation
- Main README: `readme.md` (Chinese, comprehensive)
- MCP FAQ: `README-MCP-FAQ.md`
- Cherry Studio Guide: `README-Cherry-Studio.md`

### External Links
- Repository: https://github.com/sansan0/TrendRadar
- Docker Hub: https://hub.docker.com/r/wantcat/trendradar
- Data Source: https://github.com/ourongxing/newsnow
- GitHub Pages Demo: https://sansan0.github.io/TrendRadar
- MCP Protocol: https://modelcontextprotocol.io/

### Community
- Issues: https://github.com/sansan0/TrendRadar/issues
- Discussions: GitHub Discussions
- WeChat Official Account: See README

## Working with This Codebase

### For Code Analysis
- Main logic is in `main.py` (large monolithic file)
- Use search to find specific functions
- MCP tools are well-organized in `mcp_server/tools/`

### For Adding Features
- Start with config.yaml additions
- Then modify main.py logic
- Update MCP tools if AI interface needed
- Document in README

### For Bug Fixes
- Check GitHub issues first
- Test with minimal configuration
- Ensure backward compatibility
- Update version number if needed

### For Refactoring
- **Warning**: main.py is very large - refactor carefully
- Consider extracting modules (notifications, filtering, etc.)
- Maintain backward compatibility with existing configs
- Test all deployment methods after refactoring

---

## Quick Reference Commands

```bash
# Development
python main.py                          # Run crawler once
python -m mcp_server.server             # Start MCP server (stdio)
./start-http.sh                         # Start MCP HTTP server

# Docker
docker-compose up -d                    # Start with Docker Compose
docker logs -f trendradar               # View logs
docker restart trendradar               # Restart container

# Testing
curl -X POST <webhook_url> -d '{...}'   # Test webhook
python -c "import yaml; ..."            # Validate YAML

# Git (AI Assistant)
git checkout -b claude/feature-name-sessionID
git add .
git commit -m "type: description"
git push -u origin claude/feature-name-sessionID
```

---

**Last Updated**: 2025-11-15
**Maintained By**: AI Assistant (Claude)
**For**: TrendRadar v3.0.5
