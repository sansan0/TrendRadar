# coding=utf-8
"""
报告生成模块

提供报告数据准备和 HTML 生成功能：
- prepare_report_data: 准备报告数据
- generate_html_report: 生成 HTML 报告
"""

from pathlib import Path
from typing import Dict, List, Optional, Callable


def prepare_report_data(
    stats: List[Dict],
    failed_ids: Optional[List] = None,
    new_titles: Optional[Dict] = None,
    id_to_name: Optional[Dict] = None,
    mode: str = "daily",
    rank_threshold: int = 3,
    show_new_section: bool = True,
) -> Dict:
    """
    准备报告数据

    Args:
        stats: 统计结果列表
        failed_ids: 失败的 ID 列表
        new_titles: 新增标题
        id_to_name: ID 到名称的映射
        mode: 报告模式 (daily/incremental/current)
        rank_threshold: 排名阈值
        show_new_section: 是否显示新增热点区域

    Returns:
        Dict: 准备好的报告数据
    """
    processed_new_titles = []

    stats_title_set = {
        t["title"]
        for stat in stats
        for t in stat.get("titles", [])
    }

    # 过滤新增标题：只保留在 stats 中存活的标题（即通过了 AI/关键词过滤的标题）
    filtered_new_titles = {}
    if new_titles and id_to_name:
        for source_id, titles_data in new_titles.items():
            filtered_titles = {}
            for title, title_data in titles_data.items():
                if title in stats_title_set:
                    filtered_titles[title] = title_data
            if filtered_titles:
                filtered_new_titles[source_id] = filtered_titles

        original_new_count = sum(len(titles) for titles in new_titles.values()) if new_titles else 0
        filtered_new_count = sum(len(titles) for titles in filtered_new_titles.values()) if filtered_new_titles else 0
        if original_new_count > 0:
            print(f"新增热点过滤后：{filtered_new_count} 条保留（原始 {original_new_count} 条）")

    # 在增量模式下或配置关闭时隐藏新增新闻区域（但计数已完成）
    # 当全部热榜条目都是新增时（首次运行），也隐藏以避免与主区域完全重复
    all_new_titles = {title for titles in filtered_new_titles.values() for title in titles}
    all_are_new = bool(all_new_titles) and all_new_titles == stats_title_set
    hide_new_section = mode == "incremental" or not show_new_section or all_are_new

    if not hide_new_section and filtered_new_titles and id_to_name:
        for source_id, titles_data in filtered_new_titles.items():
            source_name = id_to_name.get(source_id, source_id)
            source_titles = []

            for title, title_data in titles_data.items():
                url = title_data.get("url", "")
                mobile_url = title_data.get("mobileUrl", "")
                ranks = title_data.get("ranks", [])

                processed_title = {
                    "title": title,
                    "source_name": source_name,
                    "time_display": "",
                    "count": 1,
                    "ranks": ranks,
                    "rank_threshold": rank_threshold,
                    "url": url,
                    "mobile_url": mobile_url,
                    "is_new": True,
                    "rank_timeline": title_data.get("rank_timeline", []),
                }
                source_titles.append(processed_title)

            if source_titles:
                processed_new_titles.append(
                    {
                        "source_id": source_id,
                        "source_name": source_name,
                        "titles": source_titles,
                    }
                )

    processed_stats = []
    for stat in stats:
        if stat["count"] <= 0:
            continue

        processed_titles = []
        for title_data in stat["titles"]:
            processed_title = {
                "title": title_data["title"],
                "source_name": title_data["source_name"],
                "time_display": title_data["time_display"],
                "count": title_data["count"],
                "ranks": title_data["ranks"],
                "rank_threshold": title_data["rank_threshold"],
                "url": title_data.get("url", ""),
                "mobile_url": title_data.get("mobileUrl", ""),
                "is_new": title_data.get("is_new", False),
                "rank_timeline": title_data.get("rank_timeline", []),
            }
            processed_titles.append(processed_title)

        processed_stats.append(
            {
                "word": stat["word"],
                "count": stat["count"],
                "percentage": stat.get("percentage", 0),
                "titles": processed_titles,
            }
        )

    # total_new_count 始终从过滤结果计算（用于头部统计），不受 hide_new_section 影响
    total_new_count = sum(len(titles) for titles in filtered_new_titles.values())

    return {
        "stats": processed_stats,
        "new_titles": processed_new_titles,
        "failed_ids": failed_ids or [],
        "total_new_count": total_new_count,
    }


def generate_html_report(
    stats: List[Dict],
    total_titles: int,
    failed_ids: Optional[List] = None,
    new_titles: Optional[Dict] = None,
    id_to_name: Optional[Dict] = None,
    mode: str = "daily",
    update_info: Optional[Dict] = None,
    rank_threshold: int = 3,
    output_dir: str = "output",
    date_folder: str = "",
    time_filename: str = "",
    render_html_func: Optional[Callable] = None,
    report_metadata: Optional[Dict] = None,
    translate_report_func: Optional[Callable] = None,
) -> str:
    """
    生成 HTML 报告

    每次生成 HTML 后会：
    1. 保存时间戳快照到 output/html/日期/时间.html（历史记录）
    2. 复制到 output/html/latest/{mode}.html（最新报告）
    3. 复制到 output/index.html 和根目录 index.html（入口）

    Args:
        stats: 统计结果列表
        total_titles: 总标题数
        failed_ids: 失败的 ID 列表
        new_titles: 新增标题
        id_to_name: ID 到名称的映射
        mode: 报告模式 (daily/incremental/current)
        update_info: 更新信息
        rank_threshold: 排名阈值
        output_dir: 输出目录
        date_folder: 日期文件夹名称
        time_filename: 时间文件名
        render_html_func: HTML 渲染函数

    Returns:
        str: 生成的 HTML 文件路径（时间戳快照路径）
    """
    # 时间戳快照文件名
    snapshot_filename = f"{time_filename}.html"

    # 构建输出路径（扁平化结构：output/html/日期/）
    snapshot_path = Path(output_dir) / "html" / date_folder
    snapshot_path.mkdir(parents=True, exist_ok=True)
    snapshot_file = str(snapshot_path / snapshot_filename)

    # 准备报告数据
    report_data = prepare_report_data(
        stats,
        failed_ids,
        new_titles,
        id_to_name,
        mode,
        rank_threshold,
    )

    # 翻译热榜 report_data（stats/new_titles）——在 prepare_report_data 过滤之后翻译，
    # 不影响新增热点区的 title 匹配过滤，使 HTML 网页版热榜也展示译文
    if translate_report_func:
        report_data = translate_report_func(report_data)

    if report_metadata:
        _METADATA_KEYS = {
            "hotlist_total", "platform_total", "rss_matched_count",
            "rss_total_count", "rss_source_total", "rss_source_failed",
            "search_matched_count", "search_total_count",
            "search_topic_total", "search_topic_failed", "search_new_count",
        }
        for key in _METADATA_KEYS:
            if key in report_metadata:
                report_data[key] = report_metadata[key]

    # 渲染 HTML 内容
    if render_html_func:
        html_content = render_html_func(
            report_data, total_titles, mode, update_info
        )
    else:
        # 默认简单 HTML
        html_content = f"<html><body><h1>Report</h1><pre>{report_data}</pre></body></html>"

    # 1. 保存时间戳快照（历史记录）
    with open(snapshot_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 2. 复制到 html/latest/{mode}.html（最新报告）
    latest_dir = Path(output_dir) / "html" / "latest"
    latest_dir.mkdir(parents=True, exist_ok=True)
    latest_file = latest_dir / f"{mode}.html"
    with open(latest_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 3. 复制到 index.html（入口）
    # output/index.html（供 Docker Volume 挂载访问）
    output_index = Path(output_dir) / "index.html"
    with open(output_index, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 根目录 index.html（供 GitHub Pages 访问）
    root_index = Path("index.html")
    with open(root_index, "w", encoding="utf-8") as f:
        f.write(html_content)

    return snapshot_file
