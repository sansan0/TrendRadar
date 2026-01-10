"""
智能新闻检索工具

提供模糊搜索、链接查询、历史相关新闻检索等高级搜索功能。
"""

import re
from collections import Counter
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple, Union

from ..services.data_service import DataService
from ..utils.validators import validate_keyword, validate_limit, validate_threshold, normalize_date_range
from ..utils.errors import MCPError, InvalidParameterError, DataNotFoundError


class SearchTools:
    """智能新闻检索工具类"""

    def __init__(self, project_root: str = None):
        """
        初始化智能检索工具

        Args:
            project_root: 项目根目录
        """
        self.data_service = DataService(project_root)

    def search_news_unified(
        self,
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
    ) -> Dict:
        """
        统一新闻搜索工具 - 整合多种搜索模式，支持同时搜索热榜和RSS

        Args:
            query: 查询内容（必需）- 关键词、内容片段或实体名称
            search_mode: 搜索模式，可选值：
                - "keyword": 精确关键词匹配（默认）
                - "fuzzy": 模糊内容匹配（使用相似度算法）
                - "entity": 实体名称搜索（自动按权重排序）
            date_range: 日期范围（可选）
                       - **格式**: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
                       - **示例**: {"start": "2025-01-01", "end": "2025-01-07"}
                       - **默认**: 不指定时默认查询今天
                       - **注意**: start和end可以相同（表示单日查询）
            platforms: 平台过滤列表，如 ['zhihu', 'weibo']
            limit: 热榜返回条数限制，默认50
            sort_by: 排序方式，可选值：
                - "relevance": 按相关度排序（默认）
                - "weight": 按新闻权重排序
                - "date": 按日期排序
            threshold: 相似度阈值（仅fuzzy模式有效），0-1之间，默认0.6
            include_url: 是否包含URL链接，默认False（节省token）
            include_rss: 是否同时搜索RSS数据，默认False
            rss_limit: RSS返回条数限制，默认20

        Returns:
            搜索结果字典，包含匹配的新闻列表（热榜和RSS分开展示）

        Examples:
            - search_news_unified(query="人工智能", search_mode="keyword")
            - search_news_unified(query="特斯拉降价", search_mode="fuzzy", threshold=0.4)
            - search_news_unified(query="马斯克", search_mode="entity", limit=20)
            - search_news_unified(query="AI", include_rss=True)  # 同时搜索热榜和RSS
            - search_news_unified(query="iPhone 16", date_range={"start": "2025-01-01", "end": "2025-01-07"})
        """
        try:
            # 参数验证
            query = validate_keyword(query)

            if search_mode not in ["keyword", "fuzzy", "entity"]:
                raise InvalidParameterError(
                    f"无效的搜索模式: {search_mode}",
                    suggestion="支持的模式: keyword, fuzzy, entity"
                )

            if sort_by not in ["relevance", "weight", "date"]:
                raise InvalidParameterError(
                    f"无效的排序方式: {sort_by}",
                    suggestion="支持的排序: relevance, weight, date"
                )

            limit = validate_limit(limit, default=50)
            threshold = validate_threshold(threshold, default=0.6, min_value=0.0, max_value=1.0)

            # 处理日期范围
            if date_range:
                from ..utils.validators import validate_date_range
                date_range_tuple = validate_date_range(date_range)
                start_date, end_date = date_range_tuple
            else:
                # 不指定日期时，使用最新可用数据日期（而非 datetime.now()）
                earliest, latest = self.data_service.get_available_date_range()

                if latest is None:
                    # 没有任何可用数据
                    return {
                        "success": False,
                        "error": {
                            "code": "NO_DATA_AVAILABLE",
                            "message": "output 目录下没有可用的新闻数据",
                            "suggestion": "请先运行爬虫生成数据，或检查 output 目录"
                        }
                    }

                # 使用最新可用日期
                start_date = end_date = latest

            # 收集所有匹配的新闻
            all_matches = []
            current_date = start_date

            while current_date <= end_date:
                try:
                    all_titles, id_to_name, timestamps = self.data_service.parser.read_all_titles_for_date(
                        date=current_date,
                        platform_ids=platforms
                    )

                    # 根据搜索模式执行不同的搜索逻辑
                    if search_mode == "keyword":
                        matches = self._search_by_keyword_mode(
                            query, all_titles, id_to_name, current_date, include_url
                        )
                    elif search_mode == "fuzzy":
                        matches = self._search_by_fuzzy_mode(
                            query, all_titles, id_to_name, current_date, threshold, include_url
                        )
                    else:  # entity
                        matches = self._search_by_entity_mode(
                            query, all_titles, id_to_name, current_date, include_url
                        )

                    all_matches.extend(matches)

                except DataNotFoundError:
                    # 该日期没有数据，继续下一天
                    pass

                current_date += timedelta(days=1)

            if not all_matches:
                # 获取可用日期范围用于错误提示
                earliest, latest = self.data_service.get_available_date_range()

                # 判断时间范围描述
                if start_date.date() == datetime.now().date() and start_date == end_date:
                    time_desc = "今天"
                elif start_date == end_date:
                    time_desc = start_date.strftime("%Y-%m-%d")
                else:
                    time_desc = f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}"

                # 构建错误消息
                if earliest and latest:
                    available_desc = f"{earliest.strftime('%Y-%m-%d')} 至 {latest.strftime('%Y-%m-%d')}"
                    message = f"未找到匹配的新闻（查询范围: {time_desc}，可用数据: {available_desc}）"
                else:
                    message = f"未找到匹配的新闻（{time_desc}）"

                result = {
                    "success": True,
                    "results": [],
                    "total": 0,
                    "query": query,
                    "search_mode": search_mode,
                    "time_range": time_desc,
                    "message": message
                }
                return result

            # 统一排序逻辑
            if sort_by == "relevance":
                all_matches.sort(key=lambda x: x.get("similarity_score", 1.0), reverse=True)
            elif sort_by == "weight":
                from .analytics import calculate_news_weight
                all_matches.sort(key=lambda x: calculate_news_weight(x), reverse=True)
            elif sort_by == "date":
                all_matches.sort(key=lambda x: x.get("date", ""), reverse=True)

            # 限制返回数量
            results = all_matches[:limit]

            # 构建时间范围描述（正确判断是否为今天）
            if start_date.date() == datetime.now().date() and start_date == end_date:
                time_range_desc = "今天"
            elif start_date == end_date:
                time_range_desc = start_date.strftime("%Y-%m-%d")
            else:
                time_range_desc = f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}"

            result = {
                "success": True,
                "summary": {
                    "description": f"新闻搜索结果（{search_mode}模式）",
                    "total_found": len(all_matches),
                    "returned": len(results),
                    "requested_limit": limit,
                    "search_mode": search_mode,
                    "query": query,
                    "platforms": platforms or "所有平台",
                    "time_range": time_range_desc,
                    "sort_by": sort_by
                },
                "data": results
            }

            if search_mode == "fuzzy":
                result["summary"]["threshold"] = threshold
                if len(all_matches) < limit:
                    result["note"] = f"模糊搜索模式下，相似度阈值 {threshold} 仅匹配到 {len(all_matches)} 条结果"

            # 如果启用 RSS 搜索，同时搜索 RSS 数据
            if include_rss:
                rss_results = self._search_rss_by_keyword(
                    query=query,
                    start_date=start_date,
                    end_date=end_date,
                    limit=rss_limit,
                    include_url=include_url
                )
                result["rss"] = rss_results["items"]
                result["rss_total"] = rss_results["total"]
                result["summary"]["include_rss"] = True
                result["summary"]["rss_found"] = rss_results["total"]
                result["summary"]["rss_returned"] = len(rss_results["items"])

            return result

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

    def _search_by_keyword_mode(
        self,
        query: str,
        all_titles: Dict,
        id_to_name: Dict,
        current_date: datetime,
        include_url: bool
    ) -> List[Dict]:
        """
        关键词搜索模式（精确匹配）

        Args:
            query: 搜索关键词
            all_titles: 所有标题字典
            id_to_name: 平台ID到名称映射
            current_date: 当前日期

        Returns:
            匹配的新闻列表
        """
        matches = []
        query_lower = query.lower()

        for platform_id, titles in all_titles.items():
            platform_name = id_to_name.get(platform_id, platform_id)

            for title, info in titles.items():
                # 精确包含判断
                if query_lower in title.lower():
                    news_item = {
                        "title": title,
                        "platform": platform_id,
                        "platform_name": platform_name,
                        "date": current_date.strftime("%Y-%m-%d"),
                        "similarity_score": 1.0,  # 精确匹配，相似度为1
                        "ranks": info.get("ranks", []),
                        "count": len(info.get("ranks", [])),
                        "rank": info["ranks"][0] if info["ranks"] else 999
                    }

                    # 条件性添加 URL 字段
                    if include_url:
                        news_item["url"] = info.get("url", "")
                        news_item["mobileUrl"] = info.get("mobileUrl", "")

                    matches.append(news_item)

        return matches

    def _search_by_fuzzy_mode(
        self,
        query: str,
        all_titles: Dict,
        id_to_name: Dict,
        current_date: datetime,
        threshold: float,
        include_url: bool
    ) -> List[Dict]:
        """
        模糊搜索模式（使用相似度算法）

        Args:
            query: 搜索内容
            all_titles: 所有标题字典
            id_to_name: 平台ID到名称映射
            current_date: 当前日期
            threshold: 相似度阈值

        Returns:
            匹配的新闻列表
        """
        matches = []

        for platform_id, titles in all_titles.items():
            platform_name = id_to_name.get(platform_id, platform_id)

            for title, info in titles.items():
                # 模糊匹配
                is_match, similarity = self._fuzzy_match(query, title, threshold)

                if is_match:
                    news_item = {
                        "title": title,
                        "platform": platform_id,
                        "platform_name": platform_name,
                        "date": current_date.strftime("%Y-%m-%d"),
                        "similarity_score": round(similarity, 4),
                        "ranks": info.get("ranks", []),
                        "count": len(info.get("ranks", [])),
                        "rank": info["ranks"][0] if info["ranks"] else 999
                    }

                    # 条件性添加 URL 字段
                    if include_url:
                        news_item["url"] = info.get("url", "")
                        news_item["mobileUrl"] = info.get("mobileUrl", "")

                    matches.append(news_item)

        return matches

    def _search_by_entity_mode(
        self,
        query: str,
        all_titles: Dict,
        id_to_name: Dict,
        current_date: datetime,
        include_url: bool
    ) -> List[Dict]:
        """
        实体搜索模式（自动按权重排序）

        Args:
            query: 实体名称
            all_titles: 所有标题字典
            id_to_name: 平台ID到名称映射
            current_date: 当前日期

        Returns:
            匹配的新闻列表
        """
        matches = []

        for platform_id, titles in all_titles.items():
            platform_name = id_to_name.get(platform_id, platform_id)

            for title, info in titles.items():
                # 实体搜索：精确包含实体名称
                if query in title:
                    news_item = {
                        "title": title,
                        "platform": platform_id,
                        "platform_name": platform_name,
                        "date": current_date.strftime("%Y-%m-%d"),
                        "similarity_score": 1.0,
                        "ranks": info.get("ranks", []),
                        "count": len(info.get("ranks", [])),
                        "rank": info["ranks"][0] if info["ranks"] else 999
                    }

                    # 条件性添加 URL 字段
                    if include_url:
                        news_item["url"] = info.get("url", "")
                        news_item["mobileUrl"] = info.get("mobileUrl", "")

                    matches.append(news_item)

        return matches

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本的相似度

        Args:
            text1: 文本1
            text2: 文本2

        Returns:
            相似度分数 (0-1之间)
        """
        # 使用 difflib.SequenceMatcher 计算序列相似度
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    def _fuzzy_match(self, query: str, text: str, threshold: float = 0.3) -> Tuple[bool, float]:
        """
        模糊匹配函数

        Args:
            query: 查询文本
            text: 待匹配文本
            threshold: 匹配阈值

        Returns:
            (是否匹配, 相似度分数)
        """
        # 直接包含判断
        if query.lower() in text.lower():
            return True, 1.0

        # 计算整体相似度
        similarity = self._calculate_similarity(query, text)
        if similarity >= threshold:
            return True, similarity

        # 分词后的部分匹配
        query_words = set(self._extract_keywords(query))
        text_words = set(self._extract_keywords(text))

        if not query_words or not text_words:
            return False, 0.0

        # 计算关键词重合度
        common_words = query_words & text_words
        keyword_overlap = len(common_words) / len(query_words)

        if keyword_overlap >= 0.5:  # 50%的关键词重合
            return True, keyword_overlap

        return False, similarity

    def _extract_keywords(self, text: str, min_length: int = 2) -> List[str]:
        """
        从文本中提取关键词

        Args:
            text: 输入文本
            min_length: 最小词长

        Returns:
            关键词列表
        """
        # 移除URL和特殊字符
        text = re.sub(r'http[s]?://\S+', '', text)
        text = re.sub(r'\[.*?\]', '', text)  # 移除方括号内容

        # 使用正则表达式分词（中文和英文）
        words = re.findall(r'[\w]+', text)

        # 过滤短词
        keywords = [word for word in words if word and len(word) >= min_length]

        return keywords

    def _calculate_keyword_overlap(self, keywords1: List[str], keywords2: List[str]) -> float:
        """
        计算两个关键词列表的重合度

        Args:
            keywords1: 关键词列表1
            keywords2: 关键词列表2

        Returns:
            重合度分数 (0-1之间)
        """
        if not keywords1 or not keywords2:
            return 0.0

        set1 = set(keywords1)
        set2 = set(keywords2)

        # Jaccard 相似度
        intersection = len(set1 & set2)
        union = len(set1 | set2)

        if union == 0:
            return 0.0

        return intersection / union

    def _jaccard_similarity(self, list1: List[str], list2: List[str]) -> float:
        """
        计算两个列表的 Jaccard 相似度

        Args:
            list1: 列表1
            list2: 列表2

        Returns:
            Jaccard 相似度 (0-1之间)
        """
        if not list1 or not list2:
            return 0.0

        set1 = set(list1)
        set2 = set(list2)

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        if union == 0:
            return 0.0

        return intersection / union

    def search_related_news_history(
        self,
        reference_title: str,
        time_preset: str = "yesterday",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        threshold: float = 0.4,
        limit: int = 50,
        include_url: bool = False
    ) -> Dict:
        """
        在历史数据中搜索与给定新闻相关的新闻

        Args:
            reference_title: 参考新闻标题或内容
            time_preset: 时间范围预设值，可选：
                - "yesterday": 昨天
                - "last_week": 上周 (7天)
                - "last_month": 上个月 (30天)
                - "custom": 自定义日期范围（需要提供 start_date 和 end_date）
            start_date: 自定义开始日期（仅当 time_preset="custom" 时有效）
            end_date: 自定义结束日期（仅当 time_preset="custom" 时有效）
            threshold: 相似度阈值 (0-1之间)，默认0.4
            limit: 返回条数限制，默认50
            include_url: 是否包含URL链接，默认False（节省token）

        Returns:
            搜索结果字典，包含相关新闻列表

        Example:
            >>> tools = SearchTools()
            >>> result = tools.search_related_news_history(
            ...     reference_title="人工智能技术突破",
            ...     time_preset="last_week",
            ...     threshold=0.4,
            ...     limit=50
            ... )
            >>> for news in result['results']:
            ...     print(f"{news['date']}: {news['title']} (相似度: {news['similarity_score']})")
        """
        try:
            # 参数验证
            reference_title = validate_keyword(reference_title)
            threshold = validate_threshold(threshold, default=0.4, min_value=0.0, max_value=1.0)
            limit = validate_limit(limit, default=50)

            # 确定查询日期范围
            today = datetime.now()

            if time_preset == "yesterday":
                search_start = today - timedelta(days=1)
                search_end = today - timedelta(days=1)
            elif time_preset == "last_week":
                search_start = today - timedelta(days=7)
                search_end = today - timedelta(days=1)
            elif time_preset == "last_month":
                search_start = today - timedelta(days=30)
                search_end = today - timedelta(days=1)
            elif time_preset == "custom":
                if not start_date or not end_date:
                    raise InvalidParameterError(
                        "自定义时间范围需要提供 start_date 和 end_date",
                        suggestion="请提供 start_date 和 end_date 参数"
                    )
                search_start = start_date
                search_end = end_date
            else:
                raise InvalidParameterError(
                    f"不支持的时间范围: {time_preset}",
                    suggestion="请使用 'yesterday', 'last_week', 'last_month' 或 'custom'"
                )

            # 提取参考文本的关键词
            reference_keywords = self._extract_keywords(reference_title)

            if not reference_keywords:
                raise InvalidParameterError(
                    "无法从参考文本中提取关键词",
                    suggestion="请提供更详细的文本内容"
                )

            # 收集所有相关新闻
            all_related_news = []
            current_date = search_start

            while current_date <= search_end:
                try:
                    # 读取该日期的数据
                    all_titles, id_to_name, _ = self.data_service.parser.read_all_titles_for_date(current_date)

                    # 搜索相关新闻
                    for platform_id, titles in all_titles.items():
                        platform_name = id_to_name.get(platform_id, platform_id)

                        for title, info in titles.items():
                            # 计算标题相似度
                            title_similarity = self._calculate_similarity(reference_title, title)

                            # 提取标题关键词
                            title_keywords = self._extract_keywords(title)

                            # 计算关键词重合度
                            keyword_overlap = self._calculate_keyword_overlap(
                                reference_keywords,
                                title_keywords
                            )

                            # 综合相似度 (70% 关键词重合 + 30% 文本相似度)
                            combined_score = keyword_overlap * 0.7 + title_similarity * 0.3

                            if combined_score >= threshold:
                                news_item = {
                                    "title": title,
                                    "platform": platform_id,
                                    "platform_name": platform_name,
                                    "date": current_date.strftime("%Y-%m-%d"),
                                    "similarity_score": round(combined_score, 4),
                                    "keyword_overlap": round(keyword_overlap, 4),
                                    "text_similarity": round(title_similarity, 4),
                                    "common_keywords": list(set(reference_keywords) & set(title_keywords)),
                                    "rank": info["ranks"][0] if info["ranks"] else 0
                                }

                                # 条件性添加 URL 字段
                                if include_url:
                                    news_item["url"] = info.get("url", "")
                                    news_item["mobileUrl"] = info.get("mobileUrl", "")

                                all_related_news.append(news_item)

                except DataNotFoundError:
                    # 该日期没有数据，继续下一天
                    pass
                except Exception as e:
                    # 记录错误但继续处理其他日期
                    print(f"Warning: 处理日期 {current_date.strftime('%Y-%m-%d')} 时出错: {e}")

                # 移动到下一天
                current_date += timedelta(days=1)

            if not all_related_news:
                return {
                    "success": True,
                    "results": [],
                    "total": 0,
                    "query": reference_title,
                    "time_preset": time_preset,
                    "date_range": {
                        "start": search_start.strftime("%Y-%m-%d"),
                        "end": search_end.strftime("%Y-%m-%d")
                    },
                    "message": "未找到相关新闻"
                }

            # 按相似度排序
            all_related_news.sort(key=lambda x: x["similarity_score"], reverse=True)

            # 限制返回数量
            results = all_related_news[:limit]

            # 统计信息
            platform_distribution = Counter([news["platform"] for news in all_related_news])
            date_distribution = Counter([news["date"] for news in all_related_news])

            result = {
                "success": True,
                "summary": {
                    "description": "历史相关新闻搜索结果",
                    "total_found": len(all_related_news),
                    "returned": len(results),
                    "requested_limit": limit,
                    "threshold": threshold,
                    "reference_title": reference_title,
                    "reference_keywords": reference_keywords,
                    "time_preset": time_preset,
                    "date_range": {
                        "start": search_start.strftime("%Y-%m-%d"),
                        "end": search_end.strftime("%Y-%m-%d")
                    }
                },
                "data": results,
                "statistics": {
                    "platform_distribution": dict(platform_distribution),
                    "date_distribution": dict(date_distribution),
                    "avg_similarity": round(
                        sum([news["similarity_score"] for news in all_related_news]) / len(all_related_news),
                        4
                    ) if all_related_news else 0.0
                }
            }

            if len(all_related_news) < limit:
                result["note"] = f"相关性阈值 {threshold} 下仅找到 {len(all_related_news)} 条相关新闻"

            return result

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

    def find_related_news_unified(
        self,
        reference_title: str,
        date_range: Optional[Union[Dict[str, str], str]] = None,
        threshold: float = 0.5,
        limit: int = 50,
        include_url: bool = False
    ) -> Dict:
        """
        统一的相关新闻查找工具 - 整合相似新闻和历史相关搜索

        Args:
            reference_title: 参考新闻标题
            date_range: 日期范围（可选）
                - 不指定: 只查询今天的数据
                - {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}: 查询指定日期范围
                - "today": 今天
                - "yesterday": 昨天
                - "last_week": 最近7天
                - "last_month": 最近30天
            threshold: 相似度阈值，0-1之间，默认0.5
            limit: 返回条数限制，默认50
            include_url: 是否包含URL链接，默认False

        Returns:
            相关新闻列表，按相似度排序
        """
        try:
            # 参数验证
            reference_title = validate_keyword(reference_title)
            threshold = validate_threshold(threshold, default=0.5, min_value=0.0, max_value=1.0)
            limit = validate_limit(limit, default=50)

            # 确定日期范围
            today = datetime.now()

            # 规范化 date_range（处理 JSON 字符串序列化问题）
            date_range = normalize_date_range(date_range)

            if date_range is None or date_range == "today":
                # 只查询今天
                search_dates = [today]
            elif isinstance(date_range, str):
                # 预设时间范围
                if date_range == "yesterday":
                    search_dates = [today - timedelta(days=1)]
                elif date_range == "last_week":
                    search_dates = [today - timedelta(days=i) for i in range(7)]
                elif date_range == "last_month":
                    search_dates = [today - timedelta(days=i) for i in range(30)]
                else:
                    # 单日字符串格式
                    try:
                        single_date = datetime.strptime(date_range, "%Y-%m-%d")
                        search_dates = [single_date]
                    except ValueError:
                        search_dates = [today]
            elif isinstance(date_range, dict):
                # 日期范围对象
                start_str = date_range.get("start")
                end_str = date_range.get("end")
                if start_str and end_str:
                    start_date = datetime.strptime(start_str, "%Y-%m-%d")
                    end_date = datetime.strptime(end_str, "%Y-%m-%d")
                    search_dates = []
                    current = start_date
                    while current <= end_date:
                        search_dates.append(current)
                        current += timedelta(days=1)
                else:
                    search_dates = [today]
            else:
                search_dates = [today]

            # 提取参考标题的关键词
            reference_keywords = self._extract_keywords(reference_title)

            # 收集所有相关新闻
            all_related_news = []
            
            for search_date in search_dates:
                try:
                    all_titles, id_to_name, _ = self.data_service.parser.read_all_titles_for_date(search_date)
                    
                    for platform_id, titles in all_titles.items():
                        platform_name = id_to_name.get(platform_id, platform_id)
                        
                        for title, info in titles.items():
                            if title == reference_title:
                                continue
                            
                            # 计算相似度（使用混合算法）
                            text_similarity = self._calculate_similarity(reference_title, title)
                            
                            # 如果有关键词，也计算关键词重合度
                            if reference_keywords:
                                title_keywords = self._extract_keywords(title)
                                keyword_similarity = self._jaccard_similarity(reference_keywords, title_keywords)
                                # 混合相似度：70% 文本 + 30% 关键词
                                similarity = 0.7 * text_similarity + 0.3 * keyword_similarity
                            else:
                                similarity = text_similarity
                            
                            if similarity >= threshold:
                                news_item = {
                                    "title": title,
                                    "platform": platform_id,
                                    "platform_name": platform_name,
                                    "date": search_date.strftime("%Y-%m-%d"),
                                    "similarity": round(similarity, 3),
                                    "rank": info["ranks"][0] if info["ranks"] else 0
                                }
                                
                                if include_url:
                                    news_item["url"] = info.get("url", "")
                                
                                all_related_news.append(news_item)
                                
                except Exception:
                    # 某天数据读取失败，跳过
                    continue

            # 按相似度排序
            all_related_news.sort(key=lambda x: x["similarity"], reverse=True)
            
            # 限制数量
            results = all_related_news[:limit]

            # 统计信息
            from collections import Counter
            platform_dist = Counter([n["platform_name"] for n in all_related_news])
            date_dist = Counter([n["date"] for n in all_related_news])

            return {
                "success": True,
                "summary": {
                    "description": "相关新闻搜索结果",
                    "total_found": len(all_related_news),
                    "returned": len(results),
                    "reference_title": reference_title,
                    "threshold": threshold,
                    "date_range": {
                        "start": min(search_dates).strftime("%Y-%m-%d"),
                        "end": max(search_dates).strftime("%Y-%m-%d")
                    } if search_dates else None
                },
                "data": results,
                "statistics": {
                    "platform_distribution": dict(platform_dist),
                    "date_distribution": dict(date_dist)
                }
            }

        except MCPError as e:
            return {"success": False, "error": e.to_dict()}
        except Exception as e:
            return {"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(e)}}

    def _search_rss_by_keyword(
        self,
        query: str,
        start_date: datetime,
        end_date: datetime,
        limit: int = 20,
        include_url: bool = False
    ) -> Dict:
        """
        在 RSS 数据中搜索关键词

        Args:
            query: 搜索关键词
            start_date: 开始日期
            end_date: 结束日期
            limit: 返回条数限制
            include_url: 是否包含 URL

        Returns:
            RSS 搜索结果字典
        """
        all_rss_matches = []
        query_lower = query.lower()
        current_date = start_date

        while current_date <= end_date:
            try:
                # 读取该日期的 RSS 数据
                all_titles, id_to_name, _ = self.data_service.parser.read_all_titles_for_date(
                    date=current_date,
                    platform_ids=None,
                    db_type="rss"
                )

                for feed_id, items in all_titles.items():
                    feed_name = id_to_name.get(feed_id, feed_id)

                    for title, info in items.items():
                        # 关键词匹配（标题或摘要）
                        title_match = query_lower in title.lower()
                        summary = info.get("summary", "")
                        summary_match = query_lower in summary.lower() if summary else False

                        if title_match or summary_match:
                            rss_item = {
                                "title": title,
                                "feed_id": feed_id,
                                "feed_name": feed_name,
                                "date": current_date.strftime("%Y-%m-%d"),
                                "published_at": info.get("published_at", ""),
                                "author": info.get("author", ""),
                                "match_in": "title" if title_match else "summary"
                            }

                            if include_url:
                                rss_item["url"] = info.get("url", "")

                            all_rss_matches.append(rss_item)

            except DataNotFoundError:
                # 该日期没有 RSS 数据，继续下一天
                pass
            except Exception:
                # 其他错误，跳过
                pass

            current_date += timedelta(days=1)

        # 按发布时间排序（最新的在前）
        all_rss_matches.sort(key=lambda x: x.get("published_at", ""), reverse=True)

        return {
            "items": all_rss_matches[:limit],
            "total": len(all_rss_matches)
        }
