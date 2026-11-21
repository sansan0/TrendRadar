# coding=utf-8
"""
HTML 报告渲染模块

提供 HTML 格式的热点新闻报告生成功能
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable

from trendradar.report.helpers import html_escape, calculate_rank_trend
from trendradar.utils.time import convert_time_for_display
from trendradar.ai.formatter import render_ai_analysis_html_rich


_EMAIL_STRIP_DOM_RE = re.compile(
    r"<!--EMAIL_STRIP_START-->.*?<!--EMAIL_STRIP_END-->", re.DOTALL
)
_EMAIL_STRIP_CSS_RE = re.compile(
    r"/\*EMAIL_STRIP_CSS_START\*/.*?/\*EMAIL_STRIP_CSS_END\*/", re.DOTALL
)
_EMAIL_TOC_RE = re.compile(
    r"<!--EMAIL_TOC_START:(.*?):EMAIL_TOC_END-->", re.DOTALL
)
_EMAIL_DATA_ATTR_RE = re.compile(
    r'\s+data-(?:rank-(?:timeline|source)|copy-query|ai-accent)="[^"]*"'
)
_SCRIPT_TAG_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.DOTALL | re.IGNORECASE)


def prepare_html_for_email(html_content: str) -> str:
    """将网页版 HTML 报告净化为高兼容、轻量的邮件专用 HTML。

    邮件客户端普遍剥离 JavaScript，且部分客户端会过滤 CSS 或在超过 102KB（如 Gmail）
    时强制截断正文。该函数在不修改本地网页版 HTML 的前提下：
    1. 移除全部 <script> 及仅浏览器可用的交互控件（导出按钮、宽屏/暗色开关、
       搜索框、区域切换按钮栏、热榜/独立区/联网搜索 Tab 栏、悬浮工具栏、动态水印、
       排名变化轨迹浮层数据等）；
    2. 移除 wide-mode / dark-mode 等邮件无效 CSS，显著缩小邮件体积避免 Gmail 截断；
    3. 释放零 JS 的纯静态锚点目录条（.email-toc），确保全部主题和分区纵向完整展开可见。
    """
    if not html_content:
        return html_content

    cleaned = _EMAIL_STRIP_CSS_RE.sub("", html_content)
    cleaned = _EMAIL_STRIP_DOM_RE.sub("", cleaned)
    cleaned = _EMAIL_TOC_RE.sub(r"\1", cleaned)
    cleaned = _EMAIL_DATA_ATTR_RE.sub("", cleaned)
    # 兜底移除任何残留脚本标签（兼容外部传入或旧版生成的 HTML 文件）
    cleaned = _SCRIPT_TAG_RE.sub("", cleaned)
    # 压缩多余连续空行，进一步减小邮件体积
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned


def render_html_content(
    report_data: Dict,
    total_titles: int,
    mode: str = "daily",
    update_info: Optional[Dict] = None,
    *,
    region_order: Optional[List[str]] = None,
    get_time_func: Optional[Callable[[], datetime]] = None,
    rss_items: Optional[List[Dict]] = None,
    rss_new_items: Optional[List[Dict]] = None,
    display_mode: str = "keyword",
    standalone_data: Optional[Dict] = None,
    ai_analysis: Optional[Any] = None,
    show_new_section: bool = True,
    search_items: Optional[List[Dict]] = None,
    search_new_items: Optional[List[Dict]] = None,
) -> str:
    """渲染HTML内容

    Args:
        report_data: 报告数据字典，包含 stats, new_titles, failed_ids, total_new_count
        total_titles: 新闻总数
        mode: 报告模式 ("daily", "current", "incremental")
        update_info: 更新信息（可选）
        region_order: 区域显示顺序列表
        get_time_func: 获取当前时间的函数（可选，默认使用 datetime.now）
        rss_items: RSS 统计条目列表（可选）
        rss_new_items: RSS 新增条目列表（可选）
        display_mode: 显示模式 ("keyword"=按关键词分组, "platform"=按平台分组)
        standalone_data: 独立展示区数据（可选），包含 platforms 和 rss_feeds
        ai_analysis: AI 分析结果对象（可选），AIAnalysisResult 实例
        show_new_section: 是否显示新增热点区域
        search_items: 联网搜索统计条目列表（可选）
        search_new_items: 联网搜索新增条目列表（可选）

    Returns:
        渲染后的 HTML 字符串
    """
    # 默认区域顺序
    default_region_order = ["hotlist", "rss", "web_search", "new_items", "standalone", "ai_analysis"]
    if region_order is None:
        region_order = default_region_order

    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>热点新闻分析</title>
        <!--EMAIL_STRIP_START--><script defer src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" integrity="sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script><!--EMAIL_STRIP_END-->
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
            /*EMAIL_STRIP_CSS_START*/
            body.animating-width .container {
                transition: max-width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
            }
            /*EMAIL_STRIP_CSS_END*/

            .header {
                background-color: #4f46e5;
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                padding: 32px 24px 26px 24px;
                text-align: center;
                position: relative;
                z-index: 20;
                overflow: visible;
            }

            /*EMAIL_STRIP_CSS_START*/
            .header-watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: clamp(40px, 8vw, 80px);
                font-weight: 900;
                letter-spacing: 0.05em;
                color: rgba(255, 255, 255, 0.15);
                pointer-events: none;
                z-index: 1;
                white-space: nowrap;
                -webkit-mask-image: radial-gradient(circle 0px at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
                mask-image: radial-gradient(circle 0px at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
                transition: -webkit-mask-image 0.3s ease, mask-image 0.3s ease;
                user-select: none;
            }

            .save-buttons {
                position: absolute;
                top: 16px;
                right: 16px;
                display: flex;
                gap: 8px;
                z-index: 10;
            }

            .save-btn-group {
                position: relative;
                display: flex;
            }

            .save-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 18px;
                border-radius: 6px 0 0 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                white-space: nowrap;
                min-height: 38px;
                border-right: none;
            }

            .save-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .save-btn:active {
                transform: translateY(0);
            }

            .save-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .save-dropdown-trigger {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 10px;
                border-radius: 0 6px 6px 0;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                min-height: 38px;
                display: flex;
                align-items: center;
            }

            .save-dropdown-trigger:hover {
                background: rgba(255, 255, 255, 0.35);
            }

            .save-dropdown-menu {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 4px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(0, 0, 0, 0.08);
                border-radius: 10px;
                padding: 4px;
                min-width: 140px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-4px);
                transition: all 0.2s ease;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }

            .save-btn-group:hover .save-dropdown-menu,
            .save-dropdown-menu:hover {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            .save-dropdown-item {
                display: block;
                width: 100%;
                padding: 9px 14px;
                background: none;
                border: none;
                color: #374151;
                font-size: 13px;
                cursor: pointer;
                border-radius: 6px;
                text-align: left;
                transition: background 0.15s;
                white-space: nowrap;
            }

            .save-dropdown-item:hover {
                background: #f3f4f6;
                color: #4f46e5;
            }

            .dropdown-icon {
                width: 14px;
                height: 14px;
                margin-right: 8px;
                vertical-align: -2px;
                flex-shrink: 0;
            }
            /*EMAIL_STRIP_CSS_END*/

            .header-title {
                font-size: 22px;
                font-weight: 700;
                margin: 0 0 20px 0;
                position: relative;
                z-index: 2;
            }

            .header-info {
                position: relative;
                z-index: 30;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                font-size: 14px;
                opacity: 0.95;
            }

            .info-item {
                text-align: center;
                position: relative;
                padding: 6px 8px;
                border-radius: 10px;
            }

            .info-label {
                display: block;
                font-size: 12px;
                opacity: 0.82;
                margin-bottom: 4px;
            }

            .info-value {
                font-weight: 600;
                font-size: 16px;
                letter-spacing: 0.2px;
            }

            /* 三数据源紧凑统计行（无 Emoji、无框通透，600px 邮件与宽屏均水平 3 列对称） */
            .header-sources-bar {
                position: relative;
                z-index: 20;
                display: table;
                width: 100%;
                table-layout: fixed;
                margin-top: 14px;
                padding-top: 14px;
                border-top: 1px solid rgba(255, 255, 255, 0.18);
                text-align: center;
            }

            .header-source-card {
                display: table-cell;
                vertical-align: top;
                padding: 0 6px;
                border-right: 1px solid rgba(255, 255, 255, 0.15);
            }

            .header-source-card:last-child {
                border-right: none;
            }

            .source-card-inner {
                position: relative;
                display: block;
                padding: 8px 10px;
                border-radius: 10px;
            }

            .source-card-label {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                font-size: 12px;
                opacity: 0.86;
                margin-bottom: 4px;
            }

            .source-card-dot {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                vertical-align: middle;
                margin-right: 4px;
            }
            .dot-hotlist { background-color: #c7d2fe; }
            .dot-rss { background-color: #6ee7b7; }
            .dot-search { background-color: #fcd34d; }
            .dot-new { background-color: #fda4af; }
            .dot-standalone { background-color: #93c5fd; }
            .dot-ai { background-color: #7dd3fc; }

            .source-card-value {
                display: block;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.3;
                letter-spacing: 0.2px;
            }

            .source-card-sub {
                display: block;
                font-size: 11px;
                opacity: 0.78;
                margin-top: 3px;
            }

            /* 邮件客户端静态锚点目录条（零 JS、无 Emoji，仅邮件版释放展示） */
            .email-toc {
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 20px;
                font-size: 12px;
                color: #475569;
                line-height: 1.8;
            }

            .email-toc-label {
                font-weight: 600;
                color: #334155;
                margin-right: 8px;
            }

            .email-toc-link {
                display: inline-block;
                color: #4f46e5;
                text-decoration: none;
                font-weight: 500;
                margin-right: 12px;
            }

            .email-toc-link.toc-rss { color: #059669; }
            .email-toc-link.toc-search { color: #d97706; }
            .email-toc-link.toc-new { color: #e11d48; }
            .email-toc-link.toc-ai { color: #0369a1; }

            .email-toc-dot {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                margin-right: 5px;
                vertical-align: 1px;
                background-color: #4f46e5;
            }
            .toc-rss .email-toc-dot { background-color: #10b981; }
            .toc-search .email-toc-dot { background-color: #f59e0b; }
            .toc-new .email-toc-dot { background-color: #f43f5e; }
            .toc-ai .email-toc-dot { background-color: #0ea5e9; }

            /* 新上榜标记（柔和克制胶囊风格，网页与邮件通用） */
            .badge-new {
                display: inline-block;
                background-color: #fff1f2;
                color: #e11d48;
                border: 1px solid #fecdd3;
                font-size: 10px;
                font-weight: 600;
                padding: 1px 6.5px;
                border-radius: 999px;
                vertical-align: middle;
                letter-spacing: 0.4px;
                line-height: 1.4;
            }

            /*EMAIL_STRIP_CSS_START*/
            /* 线性 SVG 通用图标样式 */
            .ui-icon {
                width: 14px;
                height: 14px;
                flex-shrink: 0;
                display: inline-block;
                vertical-align: -2px;
            }
            .header-source-card .source-card-dot { display: none; }

            /* Header 数据指标悬停交互与毛玻璃明细浮层 */
            .metric-interactive,
            .source-card-inner {
                transition: background-color 0.2s ease, transform 0.2s ease;
                outline: none;
            }
            .metric-interactive:hover,
            .metric-interactive:focus-within,
            .metric-interactive.tip-open {
                background: rgba(255, 255, 255, 0.13);
                border-radius: 10px;
                z-index: 50;
            }
            .source-card-inner.metric-clickable {
                cursor: pointer;
            }
            .source-card-inner.metric-clickable:hover,
            .source-card-inner.metric-clickable:focus-within,
            .source-card-inner.tip-open {
                background: rgba(255, 255, 255, 0.13);
                z-index: 50;
            }
            .metric-value-hint {
                display: inline-block;
                border-bottom: 1px dashed rgba(255, 255, 255, 0.42);
                padding-bottom: 1px;
                transition: border-color 0.2s ease;
            }
            .metric-interactive:hover .metric-value-hint,
            .metric-interactive:focus-within .metric-value-hint,
            .metric-interactive.tip-open .metric-value-hint,
            .source-card-inner.metric-clickable:hover .metric-value-hint,
            .source-card-inner.tip-open .metric-value-hint {
                border-bottom-color: rgba(255, 255, 255, 0.92);
            }

            .metric-tooltip {
                position: absolute;
                top: calc(100% + 10px);
                left: 50%;
                transform: translateX(-50%) translateY(6px) scale(0.97);
                min-width: 224px;
                max-width: 276px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                color: #f8fafc;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 12px;
                padding: 12px 14px;
                text-align: left;
                box-shadow: 0 14px 36px rgba(15, 23, 42, 0.42), 0 2px 8px rgba(0, 0, 0, 0.22);
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transition: opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                            transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                            visibility 0.2s;
                z-index: 90;
                font-weight: 400;
                line-height: 1.5;
            }
            .metric-tooltip::before {
                content: "";
                position: absolute;
                top: -5px;
                left: 50%;
                width: 9px;
                height: 9px;
                background: rgba(15, 23, 42, 0.95);
                border-left: 1px solid rgba(255, 255, 255, 0.16);
                border-top: 1px solid rgba(255, 255, 255, 0.16);
                transform: translateX(-50%) rotate(45deg);
            }
            .metric-tooltip.tip-align-left {
                left: 0;
                transform: translateY(6px) scale(0.97);
            }
            .metric-tooltip.tip-align-left::before { left: 28px; transform: rotate(45deg); }
            .metric-tooltip.tip-align-right {
                left: auto;
                right: 0;
                transform: translateY(6px) scale(0.97);
            }
            .metric-tooltip.tip-align-right::before { left: auto; right: 28px; transform: rotate(45deg); }
            /* 宽屏下列宽充足，统一居中对齐使箭头正指数字正下方 */
            body.wide-mode .metric-tooltip.tip-align-left,
            body.wide-mode .metric-tooltip.tip-align-right {
                left: 50%;
                right: auto;
                transform: translateX(-50%) translateY(6px) scale(0.97);
            }
            body.wide-mode .metric-tooltip.tip-align-left::before,
            body.wide-mode .metric-tooltip.tip-align-right::before {
                left: 50%;
                right: auto;
                transform: translateX(-50%) rotate(45deg);
            }

            .metric-interactive:hover .metric-tooltip,
            .metric-interactive:focus-within .metric-tooltip,
            .metric-interactive.tip-open .metric-tooltip,
            .source-card-inner:hover .metric-tooltip,
            .source-card-inner:focus-within .metric-tooltip,
            .source-card-inner.tip-open .metric-tooltip {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0) scale(1);
            }
            .metric-interactive:hover .metric-tooltip.tip-align-left,
            .metric-interactive:focus-within .metric-tooltip.tip-align-left,
            .metric-interactive.tip-open .metric-tooltip.tip-align-left,
            .source-card-inner:hover .metric-tooltip.tip-align-left,
            .source-card-inner:focus-within .metric-tooltip.tip-align-left,
            .source-card-inner.tip-open .metric-tooltip.tip-align-left,
            .metric-interactive:hover .metric-tooltip.tip-align-right,
            .metric-interactive:focus-within .metric-tooltip.tip-align-right,
            .metric-interactive.tip-open .metric-tooltip.tip-align-right,
            .source-card-inner:hover .metric-tooltip.tip-align-right,
            .source-card-inner:focus-within .metric-tooltip.tip-align-right,
            .source-card-inner.tip-open .metric-tooltip.tip-align-right {
                transform: translateY(0) scale(1);
            }
            body.wide-mode .metric-interactive:hover .metric-tooltip.tip-align-left,
            body.wide-mode .metric-interactive:focus-within .metric-tooltip.tip-align-left,
            body.wide-mode .metric-interactive.tip-open .metric-tooltip.tip-align-left,
            body.wide-mode .source-card-inner:hover .metric-tooltip.tip-align-left,
            body.wide-mode .source-card-inner:focus-within .metric-tooltip.tip-align-left,
            body.wide-mode .source-card-inner.tip-open .metric-tooltip.tip-align-left,
            body.wide-mode .metric-interactive:hover .metric-tooltip.tip-align-right,
            body.wide-mode .metric-interactive:focus-within .metric-tooltip.tip-align-right,
            body.wide-mode .metric-interactive.tip-open .metric-tooltip.tip-align-right,
            body.wide-mode .source-card-inner:hover .metric-tooltip.tip-align-right,
            body.wide-mode .source-card-inner:focus-within .metric-tooltip.tip-align-right,
            body.wide-mode .source-card-inner.tip-open .metric-tooltip.tip-align-right {
                transform: translateX(-50%) translateY(0) scale(1);
            }

            .tip-header {
                font-size: 12px;
                font-weight: 600;
                color: #f8fafc;
                margin-bottom: 8px;
                padding-bottom: 6px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .tip-badge {
                font-size: 10px;
                font-weight: 500;
                color: #cbd5e1;
                background: rgba(255, 255, 255, 0.1);
                padding: 1px 6px;
                border-radius: 999px;
            }
            .tip-list {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .tip-line {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                font-size: 12px;
                color: #cbd5e1;
            }
            .tip-line-label {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
            }
            .tip-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .tip-line-val {
                font-weight: 600;
                color: #ffffff;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }
            .tip-foot {
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                font-size: 11px;
                color: #94a3b8;
            }
            .tip-foot-action {
                color: #a5b4fc;
                font-weight: 500;
            }

            /* 顶部区域分段滑块导航栏（浏览器增强，邮件和截图隐藏） */
            .section-nav-bar {
                display: none;
                margin-bottom: 18px;
                padding-bottom: 12px;
                border-bottom: 1px solid #f1f5f9;
            }

            .section-nav-track {
                position: relative;
                display: inline-flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 4px;
                padding: 4px;
                background: #f1f5f9;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                max-width: 100%;
            }

            .section-nav-indicator {
                position: absolute;
                top: 4px;
                left: 0;
                height: calc(100% - 8px);
                border-radius: 8px;
                background: #4f46e5;
                box-shadow: 0 2px 8px rgba(79, 70, 229, 0.28);
                transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            top 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            height 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                            background-color 0.22s ease,
                            box-shadow 0.22s ease;
                pointer-events: none;
                z-index: 1;
                opacity: 0;
            }
            .section-nav-indicator.ready { opacity: 1; }
            .section-nav-indicator[data-accent="rss"] {
                background: #059669;
                box-shadow: 0 2px 8px rgba(5, 150, 105, 0.28);
            }
            .section-nav-indicator[data-accent="web_search"] {
                background: #d97706;
                box-shadow: 0 2px 8px rgba(217, 119, 6, 0.3);
            }
            .section-nav-indicator[data-accent="new_items"] {
                background: #e11d48;
                box-shadow: 0 2px 8px rgba(225, 29, 72, 0.28);
            }
            .section-nav-indicator[data-accent="standalone"] {
                background: #0d9488;
                box-shadow: 0 2px 8px rgba(13, 148, 136, 0.28);
            }
            .section-nav-indicator[data-accent="ai_analysis"] {
                background: #0284c7;
                box-shadow: 0 2px 8px rgba(2, 132, 199, 0.28);
            }

            .section-nav-btn {
                position: relative;
                z-index: 2;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 7px 13px;
                border: none;
                background: transparent;
                color: #475569;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                transition: color 0.2s ease, background-color 0.2s ease, transform 0.15s ease;
            }

            .section-nav-btn:hover:not(.active) {
                color: #1e293b;
                background: rgba(255, 255, 255, 0.65);
            }

            .section-nav-btn:active {
                transform: scale(0.98);
            }

            .section-nav-btn.active {
                color: #ffffff !important;
            }

            .nav-pill-count {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
                height: 18px;
                padding: 0 5px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                background: rgba(15, 23, 42, 0.08);
                color: #64748b;
                transition: background-color 0.2s ease, color 0.2s ease;
                font-variant-numeric: tabular-nums;
            }

            .section-nav-btn.active .nav-pill-count {
                background: rgba(255, 255, 255, 0.24);
                color: #ffffff;
            }

            .section-divider.region-first-visible:not(.ai-section) {
                margin-top: 0;
                padding-top: 0;
                border-top: none;
            }
            .ai-section.region-first-visible {
                margin-top: 0;
            }
            /*EMAIL_STRIP_CSS_END*/

            .content {
                position: relative;
                z-index: 1;
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
                position: relative;
            }
            /*EMAIL_STRIP_CSS_START*/
            .news-number { cursor: pointer; transition: background 0.15s, color 0.15s; }
            .news-number .num-text { transition: opacity 0.15s; }
            .news-number .copy-icon {
                position: absolute;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .news-item:hover .news-number .num-text,
            .search-item:hover .news-number .num-text { opacity: 0; }
            .news-item:hover .news-number .copy-icon,
            .search-item:hover .news-number .copy-icon { opacity: 1; }
            .news-item:hover .news-number {
                background: #eef2ff;
                color: #4f46e5;
            }
            .search-item:hover .news-number {
                background: #fef3c7;
                color: #d97706;
            }
            .news-number.copied {
                background: #dcfce7 !important;
            }
            .news-number.copied .num-text { opacity: 0 !important; }
            .news-number.copied .copy-icon { opacity: 1 !important; }
            body.dark-mode .news-item:hover .news-number {
                background: #4338ca;
                color: #e0e7ff;
            }
            body.dark-mode .search-item:hover .news-number {
                background: #78350f;
                color: #fef3c7;
            }
            body.dark-mode .news-number.copied {
                background: #166534 !important;
            }
            /*EMAIL_STRIP_CSS_END*/

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

            /* 排名趋势微标（零 Emoji，线性 SVG + 邮件纯符号兜底） */
            .trend-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 1px 5px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.2;
                vertical-align: middle;
            }
            .trend-badge.trend-up {
                color: #e11d48;
                background-color: #fff1f2;
            }
            .trend-badge.trend-down {
                color: #64748b;
                background-color: #f1f5f9;
            }
            .trend-email-glyph { display: inline; }

            /* 排名轨迹触发芯片（基础态干净无干扰，浏览器增强态支持悬停/点击弹出走势卡） */
            .rank-trigger {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            /*EMAIL_STRIP_CSS_START*/
            .trend-email-glyph { display: none; }
            .trend-svg {
                width: 12px;
                height: 12px;
                display: block;
            }
            .rank-trigger[data-rank-timeline] {
                padding: 2px 6px 2px 2px;
                margin: -2px -2px -2px 0;
                border-radius: 999px;
                cursor: pointer;
                transition: background-color 0.18s ease, box-shadow 0.18s ease;
                outline: none;
            }
            .rank-trigger[data-rank-timeline]:hover,
            .rank-trigger[data-rank-timeline]:focus-visible,
            .rank-trigger[data-rank-timeline].popover-active {
                background: rgba(79, 70, 229, 0.08);
                box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.18);
            }
            .rank-spark-hint {
                display: inline-flex;
                align-items: center;
                color: #94a3b8;
                margin-left: 1px;
                transition: color 0.18s ease, transform 0.18s ease;
            }
            .rank-trigger[data-rank-timeline]:hover .rank-spark-hint,
            .rank-trigger[data-rank-timeline].popover-active .rank-spark-hint {
                color: #4f46e5;
                transform: scale(1.08);
            }
            body.dark-mode .trend-badge.trend-up {
                color: #fb7185;
                background-color: rgba(244, 63, 94, 0.18);
            }
            body.dark-mode .trend-badge.trend-down {
                color: #94a3b8;
                background-color: rgba(148, 163, 184, 0.16);
            }
            body.dark-mode .rank-trigger[data-rank-timeline]:hover,
            body.dark-mode .rank-trigger[data-rank-timeline]:focus-visible,
            body.dark-mode .rank-trigger[data-rank-timeline].popover-active {
                background: rgba(129, 140, 248, 0.16);
                box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.3);
            }
            body.dark-mode .rank-trigger[data-rank-timeline]:hover .rank-spark-hint,
            body.dark-mode .rank-trigger[data-rank-timeline].popover-active .rank-spark-hint {
                color: #a5b4fc;
            }

            /* 全局共享：排名变化轨迹毛玻璃浮层 */
            .rank-popover {
                position: fixed;
                top: 0;
                left: 0;
                width: 300px;
                max-width: calc(100vw - 24px);
                background: rgba(15, 23, 42, 0.96);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                color: #f8fafc;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 14px;
                padding: 14px 15px 12px 15px;
                box-shadow: 0 18px 44px rgba(15, 23, 42, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25);
                z-index: 1200;
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
                transform: translateY(6px) scale(0.97);
                transition: opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1),
                            transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                            visibility 0.18s;
                font-size: 12px;
                line-height: 1.5;
            }
            .rank-popover.visible {
                opacity: 1;
                visibility: visible;
                pointer-events: auto;
                transform: translateY(0) scale(1);
            }
            .rank-popover-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .rank-popover-title-wrap {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            .rank-popover-title {
                font-size: 12.5px;
                font-weight: 600;
                color: #f8fafc;
                white-space: nowrap;
            }
            .rank-popover-source {
                font-size: 11px;
                color: #94a3b8;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .rank-popover-right {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .rank-delta-pill {
                font-size: 10.5px;
                font-weight: 600;
                padding: 2px 7px;
                border-radius: 999px;
                white-space: nowrap;
            }
            .rank-delta-pill.up { background: rgba(244, 63, 94, 0.22); color: #fda4af; }
            .rank-delta-pill.down { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
            .rank-delta-pill.flat { background: rgba(99, 102, 241, 0.24); color: #c7d2fe; }
            .rank-delta-pill.single { background: rgba(16, 185, 129, 0.22); color: #6ee7b7; }
            .rank-popover-close {
                display: none;
                width: 20px;
                height: 20px;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                cursor: pointer;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: background 0.15s ease, color 0.15s ease;
            }
            .rank-popover.pinned .rank-popover-close { display: inline-flex; }
            .rank-popover-close:hover { background: rgba(255, 255, 255, 0.24); color: #ffffff; }

            .rank-chart-wrap {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.07);
                border-radius: 10px;
                padding: 8px 8px 4px 8px;
                margin-bottom: 10px;
            }
            .rank-chart-svg {
                width: 100%;
                height: auto;
                display: block;
                overflow: visible;
            }
            .rank-points-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
                max-height: 204px;
                overflow-y: auto;
                padding-right: 2px;
            }
            .rank-points-list::-webkit-scrollbar { width: 4px; }
            .rank-points-list::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.35);
                border-radius: 4px;
            }
            .rank-point-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 3.5px 8px;
                border-radius: 7px;
                background: rgba(255, 255, 255, 0.035);
                font-variant-numeric: tabular-nums;
            }
            .rank-point-row.is-latest {
                background: rgba(99, 102, 241, 0.16);
                border: 1px solid rgba(129, 140, 248, 0.24);
            }
            .rank-point-left {
                display: inline-flex;
                align-items: center;
                gap: 7px;
            }
            .rank-point-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #818cf8;
                flex-shrink: 0;
            }
            .rank-point-dot.top { background: #fb7185; }
            .rank-point-dot.off { background: transparent; border: 1.5px solid #64748b; }
            .rank-point-time {
                color: #cbd5e1;
                font-size: 11.5px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            }
            .rank-point-right {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .rank-point-rank {
                font-weight: 600;
                color: #ffffff;
                font-size: 12px;
            }
            .rank-point-rank.off { color: #94a3b8; font-weight: 500; }
            .rank-point-diff {
                font-size: 10.5px;
                min-width: 34px;
                text-align: right;
                font-weight: 500;
            }
            .rank-point-diff.up { color: #fda4af; }
            .rank-point-diff.down { color: #94a3b8; }
            .rank-point-diff.flat { color: #64748b; }
            .rank-point-diff.tag { color: #a5b4fc; }
            .rank-popover-foot {
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 10.5px;
                color: #94a3b8;
            }
            /*EMAIL_STRIP_CSS_END*/

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

            /* 通用区域分割线样式 */
            .section-divider {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 2px solid #e5e7eb;
            }

            /* 热榜统计区样式 */
            .hotlist-section {
                /* 默认无边框，由 section-divider 动态添加 */
            }

            /* 通用板块头部图标徽章与计数胶囊 */
            .section-heading-left {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }
            .section-icon-badge {
                width: 28px;
                height: 28px;
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .section-icon-badge .ui-icon,
            .section-icon-badge .ai-title-icon {
                width: 15px;
                height: 15px;
                vertical-align: 0;
            }
            .section-icon-badge.badge-rss {
                background-color: #ecfdf5;
                background: rgba(16, 185, 129, 0.11);
                color: #059669;
            }
            .section-icon-badge.badge-search {
                background-color: #fffbeb;
                background: rgba(245, 158, 11, 0.12);
                color: #d97706;
            }
            .section-icon-badge.badge-standalone {
                background-color: #f0fdfa;
                background: rgba(13, 148, 136, 0.11);
                color: #0d9488;
            }
            .section-icon-badge.badge-new-sec {
                background-color: #fff1f2;
                background: rgba(244, 63, 94, 0.1);
                color: #e11d48;
            }
            .section-icon-badge.badge-ai {
                background-color: #eef2ff;
                background: linear-gradient(135deg, rgba(79, 70, 229, 0.13), rgba(14, 165, 233, 0.13));
                color: #4f46e5;
            }
            .section-count-pill {
                display: inline-flex;
                align-items: center;
                padding: 3px 10px;
                border-radius: 999px;
                background-color: #f1f5f9;
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }
            .group-dot {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .group-dot.dot-rss { background-color: #10b981; }
            .group-dot.dot-search { background-color: #f59e0b; }
            .group-dot.dot-standalone { background-color: #0d9488; }
            .group-dot.dot-new { background-color: #f43f5e; }

            .new-section {
                margin-top: 32px;
                padding-top: 24px;
            }

            .new-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 18px;
            }

            .new-section-title {
                color: #0f172a;
                font-size: 17px;
                font-weight: 600;
                letter-spacing: -0.01em;
                margin: 0;
            }

            .new-source-group {
                margin-bottom: 16px;
                padding: 15px 18px;
                background-color: #ffffff;
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 14px;
            }

            .new-source-group:last-child {
                margin-bottom: 0;
            }

            .new-source-title {
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: #0f172a;
                font-size: 14px;
                font-weight: 600;
                margin: 0 0 10px 0;
                padding-bottom: 10px;
                border-bottom: 1px solid #f1f5f9;
            }
            .new-source-title-left {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .new-source-count {
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
            }

            .new-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 9px 6px;
                margin: 0 -6px;
                border-bottom: 1px solid #f8fafc;
                border-radius: 8px;
            }

            .new-item:last-child {
                border-bottom: none;
                padding-bottom: 2px;
            }

            .new-item-number {
                color: #64748b;
                font-size: 11.5px;
                font-weight: 600;
                min-width: 22px;
                text-align: center;
                flex-shrink: 0;
                background: #f1f5f9;
                border-radius: 50%;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .new-item-rank {
                color: #fff;
                background: #64748b;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6.5px;
                border-radius: 999px;
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
                line-height: 1.48;
                color: #0f172a;
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
                .header-sources-bar { display: block; }
                .header-source-card { display: block; border-right: none; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
                .header-source-card:last-child { border-bottom: none; padding-bottom: 0; }
                .news-header { gap: 6px; }
                .news-content { padding-right: 45px; }
                .news-item { gap: 8px; }
                .new-item { gap: 8px; }
                .news-number { width: 20px; height: 20px; font-size: 12px; }
                /*EMAIL_STRIP_CSS_START*/
                .save-buttons {
                    position: static;
                    margin-bottom: 16px;
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                    width: 100%;
                }
                .save-btn-group {
                    flex: 1;
                }
                .save-btn {
                    width: 100%;
                    border-radius: 6px 0 0 6px;
                }
                /*EMAIL_STRIP_CSS_END*/
            }

            /* RSS 订阅内容样式（极简中性卡片 + 翡翠绿微点缀） */
            .rss-section {
                margin-top: 32px;
                padding-top: 24px;
            }

            .rss-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 18px;
            }

            .rss-section-title {
                font-size: 17px;
                font-weight: 600;
                letter-spacing: -0.01em;
                color: #0f172a;
            }

            .rss-section-count {
                display: inline-flex;
                align-items: center;
                padding: 3px 10px;
                border-radius: 999px;
                background-color: #f1f5f9;
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }

            .feed-group {
                margin-bottom: 22px;
            }

            .feed-group:last-child {
                margin-bottom: 0;
            }

            .feed-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 9px;
                border-bottom: 1px solid #e2e8f0;
            }

            .feed-name-wrap {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .feed-name {
                font-size: 14.5px;
                font-weight: 600;
                color: #0f172a;
            }

            .feed-count {
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }

            .rss-item {
                margin-bottom: 10px;
                padding: 14px 16px;
                background-color: #ffffff;
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 12px;
                position: relative;
            }

            .rss-item:last-child {
                margin-bottom: 0;
            }

            .rss-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }

            .rss-meta-left {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                min-width: 0;
            }

            .rss-author {
                display: inline-block;
                background-color: #ecfdf5;
                background: rgba(16, 185, 129, 0.09);
                color: #047857;
                font-size: 11.5px;
                font-weight: 500;
                padding: 2px 8px;
                border-radius: 6px;
                line-height: 1.4;
            }

            .rss-time {
                color: #94a3b8;
                font-size: 11.5px;
                font-variant-numeric: tabular-nums;
            }

            .rss-title {
                font-size: 14.5px;
                line-height: 1.52;
                margin: 0;
            }

            .rss-link {
                color: #0f172a;
                text-decoration: none;
                font-weight: 500;
            }

            .rss-link:hover {
                color: #059669;
            }

            .rss-summary {
                font-size: 13px;
                color: #64748b;
                line-height: 1.55;
                margin: 6px 0 0 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            /* 联网搜索区域样式（极简白卡 + 琥珀微点缀） */
            .search-section {
                margin-top: 32px;
                padding-top: 24px;
            }

            .search-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 18px;
            }

            .search-section-title {
                font-size: 17px;
                font-weight: 600;
                letter-spacing: -0.01em;
                color: #0f172a;
            }

            .search-section-count {
                display: inline-flex;
                align-items: center;
                padding: 3px 10px;
                border-radius: 999px;
                background-color: #f1f5f9;
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }

            /*EMAIL_STRIP_CSS_START*/
            .search-tab-bar-wrapper {
                position: relative;
                display: none;
                margin-bottom: 18px;
                align-items: stretch;
                border-bottom: 1px solid #e2e8f0;
                background: white;
            }

            .search-tab-bar .tab-btn.active {
                background: #d97706;
                color: white;
                box-shadow: 0 2px 8px rgba(217, 119, 6, 0.24);
            }

            .search-tab-bar-wrapper .tab-scroll-indicator {
                background: #d97706;
            }

            .search-tab-bar-wrapper .tab-arrow:hover {
                color: #d97706;
            }
            /*EMAIL_STRIP_CSS_END*/

            .search-topic-group {
                margin-bottom: 24px;
            }

            .search-topic-group:last-child {
                margin-bottom: 0;
            }

            .search-topic-header {
                margin-bottom: 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e2e8f0;
            }

            .search-topic-header-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .search-topic-info {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                min-width: 0;
            }

            .search-topic-name {
                font-size: 14.5px;
                font-weight: 600;
                color: #0f172a;
            }

            .search-provider-badge {
                display: inline-block;
                background-color: #f8fafc;
                color: #475569;
                border: 1px solid #e2e8f0;
                font-size: 11px;
                font-weight: 500;
                padding: 1px 8px;
                border-radius: 999px;
                line-height: 1.45;
            }

            .search-topic-count {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                flex-shrink: 0;
                font-variant-numeric: tabular-nums;
            }

            .search-query-hint {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 11.5px;
                color: #64748b;
                background-color: #f8fafc;
                border: 1px solid rgba(15, 23, 42, 0.06);
                border-radius: 7px;
                padding: 3px 9px;
                margin-top: 8px;
                word-break: break-word;
                max-width: 100%;
            }

            .search-item {
                display: flex;
                align-items: flex-start;
                margin-bottom: 10px;
                padding: 14px 16px;
                background-color: #ffffff;
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 12px;
                position: relative;
            }

            .search-item:last-child {
                margin-bottom: 0;
            }

            .search-item .news-number {
                margin-top: 1px;
                background-color: #f1f5f9;
                color: #64748b;
                font-size: 11.5px;
                width: 22px;
                height: 22px;
                min-width: 22px;
            }

            .search-item-body {
                flex: 1;
                min-width: 0;
                margin-left: 12px;
            }

            .search-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 7px;
                flex-wrap: wrap;
            }

            .search-meta-left {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                flex-wrap: wrap;
                min-width: 0;
            }

            .search-site {
                display: inline-block;
                background-color: #fffbeb;
                background: rgba(245, 158, 11, 0.1);
                color: #b45309;
                font-size: 11.5px;
                font-weight: 500;
                padding: 2px 8px;
                border-radius: 6px;
                line-height: 1.4;
            }

            .badge-authority {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                background-color: #ecfdf5;
                background: rgba(16, 185, 129, 0.08);
                color: #047857;
                border: 1px solid rgba(16, 185, 129, 0.24);
                font-size: 10.5px;
                font-weight: 600;
                padding: 1px 7px;
                border-radius: 999px;
                line-height: 1.4;
            }

            .search-time {
                color: #94a3b8;
                font-size: 11.5px;
                font-variant-numeric: tabular-nums;
            }

            .search-title {
                font-size: 14.5px;
                line-height: 1.5;
                margin: 0;
            }

            .search-link {
                color: #0f172a;
                text-decoration: none;
                font-weight: 500;
            }

            .search-link:hover {
                color: #d97706;
            }

            .search-snippet {
                font-size: 13px;
                color: #475569;
                line-height: 1.6;
                margin-top: 7px;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            /* 独立展示区样式（极简中性面板卡片 + 青绿微点缀） */
            .standalone-section {
                margin-top: 32px;
                padding-top: 24px;
            }

            .standalone-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 18px;
            }

            .standalone-section-title {
                font-size: 17px;
                font-weight: 600;
                letter-spacing: -0.01em;
                color: #0f172a;
            }

            .standalone-section-count {
                display: inline-flex;
                align-items: center;
                padding: 3px 10px;
                border-radius: 999px;
                background-color: #f1f5f9;
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }

            .standalone-group {
                margin-bottom: 18px;
                padding: 16px 18px;
                background-color: #ffffff;
                border: 1px solid rgba(15, 23, 42, 0.08);
                border-radius: 14px;
            }

            .standalone-group:last-child {
                margin-bottom: 0;
            }

            .standalone-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid #f1f5f9;
            }

            .standalone-name-wrap {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }

            .standalone-name {
                font-size: 15px;
                font-weight: 600;
                color: #0f172a;
            }

            .standalone-type-pill {
                display: inline-block;
                background-color: #f0fdfa;
                color: #0f766e;
                border: 1px solid #ccfbf1;
                font-size: 10.5px;
                font-weight: 500;
                padding: 1px 7px;
                border-radius: 999px;
                line-height: 1.4;
            }

            .standalone-count {
                color: #64748b;
                font-size: 12px;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
            }

            .standalone-group .news-item {
                margin-bottom: 0;
                padding: 11px 6px;
                margin: 0 -6px;
                border-bottom: 1px solid #f8fafc;
                border-radius: 8px;
            }
            .standalone-group .news-item:last-child {
                border-bottom: none;
                padding-bottom: 2px;
            }
            .standalone-group .news-content {
                padding-right: 4px;
            }

            /* AI 分析区块样式（柔和中性画布 + 纯白浮雕洞察卡片） */
            .ai-section,
            .section-divider.ai-section {
                margin-top: 32px;
                padding: 22px 24px 24px 24px;
                background-color: #f8fafc;
                background: linear-gradient(180deg, #f8fafc 0%, #f3f6fb 100%);
                border-radius: 16px;
                border: 1px solid rgba(15, 23, 42, 0.08);
            }
            .section-divider.ai-section.region-first-visible {
                margin-top: 0;
            }

            .ai-section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 18px;
            }

            .ai-section-header-left {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }

            .ai-section-title {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                font-size: 17px;
                font-weight: 600;
                letter-spacing: -0.01em;
                line-height: 1.3;
                color: #0f172a;
            }

            .ai-title-icon {
                width: 15px;
                height: 15px;
                flex-shrink: 0;
                display: block;
            }

            .ai-section-badge {
                background-color: #eef2ff;
                background: rgba(79, 70, 229, 0.09);
                color: #4f46e5;
                border: 1px solid rgba(79, 70, 229, 0.2);
                font-size: 10.5px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 999px;
                line-height: 1.25;
                letter-spacing: 0.4px;
            }

            .ai-block {
                margin-bottom: 14px;
                padding: 17px 19px;
                background-color: #ffffff;
                border-radius: 12px;
                border: 1px solid rgba(15, 23, 42, 0.075);
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
            }

            .ai-block:last-child {
                margin-bottom: 0;
            }

            .ai-block-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid #f1f5f9;
            }

            .ai-block-title {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #0f172a;
                margin: 0;
            }

            .ai-block-content {
                font-size: 13.5px;
                line-height: 1.72;
                color: #334155;
                white-space: pre-wrap;
            }

            .ai-error {
                padding: 16px;
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 10px;
                color: #991b1b;
                font-size: 14px;
            }

            .ai-warning {
                padding: 16px;
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-radius: 10px;
                color: #92400e;
                font-size: 14px;
            }

            .ai-info {
                padding: 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                color: #334155;
                font-size: 14px;
            }

            /*EMAIL_STRIP_CSS_START*/
            /* ===== 浏览器增强样式（渐进增强，邮件客户端无影响） ===== */

            /* 宽屏模式 - 基础 */
            body.wide-mode .container { max-width: 1200px; }
            body.wide-mode .header-info { grid-template-columns: repeat(4, 1fr); }
            body.wide-mode .content { padding: 32px 40px; }

            /* 现代极简卡片交互（RSS / 联网搜索 / 独立展示 / 新增 / AI 洞察） */
            .rss-item, .search-item, .ai-block, .standalone-group, .new-source-group {
                transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                            box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                            border-color 0.2s ease;
            }
            .rss-item:hover {
                transform: translateY(-1.5px);
                border-color: rgba(16, 185, 129, 0.38);
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(16, 185, 129, 0.06);
            }
            .search-item:hover {
                transform: translateY(-1.5px);
                border-color: rgba(245, 158, 11, 0.42);
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(245, 158, 11, 0.07);
            }
            .ai-block:hover {
                transform: translateY(-1.5px);
                border-color: rgba(79, 70, 229, 0.24);
                box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(79, 70, 229, 0.06);
            }
            .standalone-group .news-item,
            .new-item {
                transition: background-color 0.16s ease;
            }
            .standalone-group .news-item:hover,
            .new-item:hover {
                background-color: #f8fafc;
            }

            /* 卡片内隐形快捷操作（复制按钮 & 外链箭头，默认克制、悬停浮现） */
            .card-meta-actions {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
            .card-copy-btn,
            .ai-block-copy-btn {
                width: 26px;
                height: 26px;
                border-radius: 7px;
                border: 1px solid transparent;
                background: transparent;
                color: #94a3b8;
                cursor: pointer;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transform: scale(0.92);
                transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            }
            .rss-item:hover .card-copy-btn,
            .rss-item:focus-within .card-copy-btn,
            .card-copy-btn.copied,
            .ai-block:hover .ai-block-copy-btn,
            .ai-block:focus-within .ai-block-copy-btn,
            .ai-block-copy-btn.copied {
                opacity: 1;
                transform: scale(1);
            }
            .card-copy-btn:hover,
            .ai-block-copy-btn:hover {
                background: #f1f5f9;
                border-color: rgba(15, 23, 42, 0.08);
                color: #334155;
            }
            .card-copy-btn.copied,
            .ai-block-copy-btn.copied {
                color: #059669;
                background: rgba(16, 185, 129, 0.1);
                border-color: rgba(16, 185, 129, 0.25);
            }
            .card-ext-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                color: #cbd5e1;
                transition: color 0.18s ease, transform 0.18s ease;
            }
            .rss-item:hover .card-ext-icon {
                color: #059669;
                transform: translate(1.5px, -1.5px);
            }
            .search-item:hover .card-ext-icon {
                color: #d97706;
                transform: translate(1.5px, -1.5px);
            }

            /* 联网搜索：可点击复制的搜索词芯片 & 可展开长摘要 */
            .search-query-hint.copyable {
                cursor: pointer;
                transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
            }
            .search-query-hint.copyable:hover {
                background-color: #ffffff;
                border-color: rgba(245, 158, 11, 0.35);
                color: #334155;
            }
            .search-query-hint.copied {
                background-color: #ecfdf5;
                border-color: rgba(16, 185, 129, 0.32);
                color: #047857;
            }
            .search-snippet.expandable {
                cursor: pointer;
                transition: color 0.15s ease;
            }
            .search-snippet.expandable:hover {
                color: #1e293b;
            }
            .search-snippet.expanded {
                -webkit-line-clamp: unset;
                display: block;
            }

            /* AI 洞察块语义图标徽章 & 复制全文按钮 */
            .ai-block-icon-wrap {
                width: 22px;
                height: 22px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .ai-block-icon {
                width: 13px;
                height: 13px;
                display: block;
            }
            .ai-block-icon-wrap.accent-core { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
            .ai-block-icon-wrap.accent-sentiment { background: rgba(139, 92, 246, 0.1); color: #7c3aed; }
            .ai-block-icon-wrap.accent-signals { background: rgba(245, 158, 11, 0.12); color: #d97706; }
            .ai-block-icon-wrap.accent-rss { background: rgba(16, 185, 129, 0.11); color: #059669; }
            .ai-block-icon-wrap.accent-search { background: rgba(234, 88, 12, 0.11); color: #ea580c; }
            .ai-block-icon-wrap.accent-strategy { background: rgba(14, 165, 233, 0.11); color: #0284c7; }
            .ai-block-icon-wrap.accent-standalone { background: rgba(13, 148, 136, 0.11); color: #0d9488; }

            .ai-copy-all-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                border-radius: 999px;
                border: 1px solid rgba(15, 23, 42, 0.09);
                background: rgba(255, 255, 255, 0.85);
                color: #475569;
                font-size: 12px;
                font-weight: 500;
                font-family: inherit;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
                white-space: nowrap;
            }
            .ai-copy-all-btn:hover {
                background: #ffffff;
                border-color: rgba(79, 70, 229, 0.28);
                color: #4f46e5;
                box-shadow: 0 3px 10px rgba(79, 70, 229, 0.1);
            }
            .ai-copy-all-btn.copied {
                background: #ecfdf5;
                border-color: rgba(16, 185, 129, 0.32);
                color: #047857;
            }

            /* 新增热点序号悬停复制态 */
            .new-item .new-item-number { cursor: pointer; transition: background-color 0.15s ease, color 0.15s ease; }
            .new-item .new-item-number .copy-icon { display: none; }
            .new-item:hover .new-item-number .num-text { display: none; }
            .new-item:hover .new-item-number .copy-icon { display: inline-flex; align-items: center; justify-content: center; }
            .new-item .new-item-number:hover { background: #e2e8f0; color: #334155; }
            .new-item .new-item-number.copied { background: rgba(16, 185, 129, 0.14); }
            .new-item .new-item-number.copied .num-text { display: none; }
            .new-item .new-item-number.copied .copy-icon { display: inline-flex; align-items: center; justify-content: center; }

            /* 宽屏模式 - RSS feed-group 两列 */
            body.wide-mode .rss-feeds-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }
            body.wide-mode .feed-group { margin-bottom: 0; }

            /* 宽屏模式 - 联网搜索主题两列（单主题铺满 1 列） */
            body.wide-mode .search-topics-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }
            body.wide-mode .search-topics-grid.single-topic {
                grid-template-columns: 1fr;
            }
            body.wide-mode .search-topic-group { margin-bottom: 0; }
            body.wide-mode .search-tab-bar-wrapper { display: flex; }
            body.wide-mode .search-tab-bar-wrapper.tab-hidden { display: none; }

            @media (max-width: 640px) {
                body.wide-mode .header-sources-bar { grid-template-columns: 1fr; }
                body.wide-mode .search-topics-grid { grid-template-columns: 1fr; }
            }

            /* 宽屏模式 - AI 分析区两列网格 */
            body.wide-mode .ai-section .ai-blocks-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            body.wide-mode .ai-block { margin-bottom: 0; }

            /* 宽屏模式 - 新增热点多列 */
            body.wide-mode .new-section .new-sources-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            body.wide-mode .new-source-group { margin-bottom: 0; }

            /* 宽屏模式 - 独立展示区多列 */
            .standalone-tab-bar { display: none; margin-bottom: 18px; border-bottom: 1px solid #e2e8f0; }
            .standalone-tab-bar .tab-btn.active {
                background: #0d9488;
                color: #ffffff;
                box-shadow: 0 2px 8px rgba(13, 148, 136, 0.24);
            }
            body.wide-mode .standalone-tab-bar { display: flex; }
            body.wide-mode .standalone-tab-bar.tab-hidden { display: none; }
            body.wide-mode .standalone-section .standalone-groups-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            body.wide-mode .standalone-group { margin-bottom: 0; }

            /* Tab 栏 */
            .tab-bar-wrapper {
                position: sticky;
                top: 0;
                z-index: 10;
                background: white;
                display: none;
                margin-bottom: 20px;
                align-items: stretch;
                border-bottom: 2px solid #e5e7eb;
            }
            body.wide-mode .tab-bar-wrapper { display: flex; }
            body.wide-mode .tab-bar-wrapper.tab-hidden { display: none; }

            .tab-bar {
                flex: 1;
                min-width: 0;
                display: flex;
                overflow-x: auto;
                white-space: nowrap;
                padding: 8px 0 12px 0;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
                gap: 4px;
                mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent);
                -webkit-mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent);
            }
            .tab-bar::-webkit-scrollbar { display: none; }
            .tab-bar.scroll-start {
                mask-image: linear-gradient(to right, black, black calc(100% - 24px), transparent);
                -webkit-mask-image: linear-gradient(to right, black, black calc(100% - 24px), transparent);
            }
            .tab-bar.scroll-end {
                mask-image: linear-gradient(to right, transparent, black 24px, black);
                -webkit-mask-image: linear-gradient(to right, transparent, black 24px, black);
            }
            .tab-bar.scroll-start.scroll-end,
            .tab-bar.no-overflow {
                mask-image: none;
                -webkit-mask-image: none;
            }

            .tab-arrow {
                flex-shrink: 0;
                width: 28px;
                display: none;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: #9ca3af;
                font-size: 20px;
                font-weight: 300;
                cursor: pointer;
                padding: 0;
                transition: color 0.15s ease;
            }
            .tab-arrow:hover { color: #4f46e5; }
            .tab-arrow.visible { display: flex; }

            .tab-scroll-indicator {
                position: absolute;
                bottom: 0;
                left: 0;
                width: 0;
                height: 2px;
                background: #4f46e5;
                border-radius: 0 1px 1px 0;
                transition: width 0.1s linear;
            }

            .tab-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                border: none;
                background: #f3f4f6;
                color: #6b7280;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            .tab-btn:hover { background: #e5e7eb; color: #374151; }
            .tab-btn.active { background: #4f46e5; color: white; }
            .tab-count {
                font-size: 11px;
                background: rgba(0,0,0,0.1);
                padding: 1px 6px;
                border-radius: 10px;
            }
            .tab-btn.active .tab-count { background: rgba(255,255,255,0.3); }

            /* 搜索栏（带内嵌图标、快捷键键帽与清空按钮） */
            .search-bar { display: none; padding: 0 0 14px 0; }
            .search-box {
                position: relative;
                display: flex;
                align-items: center;
            }
            .search-box-icon {
                position: absolute;
                left: 14px;
                width: 15px;
                height: 15px;
                color: #94a3b8;
                pointer-events: none;
                transition: color 0.2s ease;
            }
            .search-input {
                width: 100%;
                padding: 10px 44px 10px 40px;
                border: 1px solid #e2e8f0;
                background: #f8fafc;
                border-radius: 10px;
                font-size: 14px;
                color: #1e293b;
                outline: none;
                transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                box-sizing: border-box;
            }
            .search-input:hover {
                border-color: #cbd5e1;
                background: #ffffff;
            }
            .search-input:focus {
                background: #ffffff;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
            }
            .search-box:focus-within .search-box-icon { color: #4f46e5; }
            .search-input::placeholder { color: #94a3b8; }
            .search-kbd {
                position: absolute;
                right: 12px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 11px;
                color: #94a3b8;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 5px;
                padding: 1px 6px;
                line-height: 1.5;
                pointer-events: none;
                transition: opacity 0.18s ease;
            }
            .search-box.has-value .search-kbd,
            .search-box:focus-within .search-kbd { opacity: 0; }
            .search-clear-btn {
                position: absolute;
                right: 10px;
                width: 22px;
                height: 22px;
                border: none;
                border-radius: 50%;
                background: #e2e8f0;
                color: #475569;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transform: scale(0.85);
                transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.15s ease;
                padding: 0;
            }
            .search-box.has-value .search-clear-btn {
                opacity: 1;
                pointer-events: auto;
                transform: scale(1);
            }
            .search-clear-btn:hover { background: #cbd5e1; color: #0f172a; }

            /* 右下角磨砂玻璃悬浮操作坞（返回顶部带阅读进度环 + 可交互快捷键面板） */
            .fab-bar {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 120;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .fab-dock {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 5px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 1px solid rgba(15, 23, 42, 0.08);
                box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06);
                transition: box-shadow 0.22s ease, border-color 0.22s ease;
            }
            .fab-dock:hover {
                border-color: rgba(79, 70, 229, 0.22);
                box-shadow: 0 12px 32px rgba(79, 70, 229, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08);
            }
            .fab-btn {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: transparent;
                color: #475569;
                border: none;
                cursor: pointer;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
            }
            .fab-btn:hover {
                background: rgba(79, 70, 229, 0.1);
                color: #4f46e5;
            }
            .fab-btn:active {
                transform: scale(0.94);
            }
            .fab-top-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                pointer-events: none;
                transform: translateY(6px);
                transition: max-height 0.26s cubic-bezier(0.22, 1, 0.36, 1),
                            opacity 0.22s ease,
                            transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .fab-bar.scrolled .fab-top-wrap {
                max-height: 48px;
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0);
            }
            .fab-divider {
                width: 20px;
                height: 1px;
                background: rgba(15, 23, 42, 0.08);
                margin: 4px 0;
                flex-shrink: 0;
            }
            .fab-top-btn .fab-progress-svg {
                position: absolute;
                inset: 1px;
                width: 36px;
                height: 36px;
                transform: rotate(-90deg);
                pointer-events: none;
            }
            .fab-progress-track {
                fill: none;
                stroke: rgba(79, 70, 229, 0.12);
                stroke-width: 2;
            }
            .fab-progress-arc {
                fill: none;
                stroke: #4f46e5;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-dasharray: 100.53;
                stroke-dashoffset: 100.53;
                transition: stroke-dashoffset 0.12s linear;
            }
            .fab-top-btn:hover .fab-top-arrow {
                transform: translateY(-1.5px);
            }
            .fab-top-arrow {
                transition: transform 0.18s ease;
            }
            .fab-help-wrap {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .fab-help-wrap.open .fab-help,
            .fab-help-wrap.pinned .fab-help {
                background: #4f46e5;
                color: #ffffff;
                box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35);
            }

            /* 快捷键与交互提示毛玻璃浮层 */
            .fab-panel {
                position: absolute;
                bottom: -5px;
                right: 52px;
                width: 256px;
                background: rgba(15, 23, 42, 0.96);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                color: #f8fafc;
                border-radius: 14px;
                padding: 13px 13px 11px 13px;
                font-size: 12px;
                line-height: 1.45;
                box-shadow: 0 18px 44px rgba(15, 23, 42, 0.42), 0 4px 12px rgba(0, 0, 0, 0.24);
                border: 1px solid rgba(255, 255, 255, 0.14);
                opacity: 0;
                visibility: hidden;
                transform: translateX(6px) scale(0.97);
                transform-origin: bottom right;
                transition: opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1),
                            transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
                            visibility 0.18s;
                pointer-events: none;
                text-align: left;
            }
            .fab-help-wrap.open .fab-panel,
            .fab-help-wrap.pinned .fab-panel {
                opacity: 1;
                visibility: visible;
                transform: translateX(0) scale(1);
                pointer-events: auto;
            }
            .fab-panel-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 4px 8px 4px;
                margin-bottom: 6px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .fab-panel-title {
                font-size: 12px;
                font-weight: 600;
                color: #f8fafc;
                letter-spacing: 0.2px;
            }
            .fab-panel-close {
                display: none;
                width: 20px;
                height: 20px;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                cursor: pointer;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: background-color 0.15s ease, color 0.15s ease;
            }
            .fab-help-wrap.pinned .fab-panel-close { display: inline-flex; }
            .fab-panel-close:hover { background: rgba(255, 255, 255, 0.24); color: #ffffff; }

            .fab-panel-group {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .fab-panel-subhead {
                font-size: 10.5px;
                font-weight: 600;
                color: #94a3b8;
                padding: 8px 6px 4px 6px;
                margin-top: 6px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                letter-spacing: 0.3px;
            }
            .fab-shortcut-row {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 6px 7px;
                border: none;
                border-radius: 8px;
                background: transparent;
                color: #e2e8f0;
                font-size: 12px;
                font-family: inherit;
                text-align: left;
                cursor: pointer;
                transition: background-color 0.15s ease, color 0.15s ease;
            }
            .fab-shortcut-row:hover {
                background: rgba(255, 255, 255, 0.09);
                color: #ffffff;
            }
            .fab-shortcut-row.static-row {
                cursor: default;
            }
            .fab-shortcut-row.static-row:hover {
                background: rgba(255, 255, 255, 0.04);
                color: #e2e8f0;
            }
            .fab-kbd-group {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
            .fab-kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 22px;
                height: 21px;
                padding: 0 6px;
                border-radius: 5px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-bottom-width: 2px;
                color: #f8fafc;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 11px;
                font-weight: 600;
                line-height: 1;
            }
            .fab-hint-pill {
                font-size: 11px;
                color: #a5b4fc;
                background: rgba(99, 102, 241, 0.16);
                border: 1px solid rgba(129, 140, 248, 0.22);
                border-radius: 999px;
                padding: 1.5px 8px;
                white-space: nowrap;
                flex-shrink: 0;
            }

            body.dark-mode .fab-dock {
                background: rgba(30, 41, 59, 0.9);
                border-color: rgba(148, 163, 184, 0.18);
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
            }
            body.dark-mode .fab-dock:hover {
                border-color: rgba(129, 140, 248, 0.35);
            }
            body.dark-mode .fab-btn { color: #cbd5e1; }
            body.dark-mode .fab-btn:hover {
                background: rgba(129, 140, 248, 0.16);
                color: #c7d2fe;
            }
            body.dark-mode .fab-divider { background: rgba(148, 163, 184, 0.16); }
            body.dark-mode .fab-progress-track { stroke: rgba(129, 140, 248, 0.18); }
            body.dark-mode .fab-progress-arc { stroke: #818cf8; }
            body.dark-mode .fab-help-wrap.open .fab-help,
            body.dark-mode .fab-help-wrap.pinned .fab-help {
                background: #6366f1;
                color: #ffffff;
            }

            /* 折叠/展开 */
            .collapse-icon {
                display: none;
                margin-right: 6px;
                font-size: 12px;
                color: #9ca3af;
                transition: transform 0.2s;
                user-select: none;
            }
            .word-header.collapsible,
            .search-topic-header.collapsible { cursor: pointer; }
            .word-header.collapsible .collapse-icon,
            .search-topic-header.collapsible .collapse-icon { display: inline-block; }
            .word-header.collapsible:hover {
                background: #f9fafb;
                border-radius: 6px;
                margin: 0 -8px 20px -8px;
                padding: 8px;
            }
            .search-topic-header.collapsible:hover {
                background: #fffbeb;
                border-radius: 6px;
                margin: 0 -8px 12px -8px;
                padding: 8px;
            }
            body.dark-mode .search-topic-header.collapsible:hover { background: #261f12; }
            .word-group.collapsed .news-item,
            .search-topic-group.collapsed .search-item { display: none; }
            .word-group.collapsed .collapse-icon,
            .search-topic-group.collapsed .collapse-icon { transform: rotate(-90deg); }

            /* Tab 与区域切换动画 */
            body.wide-mode .word-group[data-tab-index],
            body.wide-mode .search-topic-group[data-search-tab],
            .region-fade-in { animation: tabFadeIn 0.22s ease; }
            @keyframes tabFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* 宽屏切换按钮 */
            .toggle-wide-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                line-height: 1;
                min-height: 38px;
            }
            .toggle-wide-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                border-color: rgba(255, 255, 255, 0.5);
                transform: translateY(-1px);
            }

            /* ===== 暗色模式 ===== */
            body.dark-mode {
                background: #0f172a;
                color: #e2e8f0;
            }
            body.dark-mode .container {
                background: #1e293b;
                box-shadow: 0 4px 24px rgba(0,0,0,0.4);
            }
            body.dark-mode .header {
                background: linear-gradient(135deg, #3730a3 0%, #7c3aed 100%);
            }
            body.dark-mode .content {
                background: #1e293b;
            }

            /* 文字颜色 */
            body.dark-mode .word-name,
            body.dark-mode .new-section-title,
            body.dark-mode .standalone-name,
            body.dark-mode .new-item-title,
            body.dark-mode .project-name { color: #f1f5f9; }
            body.dark-mode .word-count,
            body.dark-mode .word-index,
            body.dark-mode .source-name,
            body.dark-mode .time-info,
            body.dark-mode .feed-count,
            body.dark-mode .new-source-title,
            body.dark-mode .standalone-count,
            body.dark-mode .rss-section-count,
            body.dark-mode .standalone-section-count,
            body.dark-mode .news-meta,
            body.dark-mode .rss-time,
            body.dark-mode .rss-author,
            body.dark-mode .rss-summary { color: #94a3b8; }
            body.dark-mode .info-value { color: white; }

            /* 链接 */
            body.dark-mode .news-title a,
            body.dark-mode .rss-title a,
            body.dark-mode .new-item a,
            body.dark-mode .standalone-item a,
            body.dark-mode .rss-link { color: #93c5fd; }
            body.dark-mode .news-title a:visited { color: #c4b5fd; }
            body.dark-mode .rss-link:hover { color: #6ee7b7; }

            /* 强调色 */
            body.dark-mode .keyword-tag {
                background: rgba(99,102,241,0.15);
                color: #a5b4fc;
            }
            body.dark-mode .count-info { color: #6ee7b7; }
            body.dark-mode .rss-source,
            body.dark-mode .feed-name,
            body.dark-mode .rss-section-title,
            body.dark-mode .standalone-section-title { color: #6ee7b7; }

            /* 边框与分割线 */
            body.dark-mode .word-header,
            body.dark-mode .news-item,
            body.dark-mode .new-item,
            body.dark-mode .standalone-item,
            body.dark-mode .new-source-title,
            body.dark-mode .standalone-header { border-bottom-color: #334155; }
            body.dark-mode .section-divider { border-top-color: #334155; }
            body.dark-mode .feed-header { border-bottom-color: #166534; }
            body.dark-mode .tab-bar { border-bottom-color: #334155; }

            /* 序号圆圈 */
            body.dark-mode .news-number,
            body.dark-mode .new-item-number {
                background: #334155;
                color: #94a3b8;
            }

            /* 折叠 hover */
            body.dark-mode .word-header.collapsible:hover { background: #253347; }

            /* Tab 栏 */
            body.dark-mode .tab-bar-wrapper {
                background: #1e293b;
                border-bottom-color: #334155;
            }
            body.dark-mode .tab-arrow { color: #64748b; }
            body.dark-mode .tab-arrow:hover { color: #c4b5fd; }
            body.dark-mode .tab-scroll-indicator { background: #818cf8; }
            body.dark-mode .tab-btn {
                background: #334155;
                color: #94a3b8;
            }
            body.dark-mode .tab-btn:hover {
                background: #475569;
                color: #e2e8f0;
            }
            body.dark-mode .tab-btn.active {
                background: #6d28d9;
                color: white;
            }
            body.dark-mode .tab-bar::-webkit-scrollbar-track { background: #1e293b; }
            body.dark-mode .tab-bar::-webkit-scrollbar-thumb { background: #475569; }

            /* 搜索框（暗色） */
            body.dark-mode .search-input {
                background: #0f172a;
                border-color: #334155;
                color: #e2e8f0;
            }
            body.dark-mode .search-input:hover {
                border-color: #475569;
                background: #162033;
            }
            body.dark-mode .search-input:focus {
                background: #0f172a;
                border-color: #818cf8;
                box-shadow: 0 0 0 3px rgba(129,140,248,0.18);
            }
            body.dark-mode .search-box:focus-within .search-box-icon { color: #a5b4fc; }
            body.dark-mode .search-input::placeholder { color: #64748b; }
            body.dark-mode .search-kbd {
                background: #1e293b;
                border-color: #334155;
                color: #64748b;
            }
            body.dark-mode .search-clear-btn {
                background: #334155;
                color: #cbd5e1;
            }
            body.dark-mode .search-clear-btn:hover {
                background: #475569;
                color: #f8fafc;
            }

            /* RSS / 独立展示 / 新增热点 极简暗色适配 */
            body.dark-mode .rss-section-title,
            body.dark-mode .search-section-title,
            body.dark-mode .standalone-section-title,
            body.dark-mode .new-section-title,
            body.dark-mode .feed-name,
            body.dark-mode .search-topic-name,
            body.dark-mode .standalone-name,
            body.dark-mode .new-source-title { color: #f1f5f9; }
            body.dark-mode .rss-section-count,
            body.dark-mode .search-section-count,
            body.dark-mode .standalone-section-count,
            body.dark-mode .section-count-pill {
                background: rgba(148, 163, 184, 0.14);
                color: #94a3b8;
            }
            body.dark-mode .section-icon-badge.badge-rss { background: rgba(16, 185, 129, 0.16); color: #34d399; }
            body.dark-mode .section-icon-badge.badge-search { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }
            body.dark-mode .section-icon-badge.badge-standalone { background: rgba(20, 184, 166, 0.16); color: #2dd4bf; }
            body.dark-mode .section-icon-badge.badge-new-sec { background: rgba(244, 63, 94, 0.16); color: #fb7185; }
            body.dark-mode .section-icon-badge.badge-ai {
                background: linear-gradient(135deg, rgba(129, 140, 248, 0.2), rgba(56, 189, 248, 0.18));
                color: #a5b4fc;
            }
            body.dark-mode .badge-new {
                background: rgba(244, 63, 94, 0.16);
                color: #fda4af;
                border-color: rgba(244, 63, 94, 0.3);
            }
            body.dark-mode .feed-header,
            body.dark-mode .search-topic-header,
            body.dark-mode .standalone-header,
            body.dark-mode .new-source-title { border-bottom-color: rgba(148, 163, 184, 0.16); }
            body.dark-mode .rss-item,
            body.dark-mode .search-item,
            body.dark-mode .standalone-group,
            body.dark-mode .new-source-group {
                background: rgba(15, 23, 42, 0.45);
                border-color: rgba(148, 163, 184, 0.14);
            }
            body.dark-mode .rss-item:hover {
                border-color: rgba(52, 211, 153, 0.4);
                box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
            }
            body.dark-mode .search-item:hover {
                border-color: rgba(251, 191, 36, 0.42);
                box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
            }
            body.dark-mode .rss-author {
                background: rgba(16, 185, 129, 0.16);
                color: #6ee7b7;
            }
            body.dark-mode .rss-link,
            body.dark-mode .rss-title a { color: #f1f5f9; }
            body.dark-mode .rss-link:hover,
            body.dark-mode .rss-title a:hover { color: #6ee7b7; }
            body.dark-mode .standalone-type-pill {
                background: rgba(20, 184, 166, 0.14);
                color: #5eead4;
                border-color: rgba(20, 184, 166, 0.28);
            }
            body.dark-mode .standalone-group .news-item,
            body.dark-mode .new-item { border-bottom-color: rgba(148, 163, 184, 0.1); }
            body.dark-mode .standalone-group .news-item:hover,
            body.dark-mode .new-item:hover { background-color: rgba(51, 65, 85, 0.42); }
            body.dark-mode .standalone-tab-bar { border-bottom-color: #334155; }
            body.dark-mode .card-copy-btn:hover,
            body.dark-mode .ai-block-copy-btn:hover {
                background: rgba(148, 163, 184, 0.16);
                border-color: rgba(148, 163, 184, 0.2);
                color: #f8fafc;
            }
            body.dark-mode .card-ext-icon { color: #475569; }
            body.dark-mode .rss-item:hover .card-ext-icon { color: #34d399; }
            body.dark-mode .search-item:hover .card-ext-icon { color: #fbbf24; }

            /* 区域分段滑块导航栏（暗色） */
            body.dark-mode .section-nav-bar {
                border-bottom-color: #334155;
            }
            body.dark-mode .section-nav-track {
                background: #0f172a;
                border-color: #334155;
            }
            body.dark-mode .section-nav-btn {
                color: #94a3b8;
            }
            body.dark-mode .section-nav-btn:hover:not(.active) {
                background: rgba(51, 65, 85, 0.65);
                color: #f1f5f9;
            }
            body.dark-mode .section-nav-btn.active {
                color: #ffffff;
            }
            body.dark-mode .nav-pill-count {
                background: rgba(148, 163, 184, 0.14);
                color: #94a3b8;
            }
            body.dark-mode .section-nav-btn.active .nav-pill-count {
                background: rgba(255, 255, 255, 0.22);
                color: #ffffff;
            }
            body.dark-mode .section-nav-indicator {
                background: #6d28d9;
                box-shadow: 0 2px 10px rgba(109, 40, 217, 0.45);
            }
            body.dark-mode .section-nav-indicator[data-accent="rss"] {
                background: #059669;
                box-shadow: 0 2px 10px rgba(5, 150, 105, 0.45);
            }
            body.dark-mode .section-nav-indicator[data-accent="web_search"] {
                background: #d97706;
                box-shadow: 0 2px 10px rgba(217, 119, 6, 0.45);
            }
            body.dark-mode .section-nav-indicator[data-accent="new_items"] {
                background: #e11d48;
                box-shadow: 0 2px 10px rgba(225, 29, 72, 0.45);
            }
            body.dark-mode .section-nav-indicator[data-accent="standalone"] {
                background: #0d9488;
                box-shadow: 0 2px 10px rgba(13, 148, 136, 0.45);
            }
            body.dark-mode .section-nav-indicator[data-accent="ai_analysis"] {
                background: #0284c7;
                box-shadow: 0 2px 10px rgba(2, 132, 199, 0.45);
            }

            /* 联网搜索区（暗色模式） */
            body.dark-mode .search-topic-count,
            body.dark-mode .search-time,
            body.dark-mode .new-source-count { color: #94a3b8; }
            body.dark-mode .search-query-hint {
                background: rgba(15, 23, 42, 0.55);
                border-color: rgba(148, 163, 184, 0.16);
                color: #94a3b8;
            }
            body.dark-mode .search-query-hint.copyable:hover {
                background: rgba(30, 41, 59, 0.9);
                border-color: rgba(251, 191, 36, 0.35);
                color: #e2e8f0;
            }
            body.dark-mode .search-site {
                background: rgba(245, 158, 11, 0.16);
                color: #fcd34d;
            }
            body.dark-mode .search-provider-badge {
                background: rgba(148, 163, 184, 0.12);
                border-color: rgba(148, 163, 184, 0.22);
                color: #cbd5e1;
            }
            body.dark-mode .badge-authority {
                background: rgba(16, 185, 129, 0.16);
                color: #6ee7b7;
                border-color: rgba(16, 185, 129, 0.32);
            }
            body.dark-mode .search-item .news-number {
                background: rgba(148, 163, 184, 0.14);
                color: #94a3b8;
            }
            body.dark-mode .search-link,
            body.dark-mode .search-title a { color: #f1f5f9; }
            body.dark-mode .search-link:hover,
            body.dark-mode .search-title a:hover { color: #fcd34d; }
            body.dark-mode .search-snippet { color: #94a3b8; }
            body.dark-mode .search-snippet.expandable:hover { color: #cbd5e1; }
            body.dark-mode .search-tab-bar-wrapper {
                background: #1e293b;
                border-bottom-color: #334155;
            }
            body.dark-mode .search-tab-bar .tab-btn.active {
                background: #d97706;
                color: white;
            }
            body.dark-mode .search-tab-bar-wrapper .tab-scroll-indicator {
                background: #fbbf24;
            }

            /* AI 分析区（暗色） */
            body.dark-mode .ai-section,
            body.dark-mode .section-divider.ai-section {
                background: linear-gradient(180deg, rgba(30, 41, 59, 0.65) 0%, rgba(15, 23, 42, 0.72) 100%);
                border-color: rgba(148, 163, 184, 0.16);
            }
            body.dark-mode .ai-section-title { color: #f8fafc; }
            body.dark-mode .ai-section-badge {
                background: rgba(129, 140, 248, 0.16);
                color: #c7d2fe;
                border-color: rgba(129, 140, 248, 0.3);
            }
            body.dark-mode .ai-copy-all-btn {
                background: rgba(30, 41, 59, 0.85);
                border-color: rgba(148, 163, 184, 0.22);
                color: #cbd5e1;
            }
            body.dark-mode .ai-copy-all-btn:hover {
                background: rgba(51, 65, 85, 0.9);
                border-color: rgba(129, 140, 248, 0.4);
                color: #e0e7ff;
            }
            body.dark-mode .ai-block {
                background: rgba(15, 23, 42, 0.6);
                border-color: rgba(148, 163, 184, 0.14);
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            body.dark-mode .ai-block:hover {
                border-color: rgba(129, 140, 248, 0.36);
                box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
            }
            body.dark-mode .ai-block-head { border-bottom-color: rgba(148, 163, 184, 0.12); }
            body.dark-mode .ai-block-title { color: #f1f5f9; }
            body.dark-mode .ai-block-content { color: #cbd5e1; }
            body.dark-mode .ai-warning {
                background: #422006;
                border-color: #854d0e;
                color: #fbbf24;
            }
            body.dark-mode .ai-error {
                background: #450a0a;
                border-color: #991b1b;
                color: #fca5a5;
            }
            body.dark-mode .ai-info {
                background: #172554;
                border-color: #1e40af;
                color: #93c5fd;
            }

            /* 错误区 */
            body.dark-mode .error-section {
                background: #1c1917;
                border-color: #78350f;
            }
            body.dark-mode .error-title { color: #fca5a5; }
            body.dark-mode .error-item { color: #f87171; }

            /* Footer */
            body.dark-mode .footer {
                background: #0f172a;
                border-top-color: #334155;
                color: #94a3b8;
            }
            body.dark-mode .footer-link { color: #93c5fd; }
            body.dark-mode .footer-link:hover { color: #c4b5fd; }

            /* 下拉菜单 */
            body.dark-mode .save-dropdown-menu {
                background: rgba(30,41,59,0.95);
                border-color: #475569;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            }
            body.dark-mode .save-dropdown-item {
                color: #e2e8f0;
            }
            body.dark-mode .save-dropdown-item:hover {
                background: #334155;
                color: #c4b5fd;
            }

            /* 暗色模式切换按钮 */
            .toggle-dark-btn,
            .toggle-wide-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .toggle-dark-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                line-height: 1;
                min-height: 38px;
            }
            .toggle-dark-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                border-color: rgba(255, 255, 255, 0.5);
                transform: translateY(-1px);
            }

            /* 快捷键面板已集成到 fab-tooltip */

            /* 阅读进度条 */
            .reading-progress {
                position: fixed;
                top: 0; left: 0;
                width: 0;
                height: 3px;
                background: linear-gradient(90deg, #4f46e5, #7c3aed);
                z-index: 9999;
                transition: width 0.1s linear;
            }
            body.dark-mode .reading-progress {
                background: linear-gradient(90deg, #8ab4f8, #c58af9);
            }
            /*EMAIL_STRIP_CSS_END*/
        </style>
    </head>
    <body>
        <!--EMAIL_STRIP_START--><div class="reading-progress"></div><!--EMAIL_STRIP_END-->
        <div class="container">
            <div class="header">
                <!--EMAIL_STRIP_START-->
                <div class="header-watermark">TrendRadar</div>
                <div class="save-buttons">
                    <button class="toggle-wide-btn" onclick="toggleWideMode()" title="切换宽屏/窄屏" aria-label="切换宽屏/窄屏"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10"/></svg></button>
                    <button class="toggle-dark-btn" onclick="toggleDarkMode()" title="切换暗色/亮色" aria-label="切换暗色/亮色"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z"/></svg></button>
                    <div class="save-btn-group">
                        <button class="save-btn" onclick="saveAsImage(event)">导出</button>
                        <button class="save-dropdown-trigger">▾</button>
                        <div class="save-dropdown-menu">
                            <button class="save-dropdown-item" onclick="saveAsImage(event)"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="7.5" r="2.5"/><path d="M12 4h.01"/></svg>整页截图</button>
                            <button class="save-dropdown-item" onclick="saveAsMultipleImages(event)"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="10" height="10" rx="1.5"/><path d="M5 4V2.5A1.5 1.5 0 016.5 1h7A1.5 1.5 0 0115 2.5v7a1.5 1.5 0 01-1.5 1.5H12"/></svg>分段截图</button>
                            <button class="save-dropdown-item" onclick="saveAsMarkdown()"><svg class="dropdown-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9A1.5 1.5 0 012.5 2z"/><path d="M4 11V5l2.5 3L9 5v6"/><path d="M11.5 8v3m0 0l-1.5-2m1.5 2l1.5-2"/></svg>Markdown</button>
                        </div>
                    </div>
                </div>
                <!--EMAIL_STRIP_END-->
                <div class="header-title">热点新闻分析</div>
                <div class="header-info">"""

    # 使用提供的时间函数或默认 datetime.now
    if get_time_func:
        now = get_time_func()
    else:
        now = datetime.now()

    # 统一极细 14px 线性 SVG 图标（与原版导出菜单风格保持一致，避免花哨 Emoji）
    _UI_ICONS = {
        "all": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
        "hotlist": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 6 7.5 9.5 10 14 4"/><polyline points="10.5 4 14 4 14 7.5"/></svg>',
        "rss": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h.01"/><path d="M3 8.5a4.5 4.5 0 0 1 4.5 4.5"/><path d="M3 4a9 9 0 0 1 9 9"/></svg>',
        "web_search": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
        "new_items": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2v5.6M5.2 8h5.6"/></svg>',
        "standalone": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M5 6h6M5 9h6"/></svg>',
        "ai_analysis": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5l1.45 4.55L14 7.5l-4.55 1.45L8 13.5l-1.45-4.55L2 7.5l4.55-1.45z"/></svg>',
        "trend_up": '<svg class="trend-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 11.5 6.5 7.5 9.5 10 13.5 4.5"/><polyline points="10 4.5 13.5 4.5 13.5 8"/></svg>',
        "trend_down": '<svg class="trend-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 4.5 6.5 8.5 9.5 6 13.5 11.5"/><polyline points="10 11.5 13.5 11.5 13.5 8"/></svg>',
        "sparkline": '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 11 5.5 6.5 9 9.5 14.5 4"/></svg>',
        "warning": '<svg class="ui-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.3 9.2A1 1 0 0 1 13.3 13.2H2.7a1 1 0 0 1-.87-1.5z"/><path d="M8 6.2v3M8 11.2h.01"/></svg>',
        "chevron": '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"/></svg>',
        "copy": '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V5"/></svg>',
        "ext_link": '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h6v6M12.5 3.5L6 10"/></svg>',
        "shield": '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8l5 2v4.3c0 3.2-2.1 5.3-5 6.1-2.9-.8-5-2.9-5-6.1V3.8z"/><path d="M5.8 8.2L7.3 9.7 10.4 6.5"/></svg>',
        "query_mini": '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
    }

    def _normalize_rank_timeline(
        rank_timeline: Optional[List[Dict]],
        ranks: Optional[List[int]] = None,
        fallback_time: str = "",
    ) -> List[List[Any]]:
        """将排名时间线规范为极紧凑的 [[time, rank_or_null], ...] 列表"""
        points: List[List[Any]] = []
        if rank_timeline:
            for pt in rank_timeline:
                if not isinstance(pt, dict):
                    continue
                t_raw = str(pt.get("time", "") or "").strip()
                if len(t_raw) == 5 and t_raw[2] == "-":
                    t_raw = t_raw.replace("-", ":")
                elif " " in t_raw:
                    t_raw = t_raw.split()[-1][:5].replace("-", ":")
                r_val = pt.get("rank")
                if r_val is not None:
                    try:
                        r_val = int(r_val)
                        if r_val <= 0:
                            r_val = None
                    except (TypeError, ValueError):
                        r_val = None
                points.append([t_raw or "--:--", r_val])
        elif ranks:
            t_clean = (
                str(fallback_time or "")
                .replace("[", "")
                .replace("]", "")
                .replace(" ~ ", "~")
                .strip()
            )
            if "~" in t_clean and len(ranks) >= 2:
                t_parts = [p.strip() for p in t_clean.split("~", 1)]
                points.append([t_parts[0], int(ranks[0])])
                if len(ranks) > 2:
                    for mid_r in ranks[1:-1]:
                        points.append(["·", int(mid_r)])
                points.append([t_parts[1], int(ranks[-1])])
            elif ranks:
                points.append([t_clean or "--:--", int(ranks[-1])])
        return points

    def _build_rank_trigger_html(
        ranks: List[int],
        rank_threshold: int = 10,
        rank_timeline: Optional[List[Dict]] = None,
        source_name: str = "",
        fallback_time: str = "",
        single_rank: int = 0,
    ) -> str:
        """渲染带零 Emoji 趋势图标与排名轨迹交互浮层数据的排名芯片"""
        eff_ranks = [int(r) for r in (ranks or []) if r is not None and int(r) > 0]
        if not eff_ranks and single_rank and int(single_rank) > 0:
            eff_ranks = [int(single_rank)]
        if not eff_ranks:
            return ""

        min_rank = min(eff_ranks)
        max_rank = max(eff_ranks)
        if min_rank <= 3:
            rank_class = "top"
        elif min_rank <= rank_threshold:
            rank_class = "high"
        else:
            rank_class = ""

        rank_text = str(min_rank) if min_rank == max_rank else f"{min_rank}-{max_rank}"

        trend = calculate_rank_trend(rank_timeline, eff_ranks)
        trend_html = ""
        if trend == "up":
            trend_html = (
                f'<span class="trend-badge trend-up" title="排名上升">'
                f'<!--EMAIL_STRIP_START-->{_UI_ICONS["trend_up"]}<!--EMAIL_STRIP_END-->'
                f'<span class="trend-email-glyph">↑</span>'
                f'</span>'
            )
        elif trend == "down":
            trend_html = (
                f'<span class="trend-badge trend-down" title="排名下降">'
                f'<!--EMAIL_STRIP_START-->{_UI_ICONS["trend_down"]}<!--EMAIL_STRIP_END-->'
                f'<span class="trend-email-glyph">↓</span>'
                f'</span>'
            )

        points = _normalize_rank_timeline(rank_timeline, eff_ranks, fallback_time=fallback_time)
        if not points:
            return f'<span class="rank-num {rank_class}">{rank_text}</span>{trend_html}'

        payload_json = html_escape(json.dumps(points, ensure_ascii=False, separators=(",", ":")))
        src_attr = f' data-rank-source="{html_escape(source_name)}"' if source_name else ""
        # 当存在 2 个及以上时间节点且没有趋势标时，显示极轻线性走势小图标暗示可查看轨迹
        spark_hint = ""
        if len(points) >= 2 and not trend_html:
            spark_hint = (
                f'<!--EMAIL_STRIP_START-->'
                f'<span class="rank-spark-hint" aria-hidden="true">{_UI_ICONS["sparkline"]}</span>'
                f'<!--EMAIL_STRIP_END-->'
            )

        return (
            f'<span class="rank-trigger" tabindex="0" role="button" aria-label="查看排名变化轨迹" '
            f'data-rank-timeline="{payload_json}"{src_attr}>'
            f'<span class="rank-num {rank_class}">{rank_text}</span>'
            f'{trend_html}{spark_hint}'
            f'</span>'
        )

    def _build_metric_tooltip(
        title: str,
        rows: List[tuple],
        *,
        badge: str = "",
        foot: str = "",
        action_hint: str = "",
        align: str = "center",
    ) -> str:
        """构建 Header 指标毛玻璃悬停明细浮层（仅浏览器可见，发邮件时自动剥离）"""
        align_cls = ""
        if align == "left":
            align_cls = " tip-align-left"
        elif align == "right":
            align_cls = " tip-align-right"

        badge_html = f'<span class="tip-badge">{html_escape(badge)}</span>' if badge else ""
        lines_html = ""
        for row in rows:
            label, val = row[0], row[1]
            dot_color = row[2] if len(row) > 2 else ""
            dot_html = (
                f'<span class="tip-dot" style="background:{dot_color};"></span>'
                if dot_color
                else ""
            )
            lines_html += (
                f'<div class="tip-line">'
                f'<span class="tip-line-label">{dot_html}{html_escape(str(label))}</span>'
                f'<span class="tip-line-val">{html_escape(str(val))}</span>'
                f'</div>'
            )

        foot_html = ""
        if foot or action_hint:
            parts = []
            if foot:
                parts.append(html_escape(foot))
            if action_hint:
                parts.append(f'<span class="tip-foot-action">{html_escape(action_hint)}</span>')
            foot_html = f'<div class="tip-foot">{" · ".join(parts)}</div>'

        return (
            f'<!--EMAIL_STRIP_START-->'
            f'<div class="metric-tooltip{align_cls}" role="tooltip">'
            f'<div class="tip-header"><span>{html_escape(title)}</span>{badge_html}</div>'
            f'<div class="tip-list">{lines_html}</div>'
            f'{foot_html}'
            f'</div>'
            f'<!--EMAIL_STRIP_END-->'
        )

    # 处理报告类型显示与悬停说明
    if mode == "current":
        mode_display = "当前榜单"
        mode_desc = "仅统计本轮仍在榜的匹配热点与最新抓取数据"
    elif mode == "incremental":
        mode_display = "增量分析"
        mode_desc = "仅呈现本轮新发现的去重条目，零重复干扰"
    else:
        mode_display = "全天汇总"
        mode_desc = "汇总今日全部批次的匹配热点与新增条目"

    # 计算各项数据
    hot_news_count = sum(len(stat["titles"]) for stat in report_data["stats"])
    new_count = report_data.get("total_new_count", 0)

    # 从元数据获取 RSS、平台和联网搜索信息
    hotlist_total = report_data.get("hotlist_total", total_titles)
    platform_total = report_data.get("platform_total", 0)
    failed_count = len(report_data.get("failed_ids", []))
    platform_success = platform_total - failed_count if platform_total else 0
    rss_matched = report_data.get("rss_matched_count", 0)
    rss_total = report_data.get("rss_total_count", 0)
    rss_source_total = report_data.get("rss_source_total", 0)
    rss_source_failed = report_data.get("rss_source_failed", 0)
    rss_source_success = max(0, rss_source_total - rss_source_failed)

    search_items_count = sum(len(stat.get("titles", [])) for stat in (search_items or []))
    search_matched = (
        report_data["search_matched_count"]
        if "search_matched_count" in report_data
        else search_items_count
    )
    search_total_candidates = report_data.get("search_total_count", 0)
    search_topic_total = report_data.get("search_topic_total", 0)
    if search_topic_total == 0 and search_items:
        search_topic_total = len(search_items)
    search_topic_failed = report_data.get("search_topic_failed", 0)
    search_topic_success = max(0, search_topic_total - search_topic_failed)
    search_new_count = (
        report_data["search_new_count"]
        if "search_new_count" in report_data
        else sum(len(stat.get("titles", [])) for stat in (search_new_items or []))
    )

    has_web_search = bool(search_topic_total > 0 or search_items)
    rss_new_count = sum(len(stat.get("titles", [])) for stat in (rss_new_items or []))

    # 计算 AI 分析展示文本及悬停明细
    ai_tip_rows: List[tuple] = []
    ai_tip_badge = ""
    ai_tip_foot = ""
    if ai_analysis and getattr(ai_analysis, "success", False):
        hotlist_analyzed = getattr(ai_analysis, "hotlist_analyzed", 0)
        rss_analyzed = getattr(ai_analysis, "rss_analyzed", 0)
        search_analyzed = getattr(ai_analysis, "search_analyzed", 0)
        standalone_analyzed = getattr(ai_analysis, "standalone_analyzed", 0)
        ai_include_rss = getattr(ai_analysis, "include_rss", True)
        ai_include_web_search = getattr(ai_analysis, "include_web_search", False)
        ai_include_standalone = getattr(ai_analysis, "include_standalone", False)

        ai_parts = [str(hotlist_analyzed)]
        ai_tip_rows.append(("热榜新闻", f"{hotlist_analyzed} 条", "#818cf8"))
        if ai_include_rss:
            ai_parts.append(str(rss_analyzed))
            ai_tip_rows.append(("RSS 订阅", f"{rss_analyzed} 条", "#34d399"))
        if (ai_include_web_search and has_web_search) or search_analyzed > 0:
            ai_parts.append(str(search_analyzed))
            ai_tip_rows.append(("联网搜索", f"{search_analyzed} 条", "#fbbf24"))
        if ai_include_standalone:
            ai_parts.append(str(standalone_analyzed))
            ai_tip_rows.append(("独立展示", f"{standalone_analyzed} 条", "#38bdf8"))
        ai_total_analyzed = sum(int(p) for p in ai_parts)
        ai_value = " + ".join(ai_parts) if ai_total_analyzed > 0 else "0"
        ai_tip_badge = f"共 {ai_total_analyzed} 条"
        ai_tip_foot = "数字依次对应各来源送入 AI 的样本数"
    elif ai_analysis:
        if getattr(ai_analysis, "skipped", False):
            ai_value = "已跳过"
            ai_tip_rows.append(("状态", "当前调度时段跳过分析", "#94a3b8"))
        else:
            ai_value = "待配置"
            ai_tip_rows.append(("状态", "未配置模型密钥或调用失败", "#f87171"))
    else:
        ai_value = "未启用"
        ai_tip_rows.append(("状态", "可在 config.yaml 开启 ai_analysis", "#94a3b8"))

    # 构建公共明细浮层
    mode_tip = _build_metric_tooltip(
        "报告模式说明",
        [("当前模式", mode_display, "#818cf8")],
        foot=mode_desc,
        align="left",
    )
    time_tip = _build_metric_tooltip(
        "报告生成时间",
        [("完整时间", now.strftime("%Y-%m-%d %H:%M"), "#94a3b8")],
        foot="数据统计截止至此时刻",
    )

    hot_hit_rate = f"{(hot_news_count / hotlist_total * 100):.1f}%" if hotlist_total > 0 else "--"
    hotlist_tip_rows = [
        ("关键词命中", f"{hot_news_count} 条", "#818cf8"),
        ("抓取总标题", f"{hotlist_total} 条", "#94a3b8"),
        ("筛选命中率", hot_hit_rate, "#a5b4fc"),
        ("平台成功数", f"{platform_success} / {platform_total}" if platform_total > 0 else "--", "#34d399" if failed_count == 0 else "#fbbf24"),
    ]
    rss_hit_rate = f"{(rss_matched / rss_total * 100):.1f}%" if rss_total > 0 else "--"
    rss_tip_rows = (
        [
            ("筛选命中", f"{rss_matched} 条", "#34d399"),
            ("新鲜度保留", f"{rss_total} 条", "#94a3b8"),
            ("筛选命中率", rss_hit_rate, "#6ee7b7"),
            ("订阅源状态", f"{rss_source_success} / {rss_source_total}", "#34d399" if rss_source_failed == 0 else "#fbbf24"),
        ]
        if rss_source_total > 0
        else [("当前状态", "未启用 RSS 订阅源", "#94a3b8")]
    )
    search_tip_rows = [
        ("精选入榜", f"{search_matched} 条", "#fbbf24"),
    ]
    if search_total_candidates > search_matched:
        search_tip_rows.append(("质量漏斗前候选", f"{search_total_candidates} 条", "#94a3b8"))
    search_tip_rows.append(("本轮新增发现", f"{search_new_count} 条", "#fb7185"))
    search_tip_rows.append(
        ("搜索主题状态", f"{search_topic_success} / {search_topic_total}", "#34d399" if search_topic_failed == 0 else "#fbbf24")
    )

    if has_web_search:
        # 双层对称布局：第一行 4 格基础统计 + 第二行三数据源无框对称统计（均支持悬停指标详解）
        total_new = new_count + rss_new_count + search_new_count
        new_value = (
            f"{new_count} + {rss_new_count} + {search_new_count}"
            if total_new > 0
            else "0"
        )
        new_tip = _build_metric_tooltip(
            "新增条目构成",
            [
                ("热榜新增", f"{new_count} 条", "#818cf8"),
                ("RSS 新增", f"{rss_new_count} 条", "#34d399"),
                ("联网搜索新增", f"{search_new_count} 条", "#fbbf24"),
            ],
            badge=f"共 {total_new} 条",
            foot="按 热榜 + RSS + 联网搜索 顺序统计",
        )
        ai_tip = _build_metric_tooltip(
            "AI 分析样本构成",
            ai_tip_rows,
            badge=ai_tip_badge,
            foot=ai_tip_foot,
            action_hint="点击查看 AI 研判" if (ai_analysis and getattr(ai_analysis, "success", False)) else "",
            align="right",
        )
        ai_click_attr = ' data-jump-region="ai_analysis" style="cursor:pointer;"' if (ai_analysis and getattr(ai_analysis, "success", False)) else ""

        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">报告类型</span>
                        <span class="info-value">{mode_display}</span>
                        {mode_tip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">生成时间</span>
                        <span class="info-value">{now.strftime("%m-%d %H:%M")}</span>
                        {time_tip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">新增条目</span>
                        <span class="info-value"><span class="metric-value-hint">{new_value}</span></span>
                        {new_tip}
                    </div>
                    <div class="info-item metric-interactive" tabindex="0"{ai_click_attr}>
                        <span class="info-label">AI 分析</span>
                        <span class="info-value"><span class="metric-value-hint">{ai_value}</span></span>
                        {ai_tip}
                    </div>
                </div>"""

        platform_str = f"平台 {platform_success}/{platform_total}" if platform_total > 0 else "平台 --"
        hotlist_main_val = f"{hot_news_count} / {hotlist_total}"
        if rss_source_total > 0:
            rss_main_val = f"{rss_matched} / {rss_total}"
            rss_sub_val = f"源 {rss_source_success}/{rss_source_total}"
        else:
            rss_main_val = "未启用"
            rss_sub_val = "--"
        search_main_val = f"{search_matched} 条"
        search_sub_val = f"主题 {search_topic_success}/{search_topic_total}"

        hotlist_card_tip = _build_metric_tooltip(
            "热榜数据源统计",
            hotlist_tip_rows,
            action_hint="点击聚焦热榜区域" if hot_news_count > 0 else "",
            align="left",
        )
        rss_card_tip = _build_metric_tooltip(
            "RSS 订阅源统计",
            rss_tip_rows,
            action_hint="点击聚焦 RSS 区域" if rss_items else "",
        )
        search_card_tip = _build_metric_tooltip(
            "联网搜索统计",
            search_tip_rows,
            action_hint="点击聚焦联网搜索区域" if search_items else "",
            align="right",
        )

        hot_jump = ' data-jump-region="hotlist"' if hot_news_count > 0 else ""
        rss_jump = ' data-jump-region="rss"' if rss_items else ""
        search_jump = ' data-jump-region="web_search"' if search_items else ""

        html += f"""
                <div class="header-sources-bar">
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"{hot_jump}>
                            <span class="source-card-label"><span class="source-card-dot dot-hotlist"></span><!--EMAIL_STRIP_START-->{_UI_ICONS["hotlist"]}<!--EMAIL_STRIP_END-->热榜命中</span>
                            <span class="source-card-value"><span class="metric-value-hint">{hotlist_main_val}</span></span>
                            <span class="source-card-sub">{platform_str}</span>
                            {hotlist_card_tip}
                        </div>
                    </div>
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"{rss_jump}>
                            <span class="source-card-label"><span class="source-card-dot dot-rss"></span><!--EMAIL_STRIP_START-->{_UI_ICONS["rss"]}<!--EMAIL_STRIP_END-->RSS 命中</span>
                            <span class="source-card-value"><span class="metric-value-hint">{rss_main_val}</span></span>
                            <span class="source-card-sub">{rss_sub_val}</span>
                            {rss_card_tip}
                        </div>
                    </div>
                    <div class="header-source-card">
                        <div class="source-card-inner metric-clickable" tabindex="0"{search_jump}>
                            <span class="source-card-label"><span class="source-card-dot dot-search"></span><!--EMAIL_STRIP_START-->{_UI_ICONS["web_search"]}<!--EMAIL_STRIP_END-->联网搜索</span>
                            <span class="source-card-value"><span class="metric-value-hint">{search_main_val}</span></span>
                            <span class="source-card-sub">{search_sub_val}</span>
                            {search_card_tip}
                        </div>
                    </div>
                </div>
            </div>"""
    else:
        # 原有 8 格对称布局（未启用联网搜索时保持不变，同步增加指标悬停详解）
        total_new = new_count + rss_new_count
        new_value = f"{new_count} + {rss_new_count}" if total_new > 0 else "0"
        new_tip_8 = _build_metric_tooltip(
            "新增热点构成",
            [
                ("热榜新增", f"{new_count} 条", "#818cf8"),
                ("RSS 新增", f"{rss_new_count} 条", "#34d399"),
            ],
            badge=f"共 {total_new} 条",
            foot="按 热榜 + RSS 顺序统计",
        )
        ai_tip_8 = _build_metric_tooltip(
            "AI 分析样本构成",
            ai_tip_rows,
            badge=ai_tip_badge,
            foot=ai_tip_foot,
            align="right",
        )
        hotlist_tip_8 = _build_metric_tooltip("热榜数据源统计", hotlist_tip_rows)
        rss_tip_8 = _build_metric_tooltip("RSS 订阅源统计", rss_tip_rows, align="right")

        # 1. 报告类型
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">报告类型</span>
                        <span class="info-value"><span class="metric-value-hint">{mode_display}</span></span>
                        {mode_tip}
                    </div>"""

        # 2. 生成时间
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">生成时间</span>
                        <span class="info-value"><span class="metric-value-hint">{now.strftime("%m-%d %H:%M")}</span></span>
                        {time_tip}
                    </div>"""

        # 3. 热榜命中
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">热榜命中</span>
                        <span class="info-value"><span class="metric-value-hint">{hot_news_count} / {hotlist_total}</span></span>
                        {hotlist_tip_8}
                    </div>"""

        # 4. RSS 命中
        if rss_source_total > 0:
            rss_value = f"{rss_matched} / {rss_total}"
        else:
            rss_value = "未启用"
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">RSS 命中</span>
                        <span class="info-value"><span class="metric-value-hint">{rss_value}</span></span>
                        {rss_tip_8}
                    </div>"""

        # 5. 热榜平台
        if platform_total > 0:
            platform_value = f"{platform_success}/{platform_total}"
        else:
            platform_value = "--"
        html += f"""
                    <div class="info-item">
                        <span class="info-label">热榜平台</span>
                        <span class="info-value">{platform_value}</span>
                    </div>"""

        # 6. RSS 源
        if rss_source_total > 0:
            rss_source_value = f"{rss_source_success}/{rss_source_total}"
        else:
            rss_source_value = "--"
        html += f"""
                    <div class="info-item">
                        <span class="info-label">RSS 源</span>
                        <span class="info-value">{rss_source_value}</span>
                    </div>"""

        # 7. 新增热点（热榜新增 + RSS 新增）
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">新增热点</span>
                        <span class="info-value"><span class="metric-value-hint">{new_value}</span></span>
                        {new_tip_8}
                    </div>"""

        # 8. AI 分析
        html += f"""
                    <div class="info-item metric-interactive" tabindex="0">
                        <span class="info-label">AI 分析</span>
                        <span class="info-value"><span class="metric-value-hint">{ai_value}</span></span>
                        {ai_tip_8}
                    </div>"""

        html += """
                </div>
            </div>"""

    search_placeholder = "搜索新闻标题或摘要..." if has_web_search else "搜索新闻标题..."
    html += f"""

            <div class="content">
                <!--EMAIL_STRIP_START--><div class="search-bar">
                    <div class="search-box">
                        <svg class="search-box-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                        <input type="text" class="search-input" placeholder="{search_placeholder}" oninput="handleSearch(this.value)">
                        <span class="search-kbd" aria-hidden="true">/</span>
                        <button type="button" class="search-clear-btn" onclick="clearSearchInput()" title="清空搜索" aria-label="清空搜索">
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                        </button>
                    </div>
                </div><!--EMAIL_STRIP_END-->"""

    # 处理失败ID错误信息（在区域快捷切换栏之后插入）
    error_html = ""
    if report_data["failed_ids"]:
        error_html += f"""
                <div class="error-section">
                    <div class="error-title"><!--EMAIL_STRIP_START-->{_UI_ICONS["warning"]}<!--EMAIL_STRIP_END-->请求失败的平台</div>
                    <ul class="error-list">"""
        for id_value in report_data["failed_ids"]:
            error_html += f'<li class="error-item">{html_escape(id_value)}</li>'
        error_html += """
                    </ul>
                </div>"""

    # 生成热点词汇统计部分的HTML
    stats_html = ""
    tab_bar_html = ""
    if report_data["stats"]:
        total_count = len(report_data["stats"])

        # 生成 Tab 栏 HTML（仅浏览器交互用，邮件自动剔除）
        total_news_count = sum(s["count"] for s in report_data["stats"])
        tab_bar_html = '<!--EMAIL_STRIP_START--><div class="tab-bar-wrapper"><div class="tab-bar">'
        tab_bar_html += f'<button class="tab-btn" data-tab-index="all">全部<span class="tab-count">{total_news_count}</span></button>'
        for tab_i, tab_stat in enumerate(report_data["stats"]):
            escaped_tab_word = html_escape(tab_stat["word"])
            tab_count = tab_stat["count"]
            tab_bar_html += f'<button class="tab-btn" data-tab-index="{tab_i}">{escaped_tab_word}<span class="tab-count">{tab_count}</span></button>'
        tab_bar_html += '</div></div><!--EMAIL_STRIP_END-->'

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
                <div class="word-group" data-tab-index="{i - 1}">
                    <div class="word-header">
                        <div class="word-info">
                            <div class="word-name">{escaped_word}</div>
                            <div class="word-count {count_class}">{count} 条</div>
                        </div>
                        <div class="word-index"><!--EMAIL_STRIP_START--><span class="collapse-icon">{_UI_ICONS["chevron"]}</span><!--EMAIL_STRIP_END-->{i}/{total_count}</div>
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

                # 处理排名显示（支持零 Emoji 趋势微标 + 悬停/点击展示排名变化轨迹与时间点）
                ranks = title_data.get("ranks", [])
                if ranks:
                    stats_html += _build_rank_trigger_html(
                        ranks=ranks,
                        rank_threshold=title_data.get("rank_threshold", 10),
                        rank_timeline=title_data.get("rank_timeline", []),
                        source_name=title_data.get("source_name", ""),
                        fallback_time=title_data.get("time_display", ""),
                    )

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

    # 给热榜统计添加外层包装
    if stats_html:
        stats_html = f"""
                <div class="hotlist-section">{tab_bar_html}{stats_html}
                </div>"""

    # 生成新增新闻区域的HTML
    new_titles_html = ""
    if show_new_section and report_data["new_titles"]:
        new_titles_html += f"""
                <div class="new-section">
                    <div class="new-section-header">
                        <div class="section-heading-left">
                            <!--EMAIL_STRIP_START--><span class="section-icon-badge badge-new-sec">{_UI_ICONS["new_items"]}</span><!--EMAIL_STRIP_END-->
                            <div class="new-section-title">本次新增热点</div>
                        </div>
                        <div class="section-count-pill">共 {report_data['total_new_count']} 条</div>
                    </div>
                    <div class="new-sources-grid">"""

        for source_data in report_data["new_titles"]:
            escaped_source = html_escape(source_data["source_name"])
            titles_count = len(source_data["titles"])

            new_titles_html += f"""
                    <div class="new-source-group">
                        <div class="new-source-title"><span class="new-source-title-left"><span class="group-dot dot-new"></span><span>{escaped_source}</span></span><span class="new-source-count">{titles_count} 条</span></div>"""

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
                    </div>
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
                        <div class="section-heading-left">
                            <!--EMAIL_STRIP_START--><span class="section-icon-badge badge-rss">{_UI_ICONS["rss"]}</span><!--EMAIL_STRIP_END-->
                            <div class="rss-section-title">{title}</div>
                        </div>
                        <div class="rss-section-count">{total_count} 条</div>
                    </div>
                    <div class="rss-feeds-grid">"""

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
                            <div class="feed-name-wrap"><span class="group-dot dot-rss"></span><div class="feed-name">{html_escape(keyword)}</div></div>
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
                            <div class="rss-meta">
                                <div class="rss-meta-left">"""

                if source_name:
                    rss_html += f'<span class="rss-author">{html_escape(source_name)}</span>'

                if time_display:
                    rss_html += f'<span class="rss-time">{html_escape(time_display)}</span>'

                if is_new:
                    rss_html += '<span class="badge-new">NEW</span>'

                rss_html += """</div>"""

                if url:
                    rss_html += (
                        f'<!--EMAIL_STRIP_START--><div class="card-meta-actions">'
                        f'<button type="button" class="card-copy-btn" title="复制标题和链接" aria-label="复制标题和链接">{_UI_ICONS["copy"]}</button>'
                        f'<span class="card-ext-icon" aria-hidden="true">{_UI_ICONS["ext_link"]}</span>'
                        f'</div><!--EMAIL_STRIP_END-->'
                    )

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
                    </div>
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

        # 收集所有分组信息用于生成 tab
        all_groups = []
        for p in platforms:
            items = p.get("items", [])
            if items:
                all_groups.append({"name": p.get("name", p.get("id", "")), "count": len(items)})
        for f in rss_feeds:
            items = f.get("items", [])
            if items:
                all_groups.append({"name": f.get("name", f.get("id", "")), "count": len(items)})

        standalone_html = f"""
                <div class="standalone-section">
                    <div class="standalone-section-header">
                        <div class="section-heading-left">
                            <!--EMAIL_STRIP_START--><span class="section-icon-badge badge-standalone">{_UI_ICONS["standalone"]}</span><!--EMAIL_STRIP_END-->
                            <div class="standalone-section-title">独立展示区</div>
                        </div>
                        <div class="standalone-section-count">{total_count} 条</div>
                    </div>"""

        # 生成 tab 栏（2+ 分组时，仅浏览器宽屏显示，邮件自动剔除）
        if len(all_groups) >= 2:
            standalone_html += """
                    <!--EMAIL_STRIP_START--><div class="tab-bar standalone-tab-bar">"""
            for idx, g in enumerate(all_groups):
                active = ' active' if idx == 0 else ''
                standalone_html += f"""
                        <button class="tab-btn{active}" data-standalone-tab="{idx}">{html_escape(g["name"])}<span class="tab-count">{g["count"]}</span></button>"""
            standalone_html += f"""
                        <button class="tab-btn" data-standalone-tab="all">全部<span class="tab-count">{total_count}</span></button>
                    </div><!--EMAIL_STRIP_END-->"""

        standalone_html += """
                    <div class="standalone-groups-grid">"""

        group_idx = 0
        # 渲染热榜平台（复用 word-group 结构）
        for platform in platforms:
            platform_name = platform.get("name", platform.get("id", ""))
            items = platform.get("items", [])
            if not items:
                continue

            standalone_html += f"""
                    <div class="standalone-group" data-standalone-tab="{group_idx}">
                        <div class="standalone-header">
                            <div class="standalone-name-wrap"><span class="group-dot dot-standalone"></span><div class="standalone-name">{html_escape(platform_name)}</div><span class="standalone-type-pill">热榜</span></div>
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

                # 排名显示（支持趋势微标与悬停/点击展示排名变化轨迹）
                fallback_standalone_time = ""
                if first_time and last_time and first_time != last_time:
                    fallback_standalone_time = (
                        f"{convert_time_for_display(first_time)}~{convert_time_for_display(last_time)}"
                    )
                elif first_time:
                    fallback_standalone_time = convert_time_for_display(first_time)
                standalone_html += _build_rank_trigger_html(
                    ranks=ranks,
                    rank_threshold=10,
                    rank_timeline=item.get("rank_timeline", []),
                    source_name=platform_name,
                    fallback_time=fallback_standalone_time,
                    single_rank=rank,
                )

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
            group_idx += 1

        # 渲染 RSS 源（复用相同结构）
        for feed in rss_feeds:
            feed_name = feed.get("name", feed.get("id", ""))
            items = feed.get("items", [])
            if not items:
                continue

            standalone_html += f"""
                    <div class="standalone-group" data-standalone-tab="{group_idx}">
                        <div class="standalone-header">
                            <div class="standalone-name-wrap"><span class="group-dot dot-rss"></span><div class="standalone-name">{html_escape(feed_name)}</div><span class="standalone-type-pill">RSS</span></div>
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
            group_idx += 1

        standalone_html += """
                    </div>
                </div>"""
        return standalone_html

    # 生成联网搜索区块 HTML
    _PROVIDER_DISPLAY = {
        "deepseek": "DeepSeek",
        "tavily": "Tavily",
        "bocha": "博查",
        "serper": "Serper",
        "exa": "Exa",
        "perplexity": "Perplexity",
        "brave": "Brave",
        "bing": "Bing",
        "google": "Google",
        "baidu": "百度",
        "duckduckgo": "DuckDuckGo",
        "zhipu": "智谱",
        "metaso": "秘塔",
        "aliyun": "阿里云",
        "searxng": "SearXNG",
        "jina": "Jina",
    }

    def _format_provider_label(provider: str) -> str:
        if not provider:
            return ""
        cleaned = str(provider).strip()
        return _PROVIDER_DISPLAY.get(cleaned.lower(), cleaned)

    def render_search_stats_html(
        stats: List[Dict], title: str = "联网搜索", enable_tabs: bool = True
    ) -> str:
        """渲染联网搜索统计区块 HTML（琥珀橙色系）"""
        if not stats:
            return ""

        valid_topics = [s for s in stats if s.get("titles")]
        total_count = sum(len(s.get("titles", [])) for s in valid_topics)
        if total_count == 0:
            return ""

        search_html = f"""
                <div class="search-section">
                    <div class="search-section-header">
                        <div class="section-heading-left">
                            <!--EMAIL_STRIP_START--><span class="section-icon-badge badge-search">{_UI_ICONS["web_search"]}</span><!--EMAIL_STRIP_END-->
                            <div class="search-section-title">{html_escape(title)}</div>
                        </div>
                        <div class="search-section-count">{total_count} 条</div>
                    </div>"""

        # 当有 >= 2 个主题时，宽屏提供主题 Tab 栏（含「全部」Tab；仅浏览器交互用，邮件自动剔除）
        if enable_tabs and len(valid_topics) >= 2:
            search_html += f"""
                    <!--EMAIL_STRIP_START--><div class="search-tab-bar-wrapper">
                        <div class="tab-bar search-tab-bar">
                            <button class="tab-btn active" data-search-tab="all">全部<span class="tab-count">{total_count}</span></button>"""
            for t_idx, topic in enumerate(valid_topics):
                t_name = topic.get("word") or topic.get("query") or topic.get("topic_id") or f"主题 {t_idx + 1}"
                t_cnt = len(topic.get("titles", []))
                search_html += f"""
                            <button class="tab-btn" data-search-tab="{t_idx}">{html_escape(t_name)}<span class="tab-count">{t_cnt}</span></button>"""
            search_html += """
                        </div>
                    </div><!--EMAIL_STRIP_END-->"""

        grid_class = "search-topics-grid single-topic" if len(valid_topics) == 1 else "search-topics-grid"
        search_html += f"""
                    <div class="{grid_class}">"""

        for t_idx, topic in enumerate(valid_topics):
            topic_name = topic.get("word") or topic.get("query") or topic.get("topic_id") or f"主题 {t_idx + 1}"
            titles = topic.get("titles", [])
            topic_count = len(titles)
            query_text = (topic.get("query") or "").strip()
            provider_raw = topic.get("provider") or (titles[0].get("provider", "") if titles else "")
            provider_label = _format_provider_label(provider_raw)

            tab_attr = f' data-search-tab="{t_idx}"' if enable_tabs else ""
            search_html += f"""
                    <div class="search-topic-group"{tab_attr}>
                        <div class="search-topic-header">
                            <div class="search-topic-header-top">
                                <div class="search-topic-info">
                                    <span class="group-dot dot-search"></span>
                                    <div class="search-topic-name">{html_escape(topic_name)}</div>"""

            if provider_label:
                search_html += f'<span class="search-provider-badge">{html_escape(provider_label)}</span>'

            search_html += f"""
                                </div>
                                <div class="search-topic-count"><!--EMAIL_STRIP_START--><span class="collapse-icon">{_UI_ICONS["chevron"]}</span><!--EMAIL_STRIP_END-->{topic_count} 条</div>
                            </div>"""

            if query_text:
                escaped_q = html_escape(query_text)
                search_html += f"""
                            <div class="search-query-hint" data-copy-query="{escaped_q}" title="点击复制搜索词"><!--EMAIL_STRIP_START-->{_UI_ICONS["query_mini"]}<!--EMAIL_STRIP_END--><span>搜索词：{escaped_q}</span></div>"""

            search_html += """
                        </div>"""

            for j, title_data in enumerate(titles, 1):
                item_title = title_data.get("title", "")
                url = title_data.get("url", "")
                source_name = title_data.get("source_name", "")
                time_display = title_data.get("time_display", "")
                if not time_display and title_data.get("published_at"):
                    pub = str(title_data.get("published_at"))
                    try:
                        if "T" in pub:
                            time_display = datetime.fromisoformat(pub.replace("Z", "+00:00")).strftime("%m-%d %H:%M")
                        else:
                            time_display = pub
                    except Exception:
                        time_display = pub

                snippet = (title_data.get("snippet") or "").strip()
                is_new = bool(title_data.get("is_new", False))
                try:
                    authority = int(title_data.get("authority") or 0)
                except (TypeError, ValueError):
                    authority = 0

                search_html += f"""
                        <div class="search-item">
                            <div class="news-number">{j}</div>
                            <div class="search-item-body">"""

                if source_name or authority >= 3 or time_display or is_new or url:
                    search_html += """
                                <div class="search-meta">
                                    <div class="search-meta-left">"""
                    if source_name:
                        search_html += f'<span class="search-site">{html_escape(source_name)}</span>'
                    if authority >= 3:
                        search_html += f'<span class="badge-authority"><!--EMAIL_STRIP_START-->{_UI_ICONS["shield"]}<!--EMAIL_STRIP_END-->权威</span>'
                    if time_display:
                        search_html += f'<span class="search-time">{html_escape(time_display)}</span>'
                    if is_new:
                        search_html += '<span class="badge-new">NEW</span>'
                    search_html += """</div>"""
                    if url:
                        search_html += f'<!--EMAIL_STRIP_START--><span class="card-ext-icon" aria-hidden="true">{_UI_ICONS["ext_link"]}</span><!--EMAIL_STRIP_END-->'
                    search_html += """
                                </div>"""

                search_html += """
                                <div class="search-title">"""
                escaped_title = html_escape(item_title)
                if url:
                    escaped_url = html_escape(url)
                    search_html += f'<a href="{escaped_url}" target="_blank" class="search-link">{escaped_title}</a>'
                else:
                    search_html += escaped_title
                search_html += """
                                </div>"""

                if snippet:
                    search_html += f"""
                                <div class="search-snippet">{html_escape(snippet)}</div>"""

                search_html += """
                            </div>
                        </div>"""

            search_html += """
                    </div>"""

        search_html += """
                    </div>
                </div>"""
        return search_html

    # 生成 RSS 统计和新增 HTML
    rss_stats_html = render_rss_stats_html(rss_items, "RSS 订阅更新") if rss_items else ""
    rss_new_html = render_rss_stats_html(rss_new_items, "RSS 新增更新") if rss_new_items else ""

    # 生成联网搜索统计和新增 HTML
    search_stats_html = render_search_stats_html(search_items, "联网搜索", enable_tabs=True) if search_items else ""
    search_new_html = render_search_stats_html(search_new_items, "联网搜索新增", enable_tabs=False) if search_new_items else ""

    # 生成独立展示区 HTML
    standalone_html = render_standalone_html(standalone_data)

    # 生成 AI 分析 HTML
    ai_html = render_ai_analysis_html_rich(ai_analysis) if ai_analysis else ""

    # 准备各区域内容映射
    region_contents = {
        "hotlist": stats_html,
        "rss": rss_stats_html,
        "web_search": search_stats_html,
        "new_items": (new_titles_html, rss_new_html, search_new_html),  # 元组，分别处理
        "standalone": standalone_html,
        "ai_analysis": ai_html,
    }

    # 计算顶部区域快捷切换栏数据（仅在实际渲染 >= 2 个主体区域时输出）
    rss_render_count = sum(len(s.get("titles", [])) for s in (rss_items or []))
    search_render_count = sum(len(s.get("titles", [])) for s in (search_items or []))
    new_render_count = (
        (sum(len(s.get("titles", [])) for s in report_data.get("new_titles", [])) if new_titles_html else 0)
        + (sum(len(s.get("titles", [])) for s in (rss_new_items or [])) if rss_new_html else 0)
        + (sum(len(s.get("titles", [])) for s in (search_new_items or [])) if search_new_html else 0)
    )
    standalone_render_count = (
        sum(len(p.get("items", [])) for p in standalone_data.get("platforms", []))
        + sum(len(f.get("items", [])) for f in standalone_data.get("rss_feeds", []))
    ) if standalone_data else 0

    region_nav_meta = {
        "hotlist": ("热榜", hot_news_count),
        "rss": ("RSS", rss_render_count),
        "web_search": ("联网搜索", search_render_count),
        "new_items": ("新增", new_render_count),
        "standalone": ("独立展示", standalone_render_count),
        "ai_analysis": ("AI 分析", None),
    }

    rendered_nav_regions = []
    seen_nav_regions = set()
    for region in region_order:
        if region in seen_nav_regions:
            continue
        content = region_contents.get(region, "")
        has_content = any(content) if region == "new_items" else bool(content)
        if has_content and region in region_nav_meta:
            seen_nav_regions.add(region)
            nav_title, nav_count = region_nav_meta[region]
            rendered_nav_regions.append((region, nav_title, nav_count))

    if len(rendered_nav_regions) >= 2:
        html += f"""
                <!--EMAIL_STRIP_START--><div class="section-nav-bar" role="tablist" aria-label="区域快捷切换">
                    <div class="section-nav-track">
                        <div class="section-nav-indicator" aria-hidden="true"></div>
                        <button class="section-nav-btn active" data-region-target="all">{_UI_ICONS["all"]}<span>全部视图</span></button>"""
        for reg_key, reg_title, reg_count in rendered_nav_regions:
            icon_svg = _UI_ICONS.get(reg_key, "")
            count_pill = f'<span class="nav-pill-count">{reg_count}</span>' if reg_count is not None else ""
            html += f"""
                        <button class="section-nav-btn" data-region-target="{reg_key}">{icon_svg}<span>{html_escape(reg_title)}</span>{count_pill}</button>"""
        html += """
                    </div>
                </div><!--EMAIL_STRIP_END-->"""

        # 邮件专用零 JS 无 Emoji 静态目录导览条（浏览器中保持注释态不占空间，发邮件时由 prepare_html_for_email 释放）
        toc_class_map = {
            "rss": " toc-rss",
            "web_search": " toc-search",
            "new_items": " toc-new",
            "ai_analysis": " toc-ai",
        }
        toc_links = []
        for reg_key, reg_title, reg_count in rendered_nav_regions:
            cls = toc_class_map.get(reg_key, "")
            cnt_txt = f" ({reg_count})" if reg_count is not None else ""
            toc_links.append(
                f'<a href="#region-{reg_key}" class="email-toc-link{cls}">'
                f'<span class="email-toc-dot"></span>{html_escape(reg_title)}{cnt_txt}</a>'
            )
        html += (
            '\n                <!--EMAIL_TOC_START:<div class="email-toc">'
            '<span class="email-toc-label">本期内容：</span>'
            + "".join(toc_links)
            + "</div>:EMAIL_TOC_END-->"
        )

    # 插入请求失败平台警告（如有）
    if error_html:
        html += error_html

    def add_section_divider(content: str) -> str:
        """为内容的外层 div 添加 section-divider 类"""
        if not content or 'class="' not in content:
            return content
        first_class_pos = content.find('class="')
        if first_class_pos != -1:
            insert_pos = first_class_pos + len('class="')
            return content[:insert_pos] + "section-divider " + content[insert_pos:]
        return content

    def add_region_attr(content: str, region: str, add_id: bool = False) -> str:
        """为内容的外层 div 添加 data-region 属性（以及可选锚点 id）"""
        if not content:
            return content
        first_div_pos = content.find("<div ")
        if first_div_pos != -1:
            insert_pos = first_div_pos + len("<div ")
            id_attr = f'id="region-{region}" ' if add_id else ""
            return content[:insert_pos] + f'{id_attr}data-region="{region}" ' + content[insert_pos:]
        return content

    # 按 region_order 顺序组装内容，动态添加分割线、锚点 id 与 data-region 属性
    has_previous_content = False
    assigned_region_ids = set()
    for region in region_order:
        content = region_contents.get(region, "")
        if region == "new_items":
            # 特殊处理 new_items 区域（包含热榜新增、RSS 新增和联网搜索新增）
            new_html, rss_new, search_new = content
            for sub_html in (new_html, rss_new, search_new):
                if sub_html:
                    need_id = region not in assigned_region_ids
                    sub_html = add_region_attr(sub_html, "new_items", add_id=need_id)
                    if need_id:
                        assigned_region_ids.add(region)
                    if has_previous_content:
                        sub_html = add_section_divider(sub_html)
                    html += sub_html
                    has_previous_content = True
        elif content:
            need_id = region not in assigned_region_ids
            content = add_region_attr(content, region, add_id=need_id)
            if need_id:
                assigned_region_ids.add(region)
            if has_previous_content:
                content = add_section_divider(content)
            html += content
            has_previous_content = True

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

        <!--EMAIL_STRIP_START-->
        <div id="rank-timeline-popover" class="rank-popover" role="dialog" aria-label="排名变化轨迹" aria-hidden="true"></div>

        <div class="fab-bar">
            <div class="fab-dock">
                <div class="fab-top-wrap">
                    <button type="button" class="fab-btn fab-top-btn" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="返回顶部" aria-label="返回顶部">
                        <svg class="fab-progress-svg" viewBox="0 0 36 36" aria-hidden="true">
                            <circle class="fab-progress-track" cx="18" cy="18" r="16"/>
                            <circle class="fab-progress-arc" cx="18" cy="18" r="16"/>
                        </svg>
                        <svg class="fab-top-arrow" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.5M4 7.5L8 3.5l4 4"/></svg>
                    </button>
                    <div class="fab-divider" aria-hidden="true"></div>
                </div>
                <div class="fab-help-wrap">
                    <button type="button" class="fab-btn fab-help" title="快捷操作与提示 (?)" aria-label="快捷操作与提示" aria-expanded="false">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="13" height="9" rx="2"/><path d="M4.5 6.5h.01M7 6.5h.01M9.5 6.5h.01M11.5 6.5h.01M4.5 9h7"/></svg>
                    </button>
                    <div class="fab-panel" role="dialog" aria-label="快捷操作与提示">
                        <div class="fab-panel-head">
                            <span class="fab-panel-title">快捷操作与提示</span>
                            <button type="button" class="fab-panel-close" aria-label="关闭">
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                            </button>
                        </div>
                        <div class="fab-panel-group">
                            <button type="button" class="fab-shortcut-row" data-fab-action="wide"><span>切换宽屏 / 窄屏</span><span class="fab-kbd-group"><kbd class="fab-kbd">W</kbd></span></button>
                            <button type="button" class="fab-shortcut-row" data-fab-action="dark"><span>切换暗色 / 亮色</span><span class="fab-kbd-group"><kbd class="fab-kbd">D</kbd></span></button>
                            <button type="button" class="fab-shortcut-row" data-fab-action="search"><span>聚焦搜索框</span><span class="fab-kbd-group"><kbd class="fab-kbd">/</kbd></span></button>
                            <div class="fab-shortcut-row static-row"><span>切换热榜分组</span><span class="fab-kbd-group"><kbd class="fab-kbd">←</kbd><kbd class="fab-kbd">→</kbd></span></div>
                        </div>
                        <div class="fab-panel-subhead">页面交互提示</div>
                        <div class="fab-panel-group">
                            <div class="fab-shortcut-row static-row"><span>排名变化轨迹</span><span class="fab-hint-pill">悬停 / 点击排名</span></div>
                            <div class="fab-shortcut-row static-row"><span>复制标题链接</span><span class="fab-hint-pill">点击序号</span></div>
                            <div class="fab-shortcut-row static-row"><span>快速定位分区</span><span class="fab-hint-pill">点击顶部指标</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // ===== 浏览器增强功能 =====
            var ICON_EXPAND = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10"/></svg>';
            var ICON_COMPRESS = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5V5a1 1 0 0 1-1 1H2.5M13.5 6H11a1 1 0 0 1-1-1V2.5M10 13.5V11a1 1 0 0 1 1-1h2.5M2.5 10H5a1 1 0 0 1 1 1v2.5"/></svg>';
            var ICON_MOON = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z"/></svg>';
            var ICON_SUN = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"/></svg>';

            function toggleWideMode() {
                document.body.classList.add('animating-width');
                document.body.classList.toggle('wide-mode');
                var isWide = document.body.classList.contains('wide-mode');
                try { localStorage.setItem('trendradar-wide-mode', isWide ? '1' : '0'); } catch(e) {}
                var btn = document.querySelector('.toggle-wide-btn');
                if (btn) btn.innerHTML = isWide ? ICON_COMPRESS : ICON_EXPAND;
                initTabVisibility();
                initCollapseVisibility();
                initStandaloneTabVisibility();
                initSearchTabVisibility();
                setTimeout(function() {
                    document.body.classList.remove('animating-width');
                    if (window.__syncSectionNavIndicator) window.__syncSectionNavIndicator();
                }, 310);
            }

            function toggleDarkMode() {
                var isDark = document.body.classList.toggle('dark-mode');
                try { localStorage.setItem('trendradar-dark-mode', isDark ? '1' : '0'); } catch(e) {}
                var btn = document.querySelector('.toggle-dark-btn');
                if (btn) btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
            }

            // 排名变化轨迹浮层（悬停预览 + 点击固定，带 SVG 反转折线图与脱榜断点）
            function initRankTimelinePopover() {
                var popover = document.getElementById('rank-timeline-popover');
                if (!popover) return;
                var triggers = document.querySelectorAll('.rank-trigger[data-rank-timeline]');
                if (!triggers.length) return;

                var activeTrigger = null;
                var pinned = false;
                var openTimer = null;
                var closeTimer = null;

                function escapeHtmlStr(s) {
                    return String(s || '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;');
                }

                function buildSparklineSvg(points, trendType) {
                    var valid = points.filter(function(p) { return p[1] !== null && p[1] > 0; });
                    if (points.length < 2 || valid.length < 1) return '';

                    var W = 262, H = 88;
                    var padL = 28, padR = 12, padT = 14, padB = 20;
                    var plotW = W - padL - padR;
                    var plotH = H - padT - padB;

                    var ranks = valid.map(function(p) { return p[1]; });
                    var minR = Math.min.apply(null, ranks);
                    var maxR = Math.max.apply(null, ranks);
                    if (minR === maxR) {
                        minR = Math.max(1, minR - 2);
                        maxR = maxR + 2;
                    }
                    var span = Math.max(1, maxR - minR);

                    function xAt(idx) {
                        return points.length === 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW;
                    }
                    function yAt(r) {
                        // 排名越小（如 #1）越靠上
                        return padT + ((r - minR) / span) * plotH;
                    }

                    var strokeColor = trendType === 'up' ? '#fb7185' : (trendType === 'down' ? '#94a3b8' : '#818cf8');
                    var gradId = 'rkGrad_' + trendType;

                    // 构建连续有效线段与脱榜虚线连接
                    var segments = [];
                    var currSeg = [];
                    var dashedLinks = [];
                    var lastValidPt = null;
                    var sawOff = false;

                    points.forEach(function(pt, idx) {
                        var x = xAt(idx);
                        if (pt[1] !== null && pt[1] > 0) {
                            var y = yAt(pt[1]);
                            var coord = { x: x, y: y, r: pt[1], t: pt[0], idx: idx };
                            if (sawOff && lastValidPt) {
                                dashedLinks.push([lastValidPt, coord]);
                                sawOff = false;
                            }
                            currSeg.push(coord);
                            lastValidPt = coord;
                        } else {
                            if (currSeg.length) {
                                segments.push(currSeg);
                                currSeg = [];
                            }
                            sawOff = true;
                        }
                    });
                    if (currSeg.length) segments.push(currSeg);

                    var svgParts = [];
                    svgParts.push('<svg class="rank-chart-svg" viewBox="0 0 ' + W + ' ' + H + '">');
                    svgParts.push('<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
                        '<stop offset="0%" stop-color="' + strokeColor + '" stop-opacity="0.32"/>' +
                        '<stop offset="100%" stop-color="' + strokeColor + '" stop-opacity="0.02"/>' +
                        '</linearGradient></defs>');

                    // 水平虚线网格 & 左侧最高/最低名次刻度
                    var topY = padT;
                    var midY = padT + plotH / 2;
                    var botY = padT + plotH;
                    svgParts.push('<line x1="' + padL + '" y1="' + topY + '" x2="' + (W - padR) + '" y2="' + topY + '" stroke="rgba(148,163,184,0.18)" stroke-dasharray="2 3"/>');
                    svgParts.push('<line x1="' + padL + '" y1="' + midY + '" x2="' + (W - padR) + '" y2="' + midY + '" stroke="rgba(148,163,184,0.12)" stroke-dasharray="2 3"/>');
                    svgParts.push('<line x1="' + padL + '" y1="' + botY + '" x2="' + (W - padR) + '" y2="' + botY + '" stroke="rgba(148,163,184,0.18)"/>');

                    svgParts.push('<text x="' + (padL - 5) + '" y="' + (topY + 3) + '" text-anchor="end" fill="#94a3b8" font-size="9.5">#' + minR + '</text>');
                    svgParts.push('<text x="' + (padL - 5) + '" y="' + (botY + 3) + '" text-anchor="end" fill="#64748b" font-size="9.5">#' + maxR + '</text>');

                    // 面积与实线折线
                    segments.forEach(function(seg) {
                        if (seg.length >= 2) {
                            var linePts = seg.map(function(c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
                            var areaD = 'M ' + seg[0].x.toFixed(1) + ' ' + botY +
                                ' L ' + seg.map(function(c) { return c.x.toFixed(1) + ' ' + c.y.toFixed(1); }).join(' L ') +
                                ' L ' + seg[seg.length - 1].x.toFixed(1) + ' ' + botY + ' Z';
                            svgParts.push('<path d="' + areaD + '" fill="url(#' + gradId + ')"/>');
                            svgParts.push('<polyline points="' + linePts + '" fill="none" stroke="' + strokeColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
                        }
                    });

                    // 跨脱榜虚线连接
                    dashedLinks.forEach(function(pair) {
                        svgParts.push('<line x1="' + pair[0].x.toFixed(1) + '" y1="' + pair[0].y.toFixed(1) +
                            '" x2="' + pair[1].x.toFixed(1) + '" y2="' + pair[1].y.toFixed(1) +
                            '" stroke="#64748b" stroke-width="1.3" stroke-dasharray="3 3"/>');
                    });

                    // 绘制全部节点（含脱榜空心圈与终点光环）
                    var bestRank = Math.min.apply(null, ranks);
                    var bestLabeled = false;
                    points.forEach(function(pt, idx) {
                        var x = xAt(idx);
                        if (pt[1] === null || pt[1] <= 0) {
                            svgParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + botY + '" r="3" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>');
                            return;
                        }
                        var y = yAt(pt[1]);
                        var isLast = (idx === points.length - 1);
                        var isTop = pt[1] <= 3;
                        var fill = isTop ? '#fb7185' : strokeColor;
                        if (isLast) {
                            svgParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="' + fill + '" fill-opacity="0.22"/>');
                        }
                        svgParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isLast ? '3.5' : '2.7') + '" fill="' + fill + '" stroke="#0f172a" stroke-width="1.2"/>');
                        if (pt[1] === bestRank && !bestLabeled) {
                            bestLabeled = true;
                            var lblY = Math.max(9, y - 6);
                            svgParts.push('<text x="' + x.toFixed(1) + '" y="' + lblY.toFixed(1) + '" text-anchor="middle" fill="#f8fafc" font-size="9.5" font-weight="600">#' + pt[1] + '</text>');
                        }
                    });

                    // 底部首尾时间刻度
                    var firstTime = points[0][0] || '';
                    var lastTime = points[points.length - 1][0] || '';
                    svgParts.push('<text x="' + padL + '" y="' + (H - 4) + '" text-anchor="start" fill="#94a3b8" font-size="9.5">' + escapeHtmlStr(firstTime) + '</text>');
                    if (lastTime && lastTime !== firstTime) {
                        svgParts.push('<text x="' + (W - padR) + '" y="' + (H - 4) + '" text-anchor="end" fill="#cbd5e1" font-size="9.5">' + escapeHtmlStr(lastTime) + '</text>');
                    }

                    svgParts.push('</svg>');
                    return '<div class="rank-chart-wrap">' + svgParts.join('') + '</div>';
                }

                function renderPopoverContent(trigger, isPinned) {
                    var raw = trigger.getAttribute('data-rank-timeline') || '[]';
                    var points = [];
                    try { points = JSON.parse(raw); } catch (e) { points = []; }
                    if (!points.length) return false;

                    var source = trigger.getAttribute('data-rank-source') || '';
                    var valid = points.filter(function(p) { return p[1] !== null && p[1] > 0; });

                    var trendType = 'flat';
                    var badgeText = '持续在榜';
                    if (points.length === 1) {
                        trendType = 'single';
                        badgeText = '首次记录';
                    } else if (valid.length >= 2) {
                        var delta = valid[0][1] - valid[valid.length - 1][1];
                        if (delta > 0) {
                            trendType = 'up';
                            badgeText = '上升 ' + delta + ' 位';
                        } else if (delta < 0) {
                            trendType = 'down';
                            badgeText = '下降 ' + Math.abs(delta) + ' 位';
                        } else {
                            trendType = 'flat';
                            badgeText = '排名平稳';
                        }
                    }

                    var bestR = valid.length ? Math.min.apply(null, valid.map(function(p) { return p[1]; })) : null;
                    var chartHtml = buildSparklineSvg(points, trendType);

                    var listHtml = '<div class="rank-points-list">';
                    var prevRank = null;
                    var prevWasOff = false;
                    points.forEach(function(pt, idx) {
                        var t = pt[0] || '--:--';
                        var r = pt[1];
                        var isLatest = (idx === points.length - 1);
                        var dotCls = r === null ? 'off' : (r <= 3 ? 'top' : '');
                        var rankStr = r === null ? '脱榜' : ('第 ' + r + ' 名');
                        var rankCls = r === null ? 'off' : '';

                        var diffText = '';
                        var diffCls = 'flat';
                        if (idx === 0) {
                            diffText = r === null ? '脱榜' : '首登';
                            diffCls = 'tag';
                        } else if (r === null) {
                            diffText = '跌出';
                            diffCls = 'down';
                        } else if (prevWasOff) {
                            diffText = '重回';
                            diffCls = 'up';
                        } else if (prevRank !== null) {
                            var step = prevRank - r;
                            if (step > 0) { diffText = '↑ ' + step; diffCls = 'up'; }
                            else if (step < 0) { diffText = '↓ ' + Math.abs(step); diffCls = 'down'; }
                            else { diffText = '持平'; diffCls = 'flat'; }
                        }

                        if (r === null) {
                            prevWasOff = true;
                        } else {
                            prevRank = r;
                            prevWasOff = false;
                        }

                        listHtml += '<div class="rank-point-row' + (isLatest ? ' is-latest' : '') + '">' +
                            '<span class="rank-point-left">' +
                                '<span class="rank-point-dot ' + dotCls + '"></span>' +
                                '<span class="rank-point-time">' + escapeHtmlStr(t) + '</span>' +
                            '</span>' +
                            '<span class="rank-point-right">' +
                                '<span class="rank-point-rank ' + rankCls + '">' + rankStr + '</span>' +
                                '<span class="rank-point-diff ' + diffCls + '">' + diffText + '</span>' +
                            '</span>' +
                        '</div>';
                    });
                    listHtml += '</div>';

                    var footLeft = bestR !== null ? ('最高第 ' + bestR + ' 名 · 共 ' + points.length + ' 个时间点') : ('共 ' + points.length + ' 个记录点');
                    var footRight = isPinned ? '点击外部或 Esc 关闭' : '点击排名可固定';

                    popover.innerHTML =
                        '<div class="rank-popover-head">' +
                            '<div class="rank-popover-title-wrap">' +
                                '<span class="rank-popover-title">排名变化轨迹</span>' +
                                (source ? '<span class="rank-popover-source">' + escapeHtmlStr(source) + '</span>' : '') +
                            '</div>' +
                            '<div class="rank-popover-right">' +
                                '<span class="rank-delta-pill ' + trendType + '">' + badgeText + '</span>' +
                                '<button type="button" class="rank-popover-close" aria-label="关闭">' +
                                    '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
                                '</button>' +
                            '</div>' +
                        '</div>' +
                        chartHtml +
                        listHtml +
                        '<div class="rank-popover-foot">' +
                            '<span>' + footLeft + '</span>' +
                            '<span>' + footRight + '</span>' +
                        '</div>';

                    var closeBtn = popover.querySelector('.rank-popover-close');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            hidePopover(true);
                        });
                    }
                    return true;
                }

                function positionPopover(trigger) {
                    var rect = trigger.getBoundingClientRect();
                    var popW = popover.offsetWidth || 300;
                    var popH = popover.offsetHeight || 220;
                    var vw = window.innerWidth;
                    var vh = window.innerHeight;
                    var margin = 12;

                    var left = rect.left - 6;
                    left = Math.max(margin, Math.min(vw - popW - margin, left));

                    var top = rect.bottom + 8;
                    if (top + popH > vh - margin && rect.top - popH - 8 > margin) {
                        top = rect.top - popH - 8;
                    } else if (top + popH > vh - margin) {
                        top = Math.max(margin, vh - popH - margin);
                    }

                    popover.style.left = Math.round(left) + 'px';
                    popover.style.top = Math.round(top) + 'px';
                }

                function showPopover(trigger, pinIt) {
                    clearTimeout(closeTimer);
                    if (activeTrigger && activeTrigger !== trigger) {
                        activeTrigger.classList.remove('popover-active');
                    }
                    activeTrigger = trigger;
                    pinned = !!pinIt;
                    popover.classList.toggle('pinned', pinned);
                    if (!renderPopoverContent(trigger, pinned)) return;
                    trigger.classList.add('popover-active');
                    popover.setAttribute('aria-hidden', 'false');
                    popover.classList.add('visible');
                    positionPopover(trigger);
                }

                function hidePopover(force) {
                    if (pinned && !force) return;
                    clearTimeout(openTimer);
                    clearTimeout(closeTimer);
                    pinned = false;
                    popover.classList.remove('visible');
                    popover.classList.remove('pinned');
                    popover.setAttribute('aria-hidden', 'true');
                    if (activeTrigger) {
                        activeTrigger.classList.remove('popover-active');
                        activeTrigger = null;
                    }
                }

                function scheduleClose() {
                    if (pinned) return;
                    clearTimeout(openTimer);
                    closeTimer = setTimeout(function() { hidePopover(false); }, 160);
                }

                triggers.forEach(function(trigger) {
                    trigger.addEventListener('mouseenter', function() {
                        if (pinned && activeTrigger !== trigger) return;
                        clearTimeout(closeTimer);
                        clearTimeout(openTimer);
                        openTimer = setTimeout(function() {
                            showPopover(trigger, pinned && activeTrigger === trigger);
                        }, 110);
                    });
                    trigger.addEventListener('mouseleave', scheduleClose);
                    trigger.addEventListener('click', function(e) {
                        e.stopPropagation();
                        clearTimeout(openTimer);
                        if (pinned && activeTrigger === trigger) {
                            hidePopover(true);
                        } else {
                            showPopover(trigger, true);
                        }
                    });
                    trigger.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (pinned && activeTrigger === trigger) hidePopover(true);
                            else showPopover(trigger, true);
                        }
                    });
                });

                popover.addEventListener('mouseenter', function() { clearTimeout(closeTimer); });
                popover.addEventListener('mouseleave', scheduleClose);

                document.addEventListener('click', function(e) {
                    if (!activeTrigger) return;
                    if (popover.contains(e.target) || activeTrigger.contains(e.target)) return;
                    hidePopover(true);
                });
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && activeTrigger) hidePopover(true);
                });
                window.addEventListener('scroll', function() {
                    if (activeTrigger && popover.classList.contains('visible')) {
                        if (pinned) positionPopover(activeTrigger);
                        else hidePopover(true);
                    }
                }, { passive: true });
                window.addEventListener('resize', function() {
                    if (activeTrigger && popover.classList.contains('visible')) {
                        positionPopover(activeTrigger);
                    }
                });

                window.__openRankPopoverFor = function(triggerEl) {
                    if (triggerEl) showPopover(triggerEl, true);
                };
            }

            function initTabScroll(tabBar) {
                var wrapper = tabBar.closest('.tab-bar-wrapper') || tabBar.parentNode;
                var leftArrow = wrapper.querySelector('.tab-arrow-left');
                var rightArrow = wrapper.querySelector('.tab-arrow-right');
                var indicator = wrapper.querySelector('.tab-scroll-indicator');
                if (!leftArrow) {
                    leftArrow = document.createElement('button');
                    leftArrow.className = 'tab-arrow tab-arrow-left';
                    leftArrow.innerHTML = '‹';
                    rightArrow = document.createElement('button');
                    rightArrow.className = 'tab-arrow tab-arrow-right';
                    rightArrow.innerHTML = '›';
                    indicator = document.createElement('div');
                    indicator.className = 'tab-scroll-indicator';
                    wrapper.insertBefore(leftArrow, tabBar);
                    tabBar.after(rightArrow);
                    wrapper.appendChild(indicator);
                }
                var scrollStep = 200;
                leftArrow.addEventListener('click', function(e) {
                    e.stopPropagation();
                    tabBar.scrollBy({ left: -scrollStep, behavior: 'smooth' });
                });
                rightArrow.addEventListener('click', function(e) {
                    e.stopPropagation();
                    tabBar.scrollBy({ left: scrollStep, behavior: 'smooth' });
                });
                function updateArrows() {
                    var sl = tabBar.scrollLeft;
                    var sw = tabBar.scrollWidth;
                    var cw = tabBar.clientWidth;
                    var noOverflow = sw <= cw + 1;
                    var atStart = sl <= 1;
                    var atEnd = sl + cw >= sw - 1;
                    leftArrow.classList.toggle('visible', !noOverflow && !atStart);
                    rightArrow.classList.toggle('visible', !noOverflow && !atEnd);
                    tabBar.classList.toggle('scroll-start', atStart);
                    tabBar.classList.toggle('scroll-end', atEnd);
                    tabBar.classList.toggle('no-overflow', noOverflow);
                    var progress = noOverflow ? 0 : sl / (sw - cw);
                    indicator.style.width = (progress * 100) + '%';
                }
                tabBar.addEventListener('scroll', updateArrows, { passive: true });
                tabBar.addEventListener('wheel', function(e) {
                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        tabBar.scrollLeft += e.deltaY;
                        e.preventDefault();
                    }
                }, { passive: false });
                updateArrows();
                new ResizeObserver(updateArrows).observe(tabBar);
            }

            function initTabs() {
                var wrapper = document.querySelector('.hotlist-section .tab-bar-wrapper');
                var tabBar = wrapper ? wrapper.querySelector('.tab-bar') : null;
                if (!tabBar) return;
                var tabs = tabBar.querySelectorAll('.tab-btn');
                var groups = document.querySelectorAll('.word-group[data-tab-index]');
                initTabVisibility();
                initTabScroll(tabBar);

                function activateTab(index, scroll) {
                    tabs.forEach(function(t) { t.classList.remove('active'); });
                    if (index === 'all') {
                        var allBtn = tabBar.querySelector('[data-tab-index="all"]');
                        if (allBtn) {
                            allBtn.classList.add('active');
                            if (scroll !== false) allBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                        }
                        groups.forEach(function(g) { g.style.display = ''; });
                        try { history.replaceState(null, '', '#all'); } catch(e) {}
                        return;
                    }
                    var idx = parseInt(index);
                    tabs.forEach(function(t) {
                        if (parseInt(t.dataset.tabIndex) === idx) t.classList.add('active');
                    });
                    if (document.body.classList.contains('wide-mode') && !wrapper.classList.contains('tab-hidden')) {
                        groups.forEach(function(g) {
                            g.style.display = (parseInt(g.dataset.tabIndex) === idx) ? '' : 'none';
                        });
                    }
                    var activeBtn = tabBar.querySelector('.tab-btn.active');
                    if (scroll !== false && activeBtn) activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                    try { history.replaceState(null, '', '#tab-' + idx); } catch(e) {}
                }

                tabs.forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        var idx = tab.dataset.tabIndex;
                        activateTab(idx === 'all' ? 'all' : parseInt(idx));
                    });
                });

                tabBar.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        var tabsArr = Array.from(tabs);
                        var ci = tabsArr.findIndex(function(t) { return t.classList.contains('active'); });
                        var dir = e.key === 'ArrowRight' ? 1 : -1;
                        var ni = Math.max(0, Math.min(tabsArr.length - 1, ci + dir));
                        var nt = tabsArr[ni];
                        activateTab(nt.dataset.tabIndex === 'all' ? 'all' : parseInt(nt.dataset.tabIndex));
                        nt.focus();
                        e.preventDefault();
                    }
                });

                var hash = window.location.hash;
                if (hash === '#all') { activateTab('all'); }
                else if (hash.indexOf('#tab-') === 0) { activateTab(parseInt(hash.replace('#tab-', ''))); }
                else { activateTab(0, false); }
            }

            function initTabVisibility() {
                var wrapper = document.querySelector('.hotlist-section .tab-bar-wrapper');
                if (!wrapper) return;
                var tabBar = wrapper.querySelector('.tab-bar');
                var groups = document.querySelectorAll('.word-group[data-tab-index]');
                var isWide = document.body.classList.contains('wide-mode');
                if (!isWide || groups.length <= 2) {
                    wrapper.classList.add('tab-hidden');
                    groups.forEach(function(g) { g.style.display = ''; });
                } else {
                    wrapper.classList.remove('tab-hidden');
                    var activeTab = tabBar.querySelector('.tab-btn.active');
                    if (activeTab) { activeTab.click(); }
                    else {
                        var firstTab = tabBar.querySelector('.tab-btn[data-tab-index="0"]');
                        if (firstTab) firstTab.click();
                    }
                }
            }

            var handleSearch = (function() {
                var timer = null;
                return function(query) {
                    var box = document.querySelector('.search-box');
                    if (box) box.classList.toggle('has-value', !!(query && query.length));
                    clearTimeout(timer);
                    timer = setTimeout(function() {
                        query = (query || '').toLowerCase();
                        document.querySelectorAll('.news-item').forEach(function(item) {
                            var title = (item.querySelector('.news-title') || {}).textContent || '';
                            item.style.display = (!query || title.toLowerCase().indexOf(query) !== -1) ? '' : 'none';
                        });
                        document.querySelectorAll('.rss-item').forEach(function(item) {
                            var title = (item.querySelector('.rss-title') || {}).textContent || '';
                            item.style.display = (!query || title.toLowerCase().indexOf(query) !== -1) ? '' : 'none';
                        });
                        document.querySelectorAll('.search-item').forEach(function(item) {
                            var title = (item.querySelector('.search-title') || {}).textContent || '';
                            var snippet = (item.querySelector('.search-snippet') || {}).textContent || '';
                            var combined = (title + ' ' + snippet).toLowerCase();
                            item.style.display = (!query || combined.indexOf(query) !== -1) ? '' : 'none';
                        });
                    }, 160);
                };
            })();

            function clearSearchInput() {
                var input = document.querySelector('.search-input');
                if (input) {
                    input.value = '';
                    handleSearch('');
                    input.focus();
                }
            }

            function initBackToTop() {
                var fabBar = document.querySelector('.fab-bar');
                if (!fabBar) return;
                var helpWrap = fabBar.querySelector('.fab-help-wrap');
                var helpBtn = fabBar.querySelector('.fab-help');
                var closeBtn = fabBar.querySelector('.fab-panel-close');
                var progressArc = fabBar.querySelector('.fab-progress-arc');
                var CIRCUMFERENCE = 2 * Math.PI * 16;
                var hoverOpenTimer = null;
                var hoverCloseTimer = null;

                function syncScrollState() {
                    var h = document.documentElement.scrollHeight - window.innerHeight;
                    var ratio = h > 0 ? Math.max(0, Math.min(1, window.scrollY / h)) : 0;
                    fabBar.classList.toggle('scrolled', window.scrollY > 220);
                    if (progressArc) {
                        progressArc.style.strokeDashoffset = (CIRCUMFERENCE * (1 - ratio)).toFixed(2);
                    }
                }

                var ticking = false;
                window.addEventListener('scroll', function() {
                    if (!ticking) {
                        requestAnimationFrame(function() {
                            syncScrollState();
                            ticking = false;
                        });
                        ticking = true;
                    }
                }, { passive: true });
                syncScrollState();

                if (!helpWrap || !helpBtn) return;

                function closeHelpPanel() {
                    clearTimeout(hoverOpenTimer);
                    clearTimeout(hoverCloseTimer);
                    helpWrap.classList.remove('open', 'pinned');
                    helpBtn.setAttribute('aria-expanded', 'false');
                }

                function toggleHelpPin() {
                    clearTimeout(hoverOpenTimer);
                    clearTimeout(hoverCloseTimer);
                    var next = !helpWrap.classList.contains('pinned');
                    helpWrap.classList.toggle('pinned', next);
                    helpWrap.classList.toggle('open', next);
                    helpBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
                }

                helpWrap.addEventListener('mouseenter', function() {
                    clearTimeout(hoverCloseTimer);
                    if (helpWrap.classList.contains('pinned')) return;
                    hoverOpenTimer = setTimeout(function() {
                        helpWrap.classList.add('open');
                        helpBtn.setAttribute('aria-expanded', 'true');
                    }, 90);
                });
                helpWrap.addEventListener('mouseleave', function() {
                    clearTimeout(hoverOpenTimer);
                    if (helpWrap.classList.contains('pinned')) return;
                    hoverCloseTimer = setTimeout(function() {
                        helpWrap.classList.remove('open');
                        helpBtn.setAttribute('aria-expanded', 'false');
                    }, 160);
                });
                helpBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleHelpPin();
                });
                if (closeBtn) {
                    closeBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        closeHelpPanel();
                    });
                }
                helpWrap.querySelectorAll('[data-fab-action]').forEach(function(row) {
                    row.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var act = row.getAttribute('data-fab-action');
                        if (act === 'wide') {
                            toggleWideMode();
                        } else if (act === 'dark') {
                            toggleDarkMode();
                        } else if (act === 'search') {
                            closeHelpPanel();
                            var si = document.querySelector('.search-input');
                            if (si) {
                                si.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                si.focus();
                            }
                        }
                    });
                });
                document.addEventListener('click', function(e) {
                    if (helpWrap.classList.contains('open') && !helpWrap.contains(e.target)) {
                        closeHelpPanel();
                    }
                });

                window.__toggleFabHelp = toggleHelpPin;
                window.__closeFabHelp = closeHelpPanel;
            }

            function initCollapse() {
                document.querySelectorAll('.word-header').forEach(function(header) {
                    header.addEventListener('click', function() {
                        var wrapper = document.querySelector('.hotlist-section .tab-bar-wrapper');
                        if (document.body.classList.contains('wide-mode') && wrapper && !wrapper.classList.contains('tab-hidden')) return;
                        var group = header.closest('.word-group');
                        if (group) group.classList.toggle('collapsed');
                    });
                });
                document.querySelectorAll('.search-topic-header').forEach(function(header) {
                    header.addEventListener('click', function() {
                        var section = header.closest('.search-section');
                        var wrapper = section ? section.querySelector('.search-tab-bar-wrapper') : null;
                        if (document.body.classList.contains('wide-mode') && wrapper && !wrapper.classList.contains('tab-hidden')) return;
                        var group = header.closest('.search-topic-group');
                        if (group) group.classList.toggle('collapsed');
                    });
                });
                initCollapseVisibility();
            }

            function initCollapseVisibility() {
                var headers = document.querySelectorAll('.word-header');
                var wrapper = document.querySelector('.hotlist-section .tab-bar-wrapper');
                var isTabMode = document.body.classList.contains('wide-mode') && wrapper && !wrapper.classList.contains('tab-hidden');
                headers.forEach(function(h) {
                    if (isTabMode) { h.classList.remove('collapsible'); }
                    else { h.classList.add('collapsible'); }
                });
                if (isTabMode) {
                    document.querySelectorAll('.word-group.collapsed').forEach(function(g) {
                        g.classList.remove('collapsed');
                    });
                }

                document.querySelectorAll('.search-section').forEach(function(section) {
                    var sWrapper = section.querySelector('.search-tab-bar-wrapper');
                    var isSearchTabMode = document.body.classList.contains('wide-mode') && sWrapper && !sWrapper.classList.contains('tab-hidden');
                    section.querySelectorAll('.search-topic-header').forEach(function(h) {
                        if (isSearchTabMode) { h.classList.remove('collapsible'); }
                        else { h.classList.add('collapsible'); }
                    });
                    if (isSearchTabMode) {
                        section.querySelectorAll('.search-topic-group.collapsed').forEach(function(g) {
                            g.classList.remove('collapsed');
                        });
                    }
                });
            }

            // 独立展示区 Tab 切换
            function initStandaloneTabs() {
                var tabBar = document.querySelector('.standalone-tab-bar');
                if (!tabBar) return;
                var groups = document.querySelectorAll('.standalone-group[data-standalone-tab]');
                var btns = tabBar.querySelectorAll('.tab-btn[data-standalone-tab]');
                initTabScroll(tabBar);

                function activateStandaloneTab(val) {
                    btns.forEach(function(b) {
                        var bVal = b.getAttribute('data-standalone-tab');
                        b.classList.toggle('active', bVal === String(val));
                    });
                    groups.forEach(function(g) {
                        var gVal = g.getAttribute('data-standalone-tab');
                        g.style.display = (val === 'all' || gVal === String(val)) ? '' : 'none';
                    });
                }

                btns.forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        activateStandaloneTab(btn.getAttribute('data-standalone-tab'));
                    });
                });

                // 初始状态
                initStandaloneTabVisibility();
            }

            function initStandaloneTabVisibility() {
                var tabBar = document.querySelector('.standalone-tab-bar');
                if (!tabBar) return;
                var groups = document.querySelectorAll('.standalone-group[data-standalone-tab]');
                var isWide = document.body.classList.contains('wide-mode');
                if (!isWide || groups.length <= 1) {
                    tabBar.classList.add('tab-hidden');
                    groups.forEach(function(g) { g.style.display = ''; });
                } else {
                    tabBar.classList.remove('tab-hidden');
                    var activeBtn = tabBar.querySelector('.tab-btn.active');
                    if (activeBtn) activeBtn.click();
                    else { var first = tabBar.querySelector('.tab-btn'); if (first) first.click(); }
                }
            }

            // 顶部区域分段滑块导航栏 + Header 数据源点击联动
            function initSectionNav() {
                var navBar = document.querySelector('.section-nav-bar');
                if (!navBar) return;
                var track = navBar.querySelector('.section-nav-track');
                var indicator = navBar.querySelector('.section-nav-indicator');
                var btns = navBar.querySelectorAll('.section-nav-btn[data-region-target]');
                var regions = document.querySelectorAll('[data-region]');

                function syncIndicator(activeBtn, instant) {
                    if (!track || !indicator || !activeBtn) return;
                    if (instant) indicator.style.transition = 'none';
                    var target = activeBtn.getAttribute('data-region-target') || 'all';
                    indicator.setAttribute('data-accent', target);
                    indicator.style.width = activeBtn.offsetWidth + 'px';
                    indicator.style.height = activeBtn.offsetHeight + 'px';
                    indicator.style.top = activeBtn.offsetTop + 'px';
                    indicator.style.transform = 'translateX(' + activeBtn.offsetLeft + 'px)';
                    indicator.classList.add('ready');
                    if (instant) {
                        void indicator.offsetWidth;
                        indicator.style.transition = '';
                    }
                }

                function activateRegion(target, shouldScroll) {
                    var targetBtn = navBar.querySelector('.section-nav-btn[data-region-target="' + target + '"]');
                    if (!targetBtn) {
                        target = 'all';
                        targetBtn = navBar.querySelector('.section-nav-btn[data-region-target="all"]');
                    }
                    btns.forEach(function(b) {
                        b.classList.toggle('active', b === targetBtn);
                    });
                    syncIndicator(targetBtn, false);

                    var firstVisibleMarked = false;
                    regions.forEach(function(el) {
                        el.classList.remove('region-first-visible');
                        el.classList.remove('region-fade-in');
                        if (target === 'all') {
                            el.style.display = '';
                        } else if (el.getAttribute('data-region') === target) {
                            el.style.display = '';
                            void el.offsetWidth;
                            el.classList.add('region-fade-in');
                            if (!firstVisibleMarked) {
                                el.classList.add('region-first-visible');
                                firstVisibleMarked = true;
                            }
                        } else {
                            el.style.display = 'none';
                        }
                    });

                    if (shouldScroll && navBar) {
                        navBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }

                btns.forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        activateRegion(btn.getAttribute('data-region-target'), false);
                    });
                });

                // Header 数据源与 AI 统计点击后快速联动切换到对应视图
                document.querySelectorAll('[data-jump-region]').forEach(function(card) {
                    card.addEventListener('click', function() {
                        var target = card.getAttribute('data-jump-region');
                        if (target) activateRegion(target, true);
                    });
                    card.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            var target = card.getAttribute('data-jump-region');
                            if (target) activateRegion(target, true);
                        }
                    });
                });

                // 初始定位滑块 & 响应容器宽度变化
                var initActive = navBar.querySelector('.section-nav-btn.active') || btns[0];
                requestAnimationFrame(function() { syncIndicator(initActive, true); });
                if (typeof ResizeObserver !== 'undefined' && track) {
                    new ResizeObserver(function() {
                        var curr = navBar.querySelector('.section-nav-btn.active');
                        if (curr) syncIndicator(curr, true);
                    }).observe(track);
                }
                window.__syncSectionNavIndicator = function() {
                    var curr = navBar.querySelector('.section-nav-btn.active');
                    if (curr) syncIndicator(curr, false);
                };
            }

            // 联网搜索主题 Tab 切换
            function initSearchTabs() {
                document.querySelectorAll('.search-tab-bar-wrapper').forEach(function(wrapper) {
                    var tabBar = wrapper.querySelector('.search-tab-bar');
                    var section = wrapper.closest('.search-section');
                    if (!tabBar || !section) return;
                    var grid = section.querySelector('.search-topics-grid');
                    var groups = section.querySelectorAll('.search-topic-group[data-search-tab]');
                    var btns = tabBar.querySelectorAll('.tab-btn[data-search-tab]');
                    initTabScroll(tabBar);

                    function activateSearchTab(val) {
                        btns.forEach(function(b) {
                            var bVal = b.getAttribute('data-search-tab');
                            b.classList.toggle('active', bVal === String(val));
                        });
                        groups.forEach(function(g) {
                            var gVal = g.getAttribute('data-search-tab');
                            g.style.display = (val === 'all' || gVal === String(val)) ? '' : 'none';
                        });
                        if (grid) {
                            grid.classList.toggle('single-topic', val !== 'all' || groups.length <= 1);
                        }
                    }

                    btns.forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            activateSearchTab(btn.getAttribute('data-search-tab'));
                        });
                    });
                });
                initSearchTabVisibility();
            }

            function initSearchTabVisibility() {
                var isWide = document.body.classList.contains('wide-mode');
                document.querySelectorAll('.search-tab-bar-wrapper').forEach(function(wrapper) {
                    var tabBar = wrapper.querySelector('.search-tab-bar');
                    var section = wrapper.closest('.search-section');
                    if (!tabBar || !section) return;
                    var grid = section.querySelector('.search-topics-grid');
                    var groups = section.querySelectorAll('.search-topic-group[data-search-tab]');
                    if (!isWide || groups.length <= 1) {
                        wrapper.classList.add('tab-hidden');
                        groups.forEach(function(g) { g.style.display = ''; });
                        if (grid) grid.classList.toggle('single-topic', groups.length <= 1);
                    } else {
                        wrapper.classList.remove('tab-hidden');
                        var activeBtn = tabBar.querySelector('.tab-btn.active');
                        if (activeBtn) activeBtn.click();
                        else {
                            var allBtn = tabBar.querySelector('.tab-btn[data-search-tab="all"]') || tabBar.querySelector('.tab-btn');
                            if (allBtn) allBtn.click();
                        }
                    }
                });
            }

            function prepareForScreenshot() {
                var state = {
                    wasWide: document.body.classList.contains('wide-mode'),
                    hiddenGroups: [],
                    hiddenRegions: [],
                    soloRegions: [],
                    hiddenSearchGroups: []
                };
                document.body.classList.remove('wide-mode');
                state.wasDark = document.body.classList.contains('dark-mode');
                document.body.classList.remove('dark-mode');
                document.querySelectorAll('[data-region]').forEach(function(el, i) {
                    if (el.style.display === 'none') {
                        state.hiddenRegions.push(i);
                        el.style.display = '';
                    }
                    if (el.classList.contains('region-first-visible')) {
                        state.soloRegions.push(i);
                        el.classList.remove('region-first-visible');
                    }
                });
                document.querySelectorAll('.word-group[data-tab-index]').forEach(function(g, i) {
                    if (g.style.display === 'none') {
                        state.hiddenGroups.push(i);
                        g.style.display = '';
                    }
                });
                state.hiddenStandaloneGroups = [];
                document.querySelectorAll('.standalone-group[data-standalone-tab]').forEach(function(g, i) {
                    if (g.style.display === 'none') {
                        state.hiddenStandaloneGroups.push(i);
                        g.style.display = '';
                    }
                });
                document.querySelectorAll('.search-topic-group[data-search-tab]').forEach(function(g, i) {
                    if (g.style.display === 'none') {
                        state.hiddenSearchGroups.push(i);
                        g.style.display = '';
                    }
                });
                document.querySelectorAll('.tab-bar-wrapper, .standalone-tab-bar, .search-tab-bar-wrapper, .section-nav-bar, .search-bar, .fab-bar, .toggle-wide-btn, .metric-tooltip, .rank-popover, .ai-copy-all-btn, .ai-block-copy-btn, .card-copy-btn, .card-ext-icon').forEach(function(el) {
                    el.dataset.prevDisplay = el.style.display || '';
                    el.style.display = 'none';
                });
                document.querySelectorAll('.toggle-dark-btn').forEach(function(el) {
                    el.dataset.prevDisplay = el.style.display || ''; el.style.display = 'none';
                });
                document.querySelectorAll('.reading-progress').forEach(function(el) { el.style.display = 'none'; });
                document.querySelectorAll('.header-watermark').forEach(function(el) { el.style.display = 'none'; });
                return state;
            }

            function restoreAfterScreenshot(state) {
                if (state.wasWide) document.body.classList.add('wide-mode');
                if (state.wasDark) document.body.classList.add('dark-mode');
                var regions = document.querySelectorAll('[data-region]');
                if (state.hiddenRegions) {
                    state.hiddenRegions.forEach(function(i) {
                        if (regions[i]) regions[i].style.display = 'none';
                    });
                }
                if (state.soloRegions) {
                    state.soloRegions.forEach(function(i) {
                        if (regions[i]) regions[i].classList.add('region-first-visible');
                    });
                }
                var groups = document.querySelectorAll('.word-group[data-tab-index]');
                state.hiddenGroups.forEach(function(i) {
                    if (groups[i]) groups[i].style.display = 'none';
                });
                var standaloneGroups = document.querySelectorAll('.standalone-group[data-standalone-tab]');
                if (state.hiddenStandaloneGroups) {
                    state.hiddenStandaloneGroups.forEach(function(i) {
                        if (standaloneGroups[i]) standaloneGroups[i].style.display = 'none';
                    });
                }
                var searchGroups = document.querySelectorAll('.search-topic-group[data-search-tab]');
                if (state.hiddenSearchGroups) {
                    state.hiddenSearchGroups.forEach(function(i) {
                        if (searchGroups[i]) searchGroups[i].style.display = 'none';
                    });
                }
                document.querySelectorAll('.tab-bar-wrapper, .standalone-tab-bar, .search-tab-bar-wrapper, .section-nav-bar, .search-bar, .fab-bar, .toggle-wide-btn, .metric-tooltip, .rank-popover, .ai-copy-all-btn, .ai-block-copy-btn, .card-copy-btn, .card-ext-icon').forEach(function(el) {
                    el.style.display = el.dataset.prevDisplay || '';
                    delete el.dataset.prevDisplay;
                });
                document.querySelectorAll('.toggle-dark-btn').forEach(function(el) {
                    el.style.display = el.dataset.prevDisplay || ''; delete el.dataset.prevDisplay;
                });
                document.querySelectorAll('.reading-progress').forEach(function(el) { el.style.display = ''; });
                document.querySelectorAll('.header-watermark').forEach(function(el) { el.style.display = ''; });
                initTabVisibility();
                initCollapseVisibility();
                initStandaloneTabVisibility();
                initSearchTabVisibility();
                var fabBar = document.querySelector('.fab-bar');
                if (fabBar) fabBar.classList.toggle('scrolled', window.scrollY > 220);
            }

            // ===== 截图功能 =====

            async function saveAsImage(e) {
                const button = e.target.closest('.save-dropdown-item') || e.target;
                const originalHTML = button.innerHTML;
                var screenshotState = null;

                try {
                    button.textContent = '生成中...';
                    button.disabled = true;
                    window.scrollTo(0, 0);

                    // 等待页面稳定
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // 截图前准备：切回窄屏布局
                    screenshotState = prepareForScreenshot();

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
                    restoreAfterScreenshot(screenshotState);

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
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'visible';
                    if (screenshotState) { restoreAfterScreenshot(screenshotState); }
                    button.textContent = '保存失败';
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                    }, 2000);
                }
            }

            async function saveAsMultipleImages(e) {
                const button = e.target.closest('.save-dropdown-item') || e.target;
                const originalHTML = button.innerHTML;
                const container = document.querySelector('.container');
                const scale = 1.5;
                const maxHeight = 5000 / scale;
                var screenshotState2 = null;

                try {
                    screenshotState2 = prepareForScreenshot();
                    button.textContent = '分析中...';
                    button.disabled = true;

                    // 获取所有可能的分割元素
                    const newsItems = Array.from(container.querySelectorAll('.news-item'));
                    const wordGroups = Array.from(container.querySelectorAll('.word-group'));
                    const searchSections = Array.from(container.querySelectorAll('.search-section'));
                    const newSection = container.querySelector('.new-section');
                    const errorSection = container.querySelector('.error-section');
                    const header = container.querySelector('.header');
                    const footer = container.querySelector('.footer');

                    // 计算元素位置和高度
                    const containerRect = container.getBoundingClientRect();
                    const middleElements = [];

                    // 添加错误信息（如果存在）
                    if (errorSection) {
                        const rect = errorSection.getBoundingClientRect();
                        middleElements.push({
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
                            middleElements.push({
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
                            middleElements.push({
                                type: 'news-item',
                                element: item,
                                parent: group,
                                top: rect.top - containerRect.top,
                                bottom: rect.bottom - containerRect.top,
                                height: rect.height
                            });
                        });
                    });

                    // 按 search-topic-group 分组处理联网搜索卡片，防止截图截断
                    searchSections.forEach(section => {
                        const secHeader = section.querySelector('.search-section-header');
                        if (secHeader) {
                            const secRect = secHeader.getBoundingClientRect();
                            middleElements.push({
                                type: 'search-section-header',
                                element: secHeader,
                                top: secRect.top - containerRect.top,
                                bottom: secRect.bottom - containerRect.top,
                                height: secRect.height
                            });
                        }
                        const topicGroups = section.querySelectorAll('.search-topic-group');
                        topicGroups.forEach(group => {
                            const groupRect = group.getBoundingClientRect();
                            const topicHeader = group.querySelector('.search-topic-header');
                            if (topicHeader) {
                                const thRect = topicHeader.getBoundingClientRect();
                                middleElements.push({
                                    type: 'search-topic-header',
                                    element: topicHeader,
                                    parent: group,
                                    top: groupRect.top - containerRect.top,
                                    bottom: thRect.bottom - containerRect.top,
                                    height: thRect.height
                                });
                            }
                            group.querySelectorAll('.search-item').forEach(item => {
                                const rect = item.getBoundingClientRect();
                                middleElements.push({
                                    type: 'search-item',
                                    element: item,
                                    parent: group,
                                    top: rect.top - containerRect.top,
                                    bottom: rect.bottom - containerRect.top,
                                    height: rect.height
                                });
                            });
                        });
                    });

                    // 添加新增新闻部分
                    if (newSection) {
                        const rect = newSection.getBoundingClientRect();
                        middleElements.push({
                            type: 'new-section',
                            element: newSection,
                            top: rect.top - containerRect.top,
                            bottom: rect.bottom - containerRect.top,
                            height: rect.height
                        });
                    }

                    // 按垂直位置排序，适配任意 region_order
                    middleElements.sort((a, b) => a.top - b.top);

                    const elements = [{
                        type: 'header',
                        element: header,
                        top: 0,
                        bottom: header.offsetHeight,
                        height: header.offsetHeight
                    }].concat(middleElements);

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
                    restoreAfterScreenshot(screenshotState2);
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    console.error('分段保存失败:', error);
                    const buttons = document.querySelector('.save-buttons');
                    buttons.style.visibility = 'visible';
                    if (screenshotState2) { restoreAfterScreenshot(screenshotState2); }
                    button.textContent = '保存失败';
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                    }, 2000);
                }
            }

            function saveAsMarkdown() {
                var lines = [];
                var now = new Date();
                var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

                // 标题
                var headerTitle = document.querySelector('.header-title');
                lines.push('# ' + (headerTitle ? headerTitle.textContent.trim() : 'TrendRadar'));
                lines.push('');

                // 报告元信息
                var infoItems = document.querySelectorAll('.header-info .info-item');
                var sourceCards = document.querySelectorAll('.header-sources-bar .header-source-card');
                if (infoItems.length || sourceCards.length) {
                    infoItems.forEach(function(item) {
                        var label = item.querySelector('.info-label');
                        var value = item.querySelector('.info-value');
                        if (label && value) {
                            lines.push('- **' + label.textContent.trim() + '**: ' + value.textContent.trim());
                        }
                    });
                    sourceCards.forEach(function(card) {
                        var label = card.querySelector('.source-card-label');
                        var value = card.querySelector('.source-card-value');
                        var sub = card.querySelector('.source-card-sub');
                        if (label && value) {
                            var txt = value.textContent.trim();
                            if (sub && sub.textContent.trim() && sub.textContent.trim() !== '--') {
                                txt += ' · ' + sub.textContent.trim();
                            }
                            lines.push('- **' + label.textContent.trim() + '**: ' + txt);
                        }
                    });
                    lines.push('');
                }

                // 提取 news-item 通用函数
                function extractItem(item, idx) {
                    var titleEl = item.querySelector('.news-title a');
                    var titleText = '';
                    var url = '';
                    if (titleEl) {
                        titleText = titleEl.textContent.trim();
                        url = titleEl.href || '';
                    } else {
                        var titleDiv = item.querySelector('.news-title') || item.querySelector('.new-item-title');
                        if (titleDiv) titleText = titleDiv.textContent.trim();
                    }
                    if (!titleText) return '';

                    var meta = [];
                    var rank = item.querySelector('.rank-num, .new-item-rank');
                    if (rank && rank.textContent.trim() && rank.textContent.trim() !== '?') meta.push('#' + rank.textContent.trim());
                    var source = item.querySelector('.source-name');
                    if (source) meta.push(source.textContent.trim());
                    var keyword = item.querySelector('.keyword-tag');
                    if (keyword) meta.push(keyword.textContent.trim());
                    var time = item.querySelector('.time-info');
                    if (time) meta.push(time.textContent.trim());
                    var count = item.querySelector('.count-info');
                    if (count) meta.push(count.textContent.trim());

                    var line = idx + '. ';
                    if (url) {
                        line += '[' + titleText.replace(/[[\\]]/g, '') + '](' + url + ')';
                    } else {
                        line += titleText;
                    }
                    if (meta.length) line += '  `' + meta.join(' | ') + '`';
                    return line;
                }

                // 热点关键词区
                var wordGroups = document.querySelectorAll('.hotlist-section > .word-group');
                if (wordGroups.length) {
                    lines.push('## 热点新闻');
                    lines.push('');
                    wordGroups.forEach(function(group) {
                        var wordName = group.querySelector('.word-name');
                        var wordCount = group.querySelector('.word-count');
                        if (wordName) {
                            lines.push('### ' + wordName.textContent.trim() + (wordCount ? ' (' + wordCount.textContent.trim() + ')' : ''));
                            lines.push('');
                        }
                        var items = group.querySelectorAll('.news-item');
                        items.forEach(function(item, i) {
                            var line = extractItem(item, i + 1);
                            if (line) lines.push(line);
                        });
                        lines.push('');
                    });
                }

                // 新增热点区
                var newSection = document.querySelector('.new-section');
                if (newSection) {
                    var newTitle = newSection.querySelector('.new-section-title');
                    lines.push('## ' + (newTitle ? newTitle.textContent.trim() : '本次新增热点'));
                    lines.push('');
                    var sourceGroups = newSection.querySelectorAll('.new-source-group');
                    sourceGroups.forEach(function(sg) {
                        var srcTitle = sg.querySelector('.new-source-title');
                        if (srcTitle) {
                            lines.push('### ' + srcTitle.textContent.trim());
                            lines.push('');
                        }
                        var items = sg.querySelectorAll('.new-item');
                        items.forEach(function(item, i) {
                            var line = extractItem(item, i + 1);
                            if (line) lines.push(line);
                        });
                        lines.push('');
                    });
                }

                // RSS 订阅更新区
                var rssSection = document.querySelector('.rss-section');
                if (rssSection) {
                    var rssSectionTitle = rssSection.querySelector('.rss-section-title');
                    lines.push('## ' + (rssSectionTitle ? rssSectionTitle.textContent.trim() : 'RSS 订阅更新'));
                    lines.push('');
                    var feedGroups = rssSection.querySelectorAll('.feed-group');
                    feedGroups.forEach(function(group) {
                        var feedName = group.querySelector('.feed-name');
                        var feedCount = group.querySelector('.feed-count');
                        if (feedName) {
                            lines.push('### ' + feedName.textContent.trim() + (feedCount ? ' (' + feedCount.textContent.trim() + ')' : ''));
                            lines.push('');
                        }
                        var items = group.querySelectorAll('.rss-item');
                        items.forEach(function(item, i) {
                            var titleEl = item.querySelector('.rss-title a');
                            var titleText = titleEl ? titleEl.textContent.trim() : '';
                            var url = titleEl ? (titleEl.href || '') : '';
                            if (!titleText) return;
                            var meta = [];
                            var time = item.querySelector('.rss-time');
                            if (time) meta.push(time.textContent.trim());
                            var author = item.querySelector('.rss-author');
                            if (author) meta.push(author.textContent.trim());
                            var line = (i + 1) + '. ';
                            if (url) { line += '[' + titleText.replace(/[\\[\\]]/g, '') + '](' + url + ')'; }
                            else { line += titleText; }
                            if (meta.length) line += '  `' + meta.join(' | ') + '`';
                            lines.push(line);
                        });
                        lines.push('');
                    });
                }

                // 联网搜索区
                var searchSections = document.querySelectorAll('.search-section');
                searchSections.forEach(function(searchSection) {
                    var searchSectionTitle = searchSection.querySelector('.search-section-title');
                    lines.push('## ' + (searchSectionTitle ? searchSectionTitle.textContent.trim() : '联网搜索'));
                    lines.push('');
                    var topicGroups = searchSection.querySelectorAll('.search-topic-group');
                    topicGroups.forEach(function(group) {
                        var topicName = group.querySelector('.search-topic-name');
                        var topicCount = group.querySelector('.search-topic-count');
                        var providerBadge = group.querySelector('.search-provider-badge');
                        if (topicName) {
                            var heading = '### ' + topicName.textContent.trim();
                            var suffix = [];
                            if (topicCount) suffix.push(topicCount.textContent.trim());
                            if (providerBadge) suffix.push(providerBadge.textContent.trim());
                            if (suffix.length) heading += ' (' + suffix.join(' · ') + ')';
                            lines.push(heading);
                            lines.push('');
                        }
                        var queryHint = group.querySelector('.search-query-hint');
                        if (queryHint) {
                            lines.push('> ' + queryHint.textContent.trim());
                            lines.push('');
                        }
                        var items = group.querySelectorAll('.search-item');
                        items.forEach(function(item, i) {
                            var titleEl = item.querySelector('.search-title a');
                            var titleText = '';
                            var url = '';
                            if (titleEl) {
                                titleText = titleEl.textContent.trim();
                                url = titleEl.href || '';
                            } else {
                                var titleDiv = item.querySelector('.search-title');
                                if (titleDiv) titleText = titleDiv.textContent.trim();
                            }
                            if (!titleText) return;
                            var meta = [];
                            var site = item.querySelector('.search-site');
                            if (site) meta.push(site.textContent.trim());
                            var auth = item.querySelector('.badge-authority');
                            if (auth) meta.push(auth.textContent.trim());
                            var time = item.querySelector('.search-time');
                            if (time) meta.push(time.textContent.trim());
                            var line = (i + 1) + '. ';
                            if (url) { line += '[' + titleText.replace(/[\\[\\]]/g, '') + '](' + url + ')'; }
                            else { line += titleText; }
                            if (meta.length) line += '  `' + meta.join(' | ') + '`';
                            lines.push(line);
                            var snippet = item.querySelector('.search-snippet');
                            if (snippet && snippet.textContent.trim()) {
                                lines.push('   > ' + snippet.textContent.trim().replace(/\\s+/g, ' '));
                            }
                        });
                        lines.push('');
                    });
                });

                // AI 热点分析区
                var aiSection = document.querySelector('.ai-section');
                if (aiSection) {
                    var aiError = aiSection.querySelector('.ai-error') || aiSection.querySelector('.ai-warning');
                    var aiInfo = aiSection.querySelector('.ai-info');
                    if (aiError) {
                        lines.push('## AI 分析');
                        lines.push('');
                        lines.push('> ' + aiError.textContent.trim());
                        lines.push('');
                    } else if (aiInfo) {
                        // 跳过 info 提示（如"跳过"）
                    } else {
                        var aiTitle = aiSection.querySelector('.ai-section-title');
                        lines.push('## ' + (aiTitle ? aiTitle.textContent.trim() : 'AI 热点分析'));
                        lines.push('');
                        var aiBlocks = aiSection.querySelectorAll('.ai-block');
                        aiBlocks.forEach(function(block) {
                            var blockTitle = block.querySelector('.ai-block-title');
                            var blockContent = block.querySelector('.ai-block-content');
                            if (blockTitle) {
                                lines.push('### ' + blockTitle.textContent.trim());
                                lines.push('');
                            }
                            if (blockContent) {
                                lines.push(blockContent.textContent.trim());
                                lines.push('');
                            }
                        });
                    }
                }

                // 独立展示区（热榜平台 + RSS）
                var standaloneSection = document.querySelector('.standalone-section');
                if (standaloneSection) {
                    var standaloneTitle = standaloneSection.querySelector('.standalone-section-title');
                    lines.push('## ' + (standaloneTitle ? standaloneTitle.textContent.trim() : '独立展示区'));
                    lines.push('');
                    var groups = standaloneSection.querySelectorAll('.standalone-group');
                    groups.forEach(function(group) {
                        var name = group.querySelector('.standalone-name');
                        var cnt = group.querySelector('.standalone-count');
                        if (name) {
                            lines.push('### ' + name.textContent.trim() + (cnt ? ' (' + cnt.textContent.trim() + ')' : ''));
                            lines.push('');
                        }
                        var items = group.querySelectorAll('.news-item');
                        items.forEach(function(item, i) {
                            var line = extractItem(item, i + 1);
                            if (line) lines.push(line);
                        });
                        lines.push('');
                    });
                }

                // 错误区
                var errorSection = document.querySelector('.error-section');
                if (errorSection) {
                    var errorItems = errorSection.querySelectorAll('.error-item');
                    if (errorItems.length) {
                        lines.push('## 抓取异常');
                        lines.push('');
                        errorItems.forEach(function(item) {
                            lines.push('- ' + item.textContent.trim());
                        });
                        lines.push('');
                    }
                }

                // 页脚
                lines.push('---');
                lines.push('*Generated by TrendRadar*');

                // 下载
                var md = lines.join('\\n');
                var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                var link = document.createElement('a');
                var filename = 'TrendRadar_' + dateStr + '_' + timeStr.replace(':', '') + '.md';
                link.download = filename;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }

            document.addEventListener('DOMContentLoaded', function() {
                window.scrollTo(0, 0);

                // 自动检测宽屏模式
                var savedMode = null;
                try { savedMode = localStorage.getItem('trendradar-wide-mode'); } catch(e) {}
                if (savedMode === '1' || (savedMode === null && window.innerWidth > 768)) {
                    document.body.classList.add('wide-mode');
                    var btn = document.querySelector('.toggle-wide-btn');
                    if (btn) btn.innerHTML = ICON_COMPRESS;
                }

                // 暗色模式恢复
                var savedDark = null;
                try { savedDark = localStorage.getItem('trendradar-dark-mode'); } catch(e) {}
                if (savedDark === '1') {
                    document.body.classList.add('dark-mode');
                    var darkBtn = document.querySelector('.toggle-dark-btn');
                    if (darkBtn) darkBtn.innerHTML = ICON_SUN;
                }

                // 启用搜索栏和区域快捷切换栏
                var searchBar = document.querySelector('.search-bar');
                if (searchBar) searchBar.style.display = 'block';
                var sectionNavBar = document.querySelector('.section-nav-bar');
                if (sectionNavBar) sectionNavBar.style.display = 'block';

                // 初始化增强功能
                initSectionNav();
                initTabs();
                initBackToTop();
                initCollapse();
                initStandaloneTabs();
                initSearchTabs();
                initRankTimelinePopover();

                // 键盘快捷键
                document.addEventListener('keydown', function(e) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    switch(e.key) {
                        case '?':
                            if (window.__toggleFabHelp) window.__toggleFabHelp();
                            break;
                        case 'Escape':
                            if (window.__closeFabHelp) window.__closeFabHelp();
                            break;
                        case 'w': case 'W': toggleWideMode(); break;
                        case 'd': case 'D': toggleDarkMode(); break;
                        case '/': e.preventDefault(); var si = document.querySelector('.search-input'); if (si) si.focus(); break;
                    }
                });

                // 阅读进度条
                var progressBar = document.querySelector('.reading-progress');
                if (progressBar) {
                    var progressTicking = false;
                    window.addEventListener('scroll', function() {
                        if (!progressTicking) {
                            requestAnimationFrame(function() {
                                var h = document.documentElement.scrollHeight - window.innerHeight;
                                progressBar.style.width = (h > 0 ? (window.scrollY / h * 100) : 0) + '%';
                                progressTicking = false;
                            });
                            progressTicking = true;
                        }
                    });
                }

                // 通用安全复制工具（支持剪贴板 API + execCommand 兜底）
                var copySvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg>';
                var checkSvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 7-7"/></svg>';
                function copyPlainText(str, cb) {
                    function fallbackCopy() {
                        var ta = document.createElement('textarea');
                        ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
                        document.body.appendChild(ta); ta.select();
                        try { document.execCommand('copy'); if (cb) cb(); } catch(ex) {}
                        document.body.removeChild(ta);
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(str).then(function() { if (cb) cb(); }).catch(fallbackCopy);
                    } else {
                        fallbackCopy();
                    }
                }

                // 一键复制：hover 时数字变复制图标（热榜 / 独立展示 / 联网搜索 / 新增热点）
                document.querySelectorAll('.news-item .news-number, .search-item .news-number, .new-item .new-item-number').forEach(function(numEl) {
                    var item = numEl.closest('.news-item, .search-item, .new-item');
                    var titleEl = item ? item.querySelector('.news-title a, .search-title a, .new-item-title a') : null;
                    if (!titleEl) return;
                    var numText = numEl.textContent.trim();
                    numEl.innerHTML = '<span class="num-text">' + numText + '</span><span class="copy-icon">' + copySvg + '</span>';
                    numEl.title = '点击复制标题和链接';
                    numEl.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var text = titleEl.textContent.trim() + ' ' + titleEl.href;
                        copyPlainText(text, function() {
                            numEl.classList.add('copied');
                            numEl.querySelector('.copy-icon').innerHTML = checkSvg;
                            setTimeout(function() {
                                numEl.classList.remove('copied');
                                numEl.querySelector('.copy-icon').innerHTML = copySvg;
                            }, 1500);
                        });
                    });
                });

                // RSS 卡片悬停一键复制标题与链接
                document.querySelectorAll('.rss-item .card-copy-btn').forEach(function(btn) {
                    var origHtml = btn.innerHTML;
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var item = btn.closest('.rss-item');
                        var a = item ? item.querySelector('.rss-title a') : null;
                        if (!a) return;
                        copyPlainText(a.textContent.trim() + ' ' + a.href, function() {
                            btn.classList.add('copied');
                            btn.innerHTML = checkSvg;
                            setTimeout(function() {
                                btn.classList.remove('copied');
                                btn.innerHTML = origHtml;
                            }, 1500);
                        });
                    });
                });

                // 联网搜索：点击搜索词芯片复制查询词 & 点击溢出摘要展开/收起
                document.querySelectorAll('.search-query-hint[data-copy-query]').forEach(function(chip) {
                    chip.classList.add('copyable');
                    chip.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var q = chip.getAttribute('data-copy-query') || '';
                        if (!q) return;
                        var span = chip.querySelector('span');
                        var orig = span ? span.textContent : '';
                        copyPlainText(q, function() {
                            chip.classList.add('copied');
                            if (span) span.textContent = '已复制搜索词';
                            setTimeout(function() {
                                chip.classList.remove('copied');
                                if (span) span.textContent = orig;
                            }, 1400);
                        });
                    });
                });
                document.querySelectorAll('.search-snippet').forEach(function(sn) {
                    if (sn.scrollHeight > sn.clientHeight + 2) {
                        sn.classList.add('expandable');
                        sn.title = '点击展开 / 收起完整摘要';
                        sn.addEventListener('click', function() {
                            sn.classList.toggle('expanded');
                        });
                    }
                });

                // AI 分析：单节洞察卡片复制 & 一键复制全部 AI 研判
                document.querySelectorAll('.ai-block .ai-block-copy-btn').forEach(function(btn) {
                    var origHtml = btn.innerHTML;
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var block = btn.closest('.ai-block');
                        if (!block) return;
                        var t = (block.querySelector('.ai-block-title') || {}).textContent || '';
                        var c = (block.querySelector('.ai-block-content') || {}).textContent || '';
                        copyPlainText(('【' + t.trim() + '】\\n' + c.trim()).trim(), function() {
                            btn.classList.add('copied');
                            btn.innerHTML = checkSvg;
                            setTimeout(function() {
                                btn.classList.remove('copied');
                                btn.innerHTML = origHtml;
                            }, 1500);
                        });
                    });
                });
                document.querySelectorAll('.ai-copy-all-btn').forEach(function(btn) {
                    var origHtml = btn.innerHTML;
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var sec = btn.closest('.ai-section');
                        if (!sec) return;
                        var parts = [];
                        sec.querySelectorAll('.ai-block').forEach(function(b) {
                            var t = (b.querySelector('.ai-block-title') || {}).textContent || '';
                            var c = (b.querySelector('.ai-block-content') || {}).textContent || '';
                            if (t || c) parts.push('### ' + t.trim() + '\\n' + c.trim());
                        });
                        if (!parts.length) return;
                        copyPlainText(parts.join('\\n\\n'), function() {
                            btn.classList.add('copied');
                            btn.innerHTML = checkSvg + '<span>已复制</span>';
                            setTimeout(function() {
                                btn.classList.remove('copied');
                                btn.innerHTML = origHtml;
                            }, 1600);
                        });
                    });
                });



                // Header watermark 鼠标跟随揭示
                (function() {
                    var header = document.querySelector('.header');
                    var watermark = document.querySelector('.header-watermark');
                    if (!header || !watermark) return;

                    var radius = 100;

                    header.addEventListener('mousemove', function(e) {
                        var rect = watermark.getBoundingClientRect();
                        var x = e.clientX - rect.left;
                        var y = e.clientY - rect.top;
                        var maskVal = 'radial-gradient(circle ' + radius + 'px at ' + x + 'px ' + y + 'px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)';
                        watermark.style.webkitMaskImage = maskVal;
                        watermark.style.maskImage = maskVal;
                        watermark.style.color = 'rgba(255, 255, 255, 0.25)';
                    });

                    header.addEventListener('mouseleave', function() {
                        watermark.style.webkitMaskImage = 'radial-gradient(circle 0px at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)';
                        watermark.style.maskImage = 'radial-gradient(circle 0px at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)';
                        watermark.style.color = 'rgba(255, 255, 255, 0.15)';
                    });
                })();
            });
        </script>
        <!--EMAIL_STRIP_END-->
    </body>
    </html>
    """

    return html
