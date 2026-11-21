# coding=utf-8
"""
联网搜索任务配置文件（search_queries.txt）解析模块

支持语法：
- 空行分隔不同搜索主题块，忽略 # 注释行
- [GLOBAL_FILTER] 全局屏蔽区（排除词、!排除词、-site:域名）
- [SEARCH_TOPICS] 搜索任务区（默认区段）
- [主题名称] 放在段落第一行作为主题展示名
- @provider:名称 覆盖全局搜索引擎
- @数字 覆盖全局每主题最大条数
- ~数字d / ~数字D 覆盖全局时效天数（如 ~7d、~0d）
- !词 主题内排除词
- -site:域名 独立行排除网站
"""

import hashlib
import os
import re
from pathlib import Path
from typing import List, Optional, Set, Tuple
from urllib.parse import urlparse

from trendradar.crawler.search.base import SearchTopicConfig

_SECTION_HEADERS = {"GLOBAL_FILTER", "SEARCH_TOPICS"}
_PROVIDER_DIRECTIVE_RE = re.compile(r"^@provider:\s*(\S+)$", re.IGNORECASE)
_MAX_ITEMS_DIRECTIVE_RE = re.compile(r"^@(\d+)$")
_FRESHNESS_DIRECTIVE_RE = re.compile(r"^~(\d+)[dD]$")
_EXCLUDE_SITE_LINE_RE = re.compile(r"^-site:\s*(\S+)$", re.IGNORECASE)
_INLINE_OPERATOR_RE = re.compile(
    r"(?:^|\s)(?:-?site:|after:|before:|filetype:|inurl:|intitle:)\S+",
    re.IGNORECASE,
)


def _normalize_domain(raw_site: str) -> str:
    """清理域名字符串，去掉协议、路径与首尾点号"""
    site = (raw_site or "").strip()
    if not site:
        return ""
    if "://" in site:
        site = urlparse(site).hostname or ""
    else:
        site = site.split("/", 1)[0].split("?", 1)[0].strip()
    return site.lower().strip(".")


def _append_unique(target: List[str], value: str) -> None:
    """保序去重追加字符串"""
    if value and value not in target:
        target.append(value)


def _derive_topic_name(first_query: str, max_length: int = 28) -> str:
    """当未显式写 [主题名] 时，从第一条搜索词去操作符并截断生成展示名"""
    cleaned = _INLINE_OPERATOR_RE.sub(" ", first_query or "")
    cleaned = " ".join(cleaned.split()).strip()
    if not cleaned:
        cleaned = " ".join((first_query or "").split()).strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()
    return cleaned or "未命名搜索主题"


def _make_stable_topic_id(seed_text: str, used_ids: Set[str]) -> str:
    """生成稳定的主题 ID（topic_<md5[:8]>），遇到重名主题自动追加序号避免碰撞"""
    digest = hashlib.md5(seed_text.encode("utf-8")).hexdigest()[:8]
    base_id = f"topic_{digest}"
    if base_id not in used_ids:
        used_ids.add(base_id)
        return base_id

    suffix = 2
    while f"{base_id}_{suffix}" in used_ids:
        suffix += 1
    unique_id = f"{base_id}_{suffix}"
    used_ids.add(unique_id)
    return unique_id


def resolve_search_queries_path(queries_file: Optional[str] = None) -> Path:
    """
    解析联网搜索任务文件路径

    优先级：
    1. 显式传入的 queries_file 参数
    2. 环境变量 SEARCH_QUERIES_PATH
    3. 默认路径 config/search_queries.txt

    若直接路径不存在，还会尝试在 config/custom/search/ 目录下查找同名文件。
    """
    raw_path = (queries_file or "").strip()
    if not raw_path:
        raw_path = os.environ.get("SEARCH_QUERIES_PATH", "").strip() or "config/search_queries.txt"

    direct_path = Path(raw_path)
    if direct_path.exists():
        return direct_path

    custom_path = Path("config/custom/search") / raw_path
    if custom_path.exists():
        return custom_path

    return direct_path


def parse_search_queries_content(
    content: str,
) -> Tuple[List[SearchTopicConfig], List[str], List[str]]:
    """
    解析联网搜索任务配置文本内容

    Args:
        content: 配置文件原文

    Returns:
        (topics, global_exclude_words, global_exclude_sites)
    """
    normalized = (content or "").replace("\r\n", "\n").replace("\r", "\n")
    blocks = [block.strip() for block in re.split(r"\n\s*\n", normalized) if block.strip()]

    topics: List[SearchTopicConfig] = []
    global_exclude_words: List[str] = []
    global_exclude_sites: List[str] = []

    current_section = "SEARCH_TOPICS"
    used_ids: Set[str] = set()

    for block in blocks:
        lines = [
            line.strip()
            for line in block.split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]
        if not lines:
            continue

        # 检查块首是否为区段标记（[GLOBAL_FILTER] / [SEARCH_TOPICS]）
        if lines[0].startswith("[") and lines[0].endswith("]"):
            header = lines[0][1:-1].strip().upper()
            if header in _SECTION_HEADERS:
                current_section = header
                lines = lines[1:]
                if not lines:
                    continue

        # 处理全局屏蔽区
        if current_section == "GLOBAL_FILTER":
            for line in lines:
                site_match = _EXCLUDE_SITE_LINE_RE.match(line)
                if site_match:
                    domain = _normalize_domain(site_match.group(1))
                    _append_unique(global_exclude_sites, domain)
                elif line.startswith("!"):
                    word = line[1:].strip()
                    _append_unique(global_exclude_words, word)
                else:
                    _append_unique(global_exclude_words, line)
            continue

        # 处理搜索任务区
        topic_name: Optional[str] = None
        if lines[0].startswith("[") and lines[0].endswith("]"):
            candidate_name = lines[0][1:-1].strip()
            if candidate_name.upper() not in _SECTION_HEADERS:
                if candidate_name:
                    topic_name = candidate_name
                lines = lines[1:]

        queries: List[str] = []
        exclude_words: List[str] = []
        exclude_sites: List[str] = []
        max_items: Optional[int] = None
        freshness_days: Optional[int] = None
        provider: Optional[str] = None

        for line in lines:
            provider_match = _PROVIDER_DIRECTIVE_RE.match(line)
            if provider_match:
                provider = provider_match.group(1).strip().lower()
                continue

            max_match = _MAX_ITEMS_DIRECTIVE_RE.match(line)
            if max_match:
                val = int(max_match.group(1))
                if val > 0:
                    max_items = val
                continue

            fresh_match = _FRESHNESS_DIRECTIVE_RE.match(line)
            if fresh_match:
                freshness_days = int(fresh_match.group(1))
                continue

            if line.startswith("!"):
                word = line[1:].strip()
                _append_unique(exclude_words, word)
                continue

            site_match = _EXCLUDE_SITE_LINE_RE.match(line)
            if site_match:
                domain = _normalize_domain(site_match.group(1))
                _append_unique(exclude_sites, domain)
                continue

            _append_unique(queries, line)

        if not queries:
            continue

        resolved_name = topic_name or _derive_topic_name(queries[0])
        topic_id = _make_stable_topic_id(resolved_name or queries[0], used_ids)

        topics.append(
            SearchTopicConfig(
                id=topic_id,
                name=resolved_name,
                queries=queries,
                exclude_words=exclude_words,
                exclude_sites=exclude_sites,
                max_items=max_items,
                freshness_days=freshness_days,
                provider=provider,
            )
        )

    return topics, global_exclude_words, global_exclude_sites


def load_search_queries(
    queries_file: Optional[str] = None,
) -> Tuple[List[SearchTopicConfig], List[str], List[str]]:
    """
    从文件加载并解析联网搜索任务配置

    Args:
        queries_file: 指定文件路径或 config/custom/search/ 下的文件名

    Returns:
        (topics, global_exclude_words, global_exclude_sites)

    Raises:
        FileNotFoundError: 搜索任务文件不存在
    """
    file_path = resolve_search_queries_path(queries_file)
    if not file_path.exists():
        raise FileNotFoundError(
            f"找不到联网搜索任务文件：{file_path}，请检查路径配置或先创建 config/search_queries.txt"
        )

    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    return parse_search_queries_content(content)
