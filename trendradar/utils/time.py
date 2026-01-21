# coding=utf-8
"""
时间工具模块 - 统一时间处理函数
"""

from datetime import datetime
from typing import Optional

import pytz

# 默认时区
DEFAULT_TIMEZONE = "Asia/Shanghai"


def get_configured_time(timezone: str = DEFAULT_TIMEZONE) -> datetime:
    """
    获取配置时区的当前时间

    Args:
        timezone: 时区名称，如 'Asia/Shanghai', 'America/Los_Angeles'

    Returns:
        带时区信息的当前时间
    """
    try:
        tz = pytz.timezone(timezone)
    except pytz.UnknownTimeZoneError:
        print(f"[警告] 未知时区 '{timezone}'，使用默认时区 {DEFAULT_TIMEZONE}")
        tz = pytz.timezone(DEFAULT_TIMEZONE)
    return datetime.now(tz)


def format_date_folder(
    date: Optional[str] = None, timezone: str = DEFAULT_TIMEZONE
) -> str:
    """
    格式化日期文件夹名 (ISO 格式: YYYY-MM-DD)

    Args:
        date: 指定日期字符串，为 None 则使用当前日期
        timezone: 时区名称

    Returns:
        格式化后的日期字符串，如 '2025-12-09'
    """
    if date:
        return date
    return get_configured_time(timezone).strftime("%Y-%m-%d")


def format_time_filename(timezone: str = DEFAULT_TIMEZONE) -> str:
    """
    格式化时间文件名 (格式: HH-MM，用于文件名)

    Windows 系统不支持冒号作为文件名，因此使用连字符

    Args:
        timezone: 时区名称

    Returns:
        格式化后的时间字符串，如 '15-30'
    """
    return get_configured_time(timezone).strftime("%H-%M")


def get_current_time_display(timezone: str = DEFAULT_TIMEZONE) -> str:
    """
    获取当前时间显示 (格式: HH:MM，用于显示)

    Args:
        timezone: 时区名称

    Returns:
        格式化后的时间字符串，如 '15:30'
    """
    return get_configured_time(timezone).strftime("%H:%M")


def convert_time_for_display(time_str: str) -> str:
    """
    将 HH-MM 格式转换为 HH:MM 格式用于显示

    Args:
        time_str: 输入时间字符串，如 '15-30'

    Returns:
        转换后的时间字符串，如 '15:30'
    """
    if time_str and "-" in time_str and len(time_str) == 5:
        return time_str.replace("-", ":")
    return time_str


def format_iso_time_friendly(
    iso_time: str,
    timezone: str = DEFAULT_TIMEZONE,
    include_date: bool = True,
) -> str:
    """
    将 ISO 格式时间转换为用户时区的友好显示格式

    Args:
        iso_time: ISO 格式时间字符串，如 '2025-12-29T00:20:00' 或 '2025-12-29T00:20:00+00:00'
        timezone: 目标时区名称
        include_date: 是否包含日期部分

    Returns:
        友好格式的时间字符串，如 '12-29 08:20' 或 '08:20'
    """
    if not iso_time:
        return ""

    try:
        # 尝试解析各种 ISO 格式
        dt = None

        # 尝试解析带时区的格式
        if "+" in iso_time or iso_time.endswith("Z"):
            iso_time = iso_time.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(iso_time)
            except ValueError:
                pass

        # 尝试解析不带时区的格式（假设为 UTC）
        if dt is None:
            try:
                # 处理 T 分隔符
                if "T" in iso_time:
                    dt = datetime.fromisoformat(iso_time.replace("T", " ").split(".")[0])
                else:
                    dt = datetime.fromisoformat(iso_time.split(".")[0])
                # 假设为 UTC 时间
                dt = pytz.UTC.localize(dt)
            except ValueError:
                pass

        if dt is None:
            # 无法解析，返回原始字符串的简化版本
            if "T" in iso_time:
                parts = iso_time.split("T")
                if len(parts) == 2:
                    date_part = parts[0][5:]  # MM-DD
                    time_part = parts[1][:5]  # HH:MM
                    return f"{date_part} {time_part}" if include_date else time_part
            return iso_time

        # 转换到目标时区
        try:
            target_tz = pytz.timezone(timezone)
        except pytz.UnknownTimeZoneError:
            target_tz = pytz.timezone(DEFAULT_TIMEZONE)

        dt_local = dt.astimezone(target_tz)

        # 格式化输出
        if include_date:
            return dt_local.strftime("%m-%d %H:%M")
        else:
            return dt_local.strftime("%H:%M")

    except Exception:
        # 出错时返回原始字符串的简化版本
        if "T" in iso_time:
            parts = iso_time.split("T")
            if len(parts) == 2:
                date_part = parts[0][5:]  # MM-DD
                time_part = parts[1][:5]  # HH:MM
                return f"{date_part} {time_part}" if include_date else time_part
        return iso_time


def is_within_days(
    iso_time: str,
    max_days: int,
    timezone: str = DEFAULT_TIMEZONE,
) -> bool:
    """
    检查 ISO 格式时间是否在指定天数内

    用于 RSS 文章新鲜度过滤，判断文章发布时间是否超过指定天数。

    Args:
        iso_time: ISO 格式时间字符串（如 '2025-12-29T00:20:00' 或带时区）
        max_days: 最大天数（文章发布时间距今不超过此天数则返回 True）
            - max_days > 0: 正常过滤，保留 N 天内的文章
            - max_days <= 0: 禁用过滤，保留所有文章
        timezone: 时区名称（用于获取当前时间）

    Returns:
        True 如果时间在指定天数内（应保留），False 如果超过指定天数（应过滤）
        如果无法解析时间，返回 True（保留文章）
    """
    # 无时间戳或禁用过滤时，保留文章
    if not iso_time:
        return True
    if max_days <= 0:
        return True  # max_days=0 表示禁用过滤

    try:
        dt = None

        # 尝试解析带时区的格式
        if "+" in iso_time or iso_time.endswith("Z"):
            iso_time_normalized = iso_time.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(iso_time_normalized)
            except ValueError:
                pass

        # 尝试解析不带时区的格式（假设为 UTC）
        if dt is None:
            try:
                if "T" in iso_time:
                    dt = datetime.fromisoformat(iso_time.replace("T", " ").split(".")[0])
                else:
                    dt = datetime.fromisoformat(iso_time.split(".")[0])
                dt = pytz.UTC.localize(dt)
            except ValueError:
                pass

        if dt is None:
            # 无法解析时间，保留文章
            return True

        # 获取当前时间（配置的时区，带时区信息）
        now = get_configured_time(timezone)

        # 计算时间差（两个带时区的 datetime 相减会自动处理时区差异）
        diff = now - dt
        days_diff = diff.total_seconds() / (24 * 60 * 60)

        return days_diff <= max_days

    except Exception:
        # 出错时保留文章
        return True
