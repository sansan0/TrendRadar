# coding=utf-8
"""调度状态查看命令"""

from typing import Dict

from trendradar import __version__
from trendradar.context import AppContext


def handle_status_commands(config: Dict) -> None:
    """显示当前调度状态"""
    ctx = AppContext(config)

    print("=" * 60)
    print(f"TrendRadar v{__version__} 调度状态")
    print("=" * 60)

    try:
        scheduler = ctx.create_scheduler()
        schedule = scheduler.resolve()

        now = ctx.get_time()
        date_str = ctx.format_date()

        print(f"\n⏰ 当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')} ({ctx.timezone})")
        print(f"📅 当前日期: {date_str}")

        print(f"\n📋 调度信息:")
        print(f"  日计划: {schedule.day_plan}")
        if schedule.period_key:
            print(f"  当前时间段: {schedule.period_name or schedule.period_key} ({schedule.period_key})")
        else:
            print(f"  当前时间段: 无（使用默认配置）")

        ws_cfg = config.get("WEB_SEARCH", {}) or {}
        ws_enabled = bool(ws_cfg.get("ENABLED", False))

        print(f"\n🔧 行为开关:")
        print(f"  采集数据: {'✅ 是' if schedule.collect else '❌ 否'}")
        if ws_enabled:
            will_search = schedule.collect if schedule.search is None else bool(schedule.search)
            follow_hint = "（跟随采集）" if schedule.search is None else ""
            search_file = schedule.search_file or ws_cfg.get("QUERIES_FILE") or "config/search_queries.txt"
            print(f"  联网搜索: {'✅ 是' if will_search else '❌ 否'}{follow_hint}（任务文件: {search_file}）")
        print(f"  AI 分析:  {'✅ 是' if schedule.analyze else '❌ 否'}")
        print(f"  推送通知: {'✅ 是' if schedule.push else '❌ 否'}")
        print(f"  报告模式: {schedule.report_mode}")
        print(f"  AI 模式:  {schedule.ai_mode}")

        if schedule.period_key:
            print(f"\n🔁 一次性控制:")
            if schedule.once_analyze:
                already_analyzed = scheduler.already_executed(schedule.period_key, "analyze", date_str)
                print(f"  AI 分析:  仅一次 {'(今日已执行 ⚠️)' if already_analyzed else '(今日未执行 ✅)'}")
            else:
                print(f"  AI 分析:  不限次数")
            if schedule.once_push:
                already_pushed = scheduler.already_executed(schedule.period_key, "push", date_str)
                print(f"  推送通知: 仅一次 {'(今日已执行 ⚠️)' if already_pushed else '(今日未执行 ✅)'}")
            else:
                print(f"  推送通知: 不限次数")
            if ws_enabled or schedule.once_search:
                if schedule.once_search:
                    already_searched = scheduler.already_executed(schedule.period_key, "search", date_str)
                    print(f"  联网搜索: 仅一次 {'(今日已执行 ⚠️)' if already_searched else '(今日未执行 ✅)'}")
                else:
                    print(f"  联网搜索: 不限次数")

    except Exception as e:
        print(f"\n❌ 获取调度状态失败: {e}")

    print("\n" + "=" * 60)

    ctx.cleanup()
