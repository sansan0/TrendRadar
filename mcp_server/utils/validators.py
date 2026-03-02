"""
参数验证工具

提供统一的参数验证功能。
支持 MCP 客户端将参数序列化为字符串的情况。
"""

from datetime import datetime
from typing import List, Optional, Union
import os
import json
import yaml
import ast

from .errors import InvalidParameterError
from .date_parser import DateParser


# ==================== 辅助函数：处理字符串序列化 ====================

def _parse_string_to_list(value: str) -> List[str]:
    """
    将字符串解析为列表

    支持格式：
    - JSON 数组: '["zhihu", "weibo"]'
    - Python 列表字符串: "['zhihu', 'weibo']"
    - 逗号分隔: "zhihu, weibo" 或 "zhihu,weibo"

    Args:
        value: 字符串值

    Returns:
        解析后的列表

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    if not value:
        return []

    # 尝试 JSON 解析: '["zhihu", "weibo"]'
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        # 如果解析结果不是列表，继续尝试其他方式
    except json.JSONDecodeError:
        pass

    # 尝试 Python 字面量解析: "['zhihu', 'weibo']"
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        if isinstance(parsed, str):
            # 单个字符串，包装成列表
            return [parsed]
    except (ValueError, SyntaxError):
        pass

    # 尝试逗号分隔: "zhihu, weibo" 或 "zhihu,weibo"
    if ',' in value:
        items = [item.strip() for item in value.split(',')]
        return [item for item in items if item]

    # 单个值
    return [value]


def _parse_string_to_int(value: str, param_name: str = "参数") -> int:
    """
    将字符串解析为整数

    Args:
        value: 字符串值
        param_name: 参数名（用于错误消息）

    Returns:
        解析后的整数

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    try:
        # 尝试直接转换
        return int(value)
    except ValueError:
        pass

    # 尝试解析浮点数后取整
    try:
        return int(float(value))
    except ValueError:
        raise InvalidParameterError(
            f"{param_name} 必须是整数，无法解析: {value}",
            suggestion=f"请提供有效的整数值，如: 10, 50, 100"
        )


def _parse_string_to_float(value: str, param_name: str = "参数") -> float:
    """
    将字符串解析为浮点数

    Args:
        value: 字符串值
        param_name: 参数名（用于错误消息）

    Returns:
        解析后的浮点数

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    try:
        return float(value)
    except ValueError:
        raise InvalidParameterError(
            f"{param_name} 必须是数字，无法解析: {value}",
            suggestion=f"请提供有效的数字值，如: 0.6, 3.0"
        )


def _parse_string_to_bool(value: str) -> bool:
    """
    将字符串解析为布尔值

    Args:
        value: 字符串值

    Returns:
        解析后的布尔值
    """
    value = value.strip().lower()

    if value in ('true', '1', 'yes', 'on'):
        return True
    elif value in ('false', '0', 'no', 'off', ''):
        return False
    else:
        # 默认非空字符串为 True
        return bool(value)


# 平台列表 mtime 缓存（避免每次 MCP 调用都重新读取 config.yaml）
_platforms_cache: Optional[List[str]] = None
_platforms_config_mtime: float = 0.0
_platforms_config_path: Optional[str] = None


def get_supported_platforms() -> List[str]:
    """
    从 config.yaml 动态获取支持的平台列表（带 mtime 缓存）

    仅当 config.yaml 被修改时才重新读取，避免每次 MCP 调用的重复 IO。

    Returns:
        平台ID列表

    Note:
        - 读取失败时返回空列表，允许所有平台通过（降级策略）
        - 平台列表来自 config/config.yaml 中的 platforms 配置
    """
    global _platforms_cache, _platforms_config_mtime, _platforms_config_path

    try:
        if _platforms_config_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            _platforms_config_path = os.path.normpath(
                os.path.join(current_dir, "..", "..", "config", "config.yaml")
            )

        current_mtime = os.path.getmtime(_platforms_config_path)

        if _platforms_cache is not None and current_mtime == _platforms_config_mtime:
            return _platforms_cache

        with open(_platforms_config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            platforms_config = config.get('platforms', {})
            sources = platforms_config.get('sources', [])
            _platforms_cache = [p['id'] for p in sources if 'id' in p]
            _platforms_config_mtime = current_mtime
            return _platforms_cache
    except Exception as e:
        print(f"警告：无法加载平台配置: {e}")
        return []


def validate_platforms(platforms: Optional[Union[List[str], str]]) -> List[str]:
    """
    验证平台列表

    Args:
        platforms: 平台ID列表或字符串，None表示使用 config.yaml 中配置的所有平台
                   支持多种格式：
                   - None: 使用默认平台
                   - ["zhihu", "weibo"]: JSON 数组
                   - '["zhihu", "weibo"]': JSON 数组字符串
                   - "['zhihu', 'weibo']": Python 列表字符串
                   - "zhihu, weibo": 逗号分隔字符串
                   - "zhihu": 单个平台字符串

    Returns:
        验证后的平台列表

    Raises:
        InvalidParameterError: 平台不支持

    Note:
        - platforms=None 时，返回 config.yaml 中配置的平台列表
        - 会验证平台ID是否在 config.yaml 的 platforms 配置中
        - 配置加载失败时，允许所有平台通过（降级策略）
    """
    supported_platforms = get_supported_platforms()

    if platforms is None:
        # 返回配置文件中的平台列表（用户的默认配置）
        return supported_platforms if supported_platforms else []

    # 支持字符串形式的列表输入（某些 MCP 客户端会将 JSON 数组序列化为字符串）
    if isinstance(platforms, str):
        platforms = _parse_string_to_list(platforms)
        if not platforms:
            # 空字符串或解析后为空，使用默认平台
            return supported_platforms if supported_platforms else []

    if not isinstance(platforms, list):
        raise InvalidParameterError("platforms 参数必须是列表类型")

    if not platforms:
        # 空列表时，返回配置文件中的平台列表
        return supported_platforms if supported_platforms else []

    # 如果配置加载失败（supported_platforms为空），允许所有平台通过
    if not supported_platforms:
        print("警告：平台配置未加载，跳过平台验证")
        return platforms

    # 验证每个平台是否在配置中
    invalid_platforms = [p for p in platforms if p not in supported_platforms]
    if invalid_platforms:
        raise InvalidParameterError(
            f"不支持的平台: {', '.join(invalid_platforms)}",
            suggestion=f"支持的平台（来自config.yaml）: {', '.join(supported_platforms)}"
        )

    return platforms


def validate_limit(limit: Optional[Union[int, str]], default: int = 20, max_limit: int = 1000) -> int:
    """
    验证数量限制参数

    Args:
        limit: 限制数量（整数或字符串）
        default: 默认值
        max_limit: 最大限制

    Returns:
        验证后的限制值

    Raises:
        InvalidParameterError: 参数无效
    """
    if limit is None:
        return default

    # 支持字符串形式的整数（某些 MCP 客户端会将数字序列化为字符串）
    if isinstance(limit, str):
        limit = _parse_string_to_int(limit, "limit")

    if not isinstance(limit, int):
        raise InvalidParameterError("limit 参数必须是整数类型")

    if limit <= 0:
        raise InvalidParameterError("limit 必须大于0")

    if limit > max_limit:
        raise InvalidParameterError(
            f"limit 不能超过 {max_limit}",
            suggestion=f"请使用分页或降低limit值"
        )

    return limit


def validate_date(date_str: str) -> datetime:
    """
    验证日期格式

    Args:
        date_str: 日期字符串 (YYYY-MM-DD)

    Returns:
        datetime对象

    Raises:
        InvalidParameterError: 日期格式错误
    """
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise InvalidParameterError(
            f"日期格式错误: {date_str}",
            suggestion="请使用 YYYY-MM-DD 格式，例如: 2025-10-11"
        )


def normalize_date_range(date_range: Optional[Union[dict, str]]) -> Optional[Union[dict, str]]:
    """
    规范化 date_range 参数

    某些 MCP 客户端（特别是 HTTP 方式）会将 JSON 对象序列化为字符串传入。
    此函数尝试将 JSON 字符串解析为 dict，如果不是 JSON 格式则保持原样。

    Args:
        date_range: 日期范围，可能是:
            - dict: {"start": "2025-01-01", "end": "2025-01-07"}
            - JSON 字符串: '{"start": "2025-01-01", "end": "2025-01-07"}'
            - 普通字符串: "今天", "昨天", "2025-01-01"
            - None

    Returns:
        规范化后的 date_range（dict 或普通字符串）

    Examples:
        >>> normalize_date_range('{"start":"2025-01-01","end":"2025-01-07"}')
        {"start": "2025-01-01", "end": "2025-01-07"}
        >>> normalize_date_range("今天")
        "今天"
        >>> normalize_date_range({"start": "2025-01-01", "end": "2025-01-07"})
        {"start": "2025-01-01", "end": "2025-01-07"}
    """
    if date_range is None:
        return None

    # 如果已经是 dict，直接返回
    if isinstance(date_range, dict):
        return date_range

    # 如果是字符串，尝试解析为 JSON
    if isinstance(date_range, str):
        # 检查是否看起来像 JSON 对象
        stripped = date_range.strip()
        if stripped.startswith('{') and stripped.endswith('}'):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass  # 解析失败，当作普通字符串处理

    return date_range


def validate_date_range(date_range: Optional[Union[dict, str]]) -> Optional[tuple]:
    """
    验证日期范围

    Args:
        date_range: 日期范围，支持多种格式：
            - dict: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
            - JSON 字符串: '{"start": "2025-01-01", "end": "2025-01-07"}'
            - 单日字符串: "2025-01-01"（自动转为同一天的范围）
            - 自然语言: "今天", "昨天", "本周", "最近7天" 等

    Returns:
        (start_date, end_date) 元组，或 None

    Raises:
        InvalidParameterError: 日期范围无效
    """
    if date_range is None:
        return None

    # 支持字符串形式的输入
    if isinstance(date_range, str):
        stripped = date_range.strip()

        # 1. 检查是否是 JSON 对象格式
        if stripped.startswith('{') and stripped.endswith('}'):
            try:
                date_range = json.loads(stripped)
            except json.JSONDecodeError as e:
                raise InvalidParameterError(
                    f"date_range JSON 解析失败: {e}",
                    suggestion='请使用正确的JSON格式: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}'
                )
        # 2. 检查是否是单日字符串格式 YYYY-MM-DD
        elif len(stripped) == 10 and stripped[4] == '-' and stripped[7] == '-':
            try:
                single_date = datetime.strptime(stripped, "%Y-%m-%d")
                return (single_date, single_date)
            except ValueError:
                raise InvalidParameterError(
                    f"日期格式错误: {stripped}",
                    suggestion="请使用 YYYY-MM-DD 格式，例如: 2025-10-11"
                )
        # 3. 尝试自然语言解析
        else:
            try:
                result = DateParser.resolve_date_range_expression(stripped)
                if result.get("success"):
                    dr = result["date_range"]
                    start_date = datetime.strptime(dr["start"], "%Y-%m-%d")
                    end_date = datetime.strptime(dr["end"], "%Y-%m-%d")
                    return (start_date, end_date)
                else:
                    raise InvalidParameterError(
                        f"无法识别的日期表达式: {stripped}",
                        suggestion="支持格式: YYYY-MM-DD, {\"start\": \"...\", \"end\": \"...\"}, 或自然语言（今天、本周、最近7天等）"
                    )
            except InvalidParameterError:
                raise
            except Exception:
                raise InvalidParameterError(
                    f"日期解析失败: {stripped}",
                    suggestion="支持格式: YYYY-MM-DD, {\"start\": \"...\", \"end\": \"...\"}, 或自然语言（今天、本周、最近7天等）"
                )

    if not isinstance(date_range, dict):
        raise InvalidParameterError(
            "date_range 必须是字典类型、日期字符串或有效的JSON字符串",
            suggestion='例如: {"start": "2025-10-01", "end": "2025-10-11"} 或 "2025-10-01"'
        )

    start_str = date_range.get("start")
    end_str = date_range.get("end")

    if not start_str or not end_str:
        raise InvalidParameterError(
            "date_range 必须包含 start 和 end 字段",
            suggestion='例如: {"start": "2025-10-01", "end": "2025-10-11"}'
        )

    start_date = validate_date(start_str)
    end_date = validate_date(end_str)

    if start_date > end_date:
        raise InvalidParameterError(
            "开始日期不能晚于结束日期",
            suggestion=f"start: {start_str}, end: {end_str}"
        )

    # 检查日期是否在未来
    today = datetime.now().date()
    if start_date.date() > today or end_date.date() > today:
        # 获取可用日期范围提示
        try:
            from ..services.data_service import DataService
            data_service = DataService()
            earliest, latest = data_service.get_available_date_range()

            if earliest and latest:
                available_range = f"{earliest.strftime('%Y-%m-%d')} 至 {latest.strftime('%Y-%m-%d')}"
            else:
                available_range = "无可用数据"
        except Exception:
            available_range = "未知（请检查 output 目录）"

        future_dates = []
        if start_date.date() > today:
            future_dates.append(start_str)
        if end_date.date() > today and end_str != start_str:
            future_dates.append(end_str)

        raise InvalidParameterError(
            f"不允许查询未来日期: {', '.join(future_dates)}（当前日期: {today.strftime('%Y-%m-%d')}）",
            suggestion=f"当前可用数据范围: {available_range}"
        )

    return (start_date, end_date)


def validate_keyword(keyword: str) -> str:
    """
    验证关键词

    Args:
        keyword: 搜索关键词

    Returns:
        处理后的关键词

    Raises:
        InvalidParameterError: 关键词无效
    """
    if not keyword:
        raise InvalidParameterError("keyword 不能为空")

    if not isinstance(keyword, str):
        raise InvalidParameterError("keyword 必须是字符串类型")

    keyword = keyword.strip()

    if not keyword:
        raise InvalidParameterError("keyword 不能为空白字符")

    if len(keyword) > 100:
        raise InvalidParameterError(
            "keyword 长度不能超过100个字符",
            suggestion="请使用更简洁的关键词"
        )

    return keyword


def validate_top_n(top_n: Optional[Union[int, str]], default: int = 10) -> int:
    """
    验证TOP N参数

    Args:
        top_n: TOP N数量（整数或字符串）
        default: 默认值

    Returns:
        验证后的值

    Raises:
        InvalidParameterError: 参数无效
    """
    return validate_limit(top_n, default=default, max_limit=100)


def validate_mode(mode: Optional[str], valid_modes: List[str], default: str) -> str:
    """
    验证模式参数

    Args:
        mode: 模式字符串
        valid_modes: 有效模式列表
        default: 默认模式

    Returns:
        验证后的模式

    Raises:
        InvalidParameterError: 模式无效
    """
    if mode is None:
        return default

    if not isinstance(mode, str):
        raise InvalidParameterError("mode 必须是字符串类型")

    if mode not in valid_modes:
        raise InvalidParameterError(
            f"无效的模式: {mode}",
            suggestion=f"支持的模式: {', '.join(valid_modes)}"
        )

    return mode


def validate_config_section(section: Optional[str]) -> str:
    """
    验证配置节参数

    Args:
        section: 配置节名称

    Returns:
        验证后的配置节

    Raises:
        InvalidParameterError: 配置节无效
    """
    valid_sections = ["all", "crawler", "push", "keywords", "weights"]
    return validate_mode(section, valid_sections, "all")


def validate_threshold(
    threshold: Optional[Union[float, int, str]],
    default: float = 0.6,
    min_value: float = 0.0,
    max_value: float = 1.0,
    param_name: str = "threshold"
) -> float:
    """
    验证阈值参数（浮点数）

    Args:
        threshold: 阈值（浮点数、整数或字符串）
        default: 默认值
        min_value: 最小值
        max_value: 最大值
        param_name: 参数名（用于错误消息）

    Returns:
        验证后的阈值

    Raises:
        InvalidParameterError: 参数无效
    """
    if threshold is None:
        return default

    # 支持字符串形式的数字（某些 MCP 客户端会将数字序列化为字符串）
    if isinstance(threshold, str):
        threshold = _parse_string_to_float(threshold, param_name)

    # 整数转浮点数
    if isinstance(threshold, int):
        threshold = float(threshold)

    if not isinstance(threshold, float):
        raise InvalidParameterError(
            f"{param_name} 必须是数字类型",
            suggestion=f"请提供 {min_value} 到 {max_value} 之间的数字"
        )

    if threshold < min_value or threshold > max_value:
        raise InvalidParameterError(
            f"{param_name} 必须在 {min_value} 到 {max_value} 之间，当前值: {threshold}",
            suggestion=f"推荐值: {default}"
        )

    return threshold


def validate_date_query(
    date_query: str,
    allow_future: bool = False,
    max_days_ago: int = 365
) -> datetime:
    """
    验证并解析日期查询字符串

    Args:
        date_query: 日期查询字符串
        allow_future: 是否允许未来日期
        max_days_ago: 允许查询的最大天数

    Returns:
        解析后的datetime对象

    Raises:
        InvalidParameterError: 日期查询无效

    Examples:
        >>> validate_date_query("昨天")
        datetime(2025, 10, 10)
        >>> validate_date_query("2025-10-10")
        datetime(2025, 10, 10)
    """
    if not date_query:
        raise InvalidParameterError(
            "日期查询字符串不能为空",
            suggestion="请提供日期查询，如：今天、昨天、2025-10-10"
        )

    # 使用DateParser解析日期
    parsed_date = DateParser.parse_date_query(date_query)

    # 验证日期不在未来
    if not allow_future:
        DateParser.validate_date_not_future(parsed_date)

    # 验证日期不太久远
    DateParser.validate_date_not_too_old(parsed_date, max_days=max_days_ago)

    return parsed_date

