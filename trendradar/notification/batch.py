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

    # 截断到指定字节数
    truncated = text_bytes[:max_bytes]

    # 处理可能的不完整 UTF-8 字符
    for i in range(min(4, len(truncated))):
        try:
            return truncated[: len(truncated) - i].decode("utf-8")
        except UnicodeDecodeError:
            continue

    # 极端情况：返回空字符串
    return ""


def split_content_by_bytes(text: str, max_bytes: int) -> List[str]:
    """
    Split text into batches by byte size, respecting paragraph boundaries.

    Splits content at paragraph boundaries (\n\n) when possible, falling back
    to line boundaries (\n) if paragraphs are too large.

    Args:
        text: The text to split
        max_bytes: Maximum bytes per batch

    Returns:
        List of text batches, each within max_bytes limit
    """
    if len(text.encode("utf-8")) <= max_bytes:
        return [text]

    batches = []
    current_batch = ""

    # Split by paragraphs first
    paragraphs = text.split("\n\n")

    for para in paragraphs:
        para_with_sep = para + "\n\n" if para != paragraphs[-1] else para
        para_bytes = len(para_with_sep.encode("utf-8"))

        # Check if adding this paragraph would exceed limit
        current_bytes = len(current_batch.encode("utf-8"))

        if current_bytes + para_bytes <= max_bytes:
            current_batch += para_with_sep
        else:
            # Save current batch if not empty
            if current_batch.strip():
                batches.append(current_batch.rstrip())
                current_batch = ""

            # If single paragraph is too large, split by lines
            if para_bytes > max_bytes:
                lines = para.split("\n")
                for line in lines:
                    line_with_sep = line + "\n"
                    line_bytes = len(line_with_sep.encode("utf-8"))
                    current_line_bytes = len(current_batch.encode("utf-8"))

                    if current_line_bytes + line_bytes <= max_bytes:
                        current_batch += line_with_sep
                    else:
                        if current_batch.strip():
                            batches.append(current_batch.rstrip())
                        # If single line is still too large, truncate it
                        if line_bytes > max_bytes:
                            current_batch = truncate_to_bytes(line, max_bytes - 10) + "...\n"
                        else:
                            current_batch = line_with_sep

                # Add paragraph separator if there are more paragraphs
                if para != paragraphs[-1]:
                    current_batch += "\n"
            else:
                current_batch = para_with_sep

    # Don't forget the last batch
    if current_batch.strip():
        batches.append(current_batch.rstrip())

    return batches if batches else [text[:max_bytes]]


def add_batch_headers(
    batches: List[str], format_type: str, max_bytes: int
) -> List[str]:
    """为批次添加头部，动态计算确保总大小不超过限制

    Args:
        batches: 原始批次列表
        format_type: 推送类型（bark, telegram, feishu 等）
        max_bytes: 该推送类型的最大字节限制

    Returns:
        添加头部后的批次列表
    """
    if len(batches) <= 1:
        return batches

    total = len(batches)
    result = []

    for i, content in enumerate(batches, 1):
        # 生成批次头部
        header = get_batch_header(format_type, i, total)
        header_size = len(header.encode("utf-8"))

        # 动态计算允许的最大内容大小
        max_content_size = max_bytes - header_size
        content_size = len(content.encode("utf-8"))

        # 如果超出，截断到安全大小
        if content_size > max_content_size:
            print(
                f"警告：{format_type} 第 {i}/{total} 批次内容({content_size}字节) + 头部({header_size}字节) 超出限制({max_bytes}字节)，截断到 {max_content_size} 字节"
            )
            content = truncate_to_bytes(content, max_content_size)

        result.append(header + content)

    return result
