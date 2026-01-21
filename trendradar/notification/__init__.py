# coding=utf-8
"""
通知推送模块

提供多渠道通知推送功能，包括：
- 飞书、钉钉、企业微信
- Telegram、Slack
- Email、ntfy、Bark

模块结构：
- push_manager: 推送记录管理
- formatters: 内容格式转换
- batch: 批次处理工具
- renderer: 通知内容渲染
- splitter: 消息分批拆分
- senders: 消息发送器（各渠道发送函数）
- dispatcher: 多账号通知调度器
"""

from trendradar.notification.push_manager import PushRecordManager
from trendradar.notification.formatters import (
    strip_markdown,
    convert_markdown_to_mrkdwn,
)
from trendradar.notification.batch import (
    get_batch_header,
    get_max_batch_header_size,
    truncate_to_bytes,
    add_batch_headers,
)
from trendradar.notification.renderer import (
    render_feishu_content,
    render_dingtalk_content,
)
from trendradar.notification.splitter import (
    split_content_into_batches,
    DEFAULT_BATCH_SIZES,
)
from trendradar.notification.senders import (
    send_to_feishu,
    send_to_dingtalk,
    send_to_wework,
    send_to_telegram,
    send_to_email,
    send_to_ntfy,
    send_to_bark,
    send_to_slack,
    SMTP_CONFIGS,
)
from trendradar.notification.dispatcher import NotificationDispatcher

__all__ = [
    # 推送记录管理
    "PushRecordManager",
    # 格式转换
    "strip_markdown",
    "convert_markdown_to_mrkdwn",
    # 批次处理
    "get_batch_header",
    "get_max_batch_header_size",
    "truncate_to_bytes",
    "add_batch_headers",
    # 内容渲染
    "render_feishu_content",
    "render_dingtalk_content",
    # 消息分批
    "split_content_into_batches",
    "DEFAULT_BATCH_SIZES",
    # 消息发送器
    "send_to_feishu",
    "send_to_dingtalk",
    "send_to_wework",
    "send_to_telegram",
    "send_to_email",
    "send_to_ntfy",
    "send_to_bark",
    "send_to_slack",
    "SMTP_CONFIGS",
    # 通知调度器
    "NotificationDispatcher",
]
