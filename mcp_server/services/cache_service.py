"""
缓存服务

实现TTL缓存机制，提升数据访问性能。
"""

import hashlib
import json
import time
from typing import Any, Optional
from threading import Lock


def make_cache_key(namespace: str, **params) -> str:
    """
    生成结构化缓存 key

    通过对参数排序和哈希，确保相同参数组合总是生成相同的 key。

    Args:
        namespace: 缓存命名空间，如 "latest_news", "trending_topics"
        **params: 缓存参数

    Returns:
        格式化的缓存 key，如 "latest_news:a1b2c3d4"

    Examples:
        >>> make_cache_key("latest_news", platforms=["zhihu"], limit=50)
        'latest_news:8f14e45f'
        >>> make_cache_key("search", query="AI", mode="keyword")
        'search:3c6e0b8a'
    """
    if not params:
        return namespace

    # 对参数进行规范化处理
    normalized_params = {}
    for k, v in params.items():
        if v is None:
            continue  # 跳过 None 值
        elif isinstance(v, (list, tuple)):
            # 列表排序后转为字符串
            normalized_params[k] = json.dumps(sorted(v) if all(isinstance(i, str) for i in v) else list(v), ensure_ascii=False)
        elif isinstance(v, dict):
            # 字典按键排序后转为字符串
            normalized_params[k] = json.dumps(v, sort_keys=True, ensure_ascii=False)
        else:
            normalized_params[k] = str(v)

    # 排序参数并生成哈希
    sorted_params = sorted(normalized_params.items())
    param_str = "&".join(f"{k}={v}" for k, v in sorted_params)

    # 使用 MD5 生成短哈希（取前8位）
    hash_value = hashlib.md5(param_str.encode('utf-8')).hexdigest()[:8]

    return f"{namespace}:{hash_value}"


class CacheService:
    """缓存服务类"""

    def __init__(self):
        """初始化缓存服务"""
        self._cache = {}
        self._timestamps = {}
        self._lock = Lock()

    def get(self, key: str, ttl: int = 900) -> Optional[Any]:
        """
        获取缓存数据

        Args:
            key: 缓存键
            ttl: 存活时间（秒），默认15分钟

        Returns:
            缓存的值，如果不存在或已过期则返回None
        """
        with self._lock:
            if key in self._cache:
                # 检查是否过期
                if time.time() - self._timestamps[key] < ttl:
                    return self._cache[key]
                else:
                    # 已过期，删除缓存
                    del self._cache[key]
                    del self._timestamps[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """
        设置缓存数据

        Args:
            key: 缓存键
            value: 缓存值
        """
        with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()

    def delete(self, key: str) -> bool:
        """
        删除缓存

        Args:
            key: 缓存键

        Returns:
            是否成功删除
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                del self._timestamps[key]
                return True
        return False

    def clear(self) -> None:
        """清空所有缓存"""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()

    def cleanup_expired(self, ttl: int = 900) -> int:
        """
        清理过期缓存

        Args:
            ttl: 存活时间（秒）

        Returns:
            清理的条目数量
        """
        with self._lock:
            current_time = time.time()
            expired_keys = [
                key for key, timestamp in self._timestamps.items()
                if current_time - timestamp >= ttl
            ]

            for key in expired_keys:
                del self._cache[key]
                del self._timestamps[key]

            return len(expired_keys)

    def get_stats(self) -> dict:
        """
        获取缓存统计信息

        Returns:
            统计信息字典
        """
        with self._lock:
            return {
                "total_entries": len(self._cache),
                "oldest_entry_age": (
                    time.time() - min(self._timestamps.values())
                    if self._timestamps else 0
                ),
                "newest_entry_age": (
                    time.time() - max(self._timestamps.values())
                    if self._timestamps else 0
                )
            }


# 全局缓存实例
_global_cache = None


def get_cache() -> CacheService:
    """
    获取全局缓存实例

    Returns:
        全局缓存服务实例
    """
    global _global_cache
    if _global_cache is None:
        _global_cache = CacheService()
    return _global_cache
