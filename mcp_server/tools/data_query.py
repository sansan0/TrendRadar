"""
数据查询工具

实现P0核心的数据查询工具。
"""

from typing import Dict, List, Optional, Union

from ..services.data_service import DataService
from ..utils.validators import (
    validate_platforms,
    validate_limit,
    validate_keyword,
    validate_date_range,
    validate_top_n,
    validate_mode,
    validate_date_query,
    normalize_date_range
)
from ..utils.errors import MCPError


class DataQueryTools:
    """数据查询工具类"""

    def __init__(self, project_root: str = None):
        """
        初始化数据查询工具

        Args:
            project_root: 项目根目录
        """
        self.data_service = DataService(project_root)

    def get_latest_news(
        self,
        platforms: Optional[List[str]] = None,
        limit: Optional[int] = None,
        include_url: bool = False
    ) -> Dict:
        """
        获取最新一批爬取的新闻数据

        Args:
            platforms: 平台ID列表，如 ['zhihu', 'weibo']
            limit: 返回条数限制，默认20
            include_url: 是否包含URL链接，默认False（节省token）

        Returns:
            新闻列表字典

        Example:
            >>> tools = DataQueryTools()
            >>> result = tools.get_latest_news(platforms=['zhihu'], limit=10)
            >>> print(result['total'])
            10
        """
        try:
            # 参数验证
            platforms = validate_platforms(platforms)
            limit = validate_limit(limit, default=50)

            # 获取数据
            news_list = self.data_service.get_latest_news(
                platforms=platforms,
                limit=limit,
                include_url=include_url
            )

            return {
                "success": True,
                "summary": {
                    "description": "最新一批爬取的新闻数据",
                    "total": len(news_list),
                    "returned": len(news_list),
                    "platforms": platforms or "全部平台"
                },
                "data": news_list
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def search_news_by_keyword(
        self,
        keyword: str,
        date_range: Optional[Union[Dict, str]] = None,
        platforms: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Dict:
        """
        按关键词搜索历史新闻

        Args:
            keyword: 搜索关键词（必需）
            date_range: 日期范围，格式: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
            platforms: 平台过滤列表
            limit: 返回条数限制（可选，默认返回所有）

        Returns:
            搜索结果字典

        Example (假设今天是 2025-11-17):
            >>> tools = DataQueryTools()
            >>> result = tools.search_news_by_keyword(
            ...     keyword="人工智能",
            ...     date_range={"start": "2025-11-08", "end": "2025-11-17"},
            ...     limit=50
            ... )
            >>> print(result['total'])
        """
        try:
            # 参数验证
            keyword = validate_keyword(keyword)
            date_range_tuple = validate_date_range(date_range)
            platforms = validate_platforms(platforms)

            if limit is not None:
                limit = validate_limit(limit, default=100)

            # 搜索数据
            search_result = self.data_service.search_news_by_keyword(
                keyword=keyword,
                date_range=date_range_tuple,
                platforms=platforms,
                limit=limit
            )

            return {
                **search_result,
                "success": True
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def get_trending_topics(
        self,
        top_n: Optional[int] = None,
        mode: Optional[str] = None,
        extract_mode: Optional[str] = None
    ) -> Dict:
        """
        获取热点话题统计

        Args:
            top_n: 返回TOP N话题，默认10
            mode: 时间模式
                - "daily": 当日累计数据统计
                - "current": 最新一批数据统计（默认）
            extract_mode: 提取模式
                - "keywords": 统计预设关注词（基于 config/frequency_words.txt，默认）
                - "auto_extract": 自动从新闻标题提取高频词

        Returns:
            话题频率统计字典

        Example:
            >>> tools = DataQueryTools()
            >>> # 使用预设关注词
            >>> result = tools.get_trending_topics(top_n=5, mode="current")
            >>> # 自动提取高频词
            >>> result = tools.get_trending_topics(top_n=10, extract_mode="auto_extract")
        """
        try:
            # 参数验证
            top_n = validate_top_n(top_n, default=10)
            valid_modes = ["daily", "current"]
            mode = validate_mode(mode, valid_modes, default="current")

            # 验证 extract_mode
            if extract_mode is None:
                extract_mode = "keywords"
            elif extract_mode not in ["keywords", "auto_extract"]:
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_PARAMETER",
                        "message": f"不支持的提取模式: {extract_mode}",
                        "suggestion": "支持的模式: keywords, auto_extract"
                    }
                }

            # 获取趋势话题
            trending_result = self.data_service.get_trending_topics(
                top_n=top_n,
                mode=mode,
                extract_mode=extract_mode
            )

            return {
                **trending_result,
                "success": True
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def get_news_by_date(
        self,
        date_range: Optional[Union[Dict[str, str], str]] = None,
        platforms: Optional[List[str]] = None,
        limit: Optional[int] = None,
        include_url: bool = False
    ) -> Dict:
        """
        按日期查询新闻，支持自然语言日期

        Args:
            date_range: 日期范围（可选，默认"今天"），支持：
                - 范围对象：{"start": "2025-01-01", "end": "2025-01-07"}
                - 相对日期：今天、昨天、前天、3天前
                - 单日字符串：2025-10-10
            platforms: 平台ID列表，如 ['zhihu', 'weibo']
            limit: 返回条数限制，默认50
            include_url: 是否包含URL链接，默认False（节省token）

        Returns:
            新闻列表字典

        Example:
            >>> tools = DataQueryTools()
            >>> # 不指定日期，默认查询今天
            >>> result = tools.get_news_by_date(platforms=['zhihu'], limit=20)
            >>> # 指定日期
            >>> result = tools.get_news_by_date(
            ...     date_range="昨天",
            ...     platforms=['zhihu'],
            ...     limit=20
            ... )
            >>> print(result['total'])
            20
        """
        try:
            # 参数验证 - 默认今天
            if date_range is None:
                date_range = "今天"

            # 规范化 date_range（处理 JSON 字符串序列化问题）
            date_range = normalize_date_range(date_range)

            # 处理 date_range：支持字符串或对象
            if isinstance(date_range, dict):
                # 范围对象，取 start 日期
                date_str = date_range.get('start', '今天')
            else:
                date_str = date_range
            target_date = validate_date_query(date_str)
            platforms = validate_platforms(platforms)
            limit = validate_limit(limit, default=50)

            # 获取数据
            news_list = self.data_service.get_news_by_date(
                target_date=target_date,
                platforms=platforms,
                limit=limit,
                include_url=include_url
            )

            return {
                "success": True,
                "summary": {
                    "description": f"按日期查询的新闻（{target_date.strftime('%Y-%m-%d')}）",
                    "total": len(news_list),
                    "returned": len(news_list),
                    "date": target_date.strftime("%Y-%m-%d"),
                    "date_range": date_range,
                    "platforms": platforms or "全部平台"
                },
                "data": news_list
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    # ========================================
    # RSS 数据查询方法
    # ========================================

    def get_latest_rss(
        self,
        feeds: Optional[List[str]] = None,
        days: int = 1,
        limit: Optional[int] = None,
        include_summary: bool = False
    ) -> Dict:
        """
        获取最新的 RSS 数据（支持多日查询）

        Args:
            feeds: RSS 源 ID 列表，如 ['hacker-news', '36kr']
            days: 获取最近 N 天的数据，默认 1（仅今天），最大 30 天
            limit: 返回条数限制，默认50
            include_summary: 是否包含摘要，默认False（节省token）

        Returns:
            RSS 条目列表字典
        """
        try:
            limit = validate_limit(limit, default=50)

            rss_list = self.data_service.get_latest_rss(
                feeds=feeds,
                days=days,
                limit=limit,
                include_summary=include_summary
            )

            return {
                "success": True,
                "summary": {
                    "description": f"最近 {days} 天的 RSS 订阅数据" if days > 1 else "最新的 RSS 订阅数据",
                    "total": len(rss_list),
                    "returned": len(rss_list),
                    "days": days,
                    "feeds": feeds or "全部订阅源"
                },
                "data": rss_list
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def search_rss(
        self,
        keyword: str,
        feeds: Optional[List[str]] = None,
        days: int = 7,
        limit: Optional[int] = None,
        include_summary: bool = False
    ) -> Dict:
        """
        搜索 RSS 数据

        Args:
            keyword: 搜索关键词
            feeds: RSS 源 ID 列表
            days: 搜索最近 N 天的数据，默认 7 天
            limit: 返回条数限制，默认50
            include_summary: 是否包含摘要

        Returns:
            匹配的 RSS 条目列表
        """
        try:
            keyword = validate_keyword(keyword)
            limit = validate_limit(limit, default=50)

            if days < 1 or days > 30:
                days = 7

            rss_list = self.data_service.search_rss(
                keyword=keyword,
                feeds=feeds,
                days=days,
                limit=limit,
                include_summary=include_summary
            )

            return {
                "success": True,
                "summary": {
                    "description": f"RSS 搜索结果（关键词: {keyword}）",
                    "total": len(rss_list),
                    "returned": len(rss_list),
                    "keyword": keyword,
                    "feeds": feeds or "全部订阅源",
                    "days": days
                },
                "data": rss_list
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def get_rss_feeds_status(self) -> Dict:
        """
        获取 RSS 源状态

        Returns:
            RSS 源状态信息
        """
        try:
            status = self.data_service.get_rss_feeds_status()

            return {
                **status,
                "success": True
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

