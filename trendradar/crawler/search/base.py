# coding=utf-8
"""
联网搜索引擎抽象基类与核心数据模型

定义搜索引擎插件的统一契约，包括：
- SearchProviderError: 搜索引擎调用异常
- SearchTopicConfig: 单个搜索主题的任务配置
- FetchedPage: 网页正文抓取结果
- BaseSearchProvider: 搜索引擎插件抽象基类
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from trendradar.storage.base import SearchItem


class SearchProviderError(Exception):
    """联网搜索引擎调用异常"""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        retryable: bool = False,
    ):
        """
        初始化搜索异常

        Args:
            message: 通俗易懂的错误说明
            status_code: HTTP 状态码（网络异常或本地校验失败时为 None）
            retryable: 是否属于可重试的临时性故障
        """
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


@dataclass
class SearchTopicConfig:
    """单个联网搜索主题的配置"""

    id: str                                             # 稳定主题 ID（如 topic_a1b2c3d4）
    name: str                                           # 主题展示名称
    queries: List[str] = field(default_factory=list)    # 该主题下的 1 条或多条搜索语句
    exclude_words: List[str] = field(default_factory=list)  # !词 排除词列表
    exclude_sites: List[str] = field(default_factory=list)  # 独立行 -site:域名 列表
    max_items: Optional[int] = None                     # @数字 覆盖全局上限，None 表示使用全局设置
    freshness_days: Optional[int] = None                # ~Nd 覆盖全局时效，None 表示使用全局设置
    provider: Optional[str] = None                      # @provider:xxx 覆盖全局引擎，None 表示使用全局设置


@dataclass
class FetchedPage:
    """网页正文抓取结果"""

    url: str
    title: str = ""
    content: str = ""
    provider: str = ""


class BaseSearchProvider(ABC):
    """
    联网搜索引擎插件抽象基类

    所有搜索引擎适配器都应继承此类并实现 search() 方法。
    """

    name: str = "base"
    max_query_length: int = 128
    supports_fetch: bool = False
    supports_date_operator: bool = True

    def __init__(
        self,
        provider_config: Dict[str, Any],
        timeout: int = 20,
        max_retries: int = 2,
        use_proxy: bool = False,
        proxy_url: str = "",
    ):
        """
        初始化搜索引擎插件

        Args:
            provider_config: 该引擎的专属配置（如 api_key、api_base 等）
            timeout: 单次请求超时时间（秒）
            max_retries: 遇到限流或网络异常时的最大重试次数
            use_proxy: 是否启用代理
            proxy_url: 代理地址
        """
        self.provider_config: Dict[str, Any] = dict(provider_config or {})
        self.timeout: int = max(1, int(timeout))
        self.max_retries: int = max(0, int(max_retries))
        self.use_proxy: bool = bool(use_proxy)
        self.proxy_url: str = (proxy_url or "").strip()

    @abstractmethod
    def search(
        self,
        query: str,
        count: int = 10,
        *,
        topic_id: str = "",
        topic_name: str = "",
        ori_question: Optional[str] = None,
        freshness_days: int = 0,
        need_content: bool = False,
        exclude_sites: Optional[List[str]] = None,
        reference_date: Optional[datetime] = None,
    ) -> List[SearchItem]:
        """
        执行单次联网搜索并返回标准 SearchItem 列表

        Args:
            query: 搜索词
            count: 期望返回的候选条数
            topic_id: 所属主题 ID
            topic_name: 所属主题名称
            ori_question: 原始自然语言问题（用于提升重排相关性，可选）
            freshness_days: 时效天数（>0 时可拼接时间范围条件）
            need_content: 是否顺带抓取网页完整正文
            exclude_sites: 需要排除的网站域名列表
            reference_date: 计算日期范围时的基准时间（默认当前时间）

        Returns:
            SearchItem 列表
        """
        raise NotImplementedError

    def fetch(self, url: str) -> FetchedPage:
        """
        抓取单个网页的正文内容（可选能力）

        Args:
            url: 目标网页 URL

        Returns:
            FetchedPage 对象
        """
        raise NotImplementedError(f"搜索引擎 '{self.name}' 暂不支持抓取网页正文")

    def validate_config(self) -> Tuple[bool, str]:
        """
        校验引擎配置是否完整有效

        Returns:
            (是否有效, 错误提示信息)
        """
        return True, ""
