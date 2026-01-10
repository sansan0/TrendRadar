# coding=utf-8
"""
HTML 报告渲染模块

提供 HTML 格式的热点新闻报告生成功能
"""

from datetime import datetime
from typing import Dict, List, Optional, Callable

from trendradar.report.helpers import html_escape
from trendradar.utils.time import convert_time_for_display


def render_html_content(
    report_data: Dict,
    total_titles: int,
    is_daily_summary: bool = False,
    mode: str = "daily",
    update_info: Optional[Dict] = None,
    *,
    reverse_content_order: bool = False,
    get_time_func: Optional[Callable[[], datetime]] = None,
    rss_items: Optional[List[Dict]] = None,
    rss_new_items: Optional[List[Dict]] = None,
    display_mode: str = "keyword",
    standalone_data: Optional[Dict] = None,
) -> str:
    """渲染HTML内容

    Args:
        report_data: 报告数据字典，包含 stats, new_titles, failed_ids, total_new_count
        total_titles: 新闻总数
        is_daily_summary: 是否为当日汇总
        mode: 报告模式 ("daily", "current", "incremental")
        update_info: 更新信息（可选）
        reverse_content_order: 是否反转内容顺序（新增热点在前）
        get_time_func: 获取当前时间的函数（可选，默认使用 datetime.now）
        rss_items: RSS 统计条目列表（可选）
        rss_new_items: RSS 新增条目列表（可选）
        display_mode: 显示模式 ("keyword"=按关键词分组, "platform"=按平台分组)
        standalone_data: 独立展示区数据（可选），包含 platforms 和 rss_feeds

    Returns:
        渲染后的 HTML 字符串
    """
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>热点新闻分析</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" integrity="sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
        <style>
            * { box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                margin: 0;
                padding: 16px;
                background: #fafafa;
                color: #333;
                line-height: 1.5;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 2px 16px rgba(0,0,0,0.06);
            }

            .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                padding: 32px 24px;
                text-align: center;
                position: relative;
            }

            .save-buttons {
                position: absolute;
                top: 16px;
                right: 16px;
                display: flex;
                gap: 8px;
            }

            .save-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                white-space: nowrap;
            }

            .save-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                border-color: rgba(255, 255, 255, 0.5);
                transform: translateY(-1px);
            }

            .save-btn:active {
                transform: translateY(0);
            }

            .save-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .header-title {
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 20px 0;
            }

            .header-info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                font-size: 14px;
                opacity: 0.95;
            }

            .info-item {
                text-align: center;
            }

            .info-label {
                display: block;
                font-size: 12px;
                opacity: 0.8;
                margin-bottom: 4px;
            }

            .info-value {
                font-weight: 600;
                font-size: 16px;
            }

            .content {
                padding: 24px;
            }

            .word-group {
                margin-bottom: 40px;
            }

            .word-group:first-child {
                margin-top: 0;
            }

            .word-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 8px;
                border-bottom: 1px solid #f0f0f0;
            }

            .word-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .word-name {
                font-size: 17px;
                font-weight: 600;
                color: #1a1a1a;
            }

            .word-count {
                color: #666;
                font-size: 13px;
                font-weight: 500;
            }

            .word-count.hot { color: #dc2626; font-weight: 600; }
            .word-count.warm { color: #ea580c; font-weight: 600; }

            .word-index {
                color: #999;
                font-size: 12px;
            }

            .news-item {
                margin-bottom: 20px;
                padding: 16px 0;
                border-bottom: 1px solid #f5f5f5;
                position: relative;
                display: flex;
                gap: 12px;
                align-items: center;
            }

            .news-item:last-child {
                border-bottom: none;
            }

            .news-item.new::after {
                content: "NEW";
                position: absolute;
                top: 12px;
                right: 0;
                background: #fbbf24;
                color: #92400e;
                font-size: 9px;
                font-weight: 700;
                padding: 3px 6px;
                border-radius: 4px;
                letter-spacing: 0.5px;
            }

            .news-number {
                color: #999;
                font-size: 13px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
                flex-shrink: 0;
                background: #f8f9fa;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                align-self: flex-start;
                margin-top: 8px;
            }

            .news-content {
                flex: 1;
                min-width: 0;
                padding-right: 40px;
            }

            .news-item.new .news-content {
                padding-right: 50px;
            }

            .news-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }

            .source-name {
                color: #666;
                font-size: 12px;
                font-weight: 500;
            }

            .keyword-tag {
                color: #2563eb;
                font-size: 12px;
                font-weight: 500;
                background: #eff6ff;
                padding: 2px 6px;
                border-radius: 4px;
            }

            .rank-num {
                color: #fff;
                background: #6b7280;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
            }

            .rank-num.top { background: #dc2626; }
            .rank-num.high { background: #ea580c; }

            .time-info {
                color: #999;
                font-size: 11px;
            }

            .count-info {
                color: #059669;
                font-size: 11px;
                font-weight: 500;
            }

            .news-title {
                font-size: 15px;
                line-height: 1.4;
                color: #1a1a1a;
                margin: 0;
            }

            .news-link {
                color: #2563eb;
                text-decoration: none;
            }

            .news-link:hover {
                text-decoration: underline;
            }

            .news-link:visited {
                color: #7c3aed;
            }

            .new-section {
                margin-top: 40px;
                padding-top: 24px;
                border-top: 2px solid #f0f0f0;
            }

            .new-section-title {
                color: #1a1a1a;
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 20px 0;
            }

            .new-source-group {
                margin-bottom: 24px;
            }

            .new-source-title {
                color: #666;
                font-size: 13px;
                font-weight: 500;
                margin: 0 0 12px 0;
                padding-bottom: 6px;
                border-bottom: 1px solid #f5f5f5;
            }

            .new-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f9f9f9;
            }

            .new-item:last-child {
                border-bottom: none;
            }

            .new-item-number {
                color: #999;
                font-size: 12px;
                font-weight: 600;
                min-width: 18px;
                text-align: center;
                flex-shrink: 0;
                background: #f8f9fa;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .new-item-rank {
                color: #fff;
                background: #6b7280;
                font-size: 10px;
                font-weight: 700;
                padding: 3px 6px;
                border-radius: 8px;
                min-width: 20px;
                text-align: center;
                flex-shrink: 0;
            }

            .new-item-rank.top { background: #dc2626; }
            .new-item-rank.high { background: #ea580c; }

            .new-item-content {
                flex: 1;
                min-width: 0;
            }

            .new-item-title {
                font-size: 14px;
                line-height: 1.4;
                color: #1a1a1a;
                margin: 0;
            }

            .error-section {
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
            }

            .error-title {
                color: #dc2626;
                font-size: 14px;
                font-weight: 600;
                margin: 0 0 8px 0;
            }

            .error-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .error-item {
                color: #991b1b;
                font-size: 13px;
                padding: 2px 0;
                font-family: 'SF Mono', Consolas, monospace;
            }

            .footer {
                margin-top: 32px;
                padding: 20px 24px;
                background: #f8f9fa;
                border-top: 1px solid #e5e7eb;
                text-align: center;
            }

            .footer-content {
                font-size: 13px;
                color: #6b7280;
                line-height: 1.6;
            }

            .footer-link {
                color: #4f46e5;
                text-decoration: none;
                font-weight: 500;
                transition: color 0.2s ease;
            }

            .footer-link:hover {
                color: #7c3aed;
                text-decoration: underline;
            }

            .project-name {
                font-weight: 600;
                color: #374151;
            }

            @media (max-width: 480px) {
                body { padding: 12px; }
                .header { padding: 24px 20px; }
                .content { padding: 20px; }
                .footer { padding: 16px 20px; }
                .header-info { grid-template-columns: 1fr; gap: 12px; }
                .news-header { gap: 6px; }
                .news-content { padding-right: 45px; }
                .news-item { gap: 8px; }
                .new-item { gap: 8px; }
                .news-number { width: 20px; height: 20px; font-size: 12px; }
                .save-buttons {
                    position: static;
                    margin-bottom: 16px;
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                    flex-direction: column;
                    width: 100%;
                }
                .save-btn {
                    width: 100%;
                }
            }

            /* RSS 订阅内容样式 */
            .rss-section {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 2px solid #e5e7eb;
            }

            .rss-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }

            .rss-section-title {
                font-size: 18px;
                font-weight: 600;
                color: #059669;
            }

            .rss-section-count {
                color: #6b7280;
                font-size: 14px;
            }

            .feed-group {
                margin-bottom: 24px;
            }

            .feed-group:last-child {
                margin-bottom: 0;
            }

            .feed-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 2px solid #10b981;
            }

            .feed-name {
                font-size: 15px;
                font-weight: 600;
                color: #059669;
            }

            .feed-count {
                color: #666;
                font-size: 13px;
                font-weight: 500;
            }

            .rss-item {
                margin-bottom: 12px;
                padding: 14px;
                background: #f0fdf4;
                border-radius: 8px;
                border-left: 3px solid #10b981;
            }

            .rss-item:last-child {
                margin-bottom: 0;
            }

            .rss-meta {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }

            .rss-time {
                color: #6b7280;
                font-size: 12px;
            }

            .rss-author {
                color: #059669;
                font-size: 12px;
                font-weight: 500;
            }

            .rss-title {
                font-size: 14px;
                line-height: 1.5;
                margin-bottom: 6px;
            }

            .rss-link {
                color: #1f2937;
                text-decoration: none;
                font-weight: 500;
            }

            .rss-link:hover {
                color: #059669;
                text-decoration: underline;
            }

            .rss-summary {
                font-size: 13px;
                color: #6b7280;
                line-height: 1.5;
                margin: 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            /* 独立展示区样式 - 复用热点词汇统计区样式 */
            .standalone-section {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 2px solid #e5e7eb;
            }

            .standalone-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }

            .standalone-section-title {
                font-size: 18px;
                font-weight: 600;
                color: #4f46e5;
            }

            .standalone-section-count {
                color: #6b7280;
                font-size: 14px;
            }

            .standalone-group {
                margin-bottom: 40px;
            }

            .standalone-group:last-child {
                margin-bottom: 0;
            }

            .standalone-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                padding-bottom: 8px;
                border-bottom: 1px solid #f0f0f0;
            }

            .standalone-name {
                font-size: 17px;
                font-weight: 600;
                color: #1a1a1a;
            }

            .standalone-count {
                color: #666;
                font-size: 13px;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="save-buttons">
                    <button class="save-btn" onclick="saveAsImage()">保存为图片</button>
                    <button class="save-btn" onclick="saveAsMultipleImages()">分段保存</button>
                </div>
                <div class="header-title">热点新闻分析</div>
                <div class="header-info">
                    <div class="info-item">
                        <span class="info-label">报告类型</span>
                        <span class="info-value">"""

    # 处理报告类型显示
    if is_daily_summary:
        if mode == "current":
            html += "当前榜单"
        elif mode == "incremental":
            html += "增量模式"
        else:
            html += "当日汇总"
    else:
        html += "实时分析"

    html += """</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">新闻总数</span>
                        <span class="info-value">"""

    html += f"{total_titles} 条"

    # 计算筛选后的热点新闻数量
    hot_news_count = sum(len(stat["titles"]) for stat in report_data["stats"])

    html += """</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">热点新闻</span>
                        <span class="info-value">"""

    html += f"{hot_news_count} 条"

    html += """</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">生成时间</span>
                        <span class="info-value">"""

    # 使用提供的时间函数或默认 datetime.now
    if get_time_func:
        now = get_time_func()
    else:
        now = datetime.now()
    html += now.strftime("%m-%d %H:%M")

    html += """</span>
                    </div>
                </div>
            </div>

            <div class="content">"""

    # 处理失败ID错误信息
    if report_data["failed_ids"]:
        html += """
                <div class="error-section">
                    <div class="error-title">⚠️ 请求失败的平台</div>
                    <ul class="error-list">"""
        for id_value in report_data["failed_ids"]:
            html += f'<li class="error-item">{html_escape(id_value)}</li>'
        html += """
                    </ul>
                </div>"""

    # 生成热点词汇统计部分的HTML
    stats_html = ""
    if report_data["stats"]:
        total_count = len(report_data["stats"])

        for i, stat in enumerate(report_data["stats"], 1):
            count = stat["count"]

            # 确定热度等级
            if count >= 10:
                count_class = "hot"
            elif count >= 5:
                count_class = "warm"
            else:
                count_class = ""

            escaped_word = html_escape(stat["word"])

            stats_html += f"""
                <div class="word-group">
                    <div class="word-header">
                        <div class="word-info">
                            <div class="word-name">{escaped_word}</div>
                            <div class="word-count {count_class}">{count} 条</div>
                        </div>
                        <div class="word-index">{i}/{total_count}</div>
                    </div>"""

            # 处理每个词组下的新闻标题，给每条新闻标上序号
            for j, title_data in enumerate(stat["titles"], 1):
                is_new = title_data.get("is_new", False)
                new_class = "new" if is_new else ""

                stats_html += f"""
                    <div class="news-item {new_class}">
                        <div class="news-number">{j}</div>
                        <div class="news-content">
                            <div class="news-header">"""

                # 根据 display_mode 决定显示来源还是关键词
                if display_mode == "keyword":
                    # keyword 模式：显示来源
                    stats_html += f'<span class="source-name">{html_escape(title_data["source_name"])}</span>'
                else:
                    # platform 模式：显示关键词
                    matched_keyword = title_data.get("matched_keyword", "")
                    if matched_keyword:
                        stats_html += f'<span class="keyword-tag">[{html_escape(matched_keyword)}]</span>'

                # 处理排名显示
                ranks = title_data.get("ranks", [])
                if ranks:
                    min_rank = min(ranks)
                    max_rank = max(ranks)
                    rank_threshold = title_data.get("rank_threshold", 10)

                    # 确定排名等级
                    if min_rank <= 3:
                        rank_class = "top"
                    elif min_rank <= rank_threshold:
                        rank_class = "high"
                    else:
                        rank_class = ""

                    if min_rank == max_rank:
                        rank_text = str(min_rank)
                    else:
                        rank_text = f"{min_rank}-{max_rank}"

                    stats_html += f'<span class="rank-num {rank_class}">{rank_text}</span>'

                # 处理时间显示
                time_display = title_data.get("time_display", "")
                if time_display:
                    # 简化时间显示格式，将波浪线替换为~
                    simplified_time = (
                        time_display.replace(" ~ ", "~")
                        .replace("[", "")
                        .replace("]", "")
                    )
                    stats_html += (
                        f'<span class="time-info">{html_escape(simplified_time)}</span>'
                    )

                # 处理出现次数
                count_info = title_data.get("count", 1)
                if count_info > 1:
                    stats_html += f'<span class="count-info">{count_info}次</span>'

                stats_html += """
                            </div>
                            <div class="news-title">"""

                # 处理标题和链接
                escaped_title = html_escape(title_data["title"])
                link_url = title_data.get("mobile_url") or title_data.get("url", "")

                if link_url:
                    escaped_url = html_escape(link_url)
                    stats_html += f'<a href="{escaped_url}" target="_blank" class="news-link">{escaped_title}</a>'
                else:
                    stats_html += escaped_title

                stats_html += """
                            </div>
                        </div>
                    </div>"""

            stats_html += """
                </div>"""

    # 生成新增新闻区域的HTML
    new_titles_html = ""
    if report_data["new_titles"]:
        new_titles_html += f"""
                <div class="new-section">
                    <div class="new-section-title">本次新增热点 (共 {report_data['total_new_count']} 条)</div>"""

        for source_data in report_data["new_titles"]:
            escaped_source = html_escape(source_data["source_name"])
            titles_count = len(source_data["titles"])

            new_titles_html += f"""
                    <div class="new-source-group">
                        <div class="new-source-title">{escaped_source} · {titles_count}条</div>"""

            # 为新增新闻也添加序号
            for idx, title_data in enumerate(source_data["titles"], 1):
                ranks = title_data.get("ranks", [])

                # 处理新增新闻的排名显示
                rank_class = ""
                if ranks:
                    min_rank = min(ranks)
                    if min_rank <= 3:
                        rank_class = "top"
                    elif min_rank <= title_data.get("rank_threshold", 10):
                        rank_class = "high"

                    if len(ranks) == 1:
                        rank_text = str(ranks[0])
                    else:
                        rank_text = f"{min(ranks)}-{max(ranks)}"
                else:
                    rank_text = "?"

                new_titles_html += f"""
                        <div class="new-item">
                            <div class="new-item-number">{idx}</div>
                            <div class="new-item-rank {rank_class}">{rank_text}</div>
                            <div class="new-item-content">
                                <div class="new-item-title">"""

                # 处理新增新闻的链接
                escaped_title = html_escape(title_data["title"])
                link_url = title_data.get("mobile_url") or title_data.get("url", "")

                if link_url:
                    escaped_url = html_escape(link_url)
                    new_titles_html += f'<a href="{escaped_url}" target="_blank" class="news-link">{escaped_title}</a>'
                else:
                    new_titles_html += escaped_title

                new_titles_html += """
                                </div>
                            </div>
                        </div>"""

            new_titles_html += """
                    </div>"""

        new_titles_html += """
                </div>"""

    # 生成 RSS 统计内容
    def render_rss_stats_html(stats: List[Dict], title: str = "RSS 订阅更新") -> str:
        """渲染 RSS 统计区块 HTML

        Args:
            stats: RSS 分组统计列表，格式与热榜一致：
                [
                    {
                        "word": "关键词",
                        "count": 5,
                        "titles": [
                            {
                                "title": "标题",
                                "source_name": "Feed 名称",
                                "time_display": "12-29 08:20",
                                "url": "...",
                                "is_new": True/False
                            }
                        ]
                    }
                ]
            title: 区块标题

        Returns:
            渲染后的 HTML 字符串
        """
        if not stats:
            return ""

        # 计算总条目数
        total_count = sum(stat.get("count", 0) for stat in stats)
        if total_count == 0:
            return ""

        rss_html = f"""
                <div class="rss-section">
                    <div class="rss-section-header">
                        <div class="rss-section-title">{title}</div>
                        <div class="rss-section-count">{total_count} 条</div>
                    </div>"""

        # 按关键词分组渲染（与热榜格式一致）
        for stat in stats:
            keyword = stat.get("word", "")
            titles = stat.get("titles", [])
            if not titles:
                continue

            keyword_count = len(titles)

            rss_html += f"""
                    <div class="feed-group">
                        <div class="feed-header">
                            <div class="feed-name">{html_escape(keyword)}</div>
                            <div class="feed-count">{keyword_count} 条</div>
                        </div>"""

            for title_data in titles:
                item_title = title_data.get("title", "")
                url = title_data.get("url", "")
                time_display = title_data.get("time_display", "")
                source_name = title_data.get("source_name", "")
                is_new = title_data.get("is_new", False)

                rss_html += """
                        <div class="rss-item">
                            <div class="rss-meta">"""

                if time_display:
                    rss_html += f'<span class="rss-time">{html_escape(time_display)}</span>'

                if source_name:
                    rss_html += f'<span class="rss-author">{html_escape(source_name)}</span>'

                if is_new:
                    rss_html += '<span class="rss-author" style="color: #dc2626;">NEW</span>'

                rss_html += """
                            </div>
                            <div class="rss-title">"""

                escaped_title = html_escape(item_title)
                if url:
                    escaped_url = html_escape(url)
                    rss_html += f'<a href="{escaped_url}" target="_blank" class="rss-link">{escaped_title}</a>'
                else:
                    rss_html += escaped_title

                rss_html += """
                            </div>
                        </div>"""

            rss_html += """
                    </div>"""

        rss_html += """
                </div>"""
        return rss_html

    # 生成独立展示区内容
    def render_standalone_html(data: Optional[Dict]) -> str:
        """渲染独立展示区 HTML（复用热点词汇统计区样式）

        Args:
            data: 独立展示数据，格式：
                {
                    "platforms": [
                        {
                            "id": "zhihu",
                            "name": "知乎热榜",
                            "items": [
                                {
                                    "title": "标题",
                                    "url": "链接",
                                    "rank": 1,
                                    "ranks": [1, 2, 1],
                                    "first_time": "08:00",
                                    "last_time": "12:30",
                                    "count": 3,
                                }
                            ]
                        }
                    ],
                    "rss_feeds": [
                        {
                            "id": "hacker-news",
                            "name": "Hacker News",
                            "items": [
                                {
                                    "title": "标题",
                                    "url": "链接",
                                    "published_at": "2025-01-07T08:00:00",
                                    "author": "作者",
                                }
                            ]
                        }
                    ]
                }

        Returns:
            渲染后的 HTML 字符串
        """
        if not data:
            return ""

        platforms = data.get("platforms", [])
        rss_feeds = data.get("rss_feeds", [])

        if not platforms and not rss_feeds:
            return ""

        # 计算总条目数
        total_platform_items = sum(len(p.get("items", [])) for p in platforms)
        total_rss_items = sum(len(f.get("items", [])) for f in rss_feeds)
        total_count = total_platform_items + total_rss_items

        if total_count == 0:
            return ""

        standalone_html = f"""
                <div class="standalone-section">
                    <div class="standalone-section-header">
                        <div class="standalone-section-title">📋 独立展示区</div>
                        <div class="standalone-section-count">{total_count} 条</div>
                    </div>"""

        # 渲染热榜平台（复用 word-group 结构）
        for platform in platforms:
            platform_name = platform.get("name", platform.get("id", ""))
            items = platform.get("items", [])
            if not items:
                continue

            standalone_html += f"""
                    <div class="standalone-group">
                        <div class="standalone-header">
                            <div class="standalone-name">{html_escape(platform_name)}</div>
                            <div class="standalone-count">{len(items)} 条</div>
                        </div>"""

            # 渲染每个条目（复用 news-item 结构）
            for j, item in enumerate(items, 1):
                title = item.get("title", "")
                url = item.get("url", "") or item.get("mobileUrl", "")
                rank = item.get("rank", 0)
                ranks = item.get("ranks", [])
                first_time = item.get("first_time", "")
                last_time = item.get("last_time", "")
                count = item.get("count", 1)

                standalone_html += f"""
                        <div class="news-item">
                            <div class="news-number">{j}</div>
                            <div class="news-content">
                                <div class="news-header">"""

                # 排名显示（复用 rank-num 样式，无 # 前缀）
                if ranks:
                    min_rank = min(ranks)
                    max_rank = max(ranks)

                    # 确定排名等级
                    if min_rank <= 3:
                        rank_class = "top"
                    elif min_rank <= 10:
                        rank_class = "high"
                    else:
                        rank_class = ""

                    if min_rank == max_rank:
                        rank_text = str(min_rank)
                    else:
                        rank_text = f"{min_rank}-{max_rank}"

                    standalone_html += f'<span class="rank-num {rank_class}">{rank_text}</span>'
                elif rank > 0:
                    if rank <= 3:
                        rank_class = "top"
                    elif rank <= 10:
                        rank_class = "high"
                    else:
                        rank_class = ""
                    standalone_html += f'<span class="rank-num {rank_class}">{rank}</span>'

                # 时间显示（复用 time-info 样式，将 HH-MM 转换为 HH:MM）
                if first_time and last_time and first_time != last_time:
                    first_time_display = convert_time_for_display(first_time)
                    last_time_display = convert_time_for_display(last_time)
                    standalone_html += f'<span class="time-info">{html_escape(first_time_display)}~{html_escape(last_time_display)}</span>'
                elif first_time:
                    first_time_display = convert_time_for_display(first_time)
                    standalone_html += f'<span class="time-info">{html_escape(first_time_display)}</span>'

                # 出现次数（复用 count-info 样式）
                if count > 1:
                    standalone_html += f'<span class="count-info">{count}次</span>'

                standalone_html += """
                                </div>
                                <div class="news-title">"""

                # 标题和链接（复用 news-link 样式）
                escaped_title = html_escape(title)
                if url:
                    escaped_url = html_escape(url)
                    standalone_html += f'<a href="{escaped_url}" target="_blank" class="news-link">{escaped_title}</a>'
                else:
                    standalone_html += escaped_title

                standalone_html += """
                                </div>
                            </div>
                        </div>"""

            standalone_html += """
                    </div>"""

        # 渲染 RSS 源（复用相同结构）
        for feed in rss_feeds:
            feed_name = feed.get("name", feed.get("id", ""))
            items = feed.get("items", [])
            if not items:
                continue

            standalone_html += f"""
                    <div class="standalone-group">
                        <div class="standalone-header">
                            <div class="standalone-name">{html_escape(feed_name)}</div>
                            <div class="standalone-count">{len(items)} 条</div>
                        </div>"""

            for j, item in enumerate(items, 1):
                title = item.get("title", "")
                url = item.get("url", "")
                published_at = item.get("published_at", "")
                author = item.get("author", "")

                standalone_html += f"""
                        <div class="news-item">
                            <div class="news-number">{j}</div>
                            <div class="news-content">
                                <div class="news-header">"""

                # 时间显示（格式化 ISO 时间）
                if published_at:
                    try:
                        from datetime import datetime as dt
                        if "T" in published_at:
                            dt_obj = dt.fromisoformat(published_at.replace("Z", "+00:00"))
                            time_display = dt_obj.strftime("%m-%d %H:%M")
                        else:
                            time_display = published_at
                    except:
                        time_display = published_at

                    standalone_html += f'<span class="time-info">{html_escape(time_display)}</span>'

                # 作者显示
                if author:
                    standalone_html += f'<span class="source-name">{html_escape(author)}</span>'

                standalone_html += """
                                </div>
                                <div class="news-title">"""

                escaped_title = html_escape(title)
                if url:
                    escaped_url = html_escape(url)
                    standalone_html += f'<a href="{escaped_url}" target="_blank" class="news-link">{escaped_title}</a>'
                else:
                    standalone_html += escaped_title

                standalone_html += """
                                </div>
                            </div>
                        </div>"""

            standalone_html += """
                    </div>"""

        standalone_html += """
                </div>"""
        return standalone_html

    # 生成 RSS 统计和新增 HTML
    rss_stats_html = render_rss_stats_html(rss_items, "RSS 订阅更新") if rss_items else ""
    rss_new_html = render_rss_stats_html(rss_new_items, "RSS 新增更新") if rss_new_items else ""

    # 生成独立展示区 HTML
    standalone_html = render_standalone_html(standalone_data)

    # 根据配置决定内容顺序（与推送逻辑一致）
    if reverse_content_order:
        # 新增在前，统计在后
        # 顺序：热榜新增 → RSS新增 → 热榜统计 → RSS统计 → 独立展示区
        html += new_titles_html + rss_new_html + stats_html + rss_stats_html + standalone_html
    else:
        # 默认：统计在前，新增在后
        # 顺序：热榜统计 → RSS统计 → 热榜新增 → RSS新增 → 独立展示区
        html += stats_html + rss_stats_html + new_titles_html + rss_new_html + standalone_html

    html += """
            </div>

            <div class="footer">
                <div class="footer-content">
                    由 <span class="project-name">TrendRadar</span> 生成 ·
                    <a href="https://github.com/sansan0/TrendRadar" target="_blank" class="footer-link">
                        GitHub 开源项目
                    </a>"""

    if update_info:
        html += f"""
                    <br>
                    <span style="color: #ea580c; font-weight: 500;">
                        发现新版本 {update_info['remote_version']}，当前版本 {update_info['current_version']}
                    </span>"""

    html += """
                </div>
            </div>
        </div>

        <script>
            async function saveAsImage() {
                const button = event.target;
                const originalText = button.textContent;

                try {
                    button.textContent = '生成中...';
                    button.disabled = true;
                    window.scrollTo(0, 0);

                    // 等待页面稳定
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // 截图前隐藏按钮
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'hidden';

                    // 再次等待确保按钮完全隐藏
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const container = document.querySelector('.container');

                    const canvas = await html2canvas(container, {
                        backgroundColor: '#ffffff',
                        scale: 1.5,
                        useCORS: true,
                        allowTaint: false,
                        imageTimeout: 10000,
                        removeContainer: false,
                        foreignObjectRendering: false,
                        logging: false,
                        width: container.offsetWidth,
                        height: container.offsetHeight,
                        x: 0,
                        y: 0,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: window.innerWidth,
                        windowHeight: window.innerHeight
                    });

                    buttons.style.visibility = 'visible';

                    const link = document.createElement('a');
                    const now = new Date();
                    const filename = `TrendRadar_热点新闻分析_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

                    link.download = filename;
                    link.href = canvas.toDataURL('image/png', 1.0);

                    // 触发下载
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    button.textContent = '保存成功!';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'visible';
                    button.textContent = '保存失败';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);
                }
            }

            async function saveAsMultipleImages() {
                const button = event.target;
                const originalText = button.textContent;
                const container = document.querySelector('.container');
                const scale = 1.5;
                const maxHeight = 5000 / scale;

                try {
                    button.textContent = '分析中...';
                    button.disabled = true;

                    // 获取所有可能的分割元素
                    const newsItems = Array.from(container.querySelectorAll('.news-item'));
                    const wordGroups = Array.from(container.querySelectorAll('.word-group'));
                    const newSection = container.querySelector('.new-section');
                    const errorSection = container.querySelector('.error-section');
                    const header = container.querySelector('.header');
                    const footer = container.querySelector('.footer');

                    // 计算元素位置和高度
                    const containerRect = container.getBoundingClientRect();
                    const elements = [];

                    // 添加header作为必须包含的元素
                    elements.push({
                        type: 'header',
                        element: header,
                        top: 0,
                        bottom: header.offsetHeight,
                        height: header.offsetHeight
                    });

                    // 添加错误信息（如果存在）
                    if (errorSection) {
                        const rect = errorSection.getBoundingClientRect();
                        elements.push({
                            type: 'error',
                            element: errorSection,
                            top: rect.top - containerRect.top,
                            bottom: rect.bottom - containerRect.top,
                            height: rect.height
                        });
                    }

                    // 按word-group分组处理news-item
                    wordGroups.forEach(group => {
                        const groupRect = group.getBoundingClientRect();
                        const groupNewsItems = group.querySelectorAll('.news-item');

                        // 添加word-group的header部分
                        const wordHeader = group.querySelector('.word-header');
                        if (wordHeader) {
                            const headerRect = wordHeader.getBoundingClientRect();
                            elements.push({
                                type: 'word-header',
                                element: wordHeader,
                                parent: group,
                                top: groupRect.top - containerRect.top,
                                bottom: headerRect.bottom - containerRect.top,
                                height: headerRect.height
                            });
                        }

                        // 添加每个news-item
                        groupNewsItems.forEach(item => {
                            const rect = item.getBoundingClientRect();
                            elements.push({
                                type: 'news-item',
                                element: item,
                                parent: group,
                                top: rect.top - containerRect.top,
                                bottom: rect.bottom - containerRect.top,
                                height: rect.height
                            });
                        });
                    });

                    // 添加新增新闻部分
                    if (newSection) {
                        const rect = newSection.getBoundingClientRect();
                        elements.push({
                            type: 'new-section',
                            element: newSection,
                            top: rect.top - containerRect.top,
                            bottom: rect.bottom - containerRect.top,
                            height: rect.height
                        });
                    }

                    // 添加footer
                    const footerRect = footer.getBoundingClientRect();
                    elements.push({
                        type: 'footer',
                        element: footer,
                        top: footerRect.top - containerRect.top,
                        bottom: footerRect.bottom - containerRect.top,
                        height: footer.offsetHeight
                    });

                    // 计算分割点
                    const segments = [];
                    let currentSegment = { start: 0, end: 0, height: 0, includeHeader: true };
                    let headerHeight = header.offsetHeight;
                    currentSegment.height = headerHeight;

                    for (let i = 1; i < elements.length; i++) {
                        const element = elements[i];
                        const potentialHeight = element.bottom - currentSegment.start;

                        // 检查是否需要创建新分段
                        if (potentialHeight > maxHeight && currentSegment.height > headerHeight) {
                            // 在前一个元素结束处分割
                            currentSegment.end = elements[i - 1].bottom;
                            segments.push(currentSegment);

                            // 开始新分段
                            currentSegment = {
                                start: currentSegment.end,
                                end: 0,
                                height: element.bottom - currentSegment.end,
                                includeHeader: false
                            };
                        } else {
                            currentSegment.height = potentialHeight;
                            currentSegment.end = element.bottom;
                        }
                    }

                    // 添加最后一个分段
                    if (currentSegment.height > 0) {
                        currentSegment.end = container.offsetHeight;
                        segments.push(currentSegment);
                    }

                    button.textContent = `生成中 (0/${segments.length})...`;

                    // 隐藏保存按钮
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'hidden';

                    // 为每个分段生成图片
                    const images = [];
                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i];
                        button.textContent = `生成中 (${i + 1}/${segments.length})...`;

                        // 创建临时容器用于截图
                        const tempContainer = document.createElement('div');
                        tempContainer.style.cssText = `
                            position: absolute;
                            left: -9999px;
                            top: 0;
                            width: ${container.offsetWidth}px;
                            background: white;
                        `;
                        tempContainer.className = 'container';

                        // 克隆容器内容
                        const clonedContainer = container.cloneNode(true);

                        // 移除克隆内容中的保存按钮
                        const clonedButtons = clonedContainer.querySelector('.save-buttons');
                        if (clonedButtons) {
                            clonedButtons.style.display = 'none';
                        }

                        tempContainer.appendChild(clonedContainer);
                        document.body.appendChild(tempContainer);

                        // 等待DOM更新
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // 使用html2canvas截取特定区域
                        const canvas = await html2canvas(clonedContainer, {
                            backgroundColor: '#ffffff',
                            scale: scale,
                            useCORS: true,
                            allowTaint: false,
                            imageTimeout: 10000,
                            logging: false,
                            width: container.offsetWidth,
                            height: segment.end - segment.start,
                            x: 0,
                            y: segment.start,
                            windowWidth: window.innerWidth,
                            windowHeight: window.innerHeight
                        });

                        images.push(canvas.toDataURL('image/png', 1.0));

                        // 清理临时容器
                        document.body.removeChild(tempContainer);
                    }

                    // 恢复按钮显示
                    buttons.style.visibility = 'visible';

                    // 下载所有图片
                    const now = new Date();
                    const baseFilename = `TrendRadar_热点新闻分析_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

                    for (let i = 0; i < images.length; i++) {
                        const link = document.createElement('a');
                        link.download = `${baseFilename}_part${i + 1}.png`;
                        link.href = images[i];
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        // 延迟一下避免浏览器阻止多个下载
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    button.textContent = `已保存 ${segments.length} 张图片!`;
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    console.error('分段保存失败:', error);
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'visible';
                    button.textContent = '保存失败';
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);
                }
            }

            document.addEventListener('DOMContentLoaded', function() {
                window.scrollTo(0, 0);
            });
        </script>
    </body>
    </html>
    """

    return html
