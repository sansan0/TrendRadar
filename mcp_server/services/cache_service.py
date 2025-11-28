"""
缓存服务

实现TTL缓存机制，提升数据访问性能。
"""

import time
from typing import Any, Optional
from threading import Lock


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
