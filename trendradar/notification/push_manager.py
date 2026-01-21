# coding=utf-8
"""
推送记录管理模块

管理推送记录，支持每日只推送一次和时间窗口控制
通过 storage_backend 统一存储，支持本地 SQLite 和远程云存储
"""

from datetime import datetime
from typing import Callable, Optional, Any

import pytz


class PushRecordManager:
    """
    推送记录管理器

    通过 storage_backend 统一管理推送记录：
    - 本地环境：使用 LocalStorageBackend，数据存储在本地 SQLite
    - GitHub Actions：使用 RemoteStorageBackend，数据存储在云端

    这样 once_per_day 功能在 GitHub Actions 上也能正常工作。
    """

    def __init__(
        self,
        storage_backend: Any,
        get_time_func: Optional[Callable[[], datetime]] = None,
    ):
        """
        初始化推送记录管理器

        Args:
            storage_backend: 存储后端实例（LocalStorageBackend 或 RemoteStorageBackend）
            get_time_func: 获取当前时间的函数（应使用配置的时区）
        """
        self.storage_backend = storage_backend
        self.get_time = get_time_func or self._default_get_time

        print(f"[推送记录] 使用 {storage_backend.backend_name} 存储后端")

    def _default_get_time(self) -> datetime:
        """默认时间获取函数（使用 storage_backend 的时区配置）"""
        timezone = getattr(self.storage_backend, 'timezone', 'Asia/Shanghai')
        return datetime.now(pytz.timezone(timezone))

    def has_pushed_today(self) -> bool:
        """
        检查今天是否已经推送过

        Returns:
            是否已推送
        """
        return self.storage_backend.has_pushed_today()

    def record_push(self, report_type: str) -> bool:
        """
        记录推送

        Args:
            report_type: 报告类型

        Returns:
            是否记录成功
        """
        return self.storage_backend.record_push(report_type)

    def is_in_time_range(self, start_time: str, end_time: str) -> bool:
        """
        检查当前时间是否在指定时间范围内

        Args:
            start_time: 开始时间（格式：HH:MM）
            end_time: 结束时间（格式：HH:MM）

        Returns:
            是否在时间范围内
        """
        now = self.get_time()
        current_time = now.strftime("%H:%M")

        def normalize_time(time_str: str) -> str:
            """将时间字符串标准化为 HH:MM 格式"""
            try:
                parts = time_str.strip().split(":")
                if len(parts) != 2:
                    raise ValueError(f"时间格式错误: {time_str}")

                hour = int(parts[0])
                minute = int(parts[1])

                if not (0 <= hour <= 23 and 0 <= minute <= 59):
                    raise ValueError(f"时间范围错误: {time_str}")

                return f"{hour:02d}:{minute:02d}"
            except Exception as e:
                print(f"时间格式化错误 '{time_str}': {e}")
                return time_str

        normalized_start = normalize_time(start_time)
        normalized_end = normalize_time(end_time)
        normalized_current = normalize_time(current_time)

        result = normalized_start <= normalized_current <= normalized_end

        if not result:
            print(f"时间窗口判断：当前 {normalized_current}，窗口 {normalized_start}-{normalized_end}")

        return result
