# coding=utf-8
"""
Report Deduplication Plugin

This plugin merges similar news titles from different platforms, reducing duplicates
and presenting cleaner, more focused results.
"""

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Sequence

from loguru import logger

from .ollama_client import OllamaClient


# Regex to extract alphanumeric words (for English/numbers)
ALNUM_RE = re.compile(r"[a-zA-Z0-9]+")
# Regex to match Chinese characters (will be split individually)
CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")

# Module-level cache for deduplication results
_dedupe_cache = {}


def _generate_cache_key(report_data: Dict[str, Any]) -> str:
    """
    Generate a unique cache key from report data using MD5 hash.

    Args:
        report_data: Report data dictionary

    Returns:
        MD5 hash string of the serialized report data
    """
    data_str = json.dumps(report_data, sort_keys=True).encode()
    return hashlib.md5(data_str).hexdigest()


def transform_report_data(
    report_data: Dict[str, Any], config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Transform report data by deduplicating similar titles.

    Args:
        report_data: Report data dictionary
        config: Plugin configuration (runtime format with uppercase keys)

    Returns:
        Transformed report data with deduplicated titles
    """
    if not config or not config.get("enabled"):
        return report_data

    stats = report_data.get("stats", [])
    if not stats:
        return report_data

    # Default to "ollama" strategy for better deduplication accuracy
    strategy = str(config.get("strategy", "ollama")).lower()
    similarity_config = config.get("similarity", {})
    merge_config = config.get("merge", {})
    threshold = _coerce_float(similarity_config.get("threshold", 0.85), 0.85)
    max_ai_checks = _coerce_int(similarity_config.get("max_ai_checks", 50), 50)
    max_items_per_group = _coerce_int(merge_config.get("max_items_per_group", 10), 10)

    logger.debug(
        "[report_dedupe] Config: strategy={}, threshold={}, max_ai_checks={}",
        strategy,
        threshold,
        max_ai_checks,
    )

    client = None
    if strategy in ("ollama", "auto"):
        ollama_config = config.get("ollama", {})
        prompt_file = config.get("prompt_file")
        client = OllamaClient(
            ollama_config.get("base_url", "http://localhost:11434"),
            ollama_config.get("model", "qwen2.5:14b-instruct"),  # Default to qwen2.5
        )
        if not client.is_available():
            client = None
            logger.warning(
                "[report_dedupe] Ollama not available at {}, falling back to heuristic-only mode",
                ollama_config.get("base_url", "http://localhost:11434"),
            )

    ai_state = {"remaining": max_ai_checks, "client": client}

    # Count original titles before deduplication
    original_count = sum(len(stat.get("titles", [])) for stat in stats)
    logger.debug(
        "[report_dedupe] Processing {} stats with {} total titles",
        len(stats),
        original_count,
    )

    # Check cache before deduplication
    cache_key = _generate_cache_key(report_data)
    if cache_key in _dedupe_cache:
        logger.debug("[report_dedupe] Using cached deduplication result")
        return _dedupe_cache[cache_key]

    updated_stats = []
    for stat in stats:
        titles = stat.get("titles", [])
        merged_titles = _dedupe_titles(
            titles,
            threshold,
            merge_config,
            max_items_per_group,
            ai_state,
            strategy,
        )
        stat["titles"] = merged_titles
        stat["count"] = len(merged_titles)
        updated_stats.append(stat)

    total_count = sum(len(stat.get("titles", [])) for stat in updated_stats)
    for stat in updated_stats:
        if total_count > 0:
            stat["percentage"] = round(stat.get("count", 0) / total_count * 100, 1)
        else:
            stat["percentage"] = 0

    # Log deduplication results
    merged_count = total_count
    logger.info(
        "[report_dedupe] Deduplicated {} -> {} titles ({} removed)",
        original_count,
        merged_count,
        original_count - merged_count,
    )

    report_data["stats"] = updated_stats

    # Cache the result
    _dedupe_cache[cache_key] = report_data

    return report_data


def _dedupe_titles(
    titles: Sequence[Dict[str, Any]],
    threshold: float,
    merge_config: Dict[str, Any],
    max_items_per_group: int,
    ai_state: Dict[str, Any],
    strategy: str,
) -> List[Dict[str, Any]]:
    # Log titles being processed
    if len(titles) > 1:
        logger.debug("[report_dedupe] Processing {} titles in group", len(titles))
        for i, t in enumerate(titles[:5]):  # Log first 5 titles
            logger.debug(
                "[report_dedupe]   {}. {} | '{}'",
                i + 1,
                t.get("source_name", "?"),
                t.get("title", "")[:40],
            )

    groups: List[List[Dict[str, Any]]] = []
    for item in titles:
        placed = False
        for group in groups:
            if max_items_per_group > 0 and len(group) >= max_items_per_group:
                continue
            if _is_same_title(item, group[0], threshold, ai_state, strategy):
                group.append(item)
                placed = True
                break
        if not placed:
            groups.append([item])

    # Log groups with more than one item (actual merges)
    multi_groups = [g for g in groups if len(g) > 1]
    if multi_groups:
        for g in multi_groups:
            sources = [i.get("source_name", "?") for i in g]
            logger.debug(
                "[report_dedupe] Merged {} items from: {}", len(g), ", ".join(sources)
            )

    merged = [_merge_group(group, merge_config) for group in groups if group]
    merged.sort(key=_title_rank)
    return merged


def _is_same_title(
    first: Dict[str, Any],
    second: Dict[str, Any],
    threshold: float,
    ai_state: Dict[str, Any],
    strategy: str,
) -> bool:
    title_a = str(first.get("title", ""))
    title_b = str(second.get("title", ""))
    if not title_a or not title_b:
        return False

    normalized_a = _normalize_title(title_a)
    normalized_b = _normalize_title(title_b)
    if normalized_a and normalized_a == normalized_b:
        logger.debug(
            "[report_dedupe] Exact match: '{}' == '{}'", title_a[:30], title_b[:30]
        )
        return True

    tokens_a = _tokenize(normalized_a)
    tokens_b = _tokenize(normalized_b)
    jaccard = _jaccard_similarity(tokens_a, tokens_b)

    if jaccard >= threshold:
        logger.debug(
            "[report_dedupe] Jaccard match ({:.3f}): '{}' ~ '{}'",
            jaccard,
            title_a[:30],
            title_b[:30],
        )
        return True

    if strategy == "heuristic":
        return False

    client = ai_state.get("client")
    if client is None or ai_state.get("remaining", 0) <= 0:
        return False

    candidate_floor = max(0.2, threshold * 0.6)
    if jaccard < candidate_floor:
        return False

    # Use AI for borderline cases
    logger.debug(
        "[report_dedupe] AI check (jaccard={:.3f}): '{}' vs '{}'",
        jaccard,
        title_a[:30],
        title_b[:30],
    )
    ai_state["remaining"] -= 1
    result = client.judge_similarity(
        title_a,
        title_b,
        source_a=first.get("source_name", ""),
        source_b=second.get("source_name", ""),
        time_a=first.get("time_display", ""),
        time_b=second.get("time_display", ""),
        count_a=str(first.get("count", 1)),
        count_b=str(second.get("count", 1)),
    )
    if not result:
        logger.debug("[report_dedupe] AI returned no result")
        return False

    same = bool(result.get("same"))
    try:
        confidence = float(result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0

    if same and confidence >= threshold:
        logger.debug(
            "[report_dedupe] AI match (confidence={:.2f}): '{}' ~ '{}'",
            confidence,
            title_a[:30],
            title_b[:30],
        )
        return True
    else:
        logger.debug(
            "[report_dedupe] AI no match (same={}, conf={:.2f})", same, confidence
        )
        return False


def _merge_group(
    group: Sequence[Dict[str, Any]], merge_config: Dict[str, Any]
) -> Dict[str, Any]:
    source_separator = merge_config.get("source_separator", " / ")
    count_strategy = merge_config.get("count_strategy", "sum")

    canonical = min(group, key=_title_rank)
    merged = dict(canonical)

    sources = []
    seen_sources = set()
    for item in group:
        name = item.get("source_name")
        if name and name not in seen_sources:
            seen_sources.add(name)
            sources.append(name)
    if sources:
        merged["source_name"] = source_separator.join(sources)

    counts = [_coerce_int(item.get("count", 1), 1) for item in group]
    if count_strategy == "max":
        merged["count"] = max(counts)
    else:
        merged["count"] = sum(counts)

    merged["ranks"] = _merge_ranks(group)
    merged["is_new"] = any(item.get("is_new") for item in group)

    if not merged.get("time_display"):
        for item in group:
            if item.get("time_display"):
                merged["time_display"] = item["time_display"]
                break

    # Collect all unique URLs with their source names for multi-platform links
    urls = []
    seen_urls = set()
    for item in group:
        url = item.get("url") or item.get("mobile_url")
        source = item.get("source_name", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            urls.append({"url": url, "source": source})

    # Store all URLs for multi-platform display
    if urls:
        merged["urls"] = urls
        # Keep primary URL for backward compatibility
        merged["url"] = urls[0]["url"]
        # Find first mobile_url if available
        for item in group:
            if item.get("mobile_url"):
                merged["mobile_url"] = item["mobile_url"]
                break

    return merged


def _merge_ranks(group: Sequence[Dict[str, Any]]) -> List[int]:
    ranks: List[int] = []
    seen = set()
    for item in group:
        for rank in item.get("ranks", []) or []:
            if rank not in seen:
                seen.add(rank)
                ranks.append(rank)
    if not ranks:
        return [99]
    return sorted(ranks)


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _title_rank(item: Dict[str, Any]) -> int:
    ranks = item.get("ranks") or []
    if ranks:
        return min(ranks)
    return 999


def _normalize_title(title: str) -> str:
    text = title.strip().lower()
    text = re.sub(r"[\[【].*?[\]】]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tokenize(title: str) -> List[str]:
    """
    Tokenize title for similarity comparison.
    Chinese characters are split individually, alphanumeric words are kept together.
    """
    if not title:
        return []

    tokens = []
    # Add individual Chinese characters as tokens
    tokens.extend(CHINESE_RE.findall(title))
    # Add alphanumeric words as tokens (for English words, numbers, etc.)
    tokens.extend(ALNUM_RE.findall(title.lower()))
    return tokens


def _jaccard_similarity(tokens_a: Sequence[str], tokens_b: Sequence[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)
