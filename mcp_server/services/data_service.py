"""
数据访问服务

提供统一的数据查询接口,封装数据访问逻辑。
"""

import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .cache_service import get_cache
from .parser_service import ParserService
from ..utils.errors import DataNotFoundError


class DataService:
    """数据访问服务类"""

    # 中文停用词列表（用于 auto_extract 模式）
    STOPWORDS = {
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
        '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
        '看', '好', '自己', '这', '那', '来', '被', '与', '为', '对', '将', '从',
        '以', '及', '等', '但', '或', '而', '于', '中', '由', '可', '可以', '已',
        '已经', '还', '更', '最', '再', '因为', '所以', '如果', '虽然', '然而',
        '什么', '怎么', '如何', '哪', '哪些', '多少', '几', '这个', '那个',
        '他', '她', '它', '他们', '她们', '我们', '你们', '大家', '自己',
        '这样', '那样', '怎样', '这么', '那么', '多么', '非常', '特别',
        '应该', '可能', '能够', '需要', '必须', '一定', '肯定', '确实',
        '正在', '已经', '曾经', '将要', '即将', '刚刚', '马上', '立刻',
        '回应', '发布', '表示', '称', '曝', '官方', '最新', '重磅', '突发',
        '热搜', '刷屏', '引发', '关注', '网友', '评论', '转发', '点赞'
    }

    def __init__(self, project_root: str = None):
        """
        初始化数据服务

        Args:
            project_root: 项目根目录
        """
        self.parser = ParserService(project_root)
        self.cache = get_cache()

    def get_latest_news(
        self,
        platforms: Optional[List[str]] = None,
        limit: int = 50,
        include_url: bool = False
    ) -> List[Dict]:
        """
        获取最新一批爬取的新闻数据

        Args:
            platforms: 平台ID列表,None表示所有平台
            limit: 返回条数限制
            include_url: 是否包含URL链接,默认False(节省token)

        Returns:
            新闻列表

        Raises:
            DataNotFoundError: 数据不存在
        """
        # 尝试从缓存获取
        cache_key = f"latest_news:{','.join(platforms or [])}:{limit}:{include_url}"
        cached = self.cache.get(cache_key, ttl=900)  # 15分钟缓存
        if cached:
            return cached

        # 读取今天的数据
        all_titles, id_to_name, timestamps = self.parser.read_all_titles_for_date(
            date=None,
            platform_ids=platforms
        )

        # 获取最新的文件时间
        if timestamps:
            latest_timestamp = max(timestamps.values())
            fetch_time = datetime.fromtimestamp(latest_timestamp)
        else:
            fetch_time = datetime.now()

        # 转换为新闻列表
        news_list = []
        for platform_id, titles in all_titles.items():
            platform_name = id_to_name.get(platform_id, platform_id)

            for title, info in titles.items():
                # 取第一个排名
                rank = info["ranks"][0] if info["ranks"] else 0

                news_item = {
                    "title": title,
                    "platform": platform_id,
                    "platform_name": platform_name,
                    "rank": rank,
                    "timestamp": fetch_time.strftime("%Y-%m-%d %H:%M:%S")
                }

                # 条件性添加 URL 字段
                if include_url:
                    news_item["url"] = info.get("url", "")
                    news_item["mobileUrl"] = info.get("mobileUrl", "")

                news_list.append(news_item)

        # 按排名排序
        news_list.sort(key=lambda x: x["rank"])

        # 限制返回数量
        result = news_list[:limit]

        # 缓存结果
        self.cache.set(cache_key, result)

        return result

    def get_news_by_date(
        self,
        target_date: datetime,
        platforms: Optional[List[str]] = None,
        limit: int = 50,
        include_url: bool = False
    ) -> List[Dict]:
        """
        按指定日期获取新闻

        Args:
            target_date: 目标日期
            platforms: 平台ID列表,None表示所有平台
            limit: 返回条数限制
            include_url: 是否包含URL链接,默认False(节省token)

        Returns:
            新闻列表

        Raises:
            DataNotFoundError: 数据不存在

        Examples:
            >>> service = DataService()
            >>> news = service.get_news_by_date(
            ...     target_date=datetime(2025, 10, 10),
            ...     platforms=['zhihu'],
            ...     limit=20
            ... )
        """
        # 尝试从缓存获取
        date_str = target_date.strftime("%Y-%m-%d")
        cache_key = f"news_by_date:{date_str}:{','.join(platforms or [])}:{limit}:{include_url}"
        cached = self.cache.get(cache_key, ttl=900)  # 15分钟缓存
        if cached:
            return cached

        # 读取指定日期的数据
        all_titles, id_to_name, timestamps = self.parser.read_all_titles_for_date(
            date=target_date,
            platform_ids=platforms
        )

        # 转换为新闻列表
        news_list = []
        for platform_id, titles in all_titles.items():
            platform_name = id_to_name.get(platform_id, platform_id)

            for title, info in titles.items():
                # 计算平均排名
                avg_rank = sum(info["ranks"]) / len(info["ranks"]) if info["ranks"] else 0

                news_item = {
                    "title": title,
                    "platform": platform_id,
                    "platform_name": platform_name,
                    "rank": info["ranks"][0] if info["ranks"] else 0,
                    "avg_rank": round(avg_rank, 2),
                    "count": len(info["ranks"]),
                    "date": date_str
                }

                # 条件性添加 URL 字段
                if include_url:
                    news_item["url"] = info.get("url", "")
                    news_item["mobileUrl"] = info.get("mobileUrl", "")

                news_list.append(news_item)

        # 按排名排序
        news_list.sort(key=lambda x: x["rank"])

        # 限制返回数量
        result = news_list[:limit]

        # 缓存结果(历史数据缓存更久)
        self.cache.set(cache_key, result)

        return result

    def search_news_by_keyword(
        self,
        keyword: str,
        date_range: Optional[Tuple[datetime, datetime]] = None,
        platforms: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Dict:
        """
        按关键词搜索新闻

        Args:
            keyword: 搜索关键词
            date_range: 日期范围 (start_date, end_date)
            platforms: 平台过滤列表
            limit: 返回条数限制(可选)

        Returns:
            搜索结果字典

        Raises:
            DataNotFoundError: 数据不存在
        """
        # 确定搜索日期范围
        if date_range:
            start_date, end_date = date_range
        else:
            # 默认搜索今天
            start_date = end_date = datetime.now()

        # 收集所有匹配的新闻
        results = []
        platform_distribution = Counter()

        # 遍历日期范围
        current_date = start_date
        while current_date <= end_date:
            try:
                all_titles, id_to_name, _ = self.parser.read_all_titles_for_date(
                    date=current_date,
                    platform_ids=platforms
                )

                # 搜索包含关键词的标题
                for platform_id, titles in all_titles.items():
                    platform_name = id_to_name.get(platform_id, platform_id)

                    for title, info in titles.items():
                        if keyword.lower() in title.lower():
                            # 计算平均排名
                            avg_rank = sum(info["ranks"]) / len(info["ranks"]) if info["ranks"] else 0

                            results.append({
                                "title": title,
                                "platform": platform_id,
                                "platform_name": platform_name,
                                "ranks": info["ranks"],
                                "count": len(info["ranks"]),
                                "avg_rank": round(avg_rank, 2),
                                "url": info.get("url", ""),
                                "mobileUrl": info.get("mobileUrl", ""),
                                "date": current_date.strftime("%Y-%m-%d")
                            })

                            platform_distribution[platform_id] += 1

            except DataNotFoundError:
                # 该日期没有数据,继续下一天
                pass

            # 下一天
            current_date += timedelta(days=1)

        if not results:
            raise DataNotFoundError(
                f"未找到包含关键词 '{keyword}' 的新闻",
                suggestion="请尝试其他关键词或扩大日期范围"
            )

        # 计算统计信息
        total_ranks = []
        for item in results:
            total_ranks.extend(item["ranks"])

        avg_rank = sum(total_ranks) / len(total_ranks) if total_ranks else 0

        # 限制返回数量(如果指定)
        total_found = len(results)
        if limit is not None and limit > 0:
            results = results[:limit]

        return {
            "results": results,
            "total": len(results),
            "total_found": total_found,
            "statistics": {
                "platform_distribution": dict(platform_distribution),
                "avg_rank": round(avg_rank, 2),
                "keyword": keyword
            }
        }

    def _extract_words_from_title(self, title: str, min_length: int = 2) -> List[str]:
        """
        从标题中提取有意义的词语（用于 auto_extract 模式）

        Args:
            title: 新闻标题
            min_length: 最小词长

        Returns:
            关键词列表
        """
        # 移除URL和特殊字符
        title = re.sub(r'http[s]?://\S+', '', title)
        title = re.sub(r'\[.*?\]', '', title)  # 移除方括号内容
        title = re.sub(r'[【】《》「」『』""''・·•]', '', title)  # 移除中文标点

        # 使用正则表达式分词（中文和英文）
        # 匹配连续的中文字符或英文单词
        words = re.findall(r'[\u4e00-\u9fff]{2,}|[a-zA-Z]{2,}[a-zA-Z0-9]*', title)

        # 过滤停用词和短词
        keywords = [
            word for word in words
            if word and len(word) >= min_length and word.lower() not in self.STOPWORDS
            and word not in self.STOPWORDS
        ]

        return keywords

    def get_trending_topics(
        self,
        top_n: int = 10,
        mode: str = "current",
        extract_mode: str = "keywords"
    ) -> Dict:
        """
        获取热点话题统计

        Args:
            top_n: 返回TOP N话题
            mode: 时间模式
                - "daily": 当日累计数据统计
                - "current": 最新一批数据统计（默认）
            extract_mode: 提取模式
                - "keywords": 统计预设关注词（基于 config/frequency_words.txt）
                - "auto_extract": 自动从新闻标题提取高频词

        Returns:
            话题频率统计字典

        Raises:
            DataNotFoundError: 数据不存在
        """
        # 尝试从缓存获取
        cache_key = f"trending_topics:{top_n}:{mode}:{extract_mode}"
        cached = self.cache.get(cache_key, ttl=900)  # 15分钟缓存
        if cached:
            return cached

        # 读取今天的数据
        all_titles, id_to_name, timestamps = self.parser.read_all_titles_for_date()

        if not all_titles:
            raise DataNotFoundError(
                "未找到今天的新闻数据",
                suggestion="请确保爬虫已经运行并生成了数据"
            )

        # 根据 mode 选择要处理的标题数据
        if mode == "daily":
            titles_to_process = all_titles
        elif mode == "current":
            titles_to_process = all_titles  # 简化实现
        else:
            raise ValueError(f"不支持的模式: {mode}。支持的模式: daily, current")

        # 统计词频
        word_frequency = Counter()
        keyword_to_news = {}

        # 遍历要处理的标题
        for platform_id, titles in titles_to_process.items():
            for title in titles.keys():
                if extract_mode == "keywords":
                    # 基于预设关键词统计（支持正则匹配）
                    from trendradar.core.frequency import _word_matches

                    word_groups = self.parser.parse_frequency_words()
                    title_lower = title.lower()

                    for group in word_groups:
                        all_words = group.get("required", []) + group.get("normal", [])
                        # 检查是否匹配词组中的任意一个词
                        matched = any(_word_matches(word_config, title_lower) for word_config in all_words)

                        if matched:
                            # 使用组的 display_name（组别名或行别名拼接）
                            display_key = group.get("display_name") or group.get("group_key", "")

                            word_frequency[display_key] += 1
                            if display_key not in keyword_to_news:
                                keyword_to_news[display_key] = []
                            keyword_to_news[display_key].append(title)
                            break  # 每个标题只计入第一个匹配的词组

                elif extract_mode == "auto_extract":
                    # 自动提取关键词
                    extracted_words = self._extract_words_from_title(title)
                    for word in extracted_words:
                        word_frequency[word] += 1
                        if word not in keyword_to_news:
                            keyword_to_news[word] = []
                        keyword_to_news[word].append(title)

        # 获取TOP N关键词
        top_keywords = word_frequency.most_common(top_n)

        # 构建话题列表
        topics = []
        for keyword, frequency in top_keywords:
            matched_news = keyword_to_news.get(keyword, [])

            topics.append({
                "keyword": keyword,
                "frequency": frequency,
                "matched_news": len(set(matched_news)),  # 去重后的新闻数量
                "trend": "stable",
                "weight_score": 0.0
            })

        # 构建结果
        result = {
            "topics": topics,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "mode": mode,
            "extract_mode": extract_mode,
            "total_keywords": len(word_frequency),
            "description": self._get_mode_description(mode, extract_mode)
        }

        # 缓存结果
        self.cache.set(cache_key, result)

        return result

    def _get_mode_description(self, mode: str, extract_mode: str = "keywords") -> str:
        """获取模式描述"""
        mode_desc = {
            "daily": "当日累计统计",
            "current": "最新一批统计"
        }.get(mode, "未知时间模式")

        extract_desc = {
            "keywords": "基于预设关注词",
            "auto_extract": "自动提取高频词"
        }.get(extract_mode, "未知提取模式")

        return f"{mode_desc} - {extract_desc}"

    def get_current_config(self, section: str = "all") -> Dict:
        """
        获取当前系统配置

        Args:
            section: 配置节 - all/crawler/push/keywords/weights

        Returns:
            配置字典

        Raises:
            FileParseError: 配置文件解析错误
        """
        # 解析配置文件
        config_data = self.parser.parse_yaml_config()
        word_groups = self.parser.parse_frequency_words()

        # 根据section返回对应配置
        advanced = config_data.get("advanced", {})
        advanced_crawler = advanced.get("crawler", {})
        platforms_config = config_data.get("platforms", {})

        if section == "all" or section == "crawler":
            crawler_config = {
                "enable_crawler": platforms_config.get("enabled", True),
                "use_proxy": advanced_crawler.get("use_proxy", False),
                "request_interval": advanced_crawler.get("request_interval", 1),
                "retry_times": 3,
                "platforms": [p["id"] for p in platforms_config.get("sources", [])]
            }

        if section == "all" or section == "push":
            notification = config_data.get("notification", {})
            batch_size = advanced.get("batch_size", {})
            push_config = {
                "enable_notification": notification.get("enabled", True),
                "enabled_channels": [],
                "message_batch_size": batch_size.get("default", 4000),
                "push_window": notification.get("push_window", {})
            }

            # 检测已配置的通知渠道
            channels = notification.get("channels", {})
            if channels.get("feishu", {}).get("webhook_url"):
                push_config["enabled_channels"].append("feishu")
            if channels.get("dingtalk", {}).get("webhook_url"):
                push_config["enabled_channels"].append("dingtalk")
            if channels.get("wework", {}).get("webhook_url"):
                push_config["enabled_channels"].append("wework")

        if section == "all" or section == "keywords":
            keywords_config = {
                "word_groups": word_groups,
                "total_groups": len(word_groups)
            }

        if section == "all" or section == "weights":
            weight = advanced.get("weight", {})
            weights_config = {
                "rank_weight": weight.get("rank", 0.6),
                "frequency_weight": weight.get("frequency", 0.3),
                "hotness_weight": weight.get("hotness", 0.1)
            }

        # 组装结果
        if section == "all":
            result = {
                "crawler": crawler_config,
                "push": push_config,
                "keywords": keywords_config,
                "weights": weights_config
            }
        elif section == "crawler":
            result = crawler_config
        elif section == "push":
            result = push_config
        elif section == "keywords":
            result = keywords_config
        elif section == "weights":
            result = weights_config
        else:
            result = {}

        return result

    def get_available_date_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        扫描 output 目录，返回实际可用的日期范围

        Returns:
            (最早日期, 最新日期) 元组，如果没有数据则返回 (None, None)

        Examples:
            >>> service = DataService()
            >>> earliest, latest = service.get_available_date_range()
            >>> print(f"可用日期范围：{earliest} 至 {latest}")
        """
        output_dir = self.parser.project_root / "output"

        if not output_dir.exists():
            return (None, None)

        available_dates = []

        # 遍历日期文件夹
        for date_folder in output_dir.iterdir():
            if date_folder.is_dir() and not date_folder.name.startswith('.'):
                folder_date = self._parse_date_folder_name(date_folder.name)
                if folder_date:
                    available_dates.append(folder_date)

        if not available_dates:
            return (None, None)

        return (min(available_dates), max(available_dates))

    def _parse_date_folder_name(self, folder_name: str) -> Optional[datetime]:
        """
        解析日期文件夹名称（兼容中文和ISO格式）

        支持两种格式：
        - 中文格式：YYYY年MM月DD日
        - ISO格式：YYYY-MM-DD

        Args:
            folder_name: 文件夹名称

        Returns:
            datetime 对象，解析失败返回 None
        """
        # 尝试中文格式：YYYY年MM月DD日
        chinese_match = re.match(r'(\d{4})年(\d{2})月(\d{2})日', folder_name)
        if chinese_match:
            try:
                return datetime(
                    int(chinese_match.group(1)),
                    int(chinese_match.group(2)),
                    int(chinese_match.group(3))
                )
            except ValueError:
                pass

        # 尝试 ISO 格式：YYYY-MM-DD
        iso_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', folder_name)
        if iso_match:
            try:
                return datetime(
                    int(iso_match.group(1)),
                    int(iso_match.group(2)),
                    int(iso_match.group(3))
                )
            except ValueError:
                pass

        return None

    def get_system_status(self) -> Dict:
        """
        获取系统运行状态

        Returns:
            系统状态字典
        """
        # 获取数据统计
        output_dir = self.parser.project_root / "output"

        total_storage = 0
        oldest_record = None
        latest_record = None
        total_news = 0

        if output_dir.exists():
            # 遍历日期文件夹
            for date_folder in output_dir.iterdir():
                if date_folder.is_dir() and not date_folder.name.startswith('.'):
                    # 解析日期（兼容中文和ISO格式）
                    folder_date = self._parse_date_folder_name(date_folder.name)
                    if folder_date:
                        if oldest_record is None or folder_date < oldest_record:
                            oldest_record = folder_date
                        if latest_record is None or folder_date > latest_record:
                            latest_record = folder_date

                    # 计算存储大小
                    for item in date_folder.rglob("*"):
                        if item.is_file():
                            total_storage += item.stat().st_size

        # 读取版本信息
        version_file = self.parser.project_root / "version"
        version = "unknown"
        if version_file.exists():
            try:
                with open(version_file, "r") as f:
                    version = f.read().strip()
            except:
                pass

        return {
            "system": {
                "version": version,
                "project_root": str(self.parser.project_root)
            },
            "data": {
                "total_storage": f"{total_storage / 1024 / 1024:.2f} MB",
                "oldest_record": oldest_record.strftime("%Y-%m-%d") if oldest_record else None,
                "latest_record": latest_record.strftime("%Y-%m-%d") if latest_record else None,
            },
            "cache": self.cache.get_stats(),
            "health": "healthy"
        }

    # ========================================
    # RSS 数据查询方法
    # ========================================

    def get_latest_rss(
        self,
        feeds: Optional[List[str]] = None,
        days: int = 1,
        limit: int = 50,
        include_summary: bool = False
    ) -> List[Dict]:
        """
        获取最新的 RSS 数据（支持多日查询）

        Args:
            feeds: RSS 源 ID 列表，None 表示所有源
            days: 获取最近 N 天的数据，默认 1（仅今天），最大 30 天
            limit: 返回条数限制
            include_summary: 是否包含摘要，默认 False（节省 token）

        Returns:
            RSS 条目列表（按 URL 去重）

        Raises:
            DataNotFoundError: 数据不存在
        """
        days = min(max(days, 1), 30)  # 限制 1-30 天
        cache_key = f"latest_rss:{','.join(feeds or [])}:{days}:{limit}:{include_summary}"
        cached = self.cache.get(cache_key, ttl=900)
        if cached:
            return cached

        rss_list = []
        seen_urls = set()  # 跨日期 URL 去重
        today = datetime.now()

        for i in range(days):
            target_date = today - timedelta(days=i)

            try:
                all_items, id_to_name, timestamps = self.parser.read_all_titles_for_date(
                    date=target_date,
                    platform_ids=feeds,
                    db_type="rss"
                )

                # 获取抓取时间
                if timestamps:
                    latest_timestamp = max(timestamps.values())
                    fetch_time = datetime.fromtimestamp(latest_timestamp)
                else:
                    fetch_time = target_date

                # 转换为列表
                for feed_id, items in all_items.items():
                    feed_name = id_to_name.get(feed_id, feed_id)

                    for title, info in items.items():
                        # 跨日期 URL 去重
                        url = info.get("url", "")
                        if url and url in seen_urls:
                            continue
                        if url:
                            seen_urls.add(url)

                        rss_item = {
                            "title": title,
                            "feed_id": feed_id,
                            "feed_name": feed_name,
                            "url": url,
                            "published_at": info.get("published_at", ""),
                            "author": info.get("author", ""),
                            "date": target_date.strftime("%Y-%m-%d"),
                            "fetch_time": fetch_time.strftime("%Y-%m-%d %H:%M:%S") if isinstance(fetch_time, datetime) else target_date.strftime("%Y-%m-%d")
                        }

                        if include_summary:
                            rss_item["summary"] = info.get("summary", "")

                        rss_list.append(rss_item)

            except DataNotFoundError:
                continue

        # 按发布时间排序（最新的在前）
        rss_list.sort(key=lambda x: x.get("published_at", ""), reverse=True)

        # 限制返回数量
        result = rss_list[:limit]

        # 缓存结果
        self.cache.set(cache_key, result)

        return result

    def search_rss(
        self,
        keyword: str,
        feeds: Optional[List[str]] = None,
        days: int = 7,
        limit: int = 50,
        include_summary: bool = False
    ) -> List[Dict]:
        """
        搜索 RSS 数据（跨日期自动去重）

        Args:
            keyword: 搜索关键词
            feeds: RSS 源 ID 列表，None 表示所有源
            days: 搜索最近 N 天的数据
            limit: 返回条数限制
            include_summary: 是否包含摘要

        Returns:
            匹配的 RSS 条目列表（按 URL 去重）
        """
        cache_key = f"search_rss:{keyword}:{','.join(feeds or [])}:{days}:{limit}:{include_summary}"
        cached = self.cache.get(cache_key, ttl=900)
        if cached:
            return cached

        results = []
        seen_urls = set()  # 用于 URL 去重
        today = datetime.now()

        for i in range(days):
            target_date = today - timedelta(days=i)

            try:
                all_items, id_to_name, _ = self.parser.read_all_titles_for_date(
                    date=target_date,
                    platform_ids=feeds,
                    db_type="rss"
                )

                for feed_id, items in all_items.items():
                    feed_name = id_to_name.get(feed_id, feed_id)

                    for title, info in items.items():
                        # 跨日期去重：如果 URL 已出现过则跳过
                        url = info.get("url", "")
                        if url and url in seen_urls:
                            continue
                        if url:
                            seen_urls.add(url)

                        # 关键词匹配（标题或摘要）
                        summary = info.get("summary", "")
                        if keyword.lower() in title.lower() or keyword.lower() in summary.lower():
                            rss_item = {
                                "title": title,
                                "feed_id": feed_id,
                                "feed_name": feed_name,
                                "url": url,
                                "published_at": info.get("published_at", ""),
                                "author": info.get("author", ""),
                                "date": target_date.strftime("%Y-%m-%d")
                            }

                            if include_summary:
                                rss_item["summary"] = summary

                            results.append(rss_item)

            except DataNotFoundError:
                continue

        # 按发布时间排序
        results.sort(key=lambda x: x.get("published_at", ""), reverse=True)

        # 限制返回数量
        result = results[:limit]

        # 缓存结果
        self.cache.set(cache_key, result)

        return result

    def get_rss_feeds_status(self) -> Dict:
        """
        获取 RSS 源状态

        Returns:
            RSS 源状态信息
        """
        cache_key = "rss_feeds_status"
        cached = self.cache.get(cache_key, ttl=900)
        if cached:
            return cached

        # 获取可用的 RSS 日期
        available_dates = self.parser.get_available_dates(db_type="rss")

        # 获取今天的 RSS 数据统计
        today_stats = {}
        try:
            all_items, id_to_name, _ = self.parser.read_all_titles_for_date(
                date=None,
                platform_ids=None,
                db_type="rss"
            )

            for feed_id, items in all_items.items():
                today_stats[feed_id] = {
                    "name": id_to_name.get(feed_id, feed_id),
                    "item_count": len(items)
                }

        except DataNotFoundError:
            pass

        result = {
            "available_dates": available_dates[:10],  # 最近 10 天
            "total_dates": len(available_dates),
            "today_feeds": today_stats,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        self.cache.set(cache_key, result)

        return result
