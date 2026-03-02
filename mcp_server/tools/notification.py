# coding=utf-8
"""
通知推送工具

支持向已配置的通知渠道发送消息，自动检测 config.yaml 和 .env 中的渠道配置。
接受 markdown 格式内容，内部按各渠道要求自动转换格式后发送。
"""

import json
import os
import re
import smtplib
import time
from datetime import datetime
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests
import yaml

from trendradar.core.loader import _load_webhook_config, _load_notification_config
from trendradar.notification.batch import (
    truncate_to_bytes,
    get_batch_header,
    get_max_batch_header_size,
    add_batch_headers,
)
from trendradar.notification.formatters import strip_markdown
from trendradar.notification.senders import SMTP_CONFIGS

from ..utils.errors import MCPError, InvalidParameterError


# ==================== 渠道启用判断规则 ====================

# 每个渠道需要哪些配置项都非空才算"已配置"
# 注意：NTFY_SERVER_URL 在 loader 中有默认值 "https://ntfy.sh"，不作为判断依据
_CHANNEL_REQUIREMENTS = {
    "feishu": ["FEISHU_WEBHOOK_URL"],
    "dingtalk": ["DINGTALK_WEBHOOK_URL"],
    "wework": ["WEWORK_WEBHOOK_URL"],
    "telegram": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    "email": ["EMAIL_FROM", "EMAIL_PASSWORD", "EMAIL_TO"],
    "ntfy": ["NTFY_TOPIC"],
    "bark": ["BARK_URL"],
    "slack": ["SLACK_WEBHOOK_URL"],
    "generic_webhook": ["GENERIC_WEBHOOK_URL"],
}

# 渠道显示名称
_CHANNEL_NAMES = {
    "feishu": "飞书",
    "dingtalk": "钉钉",
    "wework": "企业微信",
    "telegram": "Telegram",
    "email": "邮件",
    "ntfy": "ntfy",
    "bark": "Bark",
    "slack": "Slack",
    "generic_webhook": "通用 Webhook",
}


# ==================== 批次处理配置 ====================

# 各渠道最大批次字节数的默认值
# 运行时从 config.yaml → advanced.batch_size 读取覆盖
_CHANNEL_BATCH_SIZES_DEFAULT = {
    "feishu": 30000,    # config.yaml: advanced.batch_size.feishu
    "dingtalk": 20000,  # config.yaml: advanced.batch_size.dingtalk
    "wework": 4000,     # config.yaml: advanced.batch_size.default
    "telegram": 4000,   # config.yaml: advanced.batch_size.default
    "email": 0,         # 邮件无字节限制，不分批
    "ntfy": 3800,       # 严格 4KB 限制（ntfy 代码默认值）
    "bark": 4000,       # config.yaml: advanced.batch_size.bark
    "slack": 4000,      # config.yaml: advanced.batch_size.slack
    "generic_webhook": 4000,
}

# 显示最新消息在前的渠道，批次需反序发送
_REVERSE_BATCH_CHANNELS = {"ntfy", "bark"}

# 批次发送间隔默认值（秒），运行时从 config.yaml → advanced.batch_send_interval 读取
_BATCH_INTERVAL_DEFAULT = 3.0


# ==================== 批次处理 ====================
# truncate_to_bytes, get_batch_header, get_max_batch_header_size,
# add_batch_headers 复用自 trendradar.notification.batch


def _split_text_into_batches(text: str, max_bytes: int) -> List[str]:
    """将文本按字节限制分批，优先在段落边界（双换行）切割

    分割策略（参考 trendradar splitter.py 的原子性保证）：
    1. 优先按段落（双换行 \\n\\n）拆分
    2. 段落仍超限时，按单行（\\n）拆分
    3. 单行仍超限时，用 _truncate_to_bytes 安全截断

    Args:
        text: 已转换为目标渠道格式的文本
        max_bytes: 单批最大字节数（已扣除批次头部预留）

    Returns:
        分批后的文本列表
    """
    if max_bytes <= 0 or len(text.encode("utf-8")) <= max_bytes:
        return [text]

    # 按段落分割
    paragraphs = text.split("\n\n")
    batches = []
    current = ""

    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate.encode("utf-8")) <= max_bytes:
            current = candidate
        else:
            # 当前段落放不下，先保存已有内容
            if current:
                batches.append(current)
                current = ""

            # 检查单个段落是否超限
            if len(para.encode("utf-8")) <= max_bytes:
                current = para
            else:
                # 段落本身超限，按行拆分
                lines = para.split("\n")
                for line in lines:
                    candidate = f"{current}\n{line}" if current else line
                    if len(candidate.encode("utf-8")) <= max_bytes:
                        current = candidate
                    else:
                        if current:
                            batches.append(current)
                            current = ""
                        # 单行超限，循环截断直到处理完
                        if len(line.encode("utf-8")) > max_bytes:
                            remaining = line
                            while remaining:
                                chunk = truncate_to_bytes(remaining, max_bytes)
                                if not chunk:
                                    break
                                batches.append(chunk)
                                # 移除已截断的部分
                                remaining = remaining[len(chunk):]
                        else:
                            current = line

    if current:
        batches.append(current)

    return batches if batches else [text]


def _format_for_channel(message: str, channel_id: str) -> str:
    """将通用 Markdown 适配并转换为目标渠道格式

    统一入口：先适配（剥离不支持的语法），再转换（Markdown→HTML/mrkdwn 等）。
    返回的文本可以直接用于字节分割和发送。

    Args:
        message: 原始 Markdown 格式文本
        channel_id: 目标渠道 ID

    Returns:
        目标渠道格式的文本
    """
    if channel_id == "feishu":
        return _adapt_markdown_for_feishu(message)
    elif channel_id == "dingtalk":
        return _adapt_markdown_for_dingtalk(message)
    elif channel_id == "wework":
        return _adapt_markdown_for_wework(message)
    elif channel_id == "telegram":
        return _markdown_to_telegram_html(message)
    elif channel_id == "ntfy":
        return _adapt_markdown_for_ntfy(message)
    elif channel_id == "bark":
        return _adapt_markdown_for_bark(message)
    elif channel_id == "slack":
        return _convert_markdown_to_slack(message)
    else:
        # email, generic_webhook: 保持原始 Markdown
        return message


def _prepare_batches(message: str, channel_id: str, batch_sizes: Dict = None) -> List[str]:
    """完整的分批管线：格式适配 → 字节分割 → 添加批次头部

    Args:
        message: 原始 Markdown 格式文本
        channel_id: 目标渠道 ID
        batch_sizes: 各渠道批次大小字典（来自 config.yaml），None 使用默认值

    Returns:
        准备好的批次列表（已添加头部，已处理反序）
    """
    sizes = batch_sizes or _CHANNEL_BATCH_SIZES_DEFAULT
    max_bytes = sizes.get(channel_id, sizes.get("default", 4000))
    if max_bytes <= 0:
        # 无字节限制（如 email），返回原始文本
        return [message]

    formatted = _format_for_channel(message, channel_id)

    # 预留批次头部空间后分割
    header_reserve = get_max_batch_header_size(channel_id)
    batches = _split_text_into_batches(formatted, max_bytes - header_reserve)

    # 添加批次头部（单批时不添加）
    batches = add_batch_headers(batches, channel_id, max_bytes)

    # ntfy/Bark 反序发送（客户端显示最新在前）
    if channel_id in _REVERSE_BATCH_CHANNELS and len(batches) > 1:
        batches = list(reversed(batches))

    return batches

CHANNEL_FORMAT_GUIDES = {
    "feishu": {
        "name": "飞书",
        "format": "Markdown（卡片消息）",
        "max_length": "约 29000 字节",
        "supported": [
            "**粗体**",
            "[链接文本](URL)",
            "<font color='red/green/grey/orange/blue'>彩色文本</font>",
            "---（分割线）",
            "换行分隔段落",
        ],
        "unsupported": [
            "# 标题语法（不渲染为标题样式）",
            "> 引用块",
            "表格 / 图片嵌入",
        ],
        "prompt": (
            "飞书卡片 Markdown 格式化策略：\n"
            "1. 用 **粗体** 作小标题和重点词\n"
            "2. 用 <font color='red'>红色</font> 标记紧急/重要内容\n"
            "3. 用 <font color='grey'>灰色</font> 标记辅助信息（时间、来源）\n"
            "4. 用 <font color='orange'>橙色</font> 标记警告\n"
            "5. 用 <font color='green'>绿色</font> 标记正面/成功信息\n"
            "6. 用 [文本](URL) 添加可点击链接\n"
            "7. 用 --- 分割不同主题区域\n"
            "8. 不要用 # 标题语法（卡片内不渲染）\n"
            "9. 不要用 > 引用语法\n"
            "10. 用换行 + 粗体模拟层级结构"
        ),
    },
    "dingtalk": {
        "name": "钉钉",
        "format": "Markdown",
        "max_length": "约 20000 字节",
        "supported": [
            "### 三级标题 / #### 四级标题",
            "**粗体**",
            "[链接文本](URL)",
            "> 引用块",
            "---（分割线）",
            "- 无序列表 / 1. 有序列表",
        ],
        "unsupported": [
            "# 一级标题 / ## 二级标题（可能不渲染）",
            "<font> 彩色文本",
            "~~删除线~~",
            "表格 / 图片嵌入",
        ],
        "prompt": (
            "钉钉 Markdown 格式化策略：\n"
            "1. 用 ### 或 #### 作章节标题（不用 # 和 ##）\n"
            "2. 用 **粗体** 突出关键词和数据\n"
            "3. 用 > 引用块展示备注或补充说明\n"
            "4. 用 --- 分割不同主题区域\n"
            "5. 用 [文本](URL) 添加可点击链接\n"
            "6. 用有序列表（1. 2. 3.）组织要点\n"
            "7. 不要用 <font> 颜色标签（钉钉不支持）\n"
            "8. 不要用删除线语法\n"
            "9. 标题和正文之间加空行提升可读性"
        ),
    },
    "wework": {
        "name": "企业微信",
        "format": "Markdown（群机器人）/ 纯文本（个人微信）",
        "max_length": "约 4000 字节",
        "supported": [
            "**粗体**",
            "[链接文本](URL)",
            "> 引用块（仅首行生效）",
        ],
        "unsupported": [
            "# 标题语法",
            "---（水平分割线）",
            "<font> 彩色文本",
            "~~删除线~~",
            "表格 / 图片嵌入 / 有序列表",
        ],
        "prompt": (
            "企业微信 Markdown 格式化策略：\n"
            "1. 用 **粗体** 作小标题和重点词\n"
            "2. 用 [文本](URL) 添加可点击链接\n"
            "3. 用 > 引用块展示备注（仅首行生效）\n"
            "4. 内容要简洁，受 4KB 限制\n"
            "5. 不要用 # 标题语法（不渲染）\n"
            "6. 不要用 ---（不渲染），用多个换行分隔区域\n"
            "7. 不要用 <font> 颜色标签\n"
            "8. 不要用删除线和有序列表\n"
            "9. 用换行 + 粗体模拟层级结构\n"
            "10. 个人微信模式下所有格式被剥离为纯文本"
        ),
    },
    "telegram": {
        "name": "Telegram",
        "format": "HTML（自动从 Markdown 转换）",
        "max_length": "约 4096 字符",
        "supported": [
            "<b>粗体</b>（从 **粗体** 转换）",
            "<i>斜体</i>（从 *斜体* 转换）",
            "<s>删除线</s>（从 ~~删除线~~ 转换）",
            "<code>行内代码</code>（从 `代码` 转换）",
            "<a href='URL'>链接</a>（从 [文本](URL) 转换）",
            "<blockquote>引用块</blockquote>（从 > 引用 转换）",
        ],
        "unsupported": [
            "# 标题语法（自动剥离 # 前缀）",
            "---（分割线，自动剥离）",
            "<font> 彩色文本（自动剥离）",
            "表格 / 图片嵌入",
        ],
        "prompt": (
            "Telegram HTML 格式化策略（输入仍为 Markdown，自动转换为 HTML）：\n"
            "1. 用 **粗体** 突出关键词（转为 <b>）\n"
            "2. 用 *斜体* 标记辅助信息（转为 <i>）\n"
            "3. 用 `代码` 标记数据值/时间（转为 <code>）\n"
            "4. 用 [文本](URL) 添加链接（转为 <a>）\n"
            "5. 用 > 开头的行作引用块（转为 <blockquote>）\n"
            "6. 不要用 # 标题（Telegram 无标题样式，仅剥离 #）\n"
            "7. 不要用 --- 分割线（被剥离），用空行分隔\n"
            "8. 不要用 <font> 颜色标签（被剥离）\n"
            "9. 内容受 4096 字符限制，保持简洁\n"
            "10. 链接默认禁用预览，适合信息密集型消息"
        ),
    },
    "email": {
        "name": "邮件",
        "format": "HTML（完整网页，从 Markdown 转换）",
        "max_length": "无硬限制",
        "supported": [
            "# / ## / ### 标题（转为 <h1>/<h2>/<h3>）",
            "**粗体** / *斜体* / ~~删除线~~",
            "[链接文本](URL)",
            "`行内代码`",
            "---（水平分割线）",
        ],
        "unsupported": [
            "<font> 彩色文本（转义显示）",
            "复杂表格",
        ],
        "prompt": (
            "邮件 HTML 格式化策略（输入为 Markdown，自动转换为带样式 HTML）：\n"
            "1. 用 # / ## / ### 创建清晰的标题层级\n"
            "2. 用 **粗体** 和 *斜体* 增强可读性\n"
            "3. 用 [文本](URL) 添加链接（蓝色可点击）\n"
            "4. 用 --- 分割不同章节\n"
            "5. 用 `代码` 标记技术术语或数据\n"
            "6. 可以写较长内容，邮件无严格长度限制\n"
            "7. 邮件主题自动追加日期时间\n"
            "8. 自动附带纯文本备用版本"
        ),
    },
    "ntfy": {
        "name": "ntfy",
        "format": "Markdown（原生支持）",
        "max_length": "约 3800 字节（单条 4KB 限制）",
        "supported": [
            "**粗体** / *斜体*",
            "[链接文本](URL)",
            "> 引用块",
            "`行内代码`",
            "- 列表",
        ],
        "unsupported": [
            "# 标题语法（渲染取决于客户端）",
            "<font> 彩色文本",
            "---（渲染取决于客户端）",
            "表格",
        ],
        "prompt": (
            "ntfy Markdown 格式化策略：\n"
            "1. 用 **粗体** 突出关键词\n"
            "2. 用 [文本](URL) 添加可点击链接\n"
            "3. 用 > 引用块展示备注\n"
            "4. 用 `代码` 标记数据值\n"
            "5. 内容要精炼，受 4KB 限制\n"
            "6. 不要用 <font> 颜色标签（无效）\n"
            "7. 不要依赖 # 标题和 --- 分割线\n"
            "8. 用空行和粗体组织信息层级"
        ),
    },
    "bark": {
        "name": "Bark",
        "format": "Markdown（iOS 推送）",
        "max_length": "约 3600 字节（APNs 4KB 限制）",
        "supported": [
            "**粗体**",
            "[链接文本](URL)",
            "基础文本格式",
        ],
        "unsupported": [
            "# 标题语法",
            "<font> 彩色文本",
            "---（分割线）",
            "> 引用块",
            "复杂嵌套格式",
        ],
        "prompt": (
            "Bark 格式化策略（iOS 推送通知）：\n"
            "1. 内容要极度精简，移动端阅读场景\n"
            "2. 用 **粗体** 标记核心信息\n"
            "3. 用 [文本](URL) 添加链接\n"
            "4. 不要用标题/颜色/引用等复杂格式\n"
            "5. 受 APNs 4KB 限制，控制内容长度\n"
            "6. 层级结构靠缩进和换行实现\n"
            "7. 适合简短通知和摘要，不适合长文"
        ),
    },
    "slack": {
        "name": "Slack",
        "format": "mrkdwn（Slack 专有格式，自动从 Markdown 转换）",
        "max_length": "约 4000 字节",
        "supported": [
            "*粗体*（从 **粗体** 转换）",
            "_斜体_",
            "~删除线~（从 ~~删除线~~ 转换）",
            "<URL|链接文本>（从 [文本](URL) 转换）",
            "`行内代码`",
            "```代码块```",
            "> 引用块",
        ],
        "unsupported": [
            "# 标题语法（剥离为粗体）",
            "<font> 彩色文本",
            "--- 分割线（渲染不稳定）",
            "表格",
        ],
        "prompt": (
            "Slack mrkdwn 格式化策略（输入为 Markdown，自动转换为 mrkdwn）：\n"
            "1. 用 **粗体** 突出关键词（转为 *粗体*）\n"
            "2. 用 ~~删除线~~ 标记过时信息（转为 ~删除线~）\n"
            "3. 用 [文本](URL) 添加链接（转为 <URL|文本>）\n"
            "4. 用 > 引用块展示备注\n"
            "5. 用 `代码` 标记数据值\n"
            "6. 不要用 # 标题（Slack 无标题样式）\n"
            "7. 不要用 <font> 颜色标签\n"
            "8. 用空行和粗体组织信息层级"
        ),
    },
    "generic_webhook": {
        "name": "通用 Webhook",
        "format": "Markdown（或自定义模板）",
        "max_length": "约 4000 字节",
        "supported": ["标准 Markdown 语法"],
        "unsupported": ["取决于接收端"],
        "prompt": (
            "通用 Webhook 格式化策略：\n"
            "1. 使用标准 Markdown 格式\n"
            "2. 避免使用特殊平台专有语法\n"
            "3. 如配置了自定义模板，内容会填充到 {content} 占位符"
        ),
    },
}


# ==================== 渠道 Markdown 适配 ====================

def _adapt_markdown_for_feishu(text: str) -> str:
    """将通用 Markdown 适配为飞书卡片 Markdown 格式

    飞书卡片支持：**粗体**, [链接](url), <font color='...'>, ---
    不支持：# 标题, > 引用块
    """
    # 将 # 标题转换为粗体（飞书卡片不渲染标题语法）
    text = re.sub(r'^#{1,6}\s+(.+)$', r'**\1**', text, flags=re.MULTILINE)
    # 去除引用语法前缀（飞书不支持）
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _adapt_markdown_for_dingtalk(text: str) -> str:
    """将通用 Markdown 适配为钉钉 Markdown 格式

    钉钉支持：### #### 标题, **粗体**, [链接](url), > 引用, ---
    不支持：# ## 标题, <font> 彩色文本, ~~删除线~~
    """
    # 去除 <font> 标签（钉钉不支持，保留内容）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)
    # 将 # 和 ## 标题降级为 ### （钉钉仅支持 ### 和 ####）
    text = re.sub(r'^##\s+(.+)$', r'### \1', text, flags=re.MULTILINE)
    text = re.sub(r'^#\s+(.+)$', r'### \1', text, flags=re.MULTILINE)
    # 去除删除线语法（钉钉不支持）
    text = re.sub(r'~~(.+?)~~', r'\1', text)
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _adapt_markdown_for_wework(text: str) -> str:
    """将通用 Markdown 适配为企业微信 Markdown 格式

    企业微信支持：**粗体**, [链接](url), > 引用（有限）
    不支持：# 标题, ---, <font>, ~~删除线~~, 有序列表
    """
    # 去除 <font> 标签（保留内容）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)
    # 将 # 标题转换为粗体（企业微信不渲染标题语法）
    text = re.sub(r'^#{1,6}\s+(.+)$', r'**\1**', text, flags=re.MULTILINE)
    # 将 --- 分割线替换为多个换行（企业微信不渲染水平线）
    text = re.sub(r'^[\-\*]{3,}\s*$', '\n\n', text, flags=re.MULTILINE)
    # 去除删除线语法（企业微信不支持）
    text = re.sub(r'~~(.+?)~~', r'\1', text)
    # 清理多余空行（保留最多两个）
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    return text.strip()


def _adapt_markdown_for_ntfy(text: str) -> str:
    """将通用 Markdown 适配为 ntfy 格式

    ntfy 支持：**粗体**, *斜体*, [链接](url), > 引用, `代码`
    不可靠：# 标题, ---, <font>
    """
    # 去除 <font> 标签（ntfy 不支持）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _adapt_markdown_for_bark(text: str) -> str:
    """将通用 Markdown 适配为 Bark 格式（iOS 推送）

    Bark 支持：**粗体**, [链接](url), 基础文本
    不支持：# 标题, <font>, ---, > 引用, 复杂嵌套
    """
    # 去除 <font> 标签（保留内容）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)
    # 将 # 标题转换为粗体
    text = re.sub(r'^#{1,6}\s+(.+)$', r'**\1**', text, flags=re.MULTILINE)
    # 将 --- 替换为换行
    text = re.sub(r'^[\-\*]{3,}\s*$', '\n', text, flags=re.MULTILINE)
    # 去除引用语法
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    # 去除删除线语法
    text = re.sub(r'~~(.+?)~~', r'\1', text)
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# ==================== 格式转换 ====================

def _markdown_to_telegram_html(text: str) -> str:
    """
    将 markdown 转换为 Telegram 支持的 HTML 格式

    Telegram 支持的标签：<b>, <i>, <s>, <code>, <a href="url">text</a>, <blockquote>
    """
    # 预处理：去除 <font> 标签（Telegram 不支持，保留内容）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)

    lines = text.split('\n')
    result_lines = []
    in_blockquote = False

    for line in lines:
        # 将标题符号 # ## ### 转换为粗体
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if header_match:
            line = f'**{header_match.group(2)}**'

        # 去除水平分割线
        if re.match(r'^[\-\*]{3,}\s*$', line):
            if in_blockquote:
                result_lines.append('</blockquote>')
                in_blockquote = False
            line = ''

        # 处理引用块 > text → <blockquote>text</blockquote>
        quote_match = re.match(r'^>\s*(.*)$', line)
        if quote_match:
            if not in_blockquote:
                result_lines.append('<blockquote>')
                in_blockquote = True
            result_lines.append(quote_match.group(1))
            continue
        elif in_blockquote:
            result_lines.append('</blockquote>')
            in_blockquote = False

        result_lines.append(line)

    if in_blockquote:
        result_lines.append('</blockquote>')

    text = '\n'.join(result_lines)

    # 转义 HTML 实体（在标记替换之前，但在 blockquote 标签之后）
    # 分段处理：保留已生成的 HTML 标签
    parts = re.split(r'(</?blockquote>)', text)
    escaped_parts = []
    for part in parts:
        if part in ('<blockquote>', '</blockquote>'):
            escaped_parts.append(part)
        else:
            part = part.replace('&', '&amp;')
            part = part.replace('<', '&lt;')
            part = part.replace('>', '&gt;')
            escaped_parts.append(part)
    text = ''.join(escaped_parts)

    # 转换链接 [text](url) → <a href="url">text</a>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)

    # 转换粗体 **text** → <b>text</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)

    # 转换斜体 *text* → <i>text</i>
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)

    # 转换删除线 ~~text~~ → <s>text</s>
    text = re.sub(r'~~(.+?)~~', r'<s>\1</s>', text)

    # 转换行内代码 `code` → <code>code</code>
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)

    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def _convert_markdown_to_slack(text: str) -> str:
    """将 Markdown 转换为 Slack mrkdwn 格式（增强版）

    Slack mrkdwn 与标准 Markdown 差异：
    - 粗体: *text* (非 **text**)
    - 删除线: ~text~ (非 ~~text~~)
    - 链接: <url|text> (非 [text](url))
    - 不支持标题语法
    """
    # 去除 <font> 标签（保留内容）
    text = re.sub(r'<font[^>]*>(.+?)</font>', r'\1', text)
    # 将 # 标题转换为粗体（Slack 无标题样式）
    text = re.sub(r'^#{1,6}\s+(.+)$', r'**\1**', text, flags=re.MULTILINE)
    # 去除 --- 分割线（Slack 渲染不稳定）
    text = re.sub(r'^[\-\*]{3,}\s*$', '', text, flags=re.MULTILINE)
    # 转换链接格式: [文本](url) → <url|文本>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<\2|\1>', text)
    # 转换删除线: ~~文本~~ → ~文本~
    text = re.sub(r'~~(.+?)~~', r'~\1~', text)
    # 转换粗体: **文本** → *文本*（必须在删除线之后）
    text = re.sub(r'\*\*([^*]+)\*\*', r'*\1*', text)
    # 清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _markdown_to_simple_html(text: str) -> str:
    """
    将 markdown 转换为简单 HTML（用于 Email）
    """
    html = text

    # 转义
    html = html.replace('&', '&amp;')
    html = html.replace('<', '&lt;')
    html = html.replace('>', '&gt;')

    # 链接
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)

    # 标题 ### → <h3>
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

    # 粗体
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

    # 斜体
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

    # 删除线
    html = re.sub(r'~~(.+?)~~', r'<del>\1</del>', html)

    # 行内代码
    html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)

    # 分割线
    html = re.sub(r'^[\-\*]{3,}\s*$', '<hr>', html, flags=re.MULTILINE)

    # 换行
    html = html.replace('\n', '<br>\n')

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>TrendRadar 通知</title>
<style>body{{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}}
a{{color:#1a73e8}}h1,h2,h3{{color:#333}}hr{{border:none;border-top:1px solid #ddd;margin:16px 0}}
code{{background:#f5f5f5;padding:2px 6px;border-radius:3px}}</style>
</head><body>{html}</body></html>"""


# ==================== 各渠道发送器 ====================

def _send_feishu(webhook_url: str, content: str, title: str) -> Dict:
    """飞书发送（纯文本消息，与 trendradar send_to_feishu 一致）

    飞书 webhook 使用 msg_type: "text"，所有信息整合到 content.text 中。
    """
    payload = {
        "msg_type": "text",
        "content": {
            "text": content,
        },
    }
    try:
        resp = requests.post(webhook_url, json=payload, timeout=30)
        data = resp.json()
        ok = resp.status_code == 200 and (data.get("code") == 0 or data.get("StatusCode") == 0)
        detail = ""
        if not ok:
            detail = data.get("msg") or data.get("StatusMessage", "")
        return {"success": ok, "detail": detail}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_dingtalk(webhook_url: str, content: str, title: str) -> Dict:
    """钉钉发送（接收已适配的 Markdown）"""
    payload = {
        "msgtype": "markdown",
        "markdown": {"title": title, "text": content}
    }
    try:
        resp = requests.post(webhook_url, json=payload, timeout=30)
        data = resp.json()
        ok = resp.status_code == 200 and data.get("errcode") == 0
        return {"success": ok, "detail": data.get("errmsg", "") if not ok else ""}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_wework(webhook_url: str, content: str, title: str, msg_type: str = "markdown") -> Dict:
    """企业微信发送（接收已适配的 Markdown，text 模式自动剥离格式）"""
    if msg_type == "text":
        payload = {"msgtype": "text", "text": {"content": strip_markdown(content)}}
    else:
        payload = {"msgtype": "markdown", "markdown": {"content": content}}

    try:
        resp = requests.post(webhook_url, json=payload, timeout=30)
        data = resp.json()
        ok = resp.status_code == 200 and data.get("errcode") == 0
        return {"success": ok, "detail": data.get("errmsg", "") if not ok else ""}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_telegram(bot_token: str, chat_id: str, content: str, title: str) -> Dict:
    """Telegram 发送（接收已转换的 HTML）"""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": content,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        data = resp.json()
        ok = resp.status_code == 200 and data.get("ok")
        return {"success": ok, "detail": data.get("description", "") if not ok else ""}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_email(
    from_email: str, password: str, to_email: str,
    message: str, title: str,
    smtp_server: str = "", smtp_port: str = ""
) -> Dict:
    """邮件发送（HTML 格式）"""
    try:
        domain = from_email.split("@")[-1].lower()
        html_content = _markdown_to_simple_html(message)

        # SMTP 配置
        if smtp_server and smtp_port:
            server_host = smtp_server
            port = int(smtp_port)
            use_tls = port != 465
        elif domain in SMTP_CONFIGS:
            cfg = SMTP_CONFIGS[domain]
            server_host = cfg["server"]
            port = cfg["port"]
            use_tls = cfg["encryption"] == "TLS"
        else:
            server_host = f"smtp.{domain}"
            port = 587
            use_tls = True

        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr(("TrendRadar", from_email))

        recipients = [addr.strip() for addr in to_email.split(",")]
        msg["To"] = ", ".join(recipients)

        now = datetime.now()
        msg["Subject"] = Header(f"{title} - {now.strftime('%m月%d日 %H:%M')}", "utf-8")
        msg["MIME-Version"] = "1.0"
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid()

        # 纯文本备选
        msg.attach(MIMEText(strip_markdown(message), "plain", "utf-8"))
        # HTML 主体
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        if use_tls:
            server = smtplib.SMTP(server_host, port, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP_SSL(server_host, port, timeout=30)
            server.ehlo()

        server.login(from_email, password)
        server.send_message(msg)
        server.quit()

        return {"success": True, "detail": ""}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_ntfy(server_url: str, topic: str, content: str, title: str, token: str = "") -> Dict:
    """ntfy 发送（接收已适配的 Markdown，与 trendradar send_to_ntfy 一致）

    注意：Title 使用 ASCII 字符避免 HTTP header 编码问题。
    支持 429 速率限制重试。
    """
    base_url = server_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    url = f"{base_url}/{topic}"

    headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "Markdown": "yes",
        "Title": "TrendRadar Notification",  # ASCII，避免 HTTP header 编码问题
        "Priority": "default",
        "Tags": "news",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.post(url, data=content.encode("utf-8"), headers=headers, timeout=30)
        if resp.status_code == 200:
            return {"success": True, "detail": ""}
        elif resp.status_code == 429:
            # 速率限制，等待后重试一次（与 trendradar 一致）
            time.sleep(10)
            retry_resp = requests.post(url, data=content.encode("utf-8"), headers=headers, timeout=30)
            ok = retry_resp.status_code == 200
            return {"success": ok, "detail": "" if ok else f"retry status={retry_resp.status_code}"}
        elif resp.status_code == 413:
            return {"success": False, "detail": f"消息过大被拒绝 ({len(content.encode('utf-8'))} bytes)"}
        else:
            return {"success": False, "detail": f"status={resp.status_code}"}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_bark(bark_url: str, content: str, title: str) -> Dict:
    """Bark 发送（接收已适配的 Markdown，iOS 推送）"""
    parsed = urlparse(bark_url)
    device_key = parsed.path.strip('/').split('/')[0] if parsed.path else None
    if not device_key:
        return {"success": False, "detail": f"无法从 URL 提取 device_key: {bark_url}"}

    api_endpoint = f"{parsed.scheme}://{parsed.netloc}/push"
    payload = {
        "title": title,
        "markdown": content,
        "device_key": device_key,
        "sound": "default",
        "group": "TrendRadar",
        "action": "none",
    }

    try:
        resp = requests.post(api_endpoint, json=payload, timeout=30)
        data = resp.json()
        ok = resp.status_code == 200 and data.get("code") == 200
        return {"success": ok, "detail": data.get("message", "") if not ok else ""}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_slack(webhook_url: str, content: str, title: str) -> Dict:
    """Slack 发送（接收已转换的 mrkdwn）"""
    payload = {"text": content}

    try:
        resp = requests.post(webhook_url, json=payload, timeout=30)
        ok = resp.status_code == 200 and resp.text == "ok"
        return {"success": ok, "detail": "" if ok else resp.text}
    except Exception as e:
        return {"success": False, "detail": str(e)}


def _send_generic_webhook(
    webhook_url: str, message: str, title: str, payload_template: str = ""
) -> Dict:
    """通用 Webhook 发送（Markdown 格式，支持自定义模板）"""
    try:
        if payload_template:
            json_content = json.dumps(message)[1:-1]
            json_title = json.dumps(title)[1:-1]
            payload_str = payload_template.replace("{content}", json_content).replace("{title}", json_title)
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                payload = {"title": title, "content": message}
        else:
            payload = {"title": title, "content": message}

        resp = requests.post(
            webhook_url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        ok = 200 <= resp.status_code < 300
        return {"success": ok, "detail": "" if ok else f"status={resp.status_code}"}
    except Exception as e:
        return {"success": False, "detail": str(e)}


# ==================== 工具类 ====================

class NotificationTools:
    """通知推送工具类"""

    def __init__(self, project_root: str = None):
        if project_root:
            self.project_root = Path(project_root)
        else:
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent

    def _load_merged_config(self) -> Dict[str, Any]:
        """
        加载合并后的通知配置（config.yaml + .env）

        Returns:
            包含 webhook 配置和通知参数的合并字典
        """
        config_path = self.project_root / "config" / "config.yaml"
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f)
        else:
            config_data = {}

        webhook_config = _load_webhook_config(config_data)
        notification_config = _load_notification_config(config_data)
        return {**webhook_config, **notification_config}

    def _detect_config_source(self, env_key: str, yaml_value: str) -> str:
        """检测配置项来源：env / yaml / 未配置"""
        env_val = os.environ.get(env_key, "").strip()
        if env_val:
            return "env"
        elif yaml_value:
            return "yaml"
        return ""

    def get_channel_format_guide(self, channel: Optional[str] = None) -> Dict:
        """
        获取渠道格式化策略指南

        返回各渠道支持的 Markdown 特性、限制和最佳格式化提示词，
        供 LLM 在生成推送内容时参考，确保内容样式贴合目标渠道。

        Args:
            channel: 指定渠道 ID，None 返回所有渠道的策略

        Returns:
            格式化策略字典
        """
        if channel:
            if channel not in CHANNEL_FORMAT_GUIDES:
                valid = list(CHANNEL_FORMAT_GUIDES.keys())
                return {
                    "success": False,
                    "error": {
                        "code": "INVALID_CHANNEL",
                        "message": f"无效的渠道: {channel}",
                        "suggestion": f"支持的渠道: {valid}",
                    },
                }
            guide = CHANNEL_FORMAT_GUIDES[channel]
            return {
                "success": True,
                "channel": channel,
                "guide": guide,
            }
        else:
            return {
                "success": True,
                "summary": f"共 {len(CHANNEL_FORMAT_GUIDES)} 个渠道的格式化策略",
                "guides": CHANNEL_FORMAT_GUIDES,
            }

    def get_notification_channels(self) -> Dict:
        """
        获取所有通知渠道的配置状态

        检测 config.yaml 和 .env 环境变量，返回每个渠道是否已配置。

        Returns:
            渠道状态字典
        """
        try:
            config = self._load_merged_config()
            enabled = config.get("ENABLE_NOTIFICATION", True)

            # 从 yaml 直接读取（用于判断来源）
            config_path = self.project_root / "config" / "config.yaml"
            yaml_channels = {}
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    raw = yaml.safe_load(f) or {}
                    yaml_channels = raw.get("notification", {}).get("channels", {})

            channels = []
            env_key_map = {
                "FEISHU_WEBHOOK_URL": ("feishu", "webhook_url"),
                "DINGTALK_WEBHOOK_URL": ("dingtalk", "webhook_url"),
                "WEWORK_WEBHOOK_URL": ("wework", "webhook_url"),
                "TELEGRAM_BOT_TOKEN": ("telegram", "bot_token"),
                "TELEGRAM_CHAT_ID": ("telegram", "chat_id"),
                "EMAIL_FROM": ("email", "from"),
                "EMAIL_PASSWORD": ("email", "password"),
                "EMAIL_TO": ("email", "to"),
                "NTFY_SERVER_URL": ("ntfy", "server_url"),
                "NTFY_TOPIC": ("ntfy", "topic"),
                "BARK_URL": ("bark", "url"),
                "SLACK_WEBHOOK_URL": ("slack", "webhook_url"),
                "GENERIC_WEBHOOK_URL": ("generic_webhook", "webhook_url"),
            }

            for channel_id, required_keys in _CHANNEL_REQUIREMENTS.items():
                is_configured = all(config.get(k) for k in required_keys)

                # 判断来源
                sources = set()
                for key in required_keys:
                    ch_name, field = env_key_map.get(key, ("", ""))
                    yaml_val = yaml_channels.get(ch_name, {}).get(field, "")
                    src = self._detect_config_source(key, yaml_val)
                    if src:
                        sources.add(src)

                channels.append({
                    "id": channel_id,
                    "name": _CHANNEL_NAMES.get(channel_id, channel_id),
                    "configured": is_configured,
                    "source": list(sources) if sources else [],
                })

            configured_count = sum(1 for ch in channels if ch["configured"])

            return {
                "success": True,
                "notification_enabled": enabled,
                "summary": f"{configured_count}/{len(channels)} 个渠道已配置",
                "channels": channels,
            }
        except Exception as e:
            return {
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": str(e)},
            }

    def send_notification(
        self,
        message: str,
        title: str = "TrendRadar 通知",
        channels: Optional[List[str]] = None,
    ) -> Dict:
        """
        向已配置的通知渠道发送消息

        接受 markdown 格式内容，内部自动转换为各渠道要求的格式。

        Args:
            message: markdown 格式的消息内容
            title: 消息标题
            channels: 指定发送的渠道列表，None 表示发送到所有已配置渠道
                      可选值: feishu, dingtalk, wework, telegram, email, ntfy, bark, slack, generic_webhook

        Returns:
            发送结果字典
        """
        if not message or not message.strip():
            return {
                "success": False,
                "error": {"code": "EMPTY_MESSAGE", "message": "消息内容不能为空"},
            }

        try:
            config = self._load_merged_config()

            if not config.get("ENABLE_NOTIFICATION", True):
                return {
                    "success": False,
                    "error": {"code": "NOTIFICATION_DISABLED", "message": "通知功能已禁用（notification.enabled = false）"},
                }

            # 确定目标渠道
            all_channel_ids = list(_CHANNEL_REQUIREMENTS.keys())
            if channels:
                # 验证渠道名称
                invalid = [ch for ch in channels if ch not in all_channel_ids]
                if invalid:
                    raise InvalidParameterError(
                        f"无效的渠道: {invalid}",
                        suggestion=f"支持的渠道: {all_channel_ids}"
                    )
                target_channels = channels
            else:
                # 发送到所有已配置渠道
                target_channels = [
                    ch_id for ch_id, keys in _CHANNEL_REQUIREMENTS.items()
                    if all(config.get(k) for k in keys)
                ]

            if not target_channels:
                return {
                    "success": False,
                    "error": {
                        "code": "NO_CHANNELS",
                        "message": "没有已配置的目标渠道",
                        "suggestion": "请在 config.yaml 或 .env 中配置至少一个通知渠道",
                    },
                }

            # 逐渠道发送
            results = {}
            for ch_id in target_channels:
                required_keys = _CHANNEL_REQUIREMENTS[ch_id]
                if not all(config.get(k) for k in required_keys):
                    results[ch_id] = {"success": False, "detail": "渠道未配置"}
                    continue

                result = self._dispatch_to_channel(ch_id, config, message, title)
                results[ch_id] = result

            success_count = sum(1 for r in results.values() if r["success"])
            total = len(results)

            return {
                "success": success_count > 0,
                "summary": f"{success_count}/{total} 个渠道发送成功",
                "results": {
                    ch_id: {
                        "name": _CHANNEL_NAMES.get(ch_id, ch_id),
                        **r,
                    }
                    for ch_id, r in results.items()
                },
            }

        except MCPError as e:
            return {"success": False, "error": e.to_dict()}
        except Exception as e:
            return {
                "success": False,
                "error": {"code": "INTERNAL_ERROR", "message": str(e)},
            }

    def _dispatch_to_channel(
        self, channel_id: str, config: Dict, message: str, title: str
    ) -> Dict:
        """分发消息到指定渠道（格式适配 → 字节分批 → 多账号 × 逐批发送）

        从 config.yaml → advanced.batch_size / batch_send_interval 读取配置。
        """
        # 从 config 读取批次配置（与 trendradar 一致）
        batch_sizes = self._get_batch_sizes()
        batch_interval = self._get_batch_interval()

        # Email 无字节限制，不走分批管线
        if channel_id == "email":
            return _send_email(
                config["EMAIL_FROM"],
                config["EMAIL_PASSWORD"],
                config["EMAIL_TO"],
                message, title,
                config.get("EMAIL_SMTP_SERVER", ""),
                config.get("EMAIL_SMTP_PORT", ""),
            )

        # 统一分批管线：格式适配 → 字节分割 → 添加批次头部 → (可选)反序
        batches = _prepare_batches(message, channel_id, batch_sizes)

        # 按渠道路由发送
        if channel_id == "feishu":
            return self._send_batched_multi_account(
                config["FEISHU_WEBHOOK_URL"], batches, channel_id,
                lambda url, content: _send_feishu(url, content, title),
                batch_interval,
            )
        elif channel_id == "dingtalk":
            return self._send_batched_multi_account(
                config["DINGTALK_WEBHOOK_URL"], batches, channel_id,
                lambda url, content: _send_dingtalk(url, content, title),
                batch_interval,
            )
        elif channel_id == "wework":
            msg_type = config.get("WEWORK_MSG_TYPE", "markdown")
            return self._send_batched_multi_account(
                config["WEWORK_WEBHOOK_URL"], batches, channel_id,
                lambda url, content: _send_wework(url, content, title, msg_type),
                batch_interval,
            )
        elif channel_id == "telegram":
            return self._send_batched_telegram(
                config, batches, title, batch_interval,
            )
        elif channel_id == "ntfy":
            return self._send_batched_ntfy(
                config, batches, title, batch_interval,
            )
        elif channel_id == "bark":
            return self._send_batched_multi_account(
                config["BARK_URL"], batches, channel_id,
                lambda url, content: _send_bark(url, content, title),
                batch_interval,
            )
        elif channel_id == "slack":
            return self._send_batched_multi_account(
                config["SLACK_WEBHOOK_URL"], batches, channel_id,
                lambda url, content: _send_slack(url, content, title),
                batch_interval,
            )
        elif channel_id == "generic_webhook":
            template = config.get("GENERIC_WEBHOOK_TEMPLATE", "")
            return self._send_batched_multi_account(
                config["GENERIC_WEBHOOK_URL"], batches, channel_id,
                lambda url, content: _send_generic_webhook(url, content, title, template),
                batch_interval,
            )
        else:
            return {"success": False, "detail": f"未知渠道: {channel_id}"}

    def _get_batch_sizes(self) -> Dict:
        """从 config.yaml 读取 advanced.batch_size，合并到默认值"""
        try:
            config_path = self.project_root / "config" / "config.yaml"
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    raw = yaml.safe_load(f) or {}
                advanced = raw.get("advanced", {})
                cfg_sizes = advanced.get("batch_size", {})
                # 从 config 构建渠道映射
                sizes = dict(_CHANNEL_BATCH_SIZES_DEFAULT)
                default_size = cfg_sizes.get("default", 4000)
                for ch_id in sizes:
                    if ch_id in cfg_sizes:
                        sizes[ch_id] = cfg_sizes[ch_id]
                    elif ch_id not in ("email", "ntfy") and sizes[ch_id] == 4000:
                        # 使用 config 中的 default
                        sizes[ch_id] = default_size
                return sizes
        except Exception:
            pass
        return dict(_CHANNEL_BATCH_SIZES_DEFAULT)

    def _get_batch_interval(self) -> float:
        """从 config.yaml 读取 advanced.batch_send_interval"""
        try:
            config_path = self.project_root / "config" / "config.yaml"
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    raw = yaml.safe_load(f) or {}
                return float(raw.get("advanced", {}).get("batch_send_interval", _BATCH_INTERVAL_DEFAULT))
        except Exception:
            pass
        return _BATCH_INTERVAL_DEFAULT

    def _send_batched_multi_account(
        self, urls_str: str, batches: List[str], channel_id: str, send_func,
        batch_interval: float = _BATCH_INTERVAL_DEFAULT,
    ) -> Dict:
        """多账号 × 逐批发送（; 分隔的 URL）"""
        urls = [u.strip() for u in urls_str.split(";") if u.strip()]
        if not urls:
            return {"success": False, "detail": "URL 为空"}

        any_ok = False
        details = []
        for url in urls:
            for i, batch in enumerate(batches):
                r = send_func(url, batch)
                if r["success"]:
                    any_ok = True
                elif r["detail"]:
                    details.append(r["detail"])
                # 批次间间隔
                if i < len(batches) - 1:
                    time.sleep(batch_interval)

        return {
            "success": any_ok,
            "detail": "; ".join(details) if details else "",
            "batches": len(batches),
        }

    def _send_batched_telegram(
        self, config: Dict, batches: List[str], title: str,
        batch_interval: float = _BATCH_INTERVAL_DEFAULT,
    ) -> Dict:
        """Telegram 多账号 × 逐批发送（token/chat_id 配对）"""
        tokens = config["TELEGRAM_BOT_TOKEN"].split(";")
        chat_ids = config["TELEGRAM_CHAT_ID"].split(";")
        if len(tokens) != len(chat_ids):
            return {"success": False, "detail": "bot_token 和 chat_id 数量不一致"}

        any_ok = False
        details = []
        for token, cid in zip(tokens, chat_ids):
            token, cid = token.strip(), cid.strip()
            if not (token and cid):
                continue
            for i, batch in enumerate(batches):
                r = _send_telegram(token, cid, batch, title)
                if r["success"]:
                    any_ok = True
                elif r["detail"]:
                    details.append(r["detail"])
                if i < len(batches) - 1:
                    time.sleep(batch_interval)

        return {
            "success": any_ok,
            "detail": "; ".join(details) if details else "",
            "batches": len(batches),
        }

    def _send_batched_ntfy(
        self, config: Dict, batches: List[str], title: str,
        batch_interval: float = _BATCH_INTERVAL_DEFAULT,
    ) -> Dict:
        """ntfy 多账号 × 逐批发送（server/topic/token 配对，含速率限制处理）"""
        servers = config["NTFY_SERVER_URL"].split(";")
        topics = config["NTFY_TOPIC"].split(";")
        tokens_str = config.get("NTFY_TOKEN", "")
        tokens = tokens_str.split(";") if tokens_str else [""]
        if len(servers) != len(topics):
            return {"success": False, "detail": "server_url 和 topic 数量不一致"}

        any_ok = False
        details = []
        for i, (srv, topic) in enumerate(zip(servers, topics)):
            srv, topic = srv.strip(), topic.strip()
            tk = tokens[i].strip() if i < len(tokens) else ""
            if not (srv and topic):
                continue
            # ntfy.sh 公共服务器用 2s 间隔（与 trendradar 一致）
            interval = 2.0 if "ntfy.sh" in srv else batch_interval
            for j, batch in enumerate(batches):
                r = _send_ntfy(srv, topic, batch, title, tk)
                if r["success"]:
                    any_ok = True
                elif r["detail"]:
                    details.append(r["detail"])
                if j < len(batches) - 1:
                    time.sleep(interval)

        return {
            "success": any_ok,
            "detail": "; ".join(details) if details else "",
            "batches": len(batches),
        }
