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
    matches_word_groups_func: Optional[Callable] = None,
    load_frequency_words_func: Optional[Callable] = None,
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
        matches_word_groups_func: 词组匹配函数
        load_frequency_words_func: 加载频率词函数
        show_new_section: 是否显示新增热点区域

    Returns:
        Dict: 准备好的报告数据
    """
    processed_new_titles = []

    # 在增量模式下或配置关闭时隐藏新增新闻区域
    hide_new_section = mode == "incremental" or not show_new_section

    # 只有在非隐藏模式下才处理新增新闻部分
    if not hide_new_section:
        filtered_new_titles = {}
        if new_titles and id_to_name:
            # 如果提供了匹配函数，使用它过滤
            if matches_word_groups_func and load_frequency_words_func:
                word_groups, filter_words, global_filters = load_frequency_words_func()
                for source_id, titles_data in new_titles.items():
                    filtered_titles = {}
                    for title, title_data in titles_data.items():
                        if matches_word_groups_func(title, word_groups, filter_words, global_filters):
                            filtered_titles[title] = title_data
                    if filtered_titles:
                        filtered_new_titles[source_id] = filtered_titles
            else:
                # 没有匹配函数时，使用全部
                filtered_new_titles = new_titles

            # 打印过滤后的新增热点数（与推送显示一致）
            original_new_count = sum(len(titles) for titles in new_titles.values()) if new_titles else 0
            filtered_new_count = sum(len(titles) for titles in filtered_new_titles.values()) if filtered_new_titles else 0
            if original_new_count > 0:
                print(f"频率词过滤后：{filtered_new_count} 条新增热点匹配（原始 {original_new_count} 条）")

        if filtered_new_titles and id_to_name:
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

    return {
        "stats": processed_stats,
        "new_titles": processed_new_titles,
        "failed_ids": failed_ids or [],
        "total_new_count": sum(
            len(source["titles"]) for source in processed_new_titles
        ),
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
    matches_word_groups_func: Optional[Callable] = None,
    load_frequency_words_func: Optional[Callable] = None,
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
        matches_word_groups_func: 词组匹配函数
        load_frequency_words_func: 加载频率词函数

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
        matches_word_groups_func,
        load_frequency_words_func,
    )

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
