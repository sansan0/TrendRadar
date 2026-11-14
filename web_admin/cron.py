# coding=utf-8
"""最小化的 5 段 cron 解析器。

用于管理台的内置调度器，避免引入额外依赖。
支持：*  ,  -  /  ，以及 0/7 表示周日。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Set, Tuple

FIELD_RANGES = (
    ("minute", 0, 59),
    ("hour", 0, 23),
    ("day", 1, 31),
    ("month", 1, 12),
    ("weekday", 0, 6),
)

WEEKDAY_ALIASES = {
    "sun": 0,
    "mon": 1,
    "tue": 2,
    "wed": 3,
    "thu": 4,
    "fri": 5,
    "sat": 6,
}


class CronError(ValueError):
    """cron 表达式非法。"""


def _parse_number(token: str, lo: int, hi: int, *, weekday: bool = False) -> int:
    text = token.strip().lower()
    if weekday and text in WEEKDAY_ALIASES:
        return WEEKDAY_ALIASES[text]
    if not text.isdigit():
        raise CronError(f"无法识别的数字: {token}")
    value = int(text)
    if weekday and value == 7:
        value = 0
    if value < lo or value > hi:
        raise CronError(f"取值 {value} 超出范围 {lo}-{hi}")
    return value


def _parse_field(expr: str, lo: int, hi: int, *, weekday: bool = False) -> Set[int]:
    expr = expr.strip()
    if not expr:
        raise CronError("字段为空")
    values: Set[int] = set()
    for part in expr.split(","):
        part = part.strip()
        if not part:
            raise CronError("字段中存在空项")
        step = 1
        if "/" in part:
            base, step_text = part.split("/", 1)
            if not step_text.isdigit() or int(step_text) <= 0:
                raise CronError(f"步长非法: {part}")
            step = int(step_text)
        else:
            base = part

        if base in ("*", "?"):
            start, end = lo, hi
        elif "-" in base:
            start_text, end_text = base.split("-", 1)
            start = _parse_number(start_text, lo, hi, weekday=weekday)
            end = _parse_number(end_text, lo, hi, weekday=weekday)
            if start > end:
                raise CronError(f"范围起点大于终点: {base}")
        else:
            start = end = _parse_number(base, lo, hi, weekday=weekday)

        values.update(range(start, end + 1, step))
    return values


def parse(expr: str) -> Dict[str, Set[int]]:
    """解析 cron 表达式为各字段的取值集合。"""
    if not isinstance(expr, str):
        raise CronError("cron 表达式必须是字符串")
    parts = expr.split()
    if len(parts) != 5:
        raise CronError("cron 表达式必须包含 5 段：分 时 日 月 周")
    parsed: Dict[str, Set[int]] = {}
    for (name, lo, hi), part in zip(FIELD_RANGES, parts):
        parsed[name] = _parse_field(part, lo, hi, weekday=(name == "weekday"))
    return parsed


def validate(expr: str) -> Tuple[bool, str]:
    """校验表达式，返回 (是否合法, 错误信息)。"""
    try:
        parse(expr)
        return True, ""
    except CronError as exc:
        return False, str(exc)


def _weekday_cron(dt: datetime) -> int:
    # Python: 周一=0；cron: 周日=0
    return (dt.weekday() + 1) % 7


def matches(dt: datetime, parsed: Dict[str, Set[int]]) -> bool:
    """判断给定时间（精确到分钟）是否命中表达式。"""
    if dt.minute not in parsed["minute"] or dt.hour not in parsed["hour"]:
        return False
    if dt.month not in parsed["month"]:
        return False

    dom_restricted = len(parsed["day"]) != 31
    dow_restricted = len(parsed["weekday"]) != 7
    dom_ok = dt.day in parsed["day"]
    dow_ok = _weekday_cron(dt) in parsed["weekday"]

    if dom_restricted and dow_restricted:
        # cron 标准：两者都受限时满足其一即可
        return dom_ok or dow_ok
    return dom_ok and dow_ok


def next_run(
    expr: str, after: datetime | None = None, *, limit_days: int = 366
) -> datetime | None:
    """计算 after 之后（不含当前分钟）的下一次触发时间。"""
    parsed = parse(expr)
    current = (after or datetime.now()).replace(second=0, microsecond=0)
    current += timedelta(minutes=1)
    for _ in range(limit_days * 24 * 60):
        if matches(current, parsed):
            return current
        current += timedelta(minutes=1)
    return None


def describe(expr: str) -> str:
    """生成简短的中文描述。"""
    parsed = parse(expr)
    minute, hour = parsed["minute"], parsed["hour"]
    if len(minute) == 1 and len(hour) == 1:
        return f"每天 {sorted(hour)[0]:02d}:{sorted(minute)[0]:02d}"
    step = _single_step(expr.split()[0])
    if step and expr.split()[1:] == ["*", "*", "*", "*"]:
        return f"每 {step} 分钟"
    hour_step = _single_step(expr.split()[1])
    if hour_step and expr.split()[0] == "0" and expr.split()[2:] == ["*", "*", "*"]:
        return f"每 {hour_step} 小时"
    return "自定义计划"


def _single_step(field: str) -> int | None:
    if field.startswith("*/") and field[2:].isdigit():
        return int(field[2:])
    return None
