# coding=utf-8
"""
联网搜索统一抓取与本地质量筛选调度器

负责：
1. 遍历所有搜索主题并按需切换搜索引擎插件
2. 在 smart 模式下调用 AI 改写长句搜索需求
3. 按请求间隔限速拉取候选结果并按标准化 URL 合并去重
4. 执行本地 5 步质量筛选漏斗（排除词/排除域名、时效、质量分、权威度、排序截断）
5. 输出标准 SearchData 数据集合
"""

import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse

from trendradar.crawler.search.base import (
    BaseSearchProvider,
    SearchProviderError,
    SearchTopicConfig,
)
from trendradar.crawler.search.providers import create_search_provider_from_config
from trendradar.crawler.search.query_rewriter import SearchQueryRewriter
from trendradar.storage.base import SearchData, SearchItem
from trendradar.utils.time import DEFAULT_TIMEZONE, get_configured_time, is_within_days
from trendradar.utils.url import normalize_url


def _cfg_get(cfg: Dict[str, Any], upper_key: str, default: Any = None) -> Any:
    """兼容读取大写与小写配置键"""
    if upper_key in cfg:
        return cfg[upper_key]
    lower_key = upper_key.lower()
    if lower_key in cfg:
        return cfg[lower_key]
    return default


def _merge_unique(first: Optional[List[str]], second: Optional[List[str]]) -> List[str]:
    """合并两个字符串列表并保序去重"""
    result: List[str] = []
    for seq in (first or [], second or []):
        for item in seq:
            cleaned = (item or "").strip()
            if cleaned and cleaned not in result:
                result.append(cleaned)
    return result


def _normalize_domain(raw_site: str) -> str:
    """提取并小写化域名"""
    site = (raw_site or "").strip()
    if not site:
        return ""
    lower = site.lower()
    if lower.startswith("-site:"):
        site = site[6:].strip()
    elif lower.startswith("site:"):
        site = site[5:].strip()
    if "://" in site:
        site = urlparse(site).hostname or ""
    else:
        site = site.split("/", 1)[0].split("?", 1)[0].strip()
    return site.lower().strip(".")


def _build_url_dedup_key(url: str) -> str:
    """生成用于去重的标准化 URL 键"""
    if not url:
        return ""
    norm = normalize_url(url.strip())
    try:
        parsed = urlparse(norm)
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/") or "/"
        return urlunparse((scheme, netloc, path, parsed.params, parsed.query, ""))
    except Exception:
        return norm.lower()


def _matches_excluded_site(url: str, excluded_domains: List[str]) -> bool:
    """检查 URL 的域名是否命中任一排除站点（包含其子域名）"""
    if not url or not excluded_domains:
        return False
    try:
        host = (urlparse(url).hostname or "").lower().strip(".")
    except Exception:
        return False
    if not host:
        return False
    for domain in excluded_domains:
        if host == domain or host.endswith(f".{domain}"):
            return True
    return False


class WebSearchFetcher:
    """联网搜索抓取与筛选调度器"""

    def __init__(
        self,
        web_search_config: Dict[str, Any],
        topics: List[SearchTopicConfig],
        global_exclude_words: Optional[List[str]] = None,
        global_exclude_sites: Optional[List[str]] = None,
        ai_config: Optional[Dict[str, Any]] = None,
        storage_manager: Any = None,
        timezone: str = DEFAULT_TIMEZONE,
    ):
        """
        初始化联网搜索抓取器

        Args:
            web_search_config: 联网搜索配置字典（config["WEB_SEARCH"]）
            topics: 解析后的搜索主题列表
            global_exclude_words: 全局排除词列表
            global_exclude_sites: 全局排除站点域名列表
            ai_config: AI 配置字典（smart 模式下用于改写搜索词）
            storage_manager: 存储管理器（smart 模式下用于读写按日缓存）
            timezone: 时区配置
        """
        self.web_search_config: Dict[str, Any] = dict(web_search_config or {})
        self.topics: List[SearchTopicConfig] = list(topics or [])
        self.global_exclude_words: List[str] = list(global_exclude_words or [])
        self.global_exclude_sites: List[str] = [
            d for d in (_normalize_domain(s) for s in (global_exclude_sites or [])) if d
        ]
        self.ai_config: Optional[Dict[str, Any]] = ai_config
        self.storage_manager: Any = storage_manager
        self.timezone: str = timezone or DEFAULT_TIMEZONE

        cfg = self.web_search_config
        self.global_provider: str = str(_cfg_get(cfg, "PROVIDER", "deepseek") or "deepseek").strip().lower()
        self.query_mode: str = str(_cfg_get(cfg, "QUERY_MODE", "direct") or "direct").strip().lower()
        self.fetch_count: int = max(1, min(50, int(_cfg_get(cfg, "FETCH_COUNT", 20) or 20)))
        self.global_max_items: int = max(0, int(_cfg_get(cfg, "MAX_ITEMS_PER_TOPIC", 8) if _cfg_get(cfg, "MAX_ITEMS_PER_TOPIC", 8) is not None else 8))
        self.global_freshness_days: int = max(0, int(_cfg_get(cfg, "FRESHNESS_DAYS", 7) if _cfg_get(cfg, "FRESHNESS_DAYS", 7) is not None else 7))
        self.min_score: float = float(_cfg_get(cfg, "MIN_SCORE", 0.5) if _cfg_get(cfg, "MIN_SCORE", 0.5) is not None else 0.5)
        self.min_authority: int = int(_cfg_get(cfg, "MIN_AUTHORITY", -1) if _cfg_get(cfg, "MIN_AUTHORITY", -1) is not None else -1)
        self.allow_unknown_authority: bool = bool(_cfg_get(cfg, "ALLOW_UNKNOWN_AUTHORITY", True))
        self.need_content: bool = bool(_cfg_get(cfg, "NEED_CONTENT", False))
        self.request_interval: int = max(0, int(_cfg_get(cfg, "REQUEST_INTERVAL", 1000) if _cfg_get(cfg, "REQUEST_INTERVAL", 1000) is not None else 1000))

        self._provider_cache: Dict[str, BaseSearchProvider] = {}
        self._rewriter: Optional[SearchQueryRewriter] = (
            SearchQueryRewriter(ai_config=self.ai_config, storage_manager=self.storage_manager)
            if self.query_mode == "smart"
            else None
        )

    def _get_provider(self, provider_name: str) -> BaseSearchProvider:
        """按名称获取或创建搜索引擎实例（复用同一会话）"""
        key = (provider_name or self.global_provider or "deepseek").strip().lower()
        if key not in self._provider_cache:
            self._provider_cache[key] = create_search_provider_from_config(
                self.web_search_config,
                provider_name=key,
            )
        return self._provider_cache[key]

    def _filter_topic_items(
        self,
        candidates: List[SearchItem],
        *,
        exclude_words: List[str],
        exclude_sites: List[str],
        freshness_days: int,
        max_items: int,
    ) -> List[SearchItem]:
        """
        对单个主题的候选结果执行本地 5 步质量筛选漏斗：
        1. 排除词与排除域名过滤
        2. 发布时效过滤（无发布日期默认保留）
        3. 质量分门槛过滤
        4. 来源权威度门槛过滤
        5. 按 (score, published_at) 降序排序并按上限截断
        """
        exclude_words_lower = [w.lower() for w in exclude_words if w]
        exclude_domains = [d for d in (_normalize_domain(s) for s in exclude_sites) if d]

        filtered: List[SearchItem] = []

        for item in candidates:
            # 1. 排除词过滤（标题 + 摘要，不区分大小写）与排除域名过滤
            if exclude_words_lower:
                haystack = f"{item.title}\n{item.snippet}".lower()
                if any(word in haystack for word in exclude_words_lower):
                    continue

            if exclude_domains and _matches_excluded_site(item.url, exclude_domains):
                continue

            # 2. 时效过滤（无发布日期默认保留，避免误杀刚发布的网页）
            if freshness_days > 0 and item.published_at:
                if not is_within_days(item.published_at, freshness_days, self.timezone):
                    continue

            # 3. 质量分过滤（仅当设置了门槛且引擎给出了评分时过滤）
            if self.min_score > 0 and (item.score > 0 or item.raw_score > 0):
                if item.score < self.min_score:
                    continue

            # 4. 权威度过滤
            if self.min_authority >= 0:
                if item.authority < 0:
                    if not self.allow_unknown_authority:
                        continue
                elif item.authority < self.min_authority:
                    continue

            filtered.append(item)

        # 5. 排序与截断
        filtered.sort(key=lambda x: (x.score, x.published_at or ""), reverse=True)
        if max_items > 0:
            filtered = filtered[:max_items]

        return filtered

    @staticmethod
    def _merge_item(dedup_map: Dict[str, SearchItem], item: SearchItem) -> None:
        """按标准化 URL 合并去重，同 URL 保留高分项并互补缺失字段"""
        dedup_key = _build_url_dedup_key(item.url) or f"title:{item.title.strip().lower()}"
        existing = dedup_map.get(dedup_key)
        if existing is None:
            dedup_map[dedup_key] = item
            return

        if item.score > existing.score:
            if not item.published_at and existing.published_at:
                item.published_at = existing.published_at
            if not item.snippet and existing.snippet:
                item.snippet = existing.snippet
            if not item.summary and existing.summary:
                item.summary = existing.summary
            if not item.content and existing.content:
                item.content = existing.content
            if not item.site_name and existing.site_name:
                item.site_name = existing.site_name
            if not item.site_icon and existing.site_icon:
                item.site_icon = existing.site_icon
            if item.authority < 0 <= existing.authority:
                item.authority = existing.authority
            dedup_map[dedup_key] = item
        else:
            if not existing.published_at and item.published_at:
                existing.published_at = item.published_at
            if not existing.snippet and item.snippet:
                existing.snippet = item.snippet
            if not existing.summary and item.summary:
                existing.summary = item.summary
            if not existing.content and item.content:
                existing.content = item.content
            if not existing.site_name and item.site_name:
                existing.site_name = item.site_name
            if not existing.site_icon and item.site_icon:
                existing.site_icon = item.site_icon
            if existing.authority < 0 <= item.authority:
                existing.authority = item.authority

    def fetch_all(self) -> SearchData:
        """
        执行全部搜索主题的抓取与本地筛选

        Returns:
            完整的 SearchData 数据集合
        """
        now = get_configured_time(self.timezone)
        crawl_date = now.strftime("%Y-%m-%d")
        crawl_time = now.strftime("%H:%M")

        all_items: Dict[str, List[SearchItem]] = {}
        id_to_name: Dict[str, str] = {}
        id_to_query: Dict[str, str] = {}
        id_to_provider: Dict[str, str] = {}
        failed_ids: List[str] = []

        if not self.topics:
            print("[联网搜索] 未配置任何搜索任务，已跳过")
            return SearchData(
                date=crawl_date,
                crawl_time=crawl_time,
                items=all_items,
                id_to_name=id_to_name,
                id_to_query=id_to_query,
                id_to_provider=id_to_provider,
                failed_ids=failed_ids,
            )

        print(f"[联网搜索] 开始执行 {len(self.topics)} 个搜索主题（查询模式：{self.query_mode}）...")

        request_count = 0

        for topic in self.topics:
            provider_name = (topic.provider or self.global_provider or "deepseek").strip().lower()
            id_to_name[topic.id] = topic.name
            id_to_query[topic.id] = " / ".join(topic.queries)
            id_to_provider[topic.id] = provider_name

            try:
                provider = self._get_provider(provider_name)
            except Exception as e:
                print(f"[联网搜索] 主题「{topic.name}」初始化搜索引擎 '{provider_name}' 失败：{e}")
                failed_ids.append(topic.id)
                continue

            valid, err_msg = provider.validate_config()
            if not valid:
                print(f"[联网搜索] 主题「{topic.name}」无法搜索：{err_msg}")
                failed_ids.append(topic.id)
                continue

            effective_freshness = (
                topic.freshness_days if topic.freshness_days is not None else self.global_freshness_days
            )
            effective_max_items = (
                topic.max_items if topic.max_items is not None else self.global_max_items
            )
            merged_exclude_words = _merge_unique(self.global_exclude_words, topic.exclude_words)
            merged_exclude_sites = _merge_unique(self.global_exclude_sites, topic.exclude_sites)

            # 展开该主题需要执行的子查询（smart 模式下对长自然语言进行提炼）
            sub_queries: List[Tuple[str, Optional[str]]] = []
            for raw_query in topic.queries:
                if self._rewriter is not None and self._rewriter.should_rewrite(
                    raw_query, max_query_length=provider.max_query_length
                ):
                    rewritten_list, ori_q = self._rewriter.rewrite(
                        raw_query,
                        date_str=crawl_date,
                        max_query_length=provider.max_query_length,
                    )
                    for rq in rewritten_list:
                        sub_queries.append((rq, ori_q))
                else:
                    sub_queries.append((raw_query, None))

            if not sub_queries:
                all_items[topic.id] = []
                continue

            dedup_map: Dict[str, SearchItem] = {}
            success_queries = 0
            last_error = ""

            for sub_query, ori_question in sub_queries:
                if request_count > 0 and self.request_interval > 0:
                    time.sleep(self.request_interval / 1000.0)
                request_count += 1

                try:
                    raw_items = provider.search(
                        query=sub_query,
                        count=self.fetch_count,
                        topic_id=topic.id,
                        topic_name=topic.name,
                        ori_question=ori_question,
                        freshness_days=effective_freshness,
                        need_content=self.need_content,
                        exclude_sites=merged_exclude_sites,
                        reference_date=now,
                    )
                    success_queries += 1
                except SearchProviderError as e:
                    last_error = str(e)
                    print(f"[联网搜索] 主题「{topic.name}」搜索「{sub_query}」失败：{e}")
                    continue
                except Exception as e:
                    last_error = str(e)
                    print(f"[联网搜索] 主题「{topic.name}」搜索「{sub_query}」出现异常：{e}")
                    continue

                for item in raw_items:
                    if item.url:
                        item.url = normalize_url(item.url)
                    item.topic_id = topic.id
                    item.topic_name = topic.name
                    item.provider = item.provider or provider_name
                    item.crawl_time = crawl_time
                    item.first_time = item.first_time or crawl_time
                    item.last_time = item.last_time or crawl_time
                    self._merge_item(dedup_map, item)

            # 该主题所有子查询均失败时记录到 failed_ids，不影响其他主题继续执行
            if success_queries == 0:
                failed_ids.append(topic.id)
                print(f"[联网搜索] 主题「{topic.name}」全部搜索均失败（原因：{last_error}）")
                continue

            candidates = list(dedup_map.values())
            filtered_items = self._filter_topic_items(
                candidates,
                exclude_words=merged_exclude_words,
                exclude_sites=merged_exclude_sites,
                freshness_days=effective_freshness,
                max_items=effective_max_items,
            )
            all_items[topic.id] = filtered_items
            print(
                f"[联网搜索] 主题「{topic.name}」（{provider_name}）："
                f"去重候选 {len(candidates)} 条 → 质量筛选后保留 {len(filtered_items)} 条"
            )

        total_items = sum(len(items) for items in all_items.values())
        print(
            f"[联网搜索] 搜索完成：{len(all_items)} 个主题成功，"
            f"{len(failed_ids)} 个失败，共保留 {total_items} 条结果"
        )

        return SearchData(
            date=crawl_date,
            crawl_time=crawl_time,
            items=all_items,
            id_to_name=id_to_name,
            id_to_query=id_to_query,
            id_to_provider=id_to_provider,
            failed_ids=failed_ids,
        )
