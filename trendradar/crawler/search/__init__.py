# coding=utf-8
"""
联网搜索引擎模块

统一导出搜索数据模型、插件接口、任务解析器、智能查询改写器与抓取调度器。
"""

from trendradar.crawler.search.base import (
    BaseSearchProvider,
    FetchedPage,
    SearchProviderError,
    SearchTopicConfig,
)
from trendradar.crawler.search.fetcher import WebSearchFetcher
from trendradar.crawler.search.providers import (
    DeepSeekSearchProvider,
    create_provider,
    create_search_provider_from_config,
    list_providers,
    register_provider,
)
from trendradar.crawler.search.query_parser import (
    load_search_queries,
    parse_search_queries_content,
    resolve_search_queries_path,
)
from trendradar.crawler.search.query_rewriter import SearchQueryRewriter

__all__ = [
    # 核心基类与模型
    "SearchProviderError",
    "SearchTopicConfig",
    "FetchedPage",
    "BaseSearchProvider",
    # 引擎插件与注册中心
    "DeepSeekSearchProvider",
    "register_provider",
    "list_providers",
    "create_provider",
    "create_search_provider_from_config",
    # 搜索任务解析
    "resolve_search_queries_path",
    "parse_search_queries_content",
    "load_search_queries",
    # 智能改写与统一调度
    "SearchQueryRewriter",
    "WebSearchFetcher",
]
