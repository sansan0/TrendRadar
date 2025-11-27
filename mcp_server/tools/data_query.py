"""
数据查询工具

实现P0核心的数据查询工具。
"""

from typing import Dict, List, Optional

from ..services.data_service import DataService
from ..utils.validators import (
    validate_platforms,
    validate_limit,
    validate_keyword,
    validate_date_range,
    validate_top_n,
    validate_mode,
    validate_date_query
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
                "news": news_list,
                "total": len(news_list),
                "platforms": platforms,
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

    def search_news_by_keyword(
        self,
        keyword: str,
        date_range: Optional[Dict] = None,
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
        mode: Optional[str] = None
    ) -> Dict:
        """
        获取个人关注词的新闻出现频率统计

        注意：本工具基于 config/frequency_words.txt 中的个人关注词列表进行统计，
        而不是自动从新闻中提取热点话题。这是一个个人可定制的关注词列表，
        用户可以根据自己的兴趣添加或删除关注词。

        Args:
            top_n: 返回TOP N关注词，默认10
            mode: 模式 - daily(当日累计), current(最新一批), incremental(增量)

        Returns:
            关注词频率统计字典，包含每个关注词在新闻中出现的次数

        Example:
            >>> tools = DataQueryTools()
            >>> result = tools.get_trending_topics(top_n=5, mode="current")
            >>> print(len(result['topics']))
            5
            >>> # 返回的是你在 frequency_words.txt 中设置的关注词的频率统计
        """
        try:
            # 参数验证
            top_n = validate_top_n(top_n, default=10)
            valid_modes = ["daily", "current", "incremental"]
            mode = validate_mode(mode, valid_modes, default="current")

            # 获取趋势话题
            trending_result = self.data_service.get_trending_topics(
                top_n=top_n,
                mode=mode
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
        date_query: Optional[str] = None,
        platforms: Optional[List[str]] = None,
        limit: Optional[int] = None,
        include_url: bool = False
    ) -> Dict:
        """
        按日期查询新闻，支持自然语言日期

        Args:
            date_query: 日期查询字符串（可选，默认"今天"），支持：
                - 相对日期：今天、昨天、前天、3天前、yesterday、3 days ago
                - 星期：上周一、本周三、last monday、this friday
                - 绝对日期：2025-10-10、10月10日、2025年10月10日
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
            ...     date_query="昨天",
            ...     platforms=['zhihu'],
            ...     limit=20
            ... )
            >>> print(result['total'])
            20
        """
        try:
            # 参数验证 - 默认今天
            if date_query is None:
                date_query = "今天"
            target_date = validate_date_query(date_query)
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
                "news": news_list,
                "total": len(news_list),
                "date": target_date.strftime("%Y-%m-%d"),
                "date_query": date_query,
                "platforms": platforms,
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

