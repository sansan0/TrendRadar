# coding=utf-8
"""
时间线调度器

统一的时间线调度系统，替代分散的 push_window / analysis_window 逻辑。
基于 periods + day_plans + week_map 模型实现灵活的时间段调度。
"""

import copy
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from datetime import datetime


@dataclass
class ResolvedSchedule:
    """当前时间解析后的调度结果"""
    period_key: Optional[str]       # 命中的 period key，None=默认配置
    period_name: Optional[str]      # 命中的展示名称
    day_plan: str                   # 当前日计划
    collect: bool
    analyze: bool
    push: bool
    report_mode: str
    ai_mode: str
    once_analyze: bool
    once_push: bool


class Scheduler:
    """
    时间线调度器

    根据 timeline 配置（periods + day_plans + week_map）解析当前时间应执行的行为。
    支持：
    - 预设模板 + 自定义模式
    - 跨日时间段（如 22:00-07:00）
    - 每天 / 每周差异化配置
    - once 执行去重（analyze / push 独立维度）
    - 冲突策略（error_on_overlap / last_wins）
    """

    def __init__(
        self,
        schedule_config: Dict[str, Any],
        timeline_data: Dict[str, Any],
        storage_backend: Any,
        get_time_func: Callable[[], datetime],
    ):
        """
        初始化调度器

        Args:
            schedule_config: config.yaml 中的 schedule 段（含 preset 等）
            timeline_data: timeline.yaml 的完整数据
            storage_backend: 存储后端（用于 once 去重记录）
            get_time_func: 获取当前时间的函数（应使用配置的时区）
        """
        self.schedule_config = schedule_config
        self.storage = storage_backend
        self.get_time = get_time_func
        self.enabled = schedule_config.get("enabled", True)

        # 加载并构建最终 timeline
        self.timeline = self._build_timeline(schedule_config, timeline_data)
        if self.enabled:
            self._validate_timeline(self.timeline)

    def _build_timeline(
        self,
        schedule_config: Dict[str, Any],
        timeline_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """从 preset 或 custom 构建 timeline"""
        preset = schedule_config.get("preset", "always_on")

        if preset == "custom":
            timeline = copy.deepcopy(timeline_data.get("custom", {}))
        else:
            presets = timeline_data.get("presets", {})
            if preset not in presets:
                raise ValueError(
                    f"未知的预设模板: '{preset}'，可选值: "
                    f"{', '.join(presets.keys())}, custom"
                )
            timeline = copy.deepcopy(presets[preset])

        # 确保 periods 是 dict（可能为空 {}）
        if timeline.get("periods") is None:
            timeline["periods"] = {}

        return timeline

    def resolve(self) -> ResolvedSchedule:
        """
        解析当前时间对应的调度配置

        Returns:
            ResolvedSchedule 包含当前应执行的行为
        """
        if not self.enabled:
            # 调度未启用时返回默认的全功能配置
            return ResolvedSchedule(
                period_key=None,
                period_name=None,
                day_plan="disabled",
                collect=True,
                analyze=True,
                push=True,
                report_mode="current",
                ai_mode="follow_report",
                once_analyze=False,
                once_push=False,
            )

        now = self.get_time()
        weekday = now.isoweekday()  # 1=周一 ... 7=周日
        now_hhmm = now.strftime("%H:%M")

        # 查找当天的日计划
        day_plan_key = self.timeline["week_map"].get(weekday)
        if day_plan_key is None:
            raise ValueError(f"week_map 缺少星期映射: {weekday}")

        day_plan = self.timeline["day_plans"].get(day_plan_key)
        if day_plan is None:
            raise ValueError(f"week_map[{weekday}] 引用了不存在的 day_plan: {day_plan_key}")

        # 查找当前活跃的时间段
        period_key = self._find_active_period(now_hhmm, day_plan)

        # 合并默认配置和时间段配置
        merged = self._merge_with_default(period_key)

        # 打印调度日志
        weekday_names = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"}
        period_display = "默认配置（未命中任何时间段）"
        if period_key:
            period_cfg = self.timeline["periods"][period_key]
            period_name = period_cfg.get("name", period_key)
            start = period_cfg.get("start", "?")
            end = period_cfg.get("end", "?")
            period_display = f"{period_name} ({start}-{end})"

        print(f"[调度] 星期{weekday_names.get(weekday, '?')}，日计划: {day_plan_key}")
        print(f"[调度] 当前时间段: {period_display}")

        resolved = ResolvedSchedule(
            period_key=period_key,
            period_name=(
                self.timeline["periods"][period_key].get("name")
                if period_key
                else None
            ),
            day_plan=day_plan_key,
            collect=merged.get("collect", True),
            analyze=merged.get("analyze", False),
            push=merged.get("push", False),
            report_mode=merged.get("report_mode", "current"),
            ai_mode=self._resolve_ai_mode(merged),
            once_analyze=merged.get("once", {}).get("analyze", False),
            once_push=merged.get("once", {}).get("push", False),
        )

        # 打印行为摘要
        actions = []
        if resolved.collect:
            actions.append("采集")
        if resolved.analyze:
            actions.append(f"分析(AI:{resolved.ai_mode})")
        if resolved.push:
            actions.append(f"推送(模式:{resolved.report_mode})")
        print(f"[调度] 行为: {', '.join(actions) if actions else '无'}")

        return resolved

    def _find_active_period(
        self, now_hhmm: str, day_plan: Dict[str, Any]
    ) -> Optional[str]:
        """
        查找当前时间命中的活跃时间段

        Args:
            now_hhmm: 当前时间 HH:MM
            day_plan: 日计划配置

        Returns:
            命中的 period key，或 None
        """
        candidates = []
        for idx, key in enumerate(day_plan.get("periods", [])):
            period = self.timeline["periods"].get(key)
            if period is None:
                continue
            if self._in_range(now_hhmm, period["start"], period["end"]):
                candidates.append((idx, key))

        if not candidates:
            return None

        # 检查冲突
        if len(candidates) > 1:
            policy = self.timeline.get("overlap", {}).get("policy", "error_on_overlap")
            conflicting = [c[1] for c in candidates]

            if policy == "error_on_overlap":
                raise ValueError(
                    f"检测到时间段重叠冲突: {', '.join(conflicting)} 在 {now_hhmm} 重叠。"
                    f"请调整时间段配置，或将 overlap.policy 设为 'last_wins'"
                )

            # last_wins：输出重叠警告，列表中后面的优先
            print(
                f"[调度] 检测到时间段重叠: {', '.join(conflicting)} 在 {now_hhmm} 重叠"
            )
            winner = candidates[-1]
            print(f"[调度] 冲突策略: last_wins，生效时间段: {winner[1]}")
            return winner[1]

        return candidates[0][1]

    @staticmethod
    def _in_range(now_hhmm: str, start: str, end: str) -> bool:
        """
        检查时间是否在范围内（支持跨日）

        Args:
            now_hhmm: 当前时间 HH:MM
            start: 开始时间 HH:MM
            end: 结束时间 HH:MM

        Returns:
            是否在范围内
        """
        if start <= end:
            # 正常范围，如 08:00-09:00
            return start <= now_hhmm <= end
        else:
            # 跨日范围，如 22:00-07:00
            return now_hhmm >= start or now_hhmm <= end

    def _merge_with_default(self, period_key: Optional[str]) -> Dict[str, Any]:
        """合并默认配置和时间段配置"""
        base = copy.deepcopy(self.timeline.get("default", {}))
        if not period_key:
            return base

        period = copy.deepcopy(self.timeline["periods"][period_key])

        # 先合并 once 子对象
        merged_once = dict(base.get("once", {}))
        merged_once.update(period.get("once", {}))

        # 标量字段覆盖
        base.update(period)

        # 恢复合并后的 once
        if merged_once:
            base["once"] = merged_once

        return base

    @staticmethod
    def _resolve_ai_mode(cfg: Dict[str, Any]) -> str:
        """解析最终的 AI 模式"""
        ai_mode = cfg.get("ai_mode", "follow_report")
        if ai_mode == "follow_report":
            return cfg.get("report_mode", "current")
        return ai_mode

    def already_executed(self, period_key: str, action: str, date_str: str) -> bool:
        """
        检查指定时间段的某个 action 今天是否已执行

        Args:
            period_key: 时间段 key
            action: 动作类型 (analyze / push)
            date_str: 日期 YYYY-MM-DD

        Returns:
            是否已执行
        """
        return self.storage.has_period_executed(date_str, period_key, action)

    def record_execution(self, period_key: str, action: str, date_str: str) -> None:
        """
        记录时间段的 action 执行

        Args:
            period_key: 时间段 key
            action: 动作类型 (analyze / push)
            date_str: 日期 YYYY-MM-DD
        """
        self.storage.record_period_execution(date_str, period_key, action)

    # ========================================
    # 校验
    # ========================================

    def _validate_timeline(self, timeline: Dict[str, Any]) -> None:
        """
        启动时校验 timeline 配置

        Raises:
            ValueError: 配置不合法时抛出
        """
        required_top_keys = ["default", "periods", "day_plans", "week_map"]
        for key in required_top_keys:
            if key not in timeline:
                raise ValueError(f"timeline 缺少必须字段: {key}")

        # week_map 必须覆盖 1..7
        for day in range(1, 8):
            if day not in timeline["week_map"]:
                raise ValueError(f"week_map 缺少星期映射: {day}")

        # day_plan 引用完整性
        for day, plan_key in timeline["week_map"].items():
            if plan_key not in timeline["day_plans"]:
                raise ValueError(
                    f"week_map[{day}] 引用了不存在的 day_plan: {plan_key}"
                )

        # period 引用完整性
        for plan_key, plan in timeline["day_plans"].items():
            for period_key in plan.get("periods", []):
                if period_key not in timeline["periods"]:
                    raise ValueError(
                        f"day_plan[{plan_key}] 引用了不存在的 period: {period_key}"
                    )

        # 时间格式校验
        for period_key, period in timeline["periods"].items():
            if "start" not in period or "end" not in period:
                raise ValueError(
                    f"period '{period_key}' 缺少 start 或 end 字段"
                )
            self._validate_hhmm(period["start"], f"{period_key}.start")
            self._validate_hhmm(period["end"], f"{period_key}.end")
            if period["start"] == period["end"]:
                raise ValueError(
                    f"period '{period_key}' 的 start 与 end 不能相同: {period['start']}"
                )

        # 检查冲突策略下的重叠
        policy = timeline.get("overlap", {}).get("policy", "error_on_overlap")
        if policy == "error_on_overlap":
            self._check_period_overlaps(timeline)

    def _check_period_overlaps(self, timeline: Dict[str, Any]) -> None:
        """
        检查每个日计划中的时间段是否存在重叠

        仅在 overlap.policy == "error_on_overlap" 时调用
        """
        periods = timeline.get("periods", {})

        for plan_key, plan in timeline["day_plans"].items():
            period_keys = plan.get("periods", [])
            if len(period_keys) <= 1:
                continue

            # 收集每个时间段的范围
            ranges = []
            for pk in period_keys:
                p = periods.get(pk, {})
                if "start" in p and "end" in p:
                    ranges.append((pk, p["start"], p["end"]))

            # 两两检查重叠
            for i in range(len(ranges)):
                for j in range(i + 1, len(ranges)):
                    if self._ranges_overlap(
                        ranges[i][1], ranges[i][2],
                        ranges[j][1], ranges[j][2],
                    ):
                        raise ValueError(
                            f"day_plan '{plan_key}' 中时间段 '{ranges[i][0]}' "
                            f"({ranges[i][1]}-{ranges[i][2]}) 与 '{ranges[j][0]}' "
                            f"({ranges[j][1]}-{ranges[j][2]}) 存在重叠。"
                            f"请调整时间段，或将 overlap.policy 设为 'last_wins'"
                        )

    @staticmethod
    def _ranges_overlap(s1: str, e1: str, s2: str, e2: str) -> bool:
        """检查两个时间范围是否重叠（支持跨日）"""
        def to_minutes(t: str) -> int:
            h, m = t.split(":")
            return int(h) * 60 + int(m)

        def expand_range(start: str, end: str) -> List[tuple]:
            """将时间范围展开为分钟段列表，跨日时拆分为两段"""
            s = to_minutes(start)
            e = to_minutes(end)
            if s <= e:
                return [(s, e)]
            else:
                # 跨日：拆分为 [start, 23:59] 和 [00:00, end]
                return [(s, 24 * 60 - 1), (0, e)]

        segs1 = expand_range(s1, e1)
        segs2 = expand_range(s2, e2)

        for a_start, a_end in segs1:
            for b_start, b_end in segs2:
                # 两个区间有重叠的条件
                if a_start <= b_end and b_start <= a_end:
                    return True
        return False

    @staticmethod
    def _validate_hhmm(value: str, field_name: str) -> None:
        """校验 HH:MM 格式"""
        if not re.match(r"^\d{2}:\d{2}$", value):
            raise ValueError(f"{field_name} 格式错误: '{value}'，期望 HH:MM")
        h, m = value.split(":")
        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
            raise ValueError(f"{field_name} 时间值超出范围: '{value}'")
