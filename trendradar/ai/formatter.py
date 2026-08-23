# coding=utf-8
"""
AI 分析结果格式化模块

将 AI 分析结果（按事件/主题聚合的内容总结）格式化为各推送渠道的样式
"""

import html as html_lib
import re
from .analyzer import AIAnalysisResult


def _escape_html(text: str) -> str:
    """转义 HTML 特殊字符，防止 XSS 攻击"""
    return html_lib.escape(text) if text else ""


def _format_list_content(text: str) -> str:
    """
    格式化列表内容，确保序号前有换行
    例如将 "1. xxx 2. yyy" 转换为:
    1. xxx
    2. yyy
    """
    if not text:
        return ""

    # 去除首尾空白，防止 AI 返回的内容开头就有换行导致显示空行
    text = text.strip()

    # 0. 合并序号与紧随的【标签】（防御性处理）
    # 将 "1.\n【投资者】：" 或 "1. 【投资者】：" 合并为 "1. 投资者："
    text = re.sub(r'(\d+\.)\s*【([^】]+)】([:：]?)', r'\1 \2：', text)

    # 1. 规范化：确保 "1." 后面有空格
    result = re.sub(r'(\d+)\.([^ \d])', r'\1. \2', text)

    # 2. 强制换行：匹配 "数字."，且前面不是换行符
    #    (?!\d) 排除版本号/小数（如 2.0、3.5），避免将其误判为列表序号
    result = re.sub(r'(?<=[^\n])\s+(\d+\.)(?!\d)', r'\n\1', result)

    # 3. 处理 "1.**粗体**" 这种情况（虽然 Prompt 要求不输出 Markdown，但防御性处理）
    result = re.sub(r'(?<=[^\n])(\d+\.\*\*)', r'\n\1', result)

    # 4. 处理中文标点后的换行（排除版本号/小数）
    result = re.sub(r'([：:;,。；，])\s*(\d+\.)(?!\d)', r'\1\n\2', result)

    # 5. 处理 "XX方面："、"XX领域：" 等子标题换行
    # 只有在中文标点（句号、逗号、分号等）后才触发换行，避免破坏 "1. XX领域：" 格式
    result = re.sub(r'([。！？；，、])\s*([a-zA-Z0-9一-龥]+(方面|领域)[:：])', r'\1\n\2', result)

    # 6. 处理 【标签】 格式
    # 6a. 标签前确保空行分隔（文本开头除外）
    result = re.sub(r'(?<=\S)\n*(【[^】]+】)', r'\n\n\1', result)
    # 6b. 合并标签与被换行拆开的冒号：【tag】\n： → 【tag】：
    result = re.sub(r'(【[^】]+】)\n+([:：])', r'\1\2', result)
    # 6c. 标签后（含可选冒号），如果紧跟非空白非冒号内容则另起一行
    # 用 (?=[^\s:：]) 避免正则回溯将冒号误判为"内容"而拆开 【tag】：
    result = re.sub(r'(【[^】]+】[:：]?)[ \t]*(?=[^\s:：])', r'\1\n', result)

    # 7. 在列表项之间增加视觉空行（排除版本号/小数）
    # 排除 【标签】 行（以】结尾）和子标题行（以冒号结尾）之后的情况，避免标题与首项之间出现空行
    result = re.sub(r'(?<![:：】])\n(\d+\.)(?!\d)', r'\n\n\1', result)

    return result


def _format_platforms(platforms: list) -> str:
    """格式化平台来源列表为顿号分隔的字符串"""
    if not platforms:
        return ""
    return "、".join(platforms)


def _format_key_points(key_points: list) -> str:
    """格式化关键信息要点列表"""
    if not key_points:
        return ""
    return "\n".join(f"- {p}" for p in key_points)


def _render_topic_title(topic: dict, index: int) -> str:
    """提取事件标题，空标题时用序号兜底"""
    title = topic.get("title", "")
    return title if title else f"事件{index}"


# === 通用 Markdown 系渲染骨架（企业微信 / 飞书 / ntfy / Slack 共用） ===

def _render_topics_markdown_like(result: AIAnalysisResult) -> str:
    """Markdown 系渠道的通用渲染骨架"""
    if not result.success:
        if result.skipped:
            return f"ℹ️ {result.error}"
        return f"⚠️ AI 分析失败: {result.error}"

    lines = ["**✨ AI 热点内容总结**", ""]

    if result.overview:
        lines.extend(["**本期概述**", _format_list_content(result.overview), ""])

    if result.topics:
        lines.append("**热点事件**")
        for i, topic in enumerate(result.topics, 1):
            title = _render_topic_title(topic, i)
            summary = topic.get("summary", "")
            platforms = topic.get("platforms", [])
            key_points = topic.get("key_points", [])

            lines.append(f"**{i}. {title}**")
            if platforms:
                lines.append(f"来源：{_format_platforms(platforms)}")
            if summary:
                lines.append(_format_list_content(summary))
            if key_points:
                lines.append("关键信息：")
                lines.append(_format_key_points(key_points))
            lines.append("")

    return "\n".join(lines).rstrip()


def render_ai_analysis_markdown(result: AIAnalysisResult) -> str:
    """渲染为通用 Markdown 格式（企业微信、ntfy、Slack）"""
    return _render_topics_markdown_like(result)


def render_ai_analysis_feishu(result: AIAnalysisResult) -> str:
    """渲染为飞书卡片 2.0 markdown 格式"""
    return _render_topics_markdown_like(result)


def render_ai_analysis_dingtalk(result: AIAnalysisResult) -> str:
    """渲染为钉钉 Markdown 格式"""
    if not result.success:
        if result.skipped:
            return f"ℹ️ {result.error}"
        return f"⚠️ AI 分析失败: {result.error}"

    lines = ["### ✨ AI 热点内容总结", ""]

    if result.overview:
        lines.extend(["#### 本期概述", _format_list_content(result.overview), ""])

    if result.topics:
        lines.append("#### 热点事件")
        for i, topic in enumerate(result.topics, 1):
            title = _render_topic_title(topic, i)
            summary = topic.get("summary", "")
            platforms = topic.get("platforms", [])
            key_points = topic.get("key_points", [])

            lines.append(f"**{i}. {title}**")
            if platforms:
                lines.append(f"来源：{_format_platforms(platforms)}")
            if summary:
                lines.append(_format_list_content(summary))
            if key_points:
                lines.append("关键信息：")
                lines.append(_format_key_points(key_points))
            lines.append("")

    return "\n".join(lines).rstrip()


def render_ai_analysis_plain(result: AIAnalysisResult) -> str:
    """渲染为纯文本格式（Bark）"""
    if not result.success:
        if result.skipped:
            return result.error
        return f"AI 分析失败: {result.error}"

    lines = ["【✨ AI 热点内容总结】", ""]

    if result.overview:
        lines.extend(["[本期概述]", _format_list_content(result.overview), ""])

    if result.topics:
        lines.append("[热点事件]")
        for i, topic in enumerate(result.topics, 1):
            title = _render_topic_title(topic, i)
            summary = topic.get("summary", "")
            platforms = topic.get("platforms", [])
            key_points = topic.get("key_points", [])

            lines.append(f"{i}. {title}")
            if platforms:
                lines.append(f"来源：{_format_platforms(platforms)}")
            if summary:
                lines.append(_format_list_content(summary))
            if key_points:
                lines.append("关键信息：")
                lines.append(_format_key_points(key_points))
            lines.append("")

    return "\n".join(lines).rstrip()


def render_ai_analysis_telegram(result: AIAnalysisResult) -> str:
    """渲染为 Telegram HTML 格式（配合 parse_mode: HTML）

    Telegram Bot API 的 HTML 模式仅支持有限标签：
    <b>, <i>, <u>, <s>, <code>, <pre>, <a href="">, <blockquote>
    换行直接使用 \\n，不支持 <br>, <div>, <h1>-<h6> 等标签。
    """
    if not result.success:
        if result.skipped:
            return f"ℹ️ {_escape_html(result.error)}"
        return f"⚠️ AI 分析失败: {_escape_html(result.error)}"

    lines = ["<b>✨ AI 热点内容总结</b>", ""]

    if result.overview:
        lines.extend(["<b>本期概述</b>", _escape_html(_format_list_content(result.overview)), ""])

    if result.topics:
        lines.append("<b>热点事件</b>")
        for i, topic in enumerate(result.topics, 1):
            title = _render_topic_title(topic, i)
            summary = topic.get("summary", "")
            platforms = topic.get("platforms", [])
            key_points = topic.get("key_points", [])

            lines.append(f"<b>{i}. {_escape_html(title)}</b>")
            if platforms:
                lines.append(f"来源：{_escape_html(_format_platforms(platforms))}")
            if summary:
                lines.append(_escape_html(_format_list_content(summary)))
            if key_points:
                lines.append("关键信息：")
                lines.append(_escape_html(_format_key_points(key_points)))
            lines.append("")

    return "\n".join(lines).rstrip()


def get_ai_analysis_renderer(channel: str):
    """根据渠道获取对应的渲染函数"""
    renderers = {
        "feishu": render_ai_analysis_feishu,
        "dingtalk": render_ai_analysis_dingtalk,
        "wework": render_ai_analysis_markdown,
        "telegram": render_ai_analysis_telegram,
        "email": render_ai_analysis_html_rich,  # 邮件使用丰富样式，配合 HTML 报告的 CSS
        "ntfy": render_ai_analysis_markdown,
        "bark": render_ai_analysis_plain,
        "slack": render_ai_analysis_markdown,
    }
    return renderers.get(channel, render_ai_analysis_markdown)


def render_ai_analysis_html_rich(result: AIAnalysisResult) -> str:
    """渲染为丰富样式的 HTML 格式（HTML 报告用）"""
    if not result:
        return ""

    # 检查是否成功
    if not result.success:
        if result.skipped:
            return f"""
                <div class="ai-section">
                    <div class="ai-info">ℹ️ {_escape_html(str(result.error))}</div>
                </div>"""
        error_msg = result.error or "未知错误"
        return f"""
                <div class="ai-section">
                    <div class="ai-warning">AI 分析失败: {_escape_html(str(error_msg))}</div>
                </div>"""

    ai_html = """
                <div class="ai-section">
                    <div class="ai-section-header">
                        <div class="ai-section-title">✨ AI 热点内容总结</div>
                        <span class="ai-section-badge">AI</span>
                    </div>
                    <div class="ai-blocks-grid">"""

    if result.overview:
        content = _format_list_content(result.overview)
        content_html = _escape_html(content).replace("\n", "<br>")
        ai_html += f"""
                    <div class="ai-block ai-block-full">
                        <div class="ai-block-title">本期概述</div>
                        <div class="ai-block-content">{content_html}</div>
                    </div>"""

    if result.topics:
        for i, topic in enumerate(result.topics, 1):
            title = _escape_html(_render_topic_title(topic, i))
            summary = topic.get("summary", "")
            platforms = topic.get("platforms", [])
            key_points = topic.get("key_points", [])

            parts = []
            if summary:
                parts.append(_escape_html(_format_list_content(summary)).replace("\n", "<br>"))
            if platforms:
                parts.append(f"来源：{_escape_html(_format_platforms(platforms))}")
            if key_points:
                points = "<br>".join(
                    f"- {_escape_html(p)}" for p in key_points
                )
                parts.append(f"关键信息：<br>{points}")
            content_html = "<br>".join(parts)

            ai_html += f"""
                    <div class="ai-block">
                        <div class="ai-block-title">{i}. {title}</div>
                        <div class="ai-block-content">{content_html}</div>
                    </div>"""

    ai_html += """
                    </div>
                </div>"""
    return ai_html
