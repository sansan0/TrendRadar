# coding=utf-8
"""
批次处理模块

提供消息分批发送的辅助函数
"""

from typing import List


def get_batch_header(format_type: str, batch_num: int, total_batches: int) -> str:
    """根据 format_type 生成对应格式的批次头部

    Args:
        format_type: 推送类型（telegram, slack, wework_text, bark, feishu, dingtalk, ntfy, wework）
        batch_num: 当前批次编号
        total_batches: 总批次数

    Returns:
        格式化的批次头部字符串
    """
    if format_type == "telegram":
        return f"<b>[第 {batch_num}/{total_batches} 批次]</b>\n\n"
    elif format_type == "slack":
        return f"*[第 {batch_num}/{total_batches} 批次]*\n\n"
    elif format_type in ("wework_text", "bark"):
        # 企业微信文本模式和 Bark 使用纯文本格式
        return f"[第 {batch_num}/{total_batches} 批次]\n\n"
    else:
        # 飞书、钉钉、ntfy、企业微信 markdown 模式
        return f"**[第 {batch_num}/{total_batches} 批次]**\n\n"


def get_max_batch_header_size(format_type: str) -> int:
    """估算批次头部的最大字节数（假设最多 99 批次）

    用于在分批时预留空间，避免事后截断破坏内容完整性。

    Args:
        format_type: 推送类型

    Returns:
        最大头部字节数
    """
    # 生成最坏情况的头部（99/99 批次）
    max_header = get_batch_header(format_type, 99, 99)
    return len(max_header.encode("utf-8"))


def truncate_to_bytes(text: str, max_bytes: int) -> str:
    """安全截断字符串到指定字节数，避免截断多字节字符

    Args:
        text: 要截断的文本
        max_bytes: 最大字节数

    Returns:
        截断后的文本
    """
    text_bytes = text.encode("utf-8")
    if len(text_bytes) <= max_bytes:
        return text

    truncated = text_bytes[:max_bytes]
    for i in range(min(4, len(truncated))):
        try:
            return truncated[: len(truncated) - i].decode("utf-8")
        except UnicodeDecodeError:
            continue
    return ""


def truncate_at_line_boundary(text: str, max_bytes: int) -> str:
    """在行边界处截断，确保不在标题或内容中间断开

    先按字节截断，再回退到最近的换行符位置，保证每一行都完整。

    Args:
        text: 要截断的文本
        max_bytes: 最大字节数

    Returns:
        在最后一个完整行处结束的截断文本
    """
    if len(text.encode("utf-8")) <= max_bytes:
        return text

    rough_cut = truncate_to_bytes(text, max_bytes)
    last_newline = rough_cut.rfind("\n")
    if last_newline > 0:
        return rough_cut[:last_newline]
    return rough_cut


def truncate_preserving_footer(content: str, max_bytes: int) -> str:
    """截断内容，优先保留尾部 footer（更新时间等），正文在行边界处截断

    识别内容末尾的 footer 区域（更新时间、版本提示等），
    对 footer 之前的正文部分在行边界处截断，再拼接完整 footer。

    Args:
        content: 完整内容（正文 + footer）
        max_bytes: 最大字节数

    Returns:
        截断后的内容，footer 完整保留，正文在行边界处截断
    """
    if len(content.encode("utf-8")) <= max_bytes:
        return content

    # 各平台 footer 的常见开头模式
    footer_markers = ["\n\n\n> ", "\n\n> ", "\n\n<font", "\n\n_", "\n\n更新时间"]
    footer_start = -1
    for marker in footer_markers:
        pos = content.rfind(marker)
        if pos > 0:
            footer_start = pos
            break

    if footer_start <= 0:
        return truncate_at_line_boundary(content, max_bytes)

    footer = content[footer_start:]
    body = content[:footer_start]
    footer_size = len(footer.encode("utf-8"))

    if footer_size >= max_bytes:
        return truncate_at_line_boundary(content, max_bytes)

    truncated_body = truncate_at_line_boundary(body, max_bytes - footer_size)
    return truncated_body + footer


def _split_oversized_batch(content: str, max_content_bytes: int) -> List[str]:
    """将超限批次按行边界拆分成多个子批次（保留 footer）

    Args:
        content: 超限的批次内容（含 footer）
        max_content_bytes: 每个子批次的最大字节数

    Returns:
        拆分后的子批次列表
    """
    # 识别 footer
    footer_markers = ["\n\n\n> ", "\n\n> ", "\n\n<font", "\n\n_", "\n\n更新时间"]
    footer = ""
    body = content
    for marker in footer_markers:
        pos = content.rfind(marker)
        if pos > 0:
            footer = content[pos:]
            body = content[:pos]
            break

    footer_size = len(footer.encode("utf-8"))
    available = max_content_bytes - footer_size
    if available <= 0:
        return [truncate_at_line_boundary(content, max_content_bytes)]

    # 按行拆分 body
    lines = body.split("\n")
    sub_batches = []
    current = ""

    for line in lines:
        candidate = current + line + "\n"
        if len(candidate.encode("utf-8")) > available and current.strip():
            sub_batches.append(current + footer)
            current = line + "\n"
        else:
            current = candidate

    if current.strip():
        sub_batches.append(current + footer)

    return sub_batches if sub_batches else [content]


def add_batch_headers(
    batches: List[str], format_type: str, max_bytes: int
) -> List[str]:
    """为批次添加头部，超限时拆分成多个子批次（不丢弃内容）

    Args:
        batches: 原始批次列表
        format_type: 推送类型（bark, telegram, feishu 等）
        max_bytes: 该推送类型的最大字节限制

    Returns:
        添加头部后的批次列表
    """
    if len(batches) <= 1:
        return batches

    # 第一遍：拆分超限批次
    expanded = []
    max_header_size = get_max_batch_header_size(format_type)
    for content in batches:
        if len(content.encode("utf-8")) + max_header_size > max_bytes:
            expanded.extend(_split_oversized_batch(content, max_bytes - max_header_size))
        else:
            expanded.append(content)

    # 第二遍：添加头部
    if len(expanded) <= 1:
        return expanded

    total = len(expanded)
    result = []
    for i, content in enumerate(expanded, 1):
        header = get_batch_header(format_type, i, total)
        header_size = len(header.encode("utf-8"))
        max_content_size = max_bytes - header_size

        if len(content.encode("utf-8")) > max_content_size:
            # 仍超限（极端情况：单行过长），行边界截断
            content = truncate_preserving_footer(content, max_content_size)

        result.append(header + content)

    return result


def split_ai_content_into_batches(ai_content: str, max_bytes: int) -> List[str]:
    """将 AI 分析内容按行边界拆分为独立批次

    AI 分析作为独立消息发送，不参与热点批次头部的编号。
    按行边界拆分，避免在内容中间截断，确保每条消息不超过 max_bytes。

    Args:
        ai_content: 已渲染的 AI 分析内容（markdown/HTML/纯文本）
        max_bytes: 单条消息的最大字节数

    Returns:
        拆分后的批次列表（可能为空列表）
    """
    if not ai_content:
        return []

    lines = ai_content.split("\n")
    batches = []
    current = ""

    for line in lines:
        candidate = current + line + "\n"
        if len(candidate.encode("utf-8")) > max_bytes and current.strip():
            batches.append(current)
            current = line + "\n"
        else:
            current = candidate

    if current.strip():
        batches.append(current)

    return batches
