# coding=utf-8
"""
通知内容渲染模块

提供多平台通知内容渲染功能，生成格式化的推送消息
"""

from datetime import datetime
from typing import Dict, List, Optional, Callable

from trendradar.report.formatter import format_title_for_platform


# 默认区域顺序
DEFAULT_REGION_ORDER = ["hotlist", "rss", "new_items", "standalone", "ai_analysis"]


def render_feishu_content(
    report_data: Dict,
    update_info: Optional[Dict] = None,
    mode: str = "daily",
    separator: str = "---",
    region_order: Optional[List[str]] = None,
    get_time_func: Optional[Callable[[], datetime]] = None,
    rss_items: Optional[list] = None,
    show_new_section: bool = True,
) -> str:
    """渲染飞书通知内容（支持热榜+RSS合并）

    Args:
        report_data: 报告数据字典，包含 stats, new_titles, failed_ids, total_new_count
        update_info: 版本更新信息（可选）
        mode: 报告模式 ("daily", "incremental", "current")
        separator: 内容分隔符
        region_order: 区域显示顺序列表
        get_time_func: 获取当前时间的函数（可选，默认使用 datetime.now()）
        rss_items: RSS 条目列表（可选，用于合并推送）
        show_new_section: 是否显示新增热点区域

    Returns:
        格式化的飞书消息内容
    """
    if region_order is None:
        region_order = DEFAULT_REGION_ORDER

    # 生成热点词汇统计部分
    stats_content = ""
    if report_data["stats"]:
        stats_content += "📊 **热点词汇统计**\n\n"

        total_count = len(report_data["stats"])

        for i, stat in enumerate(report_data["stats"]):
            word = stat["word"]
            count = stat["count"]

            sequence_display = f"<font color='grey'>[{i + 1}/{total_count}]</font>"

            if count >= 10:
                stats_content += f"🔥 {sequence_display} **{word}** : <font color='red'>{count}</font> 条\n\n"
            elif count >= 5:
                stats_content += f"📈 {sequence_display} **{word}** : <font color='orange'>{count}</font> 条\n\n"
            else:
                stats_content += f"📌 {sequence_display} **{word}** : {count} 条\n\n"

            for j, title_data in enumerate(stat["titles"], 1):
                formatted_title = format_title_for_platform(
                    "feishu", title_data, show_source=True
                )
                stats_content += f"  {j}. {formatted_title}\n"

                if j < len(stat["titles"]):
                    stats_content += "\n"

            if i < len(report_data["stats"]) - 1:
                stats_content += f"\n{separator}\n\n"

    # 生成新增新闻部分
    new_titles_content = ""
    if show_new_section and report_data["new_titles"]:
        new_titles_content += (
            f"🆕 **本次新增热点新闻** (共 {report_data['total_new_count']} 条)\n\n"
        )

        for source_data in report_data["new_titles"]:
            new_titles_content += (
                f"**{source_data['source_name']}** ({len(source_data['titles'])} 条):\n"
            )

            for j, title_data in enumerate(source_data["titles"], 1):
                title_data_copy = title_data.copy()
                title_data_copy["is_new"] = False
                formatted_title = format_title_for_platform(
                    "feishu", title_data_copy, show_source=False
                )
                new_titles_content += f"  {j}. {formatted_title}\n"

            new_titles_content += "\n"

    # RSS 内容
    rss_content = ""
    if rss_items:
        rss_content = _render_rss_section_feishu(rss_items, separator)

    # 准备各区域内容映射
    region_contents = {
        "hotlist": stats_content,
        "new_items": new_titles_content,
        "rss": rss_content,
    }

    # 按 region_order 顺序组装内容
    text_content = ""
    for region in region_order:
        content = region_contents.get(region, "")
        if content:
            if text_content:
                text_content += f"\n{separator}\n\n"
            text_content += content

    if not text_content:
        if mode == "incremental":
            mode_text = "增量模式下暂无新增匹配的热点词汇"
        elif mode == "current":
            mode_text = "当前榜单模式下暂无匹配的热点词汇"
        else:
            mode_text = "暂无匹配的热点词汇"
        text_content = f"📭 {mode_text}\n\n"

    if report_data["failed_ids"]:
        if text_content and "暂无匹配" not in text_content:
            text_content += f"\n{separator}\n\n"

        text_content += "⚠️ **数据获取失败的平台：**\n\n"
        for i, id_value in enumerate(report_data["failed_ids"], 1):
            text_content += f"  • <font color='red'>{id_value}</font>\n"

    # 获取当前时间
    now = get_time_func() if get_time_func else datetime.now()
    text_content += (
        f"\n\n<font color='grey'>更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}</font>"
    )

    if update_info:
        text_content += f"\n<font color='grey'>TrendRadar 发现新版本 {update_info['remote_version']}，当前 {update_info['current_version']}</font>"

    return text_content


def render_dingtalk_content(
    report_data: Dict,
    update_info: Optional[Dict] = None,
    mode: str = "daily",
    region_order: Optional[List[str]] = None,
    get_time_func: Optional[Callable[[], datetime]] = None,
    rss_items: Optional[list] = None,
    show_new_section: bool = True,
) -> str:
    """渲染钉钉通知内容（支持热榜+RSS合并）

    Args:
        report_data: 报告数据字典，包含 stats, new_titles, failed_ids, total_new_count
        update_info: 版本更新信息（可选）
        mode: 报告模式 ("daily", "incremental", "current")
        region_order: 区域显示顺序列表
        get_time_func: 获取当前时间的函数（可选，默认使用 datetime.now()）
        rss_items: RSS 条目列表（可选，用于合并推送）
        show_new_section: 是否显示新增热点区域

    Returns:
        格式化的钉钉消息内容
    """
    if region_order is None:
        region_order = DEFAULT_REGION_ORDER

    total_titles = sum(
        len(stat["titles"]) for stat in report_data["stats"] if stat["count"] > 0
    )
    now = get_time_func() if get_time_func else datetime.now()

    # 头部信息
    header_content = f"**总新闻数：** {total_titles}\n\n"
    header_content += f"**时间：** {now.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    header_content += "**类型：** 热点分析报告\n\n"
    header_content += "---\n\n"

    # 生成热点词汇统计部分
    stats_content = ""
    if report_data["stats"]:
        stats_content += "📊 **热点词汇统计**\n\n"

        total_count = len(report_data["stats"])

        for i, stat in enumerate(report_data["stats"]):
            word = stat["word"]
            count = stat["count"]

            sequence_display = f"[{i + 1}/{total_count}]"

            if count >= 10:
                stats_content += f"🔥 {sequence_display} **{word}** : **{count}** 条\n\n"
            elif count >= 5:
                stats_content += f"📈 {sequence_display} **{word}** : **{count}** 条\n\n"
            else:
                stats_content += f"📌 {sequence_display} **{word}** : {count} 条\n\n"

            for j, title_data in enumerate(stat["titles"], 1):
                formatted_title = format_title_for_platform(
                    "dingtalk", title_data, show_source=True
                )
                stats_content += f"  {j}. {formatted_title}\n"

                if j < len(stat["titles"]):
                    stats_content += "\n"

            if i < len(report_data["stats"]) - 1:
                stats_content += "\n---\n\n"

    # 生成新增新闻部分
    new_titles_content = ""
    if show_new_section and report_data["new_titles"]:
        new_titles_content += (
            f"🆕 **本次新增热点新闻** (共 {report_data['total_new_count']} 条)\n\n"
        )

        for source_data in report_data["new_titles"]:
            new_titles_content += f"**{source_data['source_name']}** ({len(source_data['titles'])} 条):\n\n"

            for j, title_data in enumerate(source_data["titles"], 1):
                title_data_copy = title_data.copy()
                title_data_copy["is_new"] = False
                formatted_title = format_title_for_platform(
                    "dingtalk", title_data_copy, show_source=False
                )
                new_titles_content += f"  {j}. {formatted_title}\n"

            new_titles_content += "\n"

    # RSS 内容
    rss_content = ""
    if rss_items:
        rss_content = _render_rss_section_markdown(rss_items)

    # 准备各区域内容映射
    region_contents = {
        "hotlist": stats_content,
        "new_items": new_titles_content,
        "rss": rss_content,
    }

    # 按 region_order 顺序组装内容
    text_content = header_content
    has_content = False
    for region in region_order:
        content = region_contents.get(region, "")
        if content:
            if has_content:
                text_content += "\n---\n\n"
            text_content += content
            has_content = True

    if not has_content:
        if mode == "incremental":
            mode_text = "增量模式下暂无新增匹配的热点词汇"
        elif mode == "current":
            mode_text = "当前榜单模式下暂无匹配的热点词汇"
        else:
            mode_text = "暂无匹配的热点词汇"
        text_content += f"📭 {mode_text}\n\n"

    if report_data["failed_ids"]:
        if "暂无匹配" not in text_content:
            text_content += "\n---\n\n"

        text_content += "⚠️ **数据获取失败的平台：**\n\n"
        for i, id_value in enumerate(report_data["failed_ids"], 1):
            text_content += f"  • **{id_value}**\n"

    text_content += f"\n\n> 更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}"

    if update_info:
        text_content += f"\n> TrendRadar 发现新版本 **{update_info['remote_version']}**，当前 **{update_info['current_version']}**"

    return text_content


def render_rss_feishu_content(
    rss_items: list,
    feeds_info: Optional[Dict] = None,
    separator: str = "---",
    get_time_func: Optional[Callable[[], datetime]] = None,
) -> str:
    """渲染 RSS 飞书通知内容

    Args:
        rss_items: RSS 条目列表，每个条目包含:
            - title: 标题
            - feed_id: RSS 源 ID
            - feed_name: RSS 源名称
            - url: 链接
            - published_at: 发布时间
            - summary: 摘要（可选）
            - author: 作者（可选）
        feeds_info: RSS 源 ID 到名称的映射
        separator: 内容分隔符
        get_time_func: 获取当前时间的函数（可选）

    Returns:
        格式化的飞书消息内容
    """
    if not rss_items:
        now = get_time_func() if get_time_func else datetime.now()
        return f"📭 暂无新的 RSS 订阅内容\n\n<font color='grey'>更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}</font>"

    # 按 feed_id 分组
    feeds_map: Dict[str, list] = {}
    for item in rss_items:
        feed_id = item.get("feed_id", "unknown")
        if feed_id not in feeds_map:
            feeds_map[feed_id] = []
        feeds_map[feed_id].append(item)

    text_content = f"📰 **RSS 订阅更新** (共 {len(rss_items)} 条)\n\n"

    text_content += f"{separator}\n\n"

    for feed_id, items in feeds_map.items():
        feed_name = items[0].get("feed_name", feed_id) if items else feed_id
        if feeds_info and feed_id in feeds_info:
            feed_name = feeds_info[feed_id]

        text_content += f"**{feed_name}** ({len(items)} 条)\n\n"

        for i, item in enumerate(items, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("published_at", "")

            if url:
                text_content += f"  {i}. [{title}]({url})"
            else:
                text_content += f"  {i}. {title}"

            if published_at:
                text_content += f" <font color='grey'>- {published_at}</font>"

            text_content += "\n"

            if i < len(items):
                text_content += "\n"

        text_content += f"\n{separator}\n\n"

    now = get_time_func() if get_time_func else datetime.now()
    text_content += f"<font color='grey'>更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}</font>"

    return text_content


def render_rss_dingtalk_content(
    rss_items: list,
    feeds_info: Optional[Dict] = None,
    get_time_func: Optional[Callable[[], datetime]] = None,
) -> str:
    """渲染 RSS 钉钉通知内容

    Args:
        rss_items: RSS 条目列表
        feeds_info: RSS 源 ID 到名称的映射
        get_time_func: 获取当前时间的函数（可选）

    Returns:
        格式化的钉钉消息内容
    """
    now = get_time_func() if get_time_func else datetime.now()

    if not rss_items:
        return f"📭 暂无新的 RSS 订阅内容\n\n> 更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}"

    # 按 feed_id 分组
    feeds_map: Dict[str, list] = {}
    for item in rss_items:
        feed_id = item.get("feed_id", "unknown")
        if feed_id not in feeds_map:
            feeds_map[feed_id] = []
        feeds_map[feed_id].append(item)

    # 头部信息
    text_content = f"**总条目数：** {len(rss_items)}\n\n"
    text_content += f"**时间：** {now.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    text_content += "**类型：** RSS 订阅更新\n\n"

    text_content += "---\n\n"

    for feed_id, items in feeds_map.items():
        feed_name = items[0].get("feed_name", feed_id) if items else feed_id
        if feeds_info and feed_id in feeds_info:
            feed_name = feeds_info[feed_id]

        text_content += f"📰 **{feed_name}** ({len(items)} 条)\n\n"

        for i, item in enumerate(items, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("published_at", "")

            if url:
                text_content += f"  {i}. [{title}]({url})"
            else:
                text_content += f"  {i}. {title}"

            if published_at:
                text_content += f" - {published_at}"

            text_content += "\n"

            if i < len(items):
                text_content += "\n"

        text_content += "\n---\n\n"

    text_content += f"> 更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}"

    return text_content


def render_rss_markdown_content(
    rss_items: list,
    feeds_info: Optional[Dict] = None,
    get_time_func: Optional[Callable[[], datetime]] = None,
) -> str:
    """渲染 RSS 通用 Markdown 格式内容（企业微信、Bark、ntfy、Slack）

    Args:
        rss_items: RSS 条目列表
        feeds_info: RSS 源 ID 到名称的映射
        get_time_func: 获取当前时间的函数（可选）

    Returns:
        格式化的 Markdown 消息内容
    """
    now = get_time_func() if get_time_func else datetime.now()

    if not rss_items:
        return f"📭 暂无新的 RSS 订阅内容\n\n更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}"

    # 按 feed_id 分组
    feeds_map: Dict[str, list] = {}
    for item in rss_items:
        feed_id = item.get("feed_id", "unknown")
        if feed_id not in feeds_map:
            feeds_map[feed_id] = []
        feeds_map[feed_id].append(item)

    text_content = f"📰 **RSS 订阅更新** (共 {len(rss_items)} 条)\n\n"

    for feed_id, items in feeds_map.items():
        feed_name = items[0].get("feed_name", feed_id) if items else feed_id
        if feeds_info and feed_id in feeds_info:
            feed_name = feeds_info[feed_id]

        text_content += f"**{feed_name}** ({len(items)} 条)\n"

        for i, item in enumerate(items, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("published_at", "")

            if url:
                text_content += f"  {i}. [{title}]({url})"
            else:
                text_content += f"  {i}. {title}"

            if published_at:
                text_content += f" `{published_at}`"

            text_content += "\n"

        text_content += "\n"

    text_content += f"更新时间：{now.strftime('%Y-%m-%d %H:%M:%S')}"

    return text_content


# === RSS 内容渲染辅助函数（用于合并推送） ===

def _render_rss_section_feishu(rss_items: list, separator: str = "---") -> str:
    """渲染 RSS 内容区块（飞书格式，用于合并推送）"""
    if not rss_items:
        return ""

    # 按 feed_id 分组
    feeds_map: Dict[str, list] = {}
    for item in rss_items:
        feed_id = item.get("feed_id", "unknown")
        if feed_id not in feeds_map:
            feeds_map[feed_id] = []
        feeds_map[feed_id].append(item)

    text_content = f"📰 **RSS 订阅更新** (共 {len(rss_items)} 条)\n\n"

    for feed_id, items in feeds_map.items():
        feed_name = items[0].get("feed_name", feed_id) if items else feed_id

        text_content += f"**{feed_name}** ({len(items)} 条)\n\n"

        for i, item in enumerate(items, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("published_at", "")

            if url:
                text_content += f"  {i}. [{title}]({url})"
            else:
                text_content += f"  {i}. {title}"

            if published_at:
                text_content += f" <font color='grey'>- {published_at}</font>"

            text_content += "\n"

            if i < len(items):
                text_content += "\n"

        text_content += "\n"

    return text_content.rstrip("\n")


def _render_rss_section_markdown(rss_items: list) -> str:
    """渲染 RSS 内容区块（通用 Markdown 格式，用于合并推送）"""
    if not rss_items:
        return ""

    # 按 feed_id 分组
    feeds_map: Dict[str, list] = {}
    for item in rss_items:
        feed_id = item.get("feed_id", "unknown")
        if feed_id not in feeds_map:
            feeds_map[feed_id] = []
        feeds_map[feed_id].append(item)

    text_content = f"📰 **RSS 订阅更新** (共 {len(rss_items)} 条)\n\n"

    for feed_id, items in feeds_map.items():
        feed_name = items[0].get("feed_name", feed_id) if items else feed_id

        text_content += f"**{feed_name}** ({len(items)} 条)\n"

        for i, item in enumerate(items, 1):
            title = item.get("title", "")
            url = item.get("url", "")
            published_at = item.get("published_at", "")

            if url:
                text_content += f"  {i}. [{title}]({url})"
            else:
                text_content += f"  {i}. {title}"

            if published_at:
                text_content += f" `{published_at}`"

            text_content += "\n"

        text_content += "\n"

    return text_content.rstrip("\n")
