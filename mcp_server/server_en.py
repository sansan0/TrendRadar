"""
TrendRadar MCP Server - FastMCP 2.0 Implementation

Provides production-grade MCP tool server using FastMCP 2.0.
Supports both stdio and HTTP transport modes.
"""

import asyncio
import json
from typing import List, Optional, Dict, Union

from fastmcp import FastMCP

from .tools.data_query import DataQueryTools
from .tools.analytics import AnalyticsTools
from .tools.search_tools import SearchTools
from .tools.config_mgmt import ConfigManagementTools
from .tools.system import SystemManagementTools
from .tools.storage_sync import StorageSyncTools
from .utils.date_parser import DateParser
from .utils.errors import MCPError


# Create FastMCP 2.0 application
mcp = FastMCP('trendradar-news')

# Global tool instances (initialized on first request)
_tools_instances = {}


def _get_tools(project_root: Optional[str] = None):
    """Get or create tool instances (singleton pattern)"""
    if not _tools_instances:
        _tools_instances['data'] = DataQueryTools(project_root)
        _tools_instances['analytics'] = AnalyticsTools(project_root)
        _tools_instances['search'] = SearchTools(project_root)
        _tools_instances['config'] = ConfigManagementTools(project_root)
        _tools_instances['system'] = SystemManagementTools(project_root)
        _tools_instances['storage'] = StorageSyncTools(project_root)
    return _tools_instances


# ==================== MCP Resources ====================

@mcp.resource("config://platforms")
async def get_platforms_resource() -> str:
    """
    Get list of supported platforms

    Returns information on all platforms configured in config.yaml, including IDs and names.
    """
    tools = _get_tools()
    config = await asyncio.to_thread(
        tools['config'].get_current_config, section="crawler"
    )
    return json.dumps({
        "platforms": config.get("platforms", []),
        "description": "List of trending platforms supported by TrendRadar"
    }, ensure_ascii=False, indent=2)


@mcp.resource("config://rss-feeds")
async def get_rss_feeds_resource() -> str:
    """
    Get RSS feed list

    Returns information on all currently configured RSS sources.
    """
    tools = _get_tools()
    status = await asyncio.to_thread(tools['data'].get_rss_feeds_status)
    return json.dumps({
        "feeds": status.get("today_feeds", {}),
        "description": "List of RSS subscription sources supported by TrendRadar"
    }, ensure_ascii=False, indent=2)


@mcp.resource("data://available-dates")
async def get_available_dates_resource() -> str:
    """
    Get available data date range

    Returns list of queryable dates in local storage.
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['storage'].list_available_dates, source="local"
    )
    return json.dumps({
        "dates": result.get("data", {}).get("local", {}).get("dates", []),
        "description": "List of queryable dates in local storage"
    }, ensure_ascii=False, indent=2)


@mcp.resource("config://keywords")
async def get_keywords_resource() -> str:
    """
    Get keyword configuration

    Returns keyword groups configured in frequency_words.txt.
    """
    tools = _get_tools()
    config = await asyncio.to_thread(
        tools['config'].get_current_config, section="keywords"
    )
    return json.dumps({
        "word_groups": config.get("word_groups", []),
        "total_groups": config.get("total_groups", 0),
        "description": "TrendRadar keyword watchlist configuration"
    }, ensure_ascii=False, indent=2)


# ==================== Date Parsing Tool (Recommended Priority) ====================

@mcp.tool
async def resolve_date_range(
    expression: str
) -> str:
    """
    [Recommended Priority] Parse natural language date expressions into standard date ranges

    **Why do we need this tool?**
    Users often use natural language like "this week" or "last 7 days" to express dates, but AI models
    calculating dates themselves may lead to inconsistent results. This tool uses precise server-side
    current time calculation, ensuring all AI models get consistent date ranges.

    **Recommended usage workflow:**
    1. User says "analyze AI sentiment this week"
    2. AI calls resolve_date_range("this week") → gets precise date range
    3. AI calls analyze_sentiment(topic="ai", date_range=date_range from previous step)

    Args:
        expression: Natural language date expression, supported:
            - Single day: "today", "yesterday", "今天", "昨天"
            - Week: "this week", "last week", "本周", "上周"
            - Month: "this month", "last month", "本月", "上月"
            - Recent N days: "last 7 days", "last 30 days", "最近7天", "最近30天"
            - Dynamic: "last 5 days", "last 10 days" (any number of days)

    Returns:
        JSON-formatted date range, can be used directly for date_range parameter in other tools:
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

    Examples:
        User: "analyze AI sentiment this week"
        AI calling steps:
        1. resolve_date_range("this week")
           → {"date_range": {"start": "2025-11-18", "end": "2025-11-26"}, ...}
        2. analyze_sentiment(topic="ai", date_range={"start": "2025-11-18", "end": "2025-11-26"})

        User: "show Tesla news from the last 7 days"
        AI calling steps:
        1. resolve_date_range("last 7 days")
           → {"date_range": {"start": "2025-11-20", "end": "2025-11-26"}, ...}
        2. search_news(query="Tesla", date_range={"start": "2025-11-20", "end": "2025-11-26"})
    """
    try:
        result = await asyncio.to_thread(DateParser.resolve_date_range_expression, expression)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except MCPError as e:
        return json.dumps({
            "success": False,
            "error": e.to_dict()
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(e)
            }
        }, ensure_ascii=False, indent=2)


# ==================== Data Query Tools ====================

@mcp.tool
async def get_latest_news(
    platforms: Optional[List[str]] = None,
    limit: int = 50,
    include_url: bool = False
) -> str:
    """
    Get latest batch of crawled news data for quick understanding of current trends

    Args:
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        limit: Return count limit, default 50, maximum 1000
        include_url: Whether to include URL links, default False (saves tokens)

    Returns:
        JSON-formatted news list

    **Data Display Recommendations**
    - Display all returned data by default, unless user explicitly requests summary
    - Only filter when user says "summarize" or "highlights"
    - If user asks "why only showing partial" it means they need complete data
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['data'].get_latest_news,
        platforms=platforms, limit=limit, include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def get_trending_topics(
    top_n: int = 10,
    mode: str = 'current',
    extract_mode: str = 'keywords'
) -> str:
    """
    Get trending topics statistics

    Args:
        top_n: Return TOP N topics, default 10
        mode: Time mode
            - "daily": Daily cumulative data statistics
            - "current": Latest batch data statistics (default)
        extract_mode: Extraction mode
            - "keywords": Count preset watch words (based on config/frequency_words.txt, default)
            - "auto_extract": Auto extract high-frequency words from news titles (no preset needed, auto discover trends)

    Returns:
        JSON-formatted topic frequency statistics list

    Examples:
        - Use preset watch words: get_trending_topics(mode="current")
        - Auto extract trends: get_trending_topics(extract_mode="auto_extract", top_n=20)
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['data'].get_trending_topics,
        top_n=top_n, mode=mode, extract_mode=extract_mode
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== RSS Data Query Tools ====================

@mcp.tool
async def get_latest_rss(
    feeds: Optional[List[str]] = None,
    days: int = 1,
    limit: int = 50,
    include_summary: bool = False
) -> str:
    """
    Get latest RSS subscription data (supports multi-day queries)

    RSS data is stored separately from trending news, displayed in chronological order, suitable for getting latest content from specific sources.

    Args:
        feeds: List of RSS source IDs, e.g. ['hacker-news', '36kr'], if not specified returns all sources
        days: Get data from last N days, default 1 (today only), maximum 30 days
        limit: Return count limit, default 50, maximum 500
        include_summary: Whether to include article summaries, default False (saves tokens)

    Returns:
        JSON-formatted RSS item list

    Examples:
        - get_latest_rss()
        - get_latest_rss(days=7, feeds=['hacker-news'])
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['data'].get_latest_rss,
        feeds=feeds, days=days, limit=limit, include_summary=include_summary
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def search_rss(
    keyword: str,
    feeds: Optional[List[str]] = None,
    days: int = 7,
    limit: int = 50,
    include_summary: bool = False
) -> str:
    """
    Search RSS data

    Search articles containing specified keywords in RSS subscription data.

    Args:
        keyword: Search keyword (required)
        feeds: List of RSS source IDs, e.g. ['hacker-news', '36kr']
               - If not specified: search all RSS sources
        days: Search last N days of data, default 7 days, maximum 30 days
        limit: Return count limit, default 50
        include_summary: Whether to include article summaries, default False

    Returns:
        JSON-formatted matching RSS item list

    Examples:
        - search_rss(keyword="AI")
        - search_rss(keyword="machine learning", feeds=['hacker-news'], days=14)
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['data'].search_rss,
        keyword=keyword,
        feeds=feeds,
        days=days,
        limit=limit,
        include_summary=include_summary
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def get_rss_feeds_status() -> str:
    """
    Get RSS source status information

    View currently configured RSS sources and their data statistics.

    Returns:
        JSON-formatted RSS source status, including:
        - available_dates: List of dates with RSS data
        - total_dates: Total number of dates
        - today_feeds: Data statistics for each RSS source today
            - {feed_id}: { name, item_count }
        - generated_at: Generation time

    Examples:
        - get_rss_feeds_status()  # View all RSS source status
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['data'].get_rss_feeds_status)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def get_news_by_date(
    date_range: Optional[Union[Dict[str, str], str]] = None,
    platforms: Optional[List[str]] = None,
    limit: int = 50,
    include_url: bool = False
) -> str:
    """
    Get news data for specified date range, for historical data analysis and comparison

    Args:
        date_range: Date range, supports multiple formats:
            - Range object: {"start": "2025-01-01", "end": "2025-01-07"}
            - Natural language: "today", "yesterday", "this week", "last 7 days"
            - Single day string: "2025-01-15"
            - Default: "today"
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        limit: Return count limit, default 50, maximum 1000
        include_url: Whether to include URL links, default False (saves tokens)

    Returns:
        JSON-formatted news list, including title, platform, ranking and other information
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['data'].get_news_by_date,
        date_range=date_range,
        platforms=platforms,
        limit=limit,
        include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)



# ==================== Advanced Data Analysis Tools ====================

@mcp.tool
async def analyze_topic_trend(
    topic: str,
    analysis_type: str = "trend",
    date_range: Optional[Union[Dict[str, str], str]] = None,
    granularity: str = "day",
    spike_threshold: float = 3.0,
    time_window: int = 24,
    lookahead_hours: int = 6,
    confidence_threshold: float = 0.7
) -> str:
    """
    Unified topic trend analysis tool - integrates multiple trend analysis modes

    Recommendation: When using natural language dates, call resolve_date_range first to get precise date range.

    Args:
        topic: Topic keyword (required)
        analysis_type: Analysis type
            - "trend": Heat trend analysis (default)
            - "lifecycle": Lifecycle analysis
            - "viral": Abnormal heat detection
            - "predict": Topic prediction
        date_range: Date range, format {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}, default last 7 days
        granularity: Time granularity, default "day"
        spike_threshold: Heat surge multiple threshold (viral mode), default 3.0
        time_window: Detection time window hours (viral mode), default 24
        lookahead_hours: Predict future hours (predict mode), default 6
        confidence_threshold: Confidence threshold (predict mode), default 0.7

    Returns:
        JSON-formatted trend analysis results

    Examples:
        - analyze_topic_trend(topic="AI", date_range={"start": "2025-01-01", "end": "2025-01-07"})
        - analyze_topic_trend(topic="Tesla", analysis_type="lifecycle")
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].analyze_topic_trend_unified,
        topic=topic,
        analysis_type=analysis_type,
        date_range=date_range,
        granularity=granularity,
        threshold=spike_threshold,
        time_window=time_window,
        lookahead_hours=lookahead_hours,
        confidence_threshold=confidence_threshold
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def analyze_data_insights(
    insight_type: str = "platform_compare",
    topic: Optional[str] = None,
    date_range: Optional[Union[Dict[str, str], str]] = None,
    min_frequency: int = 3,
    top_n: int = 20
) -> str:
    """
    Unified data insights analysis tool - integrates multiple data analysis modes

    Args:
        insight_type: Insight type, options:
            - "platform_compare": Platform comparison analysis (compare platform attention to topics)
            - "platform_activity": Platform activity statistics (count platform publishing frequency and active times)
            - "keyword_cooccur": Keyword co-occurrence analysis (analyze keyword co-occurrence patterns)
        topic: Topic keyword (optional, applies to platform_compare mode)
        date_range: **[Object Type]** Date range (optional)
                    - **Format**: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
                    - **Example**: {"start": "2025-01-01", "end": "2025-01-07"}
                    - **Important**: Must be object format, cannot pass integer
        min_frequency: Minimum co-occurrence frequency (keyword_cooccur mode), default 3
        top_n: Return TOP N results (keyword_cooccur mode), default 20

    Returns:
        JSON-formatted data insights analysis results

    Examples:
        - analyze_data_insights(insight_type="platform_compare", topic="AI")
        - analyze_data_insights(insight_type="platform_activity", date_range={"start": "2025-01-01", "end": "2025-01-07"})
        - analyze_data_insights(insight_type="keyword_cooccur", min_frequency=5, top_n=15)
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].analyze_data_insights_unified,
        insight_type=insight_type,
        topic=topic,
        date_range=date_range,
        min_frequency=min_frequency,
        top_n=top_n
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def analyze_sentiment(
    topic: Optional[str] = None,
    platforms: Optional[List[str]] = None,
    date_range: Optional[Union[Dict[str, str], str]] = None,
    limit: int = 50,
    sort_by_weight: bool = True,
    include_url: bool = False
) -> str:
    """
    Analyze news sentiment and heat trends

    Recommendation: When using natural language dates, call resolve_date_range first to get precise date range.

    Args:
        topic: Topic keyword (optional)
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        date_range: Date range, format {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}, default today
        limit: News count to return, default 50, maximum 100 (will deduplicate titles)
        sort_by_weight: Whether to sort by heat weight, default True
        include_url: Whether to include URL links, default False (saves tokens)

    Returns:
        JSON-formatted analysis results, including sentiment distribution, heat trends and related news

    Examples:
        - analyze_sentiment(topic="AI", date_range={"start": "2025-01-01", "end": "2025-01-07"})
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].analyze_sentiment,
        topic=topic,
        platforms=platforms,
        date_range=date_range,
        limit=limit,
        sort_by_weight=sort_by_weight,
        include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def find_related_news(
    reference_title: str,
    date_range: Optional[Union[Dict[str, str], str]] = None,
    threshold: float = 0.5,
    limit: int = 50,
    include_url: bool = False
) -> str:
    """
    Find other news related to specified news title (supports current and historical data)

    Args:
        reference_title: Reference news title (full or partial)
        date_range: Date range (optional)
            - Not specified: only query today's data
            - "today", "yesterday", "last_week", "last_month": preset values
            - {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}: custom range
        threshold: Similarity threshold, between 0-1, default 0.5 (higher is stricter matching)
        limit: Return count limit, default 50
        include_url: Whether to include URL links, default False (saves tokens)

    Returns:
        JSON-formatted related news list, sorted by similarity

    Examples:
        - find_related_news(reference_title="Tesla price cut")
        - find_related_news(reference_title="AI breakthrough", date_range="last_week")
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['search'].find_related_news_unified,
        reference_title=reference_title,
        date_range=date_range,
        threshold=threshold,
        limit=limit,
        include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def generate_summary_report(
    report_type: str = "daily",
    date_range: Optional[Union[Dict[str, str], str]] = None
) -> str:
    """
    Daily/weekly summary generator - automatically generate trending summary reports

    Args:
        report_type: Report type (daily/weekly)
        date_range: **[Object Type]** Custom date range (optional)
                    - **Format**: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
                    - **Example**: {"start": "2025-01-01", "end": "2025-01-07"}
                    - **Important**: Must be object format, cannot pass integer

    Returns:
        JSON-formatted summary report, including Markdown format content
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].generate_summary_report,
        report_type=report_type,
        date_range=date_range
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def aggregate_news(
    date_range: Optional[Union[Dict[str, str], str]] = None,
    platforms: Optional[List[str]] = None,
    similarity_threshold: float = 0.7,
    limit: int = 50,
    include_url: bool = False
) -> str:
    """
    Cross-platform news aggregation - deduplicate and merge similar news

    Merge the same event reported by different platforms into one aggregated news item, showing cross-platform coverage and combined heat.

    Args:
        date_range: Date range, if not specified queries today
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        similarity_threshold: Similarity threshold, 0.3-1.0, default 0.7 (higher is stricter)
        limit: Return aggregated news count, default 50
        include_url: Whether to include URL links, default False

    Returns:
        JSON-formatted aggregation results, including deduplication statistics, aggregated news list and platform coverage statistics

    Examples:
        - aggregate_news()
        - aggregate_news(similarity_threshold=0.8)
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].aggregate_news,
        date_range=date_range,
        platforms=platforms,
        similarity_threshold=similarity_threshold,
        limit=limit,
        include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def compare_periods(
    period1: Union[Dict[str, str], str],
    period2: Union[Dict[str, str], str],
    topic: Optional[str] = None,
    compare_type: str = "overview",
    platforms: Optional[List[str]] = None,
    top_n: int = 10
) -> str:
    """
    Period comparison analysis - compare news data from two time periods

    Compare trending topics, platform activity, news volume and other dimensions across different time periods.

    **Use Cases:**
    - Compare this week vs last week's trending changes
    - Analyze topic heat difference across two periods
    - View periodic changes in platform activity

    Args:
        period1: First time period (baseline)
            - {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}: date range
            - "today", "yesterday", "this_week", "last_week", "this_month", "last_month": preset values
        period2: Second time period (comparison, same format as period1)
        topic: Optional topic keyword (focus comparison on specific topic)
        compare_type: Comparison type
            - "overview": General overview (default) - news count, keyword changes, TOP news
            - "topic_shift": Topic shift analysis - rising topics, declining topics, new topics
            - "platform_activity": Platform activity comparison - platform news count changes
        platforms: Platform filter list, e.g. ['zhihu', 'weibo']
        top_n: Return TOP N results, default 10

    Returns:
        JSON-formatted comparison analysis results, including:
        - periods: Date ranges for both periods
        - compare_type: Comparison type
        - overview/topic_shift/platform_comparison: Specific comparison results (based on type)

    Examples:
        - compare_periods(period1="last_week", period2="this_week")  # Week-over-week
        - compare_periods(period1="last_month", period2="this_month", compare_type="topic_shift")
        - compare_periods(
            period1={"start": "2025-01-01", "end": "2025-01-07"},
            period2={"start": "2025-01-08", "end": "2025-01-14"},
            topic="AI"
          )
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['analytics'].compare_periods,
        period1=period1,
        period2=period2,
        topic=topic,
        compare_type=compare_type,
        platforms=platforms,
        top_n=top_n
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== Intelligent Search Tools ====================

@mcp.tool
async def search_news(
    query: str,
    search_mode: str = "keyword",
    date_range: Optional[Union[Dict[str, str], str]] = None,
    platforms: Optional[List[str]] = None,
    limit: int = 50,
    sort_by: str = "relevance",
    threshold: float = 0.6,
    include_url: bool = False,
    include_rss: bool = False,
    rss_limit: int = 20
) -> str:
    """
    Unified search interface, supports multiple search modes, can search both trending and RSS simultaneously

    Recommendation: When using natural language dates, call resolve_date_range first to get precise date range.

    Args:
        query: Search keyword or content snippet
        search_mode: Search mode
            - "keyword": Exact keyword matching (default)
            - "fuzzy": Fuzzy content matching
            - "entity": Entity name search (people/places/organizations)
        date_range: Date range, format {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}, default today
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        limit: Trending list return count limit, default 50
        sort_by: Sort method - "relevance" (relevance) / "weight" (weight) / "date" (date)
        threshold: Similarity threshold (fuzzy mode only), 0-1, default 0.6
        include_url: Whether to include URL links, default False
        include_rss: Whether to also search RSS data, default False
        rss_limit: RSS return count limit, default 20

    Returns:
        JSON-formatted search results, including trending news list and optional RSS results

    Examples:
        - search_news(query="AI")
        - search_news(query="AI", include_rss=True)
        - search_news(query="Tesla", date_range={"start": "2025-01-01", "end": "2025-01-07"})
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['search'].search_news_unified,
        query=query,
        search_mode=search_mode,
        date_range=date_range,
        platforms=platforms,
        limit=limit,
        sort_by=sort_by,
        threshold=threshold,
        include_url=include_url,
        include_rss=include_rss,
        rss_limit=rss_limit
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== Configuration & System Management Tools ====================

@mcp.tool
async def get_current_config(
    section: str = "all"
) -> str:
    """
    Get current system configuration

    Args:
        section: Configuration section, options:
            - "all": All configuration (default)
            - "crawler": Crawler configuration
            - "push": Push configuration
            - "keywords": Keywords configuration
            - "weights": Weights configuration

    Returns:
        JSON-formatted configuration information
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['config'].get_current_config, section=section)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def get_system_status() -> str:
    """
    Get system runtime status and health check information

    Returns system version, data statistics, cache status and other information

    Returns:
        JSON-formatted system status information
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['system'].get_system_status)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def check_version(
    proxy_url: Optional[str] = None
) -> str:
    """
    Check for version updates (checks both TrendRadar and MCP Server)

    Compare local version with GitHub remote version to determine if updates are needed.

    Args:
        proxy_url: Optional proxy URL for accessing GitHub (e.g. http://127.0.0.1:7890)

    Returns:
        JSON-formatted version check results, including version comparison and update recommendations for both components

    Examples:
        - check_version()
        - check_version(proxy_url="http://127.0.0.1:7890")
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['system'].check_version, proxy_url=proxy_url)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def trigger_crawl(
    platforms: Optional[List[str]] = None,
    save_to_local: bool = False,
    include_url: bool = False
) -> str:
    """
    Manually trigger a crawling task (optional persistence)

    Args:
        platforms: List of platform IDs, e.g. ['zhihu', 'weibo'], if not specified uses all platforms
        save_to_local: Whether to save to local output directory, default False
        include_url: Whether to include URL links, default False (saves tokens)

    Returns:
        JSON-formatted task status information, including success/failure platform lists and news data

    Examples:
        - trigger_crawl(platforms=['zhihu'])
        - trigger_crawl(save_to_local=True)
    """
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['system'].trigger_crawl,
        platforms=platforms, save_to_local=save_to_local, include_url=include_url
    )
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== Storage Sync Tools ====================

@mcp.tool
async def sync_from_remote(
    days: int = 7
) -> str:
    """
    Pull data from remote storage to local

    For MCP Server scenarios: crawler saves to remote cloud storage (like Cloudflare R2),
    MCP Server pulls to local for analysis and queries.

    Args:
        days: Pull data from last N days, default 7 days
              - 0: Don't pull
              - 7: Pull data from the last week
              - 30: Pull data from the last month

    Returns:
        JSON-formatted sync results, including:
        - success: Whether successful
        - synced_files: Number of successfully synced files
        - synced_dates: List of successfully synced dates
        - skipped_dates: Skipped dates (already exist locally)
        - failed_dates: Failed dates and error messages
        - message: Operation result description

    Examples:
        - sync_from_remote()  # Pull last 7 days
        - sync_from_remote(days=30)  # Pull last 30 days

    Note:
        Requires remote storage configuration in config/config.yaml (storage.remote) or environment variables:
        - S3_ENDPOINT_URL: Service endpoint
        - S3_BUCKET_NAME: Bucket name
        - S3_ACCESS_KEY_ID: Access key ID
        - S3_SECRET_ACCESS_KEY: Access secret key
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['storage'].sync_from_remote, days=days)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def get_storage_status() -> str:
    """
    Get storage configuration and status

    View current storage backend configuration, local and remote storage status information.

    Returns:
        JSON-formatted storage status information, including local/remote storage status and pull configuration
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['storage'].get_storage_status)
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool
async def list_available_dates(
    source: str = "both"
) -> str:
    """
    List available date ranges in local/remote storage

    View which dates have available data in local and remote storage.

    Args:
        source: Data source
            - "local": Local only
            - "remote": Remote only
            - "both": List and compare both (default)

    Returns:
        JSON-formatted date list, including date information and comparison results from each source

    Examples:
        - list_available_dates()
        - list_available_dates(source="local")
    """
    tools = _get_tools()
    result = await asyncio.to_thread(tools['storage'].list_available_dates, source=source)
    return json.dumps(result, ensure_ascii=False, indent=2)


# ==================== Startup Entry ====================

def run_server(
    project_root: Optional[str] = None,
    transport: str = 'stdio',
    host: str = '0.0.0.0',
    port: int = 3333
):
    """
    Start MCP server

    Args:
        project_root: Project root directory path
        transport: Transport mode, 'stdio' or 'http'
        host: HTTP mode listening address, default 0.0.0.0
        port: HTTP mode listening port, default 3333
    """
    # 初始化工具实例
    _get_tools(project_root)

    # 打印启动信息
    print()
    print("=" * 60)
    print("  TrendRadar MCP Server - FastMCP 2.0")
    print("=" * 60)
    print(f"  Transport mode: {transport.upper()}")

    if transport == 'stdio':
        print("  Protocol: MCP over stdio (standard input/output)")
        print("  Description: Communicate with MCP client via standard input/output")
    elif transport == 'http':
        print(f"  Protocol: MCP over HTTP (production environment)")
        print(f"  Server listening: {host}:{port}")

    if project_root:
        print(f"  Project directory: {project_root}")
    else:
        print("  Project directory: Current directory")

    print()
    print("  Registered tools:")
    print("    === Date Parsing Tool (Recommended Priority) ===")
    print("    0. resolve_date_range       - Parse natural language dates to standard format")
    print()
    print("    === Basic Data Query (P0 Core) ===")
    print("    1. get_latest_news        - Get latest news")
    print("    2. get_news_by_date       - Query news by date (supports natural language)")
    print("    3. get_trending_topics    - Get trending topics (supports auto extraction)")
    print()
    print("    === RSS Data Query ===")
    print("    4. get_latest_rss         - Get latest RSS subscription data")
    print("    5. search_rss             - Search RSS data")
    print("    6. get_rss_feeds_status   - Get RSS source status")
    print()
    print("    === Intelligent Search Tools ===")
    print("    7. search_news            - Unified news search (keyword/fuzzy/entity)")
    print("    8. find_related_news      - Find related news (supports historical data)")
    print()
    print("    === Advanced Data Analysis ===")
    print("    9. analyze_topic_trend      - Unified topic trend analysis (heat/lifecycle/viral/prediction)")
    print("    10. analyze_data_insights   - Unified data insights analysis (platform comparison/activity/keyword co-occurrence)")
    print("    11. analyze_sentiment       - Sentiment analysis")
    print("    12. aggregate_news          - Cross-platform news aggregation and deduplication")
    print("    13. compare_periods         - Period comparison analysis (week-over-week/month-over-month)")
    print("    14. generate_summary_report - Daily/weekly summary generation")
    print()
    print("    === Configuration & System Management ===")
    print("    15. get_current_config      - Get current system configuration")
    print("    16. get_system_status       - Get system runtime status")
    print("    17. check_version           - Check for version updates (compare local vs remote version)")
    print("    18. trigger_crawl           - Manually trigger crawling task")
    print()
    print("    === Storage Sync Tools ===")
    print("    19. sync_from_remote        - Pull data from remote storage to local")
    print("    20. get_storage_status      - Get storage configuration and status")
    print("    21. list_available_dates    - List available dates in local/remote storage")
    print("=" * 60)
    print()

    # Run server based on transport mode
    if transport == 'stdio':
        mcp.run(transport='stdio')
    elif transport == 'http':
        # HTTP mode (production recommended)
        mcp.run(
            transport='http',
            host=host,
            port=port,
            path='/mcp'  # HTTP endpoint path
        )
    else:
        raise ValueError(f"Unsupported transport mode: {transport}")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='TrendRadar MCP Server - News Aggregation MCP Tool Server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
For detailed configuration tutorial, see: README-Cherry-Studio.md
        """
    )
    parser.add_argument(
        '--transport',
        choices=['stdio', 'http'],
        default='stdio',
        help='Transport mode: stdio (default) or http (production)'
    )
    parser.add_argument(
        '--host',
        default='0.0.0.0',
        help='HTTP mode listening address, default 0.0.0.0'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=3333,
        help='HTTP mode listening port, default 3333'
    )
    parser.add_argument(
        '--project-root',
        help='Project root directory path'
    )

    args = parser.parse_args()

    run_server(
        project_root=args.project_root,
        transport=args.transport,
        host=args.host,
        port=args.port
    )
