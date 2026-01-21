# coding=utf-8
"""
存储后端抽象基类和数据模型

定义统一的存储接口，所有存储后端都需要实现这些方法
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class NewsItem:
    """新闻条目数据模型（热榜数据）"""

    title: str                          # 新闻标题
    source_id: str                      # 来源平台ID（如 toutiao, baidu）
    source_name: str = ""               # 来源平台名称（运行时使用，数据库不存储）
    rank: int = 0                       # 排名
    url: str = ""                       # 链接 URL
    mobile_url: str = ""                # 移动端 URL
    crawl_time: str = ""                # 抓取时间（HH:MM 格式）

    # 统计信息（用于分析）
    ranks: List[int] = field(default_factory=list)  # 历史排名列表
    first_time: str = ""                # 首次出现时间
    last_time: str = ""                 # 最后出现时间
    count: int = 1                      # 出现次数
    rank_timeline: List[Dict[str, Any]] = field(default_factory=list)  # 完整排名时间线
                                        # 格式: [{"time": "09:30", "rank": 1}, {"time": "10:00", "rank": 2}, ...]
                                        # None 表示脱榜: [{"time": "11:00", "rank": None}]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "title": self.title,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "rank": self.rank,
            "url": self.url,
            "mobile_url": self.mobile_url,
            "crawl_time": self.crawl_time,
            "ranks": self.ranks,
            "first_time": self.first_time,
            "last_time": self.last_time,
            "count": self.count,
            "rank_timeline": self.rank_timeline,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NewsItem":
        """从字典创建"""
        return cls(
            title=data.get("title", ""),
            source_id=data.get("source_id", ""),
            source_name=data.get("source_name", ""),
            rank=data.get("rank", 0),
            url=data.get("url", ""),
            mobile_url=data.get("mobile_url", ""),
            crawl_time=data.get("crawl_time", ""),
            ranks=data.get("ranks", []),
            first_time=data.get("first_time", ""),
            last_time=data.get("last_time", ""),
            count=data.get("count", 1),
            rank_timeline=data.get("rank_timeline", []),
        )


@dataclass
class RSSItem:
    """RSS 条目数据模型"""

    title: str                          # 标题
    feed_id: str                        # RSS 源 ID（如 "hacker-news"）
    feed_name: str = ""                 # RSS 源名称（运行时使用）
    url: str = ""                       # 文章链接
    published_at: str = ""              # RSS 发布时间（ISO 格式）
    summary: str = ""                   # 摘要/描述
    author: str = ""                    # 作者
    crawl_time: str = ""                # 抓取时间（HH:MM 格式）

    # 统计信息
    first_time: str = ""                # 首次抓取时间
    last_time: str = ""                 # 最后抓取时间
    count: int = 1                      # 抓取次数

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "title": self.title,
            "feed_id": self.feed_id,
            "feed_name": self.feed_name,
            "url": self.url,
            "published_at": self.published_at,
            "summary": self.summary,
            "author": self.author,
            "crawl_time": self.crawl_time,
            "first_time": self.first_time,
            "last_time": self.last_time,
            "count": self.count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RSSItem":
        """从字典创建"""
        return cls(
            title=data.get("title", ""),
            feed_id=data.get("feed_id", ""),
            feed_name=data.get("feed_name", ""),
            url=data.get("url", ""),
            published_at=data.get("published_at", ""),
            summary=data.get("summary", ""),
            author=data.get("author", ""),
            crawl_time=data.get("crawl_time", ""),
            first_time=data.get("first_time", ""),
            last_time=data.get("last_time", ""),
            count=data.get("count", 1),
        )


@dataclass
class RSSData:
    """
    RSS 数据集合

    结构:
    - date: 日期（YYYY-MM-DD）
    - crawl_time: 抓取时间（HH:MM）
    - items: 按 feed_id 分组的 RSS 条目
    - id_to_name: feed_id 到名称的映射
    - failed_ids: 失败的 feed_id 列表
    """

    date: str                                   # 日期
    crawl_time: str                             # 抓取时间
    items: Dict[str, List[RSSItem]]             # 按 feed_id 分组的条目
    id_to_name: Dict[str, str] = field(default_factory=dict)   # ID到名称映射
    failed_ids: List[str] = field(default_factory=list)        # 失败的ID

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        items_dict = {}
        for feed_id, rss_list in self.items.items():
            items_dict[feed_id] = [item.to_dict() for item in rss_list]

        return {
            "date": self.date,
            "crawl_time": self.crawl_time,
            "items": items_dict,
            "id_to_name": self.id_to_name,
            "failed_ids": self.failed_ids,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RSSData":
        """从字典创建"""
        items = {}
        items_data = data.get("items", {})
        for feed_id, rss_list in items_data.items():
            items[feed_id] = [RSSItem.from_dict(item) for item in rss_list]

        return cls(
            date=data.get("date", ""),
            crawl_time=data.get("crawl_time", ""),
            items=items,
            id_to_name=data.get("id_to_name", {}),
            failed_ids=data.get("failed_ids", []),
        )

    def get_total_count(self) -> int:
        """获取条目总数"""
        return sum(len(rss_list) for rss_list in self.items.values())


@dataclass
class NewsData:
    """
    新闻数据集合

    结构:
    - date: 日期（YYYY-MM-DD）
    - crawl_time: 抓取时间（HH时MM分）
    - items: 按来源ID分组的新闻条目
    - id_to_name: 来源ID到名称的映射
    - failed_ids: 失败的来源ID列表
    """

    date: str                                   # 日期
    crawl_time: str                             # 抓取时间
    items: Dict[str, List[NewsItem]]            # 按来源分组的新闻
    id_to_name: Dict[str, str] = field(default_factory=dict)   # ID到名称映射
    failed_ids: List[str] = field(default_factory=list)        # 失败的ID

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        items_dict = {}
        for source_id, news_list in self.items.items():
            items_dict[source_id] = [item.to_dict() for item in news_list]

        return {
            "date": self.date,
            "crawl_time": self.crawl_time,
            "items": items_dict,
            "id_to_name": self.id_to_name,
            "failed_ids": self.failed_ids,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NewsData":
        """从字典创建"""
        items = {}
        items_data = data.get("items", {})
        for source_id, news_list in items_data.items():
            items[source_id] = [NewsItem.from_dict(item) for item in news_list]

        return cls(
            date=data.get("date", ""),
            crawl_time=data.get("crawl_time", ""),
            items=items,
            id_to_name=data.get("id_to_name", {}),
            failed_ids=data.get("failed_ids", []),
        )

    def get_total_count(self) -> int:
        """获取新闻总数"""
        return sum(len(news_list) for news_list in self.items.values())

    def merge_with(self, other: "NewsData") -> "NewsData":
        """
        合并另一个 NewsData 到当前数据

        合并规则:
        - 相同 source_id + title 的新闻合并排名历史
        - 更新 last_time 和 count
        - 保留较早的 first_time
        """
        merged_items = {}

        # 复制当前数据
        for source_id, news_list in self.items.items():
            merged_items[source_id] = {item.title: item for item in news_list}

        # 合并其他数据
        for source_id, news_list in other.items.items():
            if source_id not in merged_items:
                merged_items[source_id] = {}

            for item in news_list:
                if item.title in merged_items[source_id]:
                    # 合并已存在的新闻
                    existing = merged_items[source_id][item.title]

                    # 合并排名
                    existing_ranks = set(existing.ranks) if existing.ranks else set()
                    new_ranks = set(item.ranks) if item.ranks else set()
                    merged_ranks = sorted(existing_ranks | new_ranks)
                    existing.ranks = merged_ranks

                    # 更新时间
                    if item.first_time and (not existing.first_time or item.first_time < existing.first_time):
                        existing.first_time = item.first_time
                    if item.last_time and (not existing.last_time or item.last_time > existing.last_time):
                        existing.last_time = item.last_time

                    # 更新计数
                    existing.count += 1

                    # 保留URL（如果原来没有）
                    if not existing.url and item.url:
                        existing.url = item.url
                    if not existing.mobile_url and item.mobile_url:
                        existing.mobile_url = item.mobile_url
                else:
                    # 添加新新闻
                    merged_items[source_id][item.title] = item

        # 转换回列表格式
        final_items = {}
        for source_id, items_dict in merged_items.items():
            final_items[source_id] = list(items_dict.values())

        # 合并 id_to_name
        merged_id_to_name = {**self.id_to_name, **other.id_to_name}

        # 合并 failed_ids（去重）
        merged_failed_ids = list(set(self.failed_ids + other.failed_ids))

        return NewsData(
            date=self.date or other.date,
            crawl_time=other.crawl_time,  # 使用较新的抓取时间
            items=final_items,
            id_to_name=merged_id_to_name,
            failed_ids=merged_failed_ids,
        )


class StorageBackend(ABC):
    """
    存储后端抽象基类

    所有存储后端都需要实现这些方法，以支持:
    - 保存新闻数据
    - 读取当天所有数据
    - 检测新增新闻
    - 生成报告文件（TXT/HTML）
    """

    @abstractmethod
    def save_news_data(self, data: NewsData) -> bool:
        """
        保存新闻数据

        Args:
            data: 新闻数据

        Returns:
            是否保存成功
        """
        pass

    @abstractmethod
    def get_today_all_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """
        获取指定日期的所有新闻数据

        Args:
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            合并后的新闻数据，如果没有数据返回 None
        """
        pass

    @abstractmethod
    def get_latest_crawl_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """
        获取最新一次抓取的数据

        Args:
            date: 日期字符串，默认为今天

        Returns:
            最新抓取的新闻数据
        """
        pass

    @abstractmethod
    def detect_new_titles(self, current_data: NewsData) -> Dict[str, Dict]:
        """
        检测新增的标题

        Args:
            current_data: 当前抓取的数据

        Returns:
            新增的标题数据，格式: {source_id: {title: title_data}}
        """
        pass

    @abstractmethod
    def save_txt_snapshot(self, data: NewsData) -> Optional[str]:
        """
        保存 TXT 快照（可选功能，本地环境可用）

        Args:
            data: 新闻数据

        Returns:
            保存的文件路径，如果不支持返回 None
        """
        pass

    @abstractmethod
    def save_html_report(self, html_content: str, filename: str, is_summary: bool = False) -> Optional[str]:
        """
        保存 HTML 报告

        Args:
            html_content: HTML 内容
            filename: 文件名
            is_summary: 是否为汇总报告

        Returns:
            保存的文件路径
        """
        pass

    @abstractmethod
    def is_first_crawl_today(self, date: Optional[str] = None) -> bool:
        """
        检查是否是当天第一次抓取

        Args:
            date: 日期字符串，默认为今天

        Returns:
            是否是第一次抓取
        """
        pass

    @abstractmethod
    def cleanup(self) -> None:
        """
        清理资源（如临时文件、数据库连接等）
        """
        pass

    @abstractmethod
    def cleanup_old_data(self, retention_days: int) -> int:
        """
        清理过期数据

        Args:
            retention_days: 保留天数（0 表示不清理）

        Returns:
            删除的日期目录数量
        """
        pass

    @property
    @abstractmethod
    def backend_name(self) -> str:
        """
        存储后端名称
        """
        pass

    @property
    @abstractmethod
    def supports_txt(self) -> bool:
        """
        是否支持生成 TXT 快照
        """
        pass

    # === 推送记录相关方法 ===

    @abstractmethod
    def has_pushed_today(self, date: Optional[str] = None) -> bool:
        """
        检查指定日期是否已推送过

        Args:
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            是否已推送
        """
        pass

    @abstractmethod
    def record_push(self, report_type: str, date: Optional[str] = None) -> bool:
        """
        记录推送

        Args:
            report_type: 报告类型
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            是否记录成功
        """
        pass


def convert_crawl_results_to_news_data(
    results: Dict[str, Dict],
    id_to_name: Dict[str, str],
    failed_ids: List[str],
    crawl_time: str,
    crawl_date: str,
) -> NewsData:
    """
    将爬虫结果转换为 NewsData 格式

    Args:
        results: 爬虫返回的结果 {source_id: {title: {ranks: [], url: "", mobileUrl: ""}}}
        id_to_name: 来源ID到名称的映射
        failed_ids: 失败的来源ID
        crawl_time: 抓取时间（HH:MM）
        crawl_date: 抓取日期（YYYY-MM-DD）

    Returns:
        NewsData 对象
    """
    items = {}

    for source_id, titles_data in results.items():
        source_name = id_to_name.get(source_id, source_id)
        news_list = []

        for title, data in titles_data.items():
            if isinstance(data, dict):
                ranks = data.get("ranks", [])
                url = data.get("url", "")
                mobile_url = data.get("mobileUrl", "")
            else:
                # 兼容旧格式
                ranks = data if isinstance(data, list) else []
                url = ""
                mobile_url = ""

            rank = ranks[0] if ranks else 99

            news_item = NewsItem(
                title=title,
                source_id=source_id,
                source_name=source_name,
                rank=rank,
                url=url,
                mobile_url=mobile_url,
                crawl_time=crawl_time,
                ranks=ranks,
                first_time=crawl_time,
                last_time=crawl_time,
                count=1,
            )
            news_list.append(news_item)

        items[source_id] = news_list

    return NewsData(
        date=crawl_date,
        crawl_time=crawl_time,
        items=items,
        id_to_name=id_to_name,
        failed_ids=failed_ids,
    )


def convert_news_data_to_results(data: NewsData) -> tuple:
    """
    将 NewsData 转换回原有的 results 格式（用于兼容现有代码）

    Args:
        data: NewsData 对象

    Returns:
        (results, id_to_name, title_info) 元组
    """
    results = {}
    title_info = {}

    for source_id, news_list in data.items.items():
        results[source_id] = {}
        title_info[source_id] = {}

        for item in news_list:
            results[source_id][item.title] = {
                "ranks": item.ranks,
                "url": item.url,
                "mobileUrl": item.mobile_url,
            }

            title_info[source_id][item.title] = {
                "first_time": item.first_time,
                "last_time": item.last_time,
                "count": item.count,
                "ranks": item.ranks,
                "url": item.url,
                "mobileUrl": item.mobile_url,
            }

    return results, data.id_to_name, title_info
