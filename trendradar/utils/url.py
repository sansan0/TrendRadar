# coding=utf-8
"""
URL 处理工具模块

提供 URL 标准化功能，用于去重时消除动态参数的影响：
- normalize_url: 标准化 URL，去除动态参数
"""

from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from typing import Dict, Set


# 各平台需要移除的特定参数
#   - weibo: 有 band_rank（排名）和 Refer（来源）动态参数
#   - 其他平台: URL 为路径格式或简单关键词查询，无需处理
PLATFORM_PARAMS_TO_REMOVE: Dict[str, Set[str]] = {
    # 微博：band_rank 是动态排名参数，Refer 是来源参数，t 是时间范围参数
    # 示例：https://s.weibo.com/weibo?q=xxx&t=31&band_rank=1&Refer=top
    # 保留：q（关键词）
    # 移除：band_rank, Refer, t
    "weibo": {"band_rank", "Refer", "t"},
}

# 通用追踪参数（适用于所有平台）
# 这些参数通常由分享链接或广告追踪添加，不影响内容识别
COMMON_TRACKING_PARAMS: Set[str] = {
    # UTM 追踪参数
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    # 常见追踪参数
    "ref", "referrer", "source", "channel",
    # 时间戳和随机参数
    "_t", "timestamp", "_", "random",
    # 分享相关
    "share_token", "share_id", "share_from",
}


def normalize_url(url: str, platform_id: str = "") -> str:
    """
    标准化 URL，去除动态参数

    用于数据库去重，确保同一条新闻的不同 URL 变体能被正确识别为同一条。

    处理规则：
    1. 去除平台特定的动态参数（如微博的 band_rank）
    2. 去除通用追踪参数（如 utm_*）
    3. 保留核心查询参数（如搜索关键词 q=, wd=, keyword=）
    4. 对查询参数按字母序排序（确保一致性）

    Args:
        url: 原始 URL
        platform_id: 平台 ID，用于应用平台特定规则

    Returns:
        标准化后的 URL

    Examples:
        >>> normalize_url("https://s.weibo.com/weibo?q=test&band_rank=6&Refer=top", "weibo")
        'https://s.weibo.com/weibo?q=test'

        >>> normalize_url("https://example.com/page?id=1&utm_source=twitter", "")
        'https://example.com/page?id=1'
    """
    if not url:
        return url

    try:
        # 解析 URL
        parsed = urlparse(url)

        # 如果没有查询参数，直接返回
        if not parsed.query:
            return url

        # 解析查询参数
        params = parse_qs(parsed.query, keep_blank_values=True)

        # 收集需要移除的参数（使用小写进行比较）
        params_to_remove: Set[str] = set()

        # 添加通用追踪参数
        params_to_remove.update(COMMON_TRACKING_PARAMS)

        # 添加平台特定参数
        if platform_id and platform_id in PLATFORM_PARAMS_TO_REMOVE:
            params_to_remove.update(PLATFORM_PARAMS_TO_REMOVE[platform_id])

        # 过滤参数（参数名转小写进行比较）
        filtered_params = {
            key: values
            for key, values in params.items()
            if key.lower() not in {p.lower() for p in params_to_remove}
        }

        # 如果过滤后没有参数了，返回不带查询字符串的 URL
        if not filtered_params:
            return urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                "",  # 空查询字符串
                ""   # 移除 fragment
            ))

        # 重建查询字符串（按字母序排序以确保一致性）
        sorted_params = []
        for key in sorted(filtered_params.keys()):
            for value in filtered_params[key]:
                sorted_params.append((key, value))

        new_query = urlencode(sorted_params)

        # 重建 URL（移除 fragment）
        normalized = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            ""  # 移除 fragment
        ))

        return normalized

    except Exception:
        # 解析失败时返回原始 URL
        return url


def get_url_signature(url: str, platform_id: str = "") -> str:
    """
    获取 URL 的签名（用于快速比较）

    基于标准化 URL 生成签名，可用于：
    - 快速判断两个 URL 是否指向同一内容
    - 作为缓存键

    Args:
        url: 原始 URL
        platform_id: 平台 ID

    Returns:
        URL 签名字符串
    """
    return normalize_url(url, platform_id)
