# coding=utf-8
"""配置读写、字段模型与校验。

管理台直接读写项目原有的 YAML / 文本配置文件，
保存前做备份和原子替换，保证运行进程永远读到完整文件。
"""

from __future__ import annotations

import copy
import json
import os
import re
import shutil
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import yaml

try:  # Python 3.9+
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"
CONFIG_FILE = CONFIG_DIR / "config.yaml"
SETTINGS_FILE = DATA_DIR / "settings.json"
STATE_FILE = DATA_DIR / "state.json"
BACKUP_DIR = DATA_DIR / "backups"
LOG_DIR = DATA_DIR / "logs"
CREDENTIALS_FILE = DATA_DIR / "admin.json"
ACME_DIR = DATA_DIR / "acme"

CLEAR_TOKEN = "__CLEAR__"

TEXT_FILES = {
    "config.yaml": {
        "path": "config.yaml",
        "label": "主配置（原始 YAML）",
        "kind": "yaml",
    },
    "timeline.yaml": {"path": "timeline.yaml", "label": "时间线配置", "kind": "yaml"},
    "frequency_words.txt": {
        "path": "frequency_words.txt",
        "label": "关键词规则",
        "kind": "keyword",
    },
    "ai_interests.txt": {
        "path": "ai_interests.txt",
        "label": "AI 兴趣描述",
        "kind": "text",
    },
    "ai_analysis_prompt.txt": {
        "path": "ai_analysis_prompt.txt",
        "label": "AI 分析提示词",
        "kind": "text",
    },
    "ai_translation_prompt.txt": {
        "path": "ai_translation_prompt.txt",
        "label": "AI 翻译提示词",
        "kind": "text",
    },
    "ai_filter_prompt.txt": {
        "path": "ai_filter/prompt.txt",
        "label": "AI 筛选分类提示词",
        "kind": "text",
    },
    "ai_filter_extract_prompt.txt": {
        "path": "ai_filter/extract_prompt.txt",
        "label": "AI 标签提取提示词",
        "kind": "text",
    },
    "ai_filter_update_prompt.txt": {
        "path": "ai_filter/update_tags_prompt.txt",
        "label": "AI 标签更新提示词",
        "kind": "text",
    },
}


def _f(path: str, label: str, ftype: str = "text", **kwargs: Any) -> Dict[str, Any]:
    field = {"path": path, "label": label, "type": ftype}
    field.update(kwargs)
    return field


SCHEMA: Dict[str, Any] = {
    "version": 1,
    "groups": [
        {
            "id": "basic",
            "title": "基础与报告",
            "desc": "时区、调度模板、报告模式与展示方式。保存后下一次运行生效。",
            "fields": [
                _f(
                    "app.timezone",
                    "时区",
                    "text",
                    default="Asia/Shanghai",
                    placeholder="Asia/Shanghai",
                    help="影响时间显示、调度判断和数据存储，例如 Asia/Shanghai。",
                ),
                _f("app.show_version_update", "显示版本更新提示", "bool", default=True),
                _f(
                    "schedule.enabled",
                    "启用时间线调度",
                    "bool",
                    default=False,
                    help="关闭时全天使用同一套采集/推送策略；开启后由时间线模板决定各时段行为。",
                ),
                _f(
                    "schedule.preset",
                    "时间线模板",
                    "select",
                    default="morning_evening",
                    options=[
                        {"value": "always_on", "label": "全天监控（有新增即推送）"},
                        {
                            "value": "morning_evening",
                            "label": "早间 + 晚间汇总（推荐）",
                        },
                        {"value": "office_hours", "label": "工作日三段式"},
                        {"value": "night_owl", "label": "午后速览 + 深夜汇总"},
                        {"value": "custom", "label": "自定义（编辑时间线文件）"},
                    ],
                ),
                _f(
                    "report.mode",
                    "报告模式",
                    "select",
                    default="current",
                    options=[
                        {"value": "daily", "label": "当日汇总"},
                        {"value": "current", "label": "当前榜单"},
                        {"value": "incremental", "label": "增量监控（零重复）"},
                    ],
                ),
                _f(
                    "report.display_mode",
                    "分组维度",
                    "select",
                    default="keyword",
                    options=[
                        {"value": "keyword", "label": "按关键词分组"},
                        {"value": "platform", "label": "按平台/来源分组"},
                    ],
                ),
                _f(
                    "report.sort_by_position_first",
                    "按关键词定义顺序排序",
                    "bool",
                    default=False,
                ),
                _f(
                    "report.rank_threshold",
                    "排名高亮阈值",
                    "number",
                    default=5,
                    min=0,
                    max=100,
                    step=1,
                ),
                _f(
                    "report.max_news_per_keyword",
                    "每个关键词最多显示",
                    "number",
                    default=0,
                    min=0,
                    max=1000,
                    step=1,
                    help="0 表示不限制。",
                ),
            ],
        },
        {
            "id": "sources",
            "title": "数据源",
            "desc": "热榜平台与 RSS 订阅源，可在这里增删、禁用或调整顺序。",
            "fields": [
                _f("platforms.enabled", "启用热榜抓取", "bool", default=True),
                _f(
                    "platforms.api_url",
                    "热榜 API 地址",
                    "text",
                    default="",
                    placeholder="留空使用默认 newsnow 地址",
                    help="可指向自建的 newsnow 实例。",
                ),
                _f(
                    "platforms.sources",
                    "热榜平台",
                    "objectlist",
                    default=[],
                    item_fields=[
                        _f("id", "平台 ID", "text", required=True, placeholder="weibo"),
                        _f(
                            "name",
                            "显示名称",
                            "text",
                            required=True,
                            placeholder="微博",
                        ),
                        _f(
                            "expected_domain",
                            "校验域名",
                            "text",
                            placeholder="weibo.com",
                        ),
                        _f("enabled", "启用", "bool", default=True),
                    ],
                ),
                _f("rss.enabled", "启用 RSS 抓取", "bool", default=True),
                _f(
                    "rss.freshness_filter.enabled",
                    "启用文章新鲜度过滤",
                    "bool",
                    default=True,
                ),
                _f(
                    "rss.freshness_filter.max_age_days",
                    "最大文章年龄（天）",
                    "number",
                    default=1,
                    min=0,
                    max=365,
                    step=1,
                    help="0 表示不过滤，推送全部文章；单个源可单独覆盖。",
                ),
                _f(
                    "rss.feeds",
                    "RSS 订阅源",
                    "objectlist",
                    default=[],
                    item_fields=[
                        _f(
                            "id",
                            "源 ID",
                            "text",
                            required=True,
                            placeholder="hacker-news",
                        ),
                        _f("name", "显示名称", "text", required=True),
                        _f(
                            "url",
                            "订阅地址",
                            "text",
                            required=True,
                            placeholder="https://example.com/feed.xml",
                        ),
                        _f("enabled", "启用", "bool", default=True),
                        _f(
                            "max_age_days",
                            "单独新鲜度（天）",
                            "number",
                            min=0,
                            max=365,
                            step=1,
                            help="留空继承全局设置。",
                        ),
                    ],
                ),
            ],
        },
        {
            "id": "display",
            "title": "筛选与展示",
            "desc": "关键词/AI 筛选方式，以及推送内容中各区域的显示顺序。",
            "fields": [
                _f(
                    "filter.method",
                    "筛选方式",
                    "select",
                    default="keyword",
                    options=[
                        {"value": "keyword", "label": "关键词匹配（不耗 token）"},
                        {"value": "ai", "label": "AI 智能筛选（每次运行消耗 token）"},
                    ],
                ),
                _f(
                    "filter.priority_sort_enabled",
                    "AI 标签按兴趣顺序排序",
                    "bool",
                    default=True,
                ),
                _f(
                    "display.region_order",
                    "区域显示顺序",
                    "order",
                    default=[
                        "new_items",
                        "hotlist",
                        "rss",
                        "standalone",
                        "ai_analysis",
                    ],
                    options=[
                        {"value": "new_items", "label": "新增热点"},
                        {"value": "hotlist", "label": "热榜"},
                        {"value": "rss", "label": "RSS"},
                        {"value": "standalone", "label": "独立展示区"},
                        {"value": "ai_analysis", "label": "AI 分析"},
                    ],
                ),
                _f("display.regions.hotlist", "显示热榜区域", "bool", default=True),
                _f(
                    "display.regions.new_items",
                    "显示新增热点区域",
                    "bool",
                    default=False,
                ),
                _f("display.regions.rss", "显示 RSS 区域", "bool", default=True),
                _f(
                    "display.regions.standalone",
                    "显示独立展示区",
                    "bool",
                    default=False,
                ),
                _f(
                    "display.regions.ai_analysis",
                    "显示 AI 分析区域",
                    "bool",
                    default=True,
                ),
                _f(
                    "display.standalone.platforms",
                    "独立展示的热榜平台",
                    "idlist",
                    default=["zhihu", "wallstreetcn-hot"],
                    source="platforms",
                ),
                _f(
                    "display.standalone.rss_feeds",
                    "独立展示的 RSS 源",
                    "idlist",
                    default=[],
                    source="rss",
                ),
                _f(
                    "display.standalone.max_items",
                    "独立展示每源条数",
                    "number",
                    default=20,
                    min=0,
                    max=200,
                    step=1,
                    help="0 表示不限制。",
                ),
            ],
        },
        {
            "id": "ai",
            "title": "AI 能力",
            "desc": "模型凭据、AI 分析、翻译与智能筛选。密钥留空表示保持原值。",
            "fields": [
                _f(
                    "ai.model",
                    "模型",
                    "text",
                    default="deepseek/deepseek-v4-flash",
                    placeholder="deepseek/deepseek-v4-flash",
                    help="LiteLLM 格式：提供商/模型名，例如 openai/gpt-4o、gemini/gemini-2.5-flash。",
                ),
                _f("ai.api_key", "API Key", "password", sensitive=True),
                _f(
                    "ai.api_base",
                    "自定义 API 地址",
                    "text",
                    default="",
                    help="使用中转或私有部署时填写，并在模型前加 openai/ 前缀。",
                ),
                _f(
                    "ai.timeout",
                    "请求超时（秒）",
                    "number",
                    default=120,
                    min=5,
                    max=600,
                    step=5,
                ),
                _f(
                    "ai.temperature",
                    "采样温度",
                    "number",
                    default=1.0,
                    min=0,
                    max=2,
                    step=0.1,
                ),
                _f(
                    "ai.max_tokens",
                    "最大生成 token",
                    "number",
                    default=5000,
                    min=0,
                    max=200000,
                    step=100,
                    help="0 表示不发送该参数。",
                ),
                _f(
                    "ai.num_retries",
                    "失败重试次数",
                    "number",
                    default=1,
                    min=0,
                    max=5,
                    step=1,
                ),
                _f("ai.fallback_models", "备用模型", "stringlist", default=[]),
                _f(
                    "ai.extra_params",
                    "额外请求参数",
                    "yaml",
                    default={},
                    help="原样透传给 LiteLLM，例如 top_p、presence_penalty。",
                ),
                _f("ai_analysis.enabled", "启用 AI 分析", "bool", default=True),
                _f(
                    "ai_analysis.language",
                    "分析语言",
                    "text",
                    default="Chinese",
                    placeholder="Chinese / English / 中文",
                ),
                _f(
                    "ai_analysis.prompt_file",
                    "分析提示词文件",
                    "text",
                    default="ai_analysis_prompt.txt",
                ),
                _f(
                    "ai_analysis.mode",
                    "分析模式",
                    "select",
                    default="follow_report",
                    options=[
                        {"value": "follow_report", "label": "跟随报告模式"},
                        {"value": "daily", "label": "强制当日汇总"},
                        {"value": "current", "label": "强制当前榜单"},
                        {"value": "incremental", "label": "强制增量"},
                    ],
                ),
                _f(
                    "ai_analysis.max_news_for_analysis",
                    "参与分析的新闻上限",
                    "number",
                    default=150,
                    min=0,
                    max=1000,
                    step=10,
                    help="控制 token 成本的关键项。",
                ),
                _f("ai_analysis.include_rss", "分析中包含 RSS", "bool", default=False),
                _f(
                    "ai_analysis.include_standalone",
                    "分析中包含独立展示区",
                    "bool",
                    default=True,
                ),
                _f(
                    "ai_analysis.include_rank_timeline",
                    "包含完整排名轨迹",
                    "bool",
                    default=True,
                    help="更准确但会增加约 0.5~1 倍 token。",
                ),
                _f("ai_translation.enabled", "启用标题翻译", "bool", default=True),
                _f("ai_translation.language", "翻译目标语言", "text", default="中文"),
                _f(
                    "ai_translation.prompt_file",
                    "翻译提示词文件",
                    "text",
                    default="ai_translation_prompt.txt",
                ),
                _f(
                    "ai_translation.batch_size",
                    "翻译每批标题数",
                    "number",
                    default=100,
                    min=1,
                    max=1000,
                    step=10,
                ),
                _f(
                    "ai_translation.batch_interval",
                    "翻译分批间隔（秒）",
                    "number",
                    default=2,
                    min=0,
                    max=60,
                    step=1,
                ),
                _f(
                    "ai_translation.scope.hotlist",
                    "翻译热榜标题",
                    "bool",
                    default=False,
                ),
                _f("ai_translation.scope.rss", "翻译 RSS 标题", "bool", default=True),
                _f(
                    "ai_translation.scope.standalone",
                    "翻译独立展示区",
                    "bool",
                    default=True,
                ),
                _f(
                    "ai_filter.batch_size",
                    "筛选每批标题数",
                    "number",
                    default=200,
                    min=1,
                    max=1000,
                    step=10,
                ),
                _f(
                    "ai_filter.batch_interval",
                    "筛选分批间隔（秒）",
                    "number",
                    default=2,
                    min=0,
                    max=60,
                    step=1,
                ),
                _f(
                    "ai_filter.min_score",
                    "推送最低分数",
                    "number",
                    default=0.7,
                    min=0,
                    max=1,
                    step=0.05,
                    help="0 表示不过滤；0.5~0.7 适合起步。",
                ),
                _f(
                    "ai_filter.reclassify_threshold",
                    "全量重分类阈值",
                    "number",
                    default=0.6,
                    min=0,
                    max=1,
                    step=0.05,
                ),
                _f(
                    "ai_filter.interests_file",
                    "兴趣描述文件",
                    "text",
                    default="",
                    help="留空使用 config/ai_interests.txt；自定义文件放在 config/custom/ai/ 下并填文件名。",
                ),
                _f(
                    "ai_filter.prompt_file",
                    "分类提示词文件",
                    "text",
                    default="prompt.txt",
                ),
                _f(
                    "ai_filter.extract_prompt_file",
                    "标签提取提示词文件",
                    "text",
                    default="extract_prompt.txt",
                ),
                _f(
                    "ai_filter.update_tags_prompt_file",
                    "标签更新提示词文件",
                    "text",
                    default="update_tags_prompt.txt",
                ),
            ],
        },
        {
            "id": "notification",
            "title": "推送通知",
            "desc": "先打开总开关，再按下方「配置指南」逐步填入至少一个渠道，保存后发一条测试通知确认。多个账号/群使用英文分号 ; 分隔。",
            "guide": [
                {
                    "title": "飞书",
                    "steps": [
                        "在飞书群聊右上角进入「设置 → 群机器人 → 添加机器人 → 自定义机器人」，复制 Webhook 地址。",
                        "粘贴到「飞书 Webhook」。多个群用英文分号分隔，例如 url1;url2。",
                        "安全设置请选择「自定义关键词」并填入 TrendRadar，或使用 IP 白名单；本程序不支持签名校验，开启签名会发送失败。",
                    ],
                    "example": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx",
                    "note": "www.feishu.cn 的 Webhook 发送文本消息，open.feishu.cn / Lark 发送卡片消息，两种地址都可直接使用。",
                },
                {
                    "title": "钉钉",
                    "steps": [
                        "群设置 → 智能群助手 → 添加机器人 → 自定义 → 复制 Webhook。",
                        "安全设置选择「自定义关键词」，填入 TrendRadar（报告标题包含该词）；选择「加签」会导致发送失败。",
                        "多个群用英文分号分隔。",
                    ],
                    "example": "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx",
                },
                {
                    "title": "企业微信",
                    "steps": [
                        "群聊右上角 → 群机器人 → 添加机器人 → 复制 Webhook。",
                        "消息类型保持 markdown（群机器人）；只有对接企业微信「应用消息」时才选 text。",
                        "多个群用英文分号分隔。",
                    ],
                    "example": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
                },
                {
                    "title": "Telegram",
                    "steps": [
                        "在 Telegram 搜索 @BotFather，发送 /newbot，按提示创建机器人并保存 Bot Token。",
                        "先把机器人拉进目标群或私聊并发送一条消息，再用 @userinfobot 查询 Chat ID（群组 ID 通常为负数）。",
                        "Token 与 Chat ID 都支持多个账号：用英文分号分隔，且两边数量必须一一对应。",
                    ],
                    "example": "Token: 123456:ABC-DEF...  Chat ID: -1001234567890",
                    "note": "服务器无法直连 api.telegram.org 时，请在「高级设置」启用代理并填写可用代理地址。",
                },
                {
                    "title": "邮件",
                    "steps": [
                        "发件邮箱填完整地址，例如 you@qq.com；密码填 SMTP 授权码，不是邮箱登录密码。",
                        "收件人可填多个，用英文逗号分隔；抄送不支持，请分别填写。",
                        "SMTP 服务器/端口留空会按邮箱域名自动识别（QQ、163、Gmail、Outlook、阿里云、iCloud 等）；自定义服务器填 smtp.example.com 与 465（SSL）或 587（TLS）。",
                        "邮件推送依赖 HTML 报告，请确认「存储 → 生成 HTML 报告」已开启。",
                    ],
                    "note": "QQ/163 邮箱需先在网页版设置中开启 SMTP 服务并生成授权码；发送失败时查看日志中的 SMTP 错误码。",
                },
                {
                    "title": "ntfy",
                    "steps": [
                        "手机安装 ntfy App，订阅一个主题名（topic），例如 trendradar-abc123。",
                        "服务器默认 https://ntfy.sh，自建服务填自己的地址；主题填订阅的 topic。",
                        "公开服务器的主题任何人可订阅，请使用不易猜测的名称；私有主题需填写访问令牌。",
                    ],
                },
                {
                    "title": "Bark（iPhone）",
                    "steps": [
                        "iPhone 安装 Bark App，首页复制推送地址，形如 https://api.day.app/你的device_key。",
                        "把完整地址粘贴到「Bark 推送地址」；自建服务器使用自己的域名。",
                        "多个设备用英文分号分隔。",
                    ],
                },
                {
                    "title": "Slack",
                    "steps": [
                        "在 Slack App 管理页创建 App → Incoming Webhooks → Add New Webhook，选择频道后复制 URL。",
                        "粘贴到「Slack Webhook」；多个频道可用英文分号分隔。",
                    ],
                    "example": "https://hooks.slack.com/services/T000/B000/xxxxxxxx",
                },
                {
                    "title": "通用 Webhook",
                    "steps": [
                        "适用于 Discord、Matrix、IFTTT 或自建服务等任何接受 POST JSON 的地址。",
                        '模板使用 {title} 与 {content} 占位符，模板本身必须是合法 JSON；留空则发送 {"title": "...", "content": "..."}。',
                        "接收端返回 2xx 视为成功；content 中的引号会自动转义。",
                    ],
                    "example": '{"content": "{content}"}',
                },
            ],
            "fields": [
                _f(
                    "notification.enabled",
                    "启用通知（总开关）",
                    "bool",
                    default=True,
                    help="关闭后所有渠道都不会发送；开启时间线调度时，本开关仍是最高优先级。",
                ),
                _f(
                    "notification.channels.feishu.webhook_url",
                    "飞书 Webhook",
                    "password",
                    sensitive=True,
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/...",
                    help="多个群用英文分号分隔；安全设置请用「自定义关键词」或 IP 白名单，不要开启签名校验。",
                ),
                _f(
                    "notification.channels.dingtalk.webhook_url",
                    "钉钉 Webhook",
                    "password",
                    sensitive=True,
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=...",
                    help="多个群用英文分号分隔；安全设置请选「自定义关键词」并填入 TrendRadar。",
                ),
                _f(
                    "notification.channels.wework.webhook_url",
                    "企业微信 Webhook",
                    "password",
                    sensitive=True,
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
                    help="群机器人地址；多个群用英文分号分隔。",
                ),
                _f(
                    "notification.channels.wework.msg_type",
                    "企业微信消息类型",
                    "select",
                    default="markdown",
                    options=[
                        {"value": "markdown", "label": "markdown（群机器人）"},
                        {"value": "text", "label": "text（个人微信应用）"},
                    ],
                    help="群机器人选 markdown；企业微信应用消息选 text。",
                ),
                _f(
                    "notification.channels.telegram.bot_token",
                    "Telegram Bot Token",
                    "password",
                    sensitive=True,
                    placeholder="123456789:AA...",
                    help="从 @BotFather 的 /newbot 获取；多个 Token 用英文分号分隔。",
                ),
                _f(
                    "notification.channels.telegram.chat_id",
                    "Telegram Chat ID",
                    "text",
                    placeholder="-1001234567890",
                    help="用 @userinfobot 获取，群组为负数；多个 ID 用英文分号分隔，数量需与 Token 一致。",
                ),
                _f(
                    "notification.channels.email.from",
                    "发件邮箱",
                    "text",
                    placeholder="you@qq.com",
                    help="填写完整邮箱地址，用于生成发件人。",
                ),
                _f(
                    "notification.channels.email.password",
                    "邮箱密码 / 授权码",
                    "password",
                    sensitive=True,
                    help="QQ、163、阿里云等需使用 SMTP 授权码，不是网页登录密码。",
                ),
                _f(
                    "notification.channels.email.to",
                    "收件人",
                    "text",
                    placeholder="a@example.com,b@example.com",
                    help="多个收件人用英文逗号分隔；邮件依赖 HTML 报告。",
                ),
                _f(
                    "notification.channels.email.smtp_server",
                    "SMTP 服务器",
                    "text",
                    placeholder="smtp.qq.com",
                    help="留空按邮箱域名自动识别；自定义服务器时与端口一起填写。",
                ),
                _f(
                    "notification.channels.email.smtp_port",
                    "SMTP 端口",
                    "text",
                    placeholder="465 或 587",
                    help="465 使用 SSL，587 使用 STARTTLS；留空自动识别。",
                ),
                _f(
                    "notification.channels.ntfy.server_url",
                    "ntfy 服务器",
                    "text",
                    default="https://ntfy.sh",
                    help="可使用公共 https://ntfy.sh 或自建服务器地址。",
                ),
                _f(
                    "notification.channels.ntfy.topic",
                    "ntfy 主题",
                    "text",
                    placeholder="trendradar-abc123",
                    help="手机 App 中订阅的主题名，公开主题请用不易猜的名称。",
                ),
                _f(
                    "notification.channels.ntfy.token",
                    "ntfy 访问令牌",
                    "password",
                    sensitive=True,
                    help="仅私有主题需要；在 ntfy 服务器配置访问控制后生成。",
                ),
                _f(
                    "notification.channels.bark.url",
                    "Bark 推送地址",
                    "password",
                    sensitive=True,
                    placeholder="https://api.day.app/your_device_key",
                    help="Bark App 首页复制的完整地址；多个设备用英文分号分隔。",
                ),
                _f(
                    "notification.channels.slack.webhook_url",
                    "Slack Webhook",
                    "password",
                    sensitive=True,
                    placeholder="https://hooks.slack.com/services/...",
                    help="在 Slack App 的 Incoming Webhooks 中创建并复制。",
                ),
                _f(
                    "notification.channels.generic_webhook.webhook_url",
                    "通用 Webhook 地址",
                    "password",
                    sensitive=True,
                    help="任何接受 POST JSON 的地址，例如 Discord、Matrix、IFTTT 或自建服务。",
                ),
                _f(
                    "notification.channels.generic_webhook.payload_template",
                    "通用 Webhook 模板",
                    "textarea",
                    placeholder='{"title": "{title}", "content": "{content}"}',
                    help="必须是合法 JSON，支持 {title} 与 {content} 占位符；留空使用默认格式。",
                ),
            ],
        },
        {
            "id": "storage",
            "title": "存储",
            "desc": "本地 SQLite / 报告文件，或 S3 兼容远程存储。",
            "fields": [
                _f(
                    "storage.backend",
                    "存储后端",
                    "select",
                    default="auto",
                    options=[
                        {"value": "auto", "label": "自动选择"},
                        {"value": "local", "label": "本地"},
                        {"value": "remote", "label": "远程 S3 兼容存储"},
                    ],
                ),
                _f(
                    "storage.formats.sqlite",
                    "生成 SQLite 数据库",
                    "bool",
                    default=True,
                    help="主存储，必须保持开启。",
                ),
                _f("storage.formats.txt", "生成 TXT 快照", "bool", default=False),
                _f(
                    "storage.formats.html",
                    "生成 HTML 报告",
                    "bool",
                    default=True,
                    help="需要网页版报告或邮件推送时必须开启。",
                ),
                _f("storage.local.data_dir", "本地数据目录", "text", default="output"),
                _f(
                    "storage.local.retention_days",
                    "本地数据保留天数",
                    "number",
                    default=0,
                    min=0,
                    max=3650,
                    step=1,
                    help="0 表示永久保留。",
                ),
                _f(
                    "storage.remote.retention_days",
                    "远程数据保留天数",
                    "number",
                    default=0,
                    min=0,
                    max=3650,
                    step=1,
                ),
                _f("storage.remote.endpoint_url", "S3 Endpoint", "text"),
                _f("storage.remote.bucket_name", "Bucket 名称", "text"),
                _f(
                    "storage.remote.access_key_id",
                    "Access Key ID",
                    "password",
                    sensitive=True,
                ),
                _f(
                    "storage.remote.secret_access_key",
                    "Secret Access Key",
                    "password",
                    sensitive=True,
                ),
                _f("storage.remote.region", "Region", "text"),
                _f(
                    "storage.pull.enabled",
                    "启动时从远程拉取数据",
                    "bool",
                    default=False,
                ),
                _f(
                    "storage.pull.days",
                    "拉取最近天数",
                    "number",
                    default=7,
                    min=1,
                    max=365,
                    step=1,
                ),
            ],
        },
        {
            "id": "advanced",
            "title": "高级设置",
            "desc": "爬虫、排序权重与消息分批等参数，通常无需修改。",
            "fields": [
                _f("advanced.debug", "调试模式", "bool", default=False),
                _f("advanced.version_check_url", "版本检查地址", "text"),
                _f("advanced.mcp_version_check_url", "MCP 版本检查地址", "text"),
                _f("advanced.configs_version_check_url", "配置版本检查地址", "text"),
                _f(
                    "advanced.crawler.request_interval",
                    "热榜请求间隔（毫秒）",
                    "number",
                    default=2000,
                    min=0,
                    max=60000,
                    step=100,
                ),
                _f("advanced.crawler.use_proxy", "热榜启用代理", "bool", default=False),
                _f(
                    "advanced.crawler.default_proxy",
                    "默认代理地址",
                    "text",
                    default="http://127.0.0.1:10801",
                ),
                _f(
                    "advanced.rss.request_interval",
                    "RSS 请求间隔（毫秒）",
                    "number",
                    default=1000,
                    min=0,
                    max=60000,
                    step=100,
                ),
                _f(
                    "advanced.rss.timeout",
                    "RSS 请求超时（秒）",
                    "number",
                    default=15,
                    min=1,
                    max=120,
                    step=1,
                ),
                _f("advanced.rss.use_proxy", "RSS 启用代理", "bool", default=False),
                _f(
                    "advanced.rss.proxy_url",
                    "RSS 专用代理",
                    "text",
                    help="留空则使用默认代理。",
                ),
                _f(
                    "advanced.weight.rank",
                    "排名权重",
                    "number",
                    default=0.6,
                    min=0,
                    max=1,
                    step=0.01,
                ),
                _f(
                    "advanced.weight.frequency",
                    "频次权重",
                    "number",
                    default=0.3,
                    min=0,
                    max=1,
                    step=0.01,
                ),
                _f(
                    "advanced.weight.hotness",
                    "热度权重",
                    "number",
                    default=0.1,
                    min=0,
                    max=1,
                    step=0.01,
                    help="三项权重之和应为 1。",
                ),
                _f(
                    "advanced.max_accounts_per_channel",
                    "每渠道最大账号数",
                    "number",
                    default=3,
                    min=1,
                    max=20,
                    step=1,
                ),
                _f(
                    "advanced.batch_size.default",
                    "默认消息分批大小（字节）",
                    "number",
                    default=4000,
                    min=500,
                    max=100000,
                    step=500,
                ),
                _f(
                    "advanced.batch_size.dingtalk",
                    "钉钉分批大小",
                    "number",
                    default=20000,
                    min=500,
                    max=100000,
                    step=500,
                ),
                _f(
                    "advanced.batch_size.feishu",
                    "飞书分批大小",
                    "number",
                    default=30000,
                    min=500,
                    max=100000,
                    step=500,
                ),
                _f(
                    "advanced.batch_size.bark",
                    "Bark 分批大小",
                    "number",
                    default=4000,
                    min=500,
                    max=100000,
                    step=500,
                ),
                _f(
                    "advanced.batch_size.slack",
                    "Slack 分批大小",
                    "number",
                    default=4000,
                    min=500,
                    max=100000,
                    step=500,
                ),
                _f(
                    "advanced.batch_send_interval",
                    "批次发送间隔（秒）",
                    "number",
                    default=3,
                    min=0,
                    max=60,
                    step=1,
                ),
                _f("advanced.feishu_message_separator", "飞书消息分隔符", "text"),
            ],
        },
    ],
}

SENSITIVE_PATHS = {
    field["path"]
    for group in SCHEMA["groups"]
    for field in group["fields"]
    if field.get("sensitive")
}


# ---------------------------------------------------------------------------
# 基础读写
# ---------------------------------------------------------------------------


def deep_get(data: Any, path: str, default: Any = None) -> Any:
    node = data
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return default
        node = node[part]
    return node


def deep_set(data: Dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    node = data
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[parts[-1]] = value


def deep_delete(data: Dict[str, Any], path: str) -> None:
    parts = path.split(".")
    node = data
    for part in parts[:-1]:
        if not isinstance(node, dict) or part not in node:
            return
        node = node[part]
    if isinstance(node, dict):
        node.pop(parts[-1], None)


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _backup(path: Path, label: str) -> Optional[str]:
    if not path.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = BACKUP_DIR / f"{stamp}-{label}"
    counter = 1
    while target.exists():
        target = BACKUP_DIR / f"{stamp}-{counter}-{label}"
        counter += 1
    shutil.copy2(path, target)
    _prune_backups()
    return str(target)


def _prune_backups(keep: int = 60) -> None:
    try:
        files = sorted(
            BACKUP_DIR.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True
        )
        for old in files[keep:]:
            old.unlink(missing_ok=True)
    except OSError:
        pass


def acme_challenge_file(token: str) -> Optional[Path]:
    """返回 ACME HTTP-01 校验文件；token 只允许安全字符。"""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", token or ""):
        return None
    base = (ACME_DIR / ".well-known" / "acme-challenge").resolve()
    target = (base / token).resolve()
    if base not in target.parents:
        return None
    return target if target.is_file() else None


def read_config() -> Dict[str, Any]:
    if not CONFIG_FILE.exists():
        raise FileNotFoundError(f"配置文件不存在: {CONFIG_FILE}")
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError("config.yaml 顶层必须是映射（键值对）")
    return data


def yaml_text(data: Any) -> str:
    return yaml.safe_dump(
        data,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=120,
    )


def write_config(data: Dict[str, Any]) -> Optional[str]:
    backup = _backup(CONFIG_FILE, "config.yaml")
    header = (
        "# TrendRadar 配置文件\n"
        f"# 由管理台于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 保存\n"
        "# 如需保留注释，请使用「原始 YAML」编辑器手动维护\n\n"
    )
    _atomic_write(CONFIG_FILE, header + yaml_text(data))
    return backup


# ---------------------------------------------------------------------------
# 表单值
# ---------------------------------------------------------------------------


def _hint(value: str) -> str:
    if not value:
        return ""
    tail = value[-4:] if len(value) > 4 else ""
    return f"已设置，尾号 {tail}" if tail else "已设置"


def mask_secret(value: Any) -> Tuple[str, str]:
    if not isinstance(value, str) or not value:
        return "", ""
    return "", _hint(value)


def collect_values(data: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """按 schema 提取值；敏感项返回空串并附带提示。"""
    values: Dict[str, Any] = {}
    hints: Dict[str, str] = {}
    for group in SCHEMA["groups"]:
        for field in group["fields"]:
            path = field["path"]
            value = deep_get(data, path, field.get("default"))
            if field.get("type") == "objectlist":
                value = copy.deepcopy(value) if isinstance(value, list) else []
                # 为缺省字段补齐默认值，避免前端把“未填写”误当成关闭
                normalized = []
                for entry in value:
                    if not isinstance(entry, dict):
                        continue
                    item = dict(entry)
                    for sub in field.get("item_fields", []):
                        key = sub["path"]
                        if key not in item:
                            if sub["type"] == "bool":
                                item[key] = bool(sub.get("default", True))
                            elif sub["type"] == "number":
                                item[key] = ""
                            else:
                                item[key] = ""
                    normalized.append(item)
                value = normalized
            elif field.get("type") == "yaml":
                value = value if isinstance(value, (dict, list)) else {}
            elif field.get("type") == "stringlist":
                value = value if isinstance(value, list) else []
            elif field.get("type") == "idlist":
                value = value if isinstance(value, list) else []
            elif field.get("type") == "order":
                value = value if isinstance(value, list) else field.get("default", [])

            if field.get("sensitive"):
                _, hint = mask_secret(value)
                if hint:
                    hints[path] = hint
                values[path] = ""
            else:
                values[path] = value
    return values, hints


def _coerce(field: Dict[str, Any], raw: Any) -> Tuple[Any, Optional[str]]:
    ftype = field["type"]
    label = field.get("label", field["path"])
    if ftype == "bool":
        if isinstance(raw, bool):
            return raw, None
        if isinstance(raw, str):
            return raw.strip().lower() in ("true", "1", "on", "yes"), None
        return bool(raw), None
    if ftype == "number":
        if raw is None or raw == "":
            return field.get("default"), None
        try:
            number = float(raw)
        except (TypeError, ValueError):
            return None, f"{label} 必须是数字"
        if number.is_integer() and field.get("step", 1) >= 1:
            number = int(number)
        lo, hi = field.get("min"), field.get("max")
        if lo is not None and number < lo:
            return None, f"{label} 不能小于 {lo}"
        if hi is not None and number > hi:
            return None, f"{label} 不能大于 {hi}"
        return number, None
    if ftype == "select":
        allowed = {opt["value"] for opt in field.get("options", [])}
        if raw not in allowed:
            return None, f"{label} 取值不合法"
        return raw, None
    if ftype == "stringlist":
        if isinstance(raw, list):
            items = [str(item).strip() for item in raw]
        elif raw in (None, ""):
            items = []
        else:
            items = [part.strip() for part in str(raw).replace("，", ",").split(",")]
        return [item for item in items if item], None
    if ftype == "idlist":
        if not isinstance(raw, list):
            return None, f"{label} 必须是列表"
        return [str(item).strip() for item in raw if str(item).strip()], None
    if ftype == "order":
        if not isinstance(raw, list):
            return None, f"{label} 必须是列表"
        return [str(item) for item in raw], None
    if ftype == "yaml":
        if raw in (None, ""):
            return {}, None
        if isinstance(raw, (dict, list)):
            return raw, None
        try:
            parsed = yaml.safe_load(str(raw)) or {}
        except yaml.YAMLError as exc:
            return None, f"{label} 不是合法 YAML: {exc}"
        if not isinstance(parsed, (dict, list)):
            return None, f"{label} 必须是键值对结构"
        return parsed, None
    if ftype == "objectlist":
        if not isinstance(raw, list):
            return None, f"{label} 必须是列表"
        items = []
        item_fields = field.get("item_fields", [])
        for index, entry in enumerate(raw):
            if not isinstance(entry, dict):
                return None, f"{label} 第 {index + 1} 项格式错误"
            item: Dict[str, Any] = {}
            for sub in item_fields:
                key = sub["path"]
                value = entry.get(key)
                if sub["type"] == "bool":
                    value = (
                        bool(value)
                        if value is not None
                        else bool(sub.get("default", True))
                    )
                elif sub["type"] == "number":
                    if value in (None, ""):
                        continue
                    try:
                        value = int(float(value))
                    except (TypeError, ValueError):
                        return (
                            None,
                            f"{label} 第 {index + 1} 项的「{sub['label']}」必须是数字",
                        )
                    if value < (sub.get("min") or 0):
                        return (
                            None,
                            f"{label} 第 {index + 1} 项的「{sub['label']}」不能小于 {sub.get('min')}",
                        )
                else:
                    value = "" if value is None else str(value).strip()
                    if sub.get("required") and not value:
                        return (
                            None,
                            f"{label} 第 {index + 1} 项的「{sub['label']}」不能为空",
                        )
                item[key] = value
            items.append(item)
        return items, None
    # text / password / textarea
    return ("" if raw is None else str(raw)), None


def _validate_cross(data: Dict[str, Any]) -> Dict[str, str]:
    """对合并后的完整配置做跨字段校验。"""
    errors: Dict[str, str] = {}
    timezone = str(deep_get(data, "app.timezone", "") or "").strip()
    if timezone and ZoneInfo is not None:
        try:
            ZoneInfo(timezone)
        except Exception:
            errors["app.timezone"] = (
                "时区名称无效，请使用 IANA 名称，例如 Asia/Shanghai"
            )

    weights = [
        float(deep_get(data, "advanced.weight.rank", 0) or 0),
        float(deep_get(data, "advanced.weight.frequency", 0) or 0),
        float(deep_get(data, "advanced.weight.hotness", 0) or 0),
    ]
    if abs(sum(weights) - 1.0) > 0.011:
        errors["advanced.weight.rank"] = "排名、频次、热度三项权重之和必须等于 1"

    platforms = deep_get(data, "platforms.sources", []) or []
    platform_ids = set()
    for item in platforms:
        pid = str(item.get("id", "")).strip()
        if not pid:
            errors["platforms.sources"] = "平台 ID 不能为空"
            break
        if pid in platform_ids:
            errors["platforms.sources"] = f"平台 ID 重复：{pid}"
            break
        platform_ids.add(pid)

    feeds = deep_get(data, "rss.feeds", []) or []
    feed_ids = set()
    for item in feeds:
        fid = str(item.get("id", "")).strip()
        if not fid:
            errors["rss.feeds"] = "RSS 源 ID 不能为空"
            break
        if fid in feed_ids:
            errors["rss.feeds"] = f"RSS 源 ID 重复：{fid}"
            break
        feed_ids.add(fid)
        url = str(item.get("url", "")).strip()
        if url:
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                errors["rss.feeds"] = (
                    f"RSS 源「{item.get('name') or fid}」的订阅地址必须是 http(s) URL"
                )
                break

    regions = deep_get(data, "display.region_order", []) or []
    valid = {"hotlist", "rss", "new_items", "standalone", "ai_analysis"}
    if len(regions) != len(set(regions)) or any(r not in valid for r in regions):
        errors["display.region_order"] = "区域顺序包含重复或非法项"

    for pid in deep_get(data, "display.standalone.platforms", []) or []:
        if str(pid) not in platform_ids:
            errors["display.standalone.platforms"] = f"平台 {pid} 不在数据源列表中"
            break
    for fid in deep_get(data, "display.standalone.rss_feeds", []) or []:
        if str(fid) not in feed_ids:
            errors["display.standalone.rss_feeds"] = f"RSS 源 {fid} 不在数据源列表中"
            break

    if deep_get(data, "storage.formats.sqlite", True) is False:
        errors["storage.formats.sqlite"] = "SQLite 是主存储，必须保持开启"

    token = str(deep_get(data, "notification.channels.telegram.bot_token", "") or "")
    chat_id = str(deep_get(data, "notification.channels.telegram.chat_id", "") or "")
    if token and not chat_id:
        errors["notification.channels.telegram.chat_id"] = (
            "配置了 Telegram Token 时必须填写 Chat ID"
        )

    smtp_port = str(
        deep_get(data, "notification.channels.email.smtp_port", "") or ""
    ).strip()
    if smtp_port and not smtp_port.isdigit():
        errors["notification.channels.email.smtp_port"] = "SMTP 端口必须是数字"

    data_dir = str(deep_get(data, "storage.local.data_dir", "") or "").strip()
    if (
        data_dir.startswith("/")
        or data_dir.startswith("\\")
        or ".." in Path(data_dir).parts
    ):
        errors["storage.local.data_dir"] = "数据目录必须是项目内的相对路径"

    return errors


def apply_values(
    base: Dict[str, Any], submitted: Dict[str, Any]
) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """把表单值合并进配置；返回新配置和字段错误。"""
    data = copy.deepcopy(base)
    errors: Dict[str, str] = {}

    for group in SCHEMA["groups"]:
        for field in group["fields"]:
            path = field["path"]
            if path not in submitted:
                continue
            raw = submitted[path]
            if field.get("sensitive"):
                if raw == CLEAR_TOKEN:
                    deep_set(data, path, "")
                    continue
                if raw is None or (isinstance(raw, str) and raw == ""):
                    # 留空表示保留原值
                    continue
            value, error = _coerce(field, raw)
            if error:
                errors[path] = error
                continue
            if field["type"] == "objectlist" and isinstance(value, list):
                # 保留原条目里的其他未知字段，避免升级配置后丢参数
                existing = deep_get(data, path, []) or []
                by_id = {
                    str(item.get("id", "")): item
                    for item in existing
                    if isinstance(item, dict)
                }
                merged = []
                for item in value:
                    base_item = dict(by_id.get(str(item.get("id", "")), {}))
                    base_item.update(item)
                    merged.append(base_item)
                value = merged
            deep_set(data, path, value)

    errors.update(_validate_cross(data))
    return data, errors


def validation_summary(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """对当前配置做轻量体检，返回提示列表。"""
    notes: List[Dict[str, str]] = []
    if not deep_get(data, "notification.enabled", True):
        notes.append(
            {"level": "warn", "text": "通知总开关处于关闭状态，运行结果不会推送。"}
        )
    if not deep_get(data, "storage.formats.html", True):
        notes.append(
            {"level": "warn", "text": "HTML 报告已关闭，管理台将看不到网页版报告。"}
        )
    if deep_get(data, "schedule.enabled", False):
        notes.append(
            {"level": "info", "text": "时间线调度已启用，实际推送时机由所选模板决定。"}
        )
    if deep_get(data, "filter.method") == "ai" and not deep_get(data, "ai.api_key"):
        notes.append({"level": "warn", "text": "筛选方式为 AI，但未配置 API Key。"})
    if deep_get(data, "ai_analysis.enabled") and not deep_get(data, "ai.api_key"):
        notes.append({"level": "warn", "text": "AI 分析已启用，但未配置 API Key。"})
    enabled_channels = []
    for name, label in (
        ("feishu", "飞书"),
        ("dingtalk", "钉钉"),
        ("wework", "企业微信"),
        ("telegram", "Telegram"),
        ("email", "邮件"),
        ("ntfy", "ntfy"),
        ("bark", "Bark"),
        ("slack", "Slack"),
        ("generic_webhook", "通用 Webhook"),
    ):
        channel = deep_get(data, f"notification.channels.{name}", {}) or {}
        if any(str(v).strip() for v in channel.values() if isinstance(v, str)):
            enabled_channels.append(label)
    if not enabled_channels:
        notes.append({"level": "warn", "text": "尚未配置任何推送渠道。"})
    return notes


# ---------------------------------------------------------------------------
# 文本文件
# ---------------------------------------------------------------------------


def text_file_path(name: str) -> Path:
    meta = TEXT_FILES.get(name)
    if not meta:
        raise KeyError(f"不允许编辑该文件: {name}")
    target = (CONFIG_DIR / meta["path"]).resolve()
    if CONFIG_DIR.resolve() not in target.parents and target != CONFIG_DIR.resolve():
        raise ValueError("文件路径越界")
    return target


def read_text(name: str) -> Dict[str, Any]:
    meta = TEXT_FILES[name]
    path = text_file_path(name)
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    stat = path.stat() if path.exists() else None
    return {
        "name": name,
        "label": meta["label"],
        "kind": meta["kind"],
        "content": content,
        "path": f"config/{meta['path']}",
        "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        if stat
        else None,
        "size": stat.st_size if stat else 0,
    }


def write_text(name: str, content: str) -> Optional[str]:
    meta = TEXT_FILES[name]
    path = text_file_path(name)
    if meta["kind"] == "yaml":
        try:
            parsed = yaml.safe_load(content)
        except yaml.YAMLError as exc:
            raise ValueError(f"YAML 语法错误: {exc}")
        if parsed is None or not isinstance(parsed, dict):
            raise ValueError("YAML 顶层必须是非空的键值对结构")
    if meta["kind"] == "keyword":
        if len(content) > 2_000_000:
            raise ValueError("文件过大")
    if not content.endswith("\n"):
        content += "\n"
    backup = _backup(path, meta["path"].replace("/", "_"))
    _atomic_write(path, content)
    return backup


KEYWORD_FILE = CONFIG_DIR / "frequency_words.txt"


def parse_keywords(content: str) -> Dict[str, Any]:
    """把关键词文件解析成结构化词组，保留每行原始语法（+、!、@、正则、=> 别名）。"""
    chunks = [
        g.strip() for g in content.replace("\r\n", "\n").split("\n\n") if g.strip()
    ]
    section = "WORD_GROUPS"
    groups: List[Dict[str, Any]] = []
    global_filters: List[str] = []
    warnings: List[str] = []

    for chunk in chunks:
        lines = [
            line.strip()
            for line in chunk.split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]
        if not lines:
            continue
        first = lines[0]
        if first.startswith("[") and first.endswith("]"):
            name = first[1:-1].strip()
            if name.upper() in ("GLOBAL_FILTER", "WORD_GROUPS"):
                section = name.upper()
                lines = lines[1:]
                if not lines:
                    continue
        if section == "GLOBAL_FILTER":
            for line in lines:
                if line.startswith(("!", "+", "@")):
                    warnings.append(f"全局过滤区会忽略特殊前缀：{line}")
                    continue
                global_filters.append(line)
            continue

        alias = ""
        if lines[0].startswith("[") and lines[0].endswith("]"):
            alias = lines[0][1:-1].strip()
            lines = lines[1:]
        max_count = 0
        items: List[str] = []
        for line in lines:
            if line.startswith("@"):
                try:
                    value = int(line[1:])
                except ValueError:
                    warnings.append(f"无效的数量标记：{line}")
                    continue
                if value > 0:
                    max_count = value
                continue
            if line in ("!", "+"):
                warnings.append(f"空词条已忽略：{line}")
                continue
            items.append(line)
        if not items and not alias:
            continue
        groups.append({"alias": alias, "max_count": max_count, "items": items})

    return {
        "groups": groups,
        "global_filters": global_filters,
        "warnings": warnings,
    }


def read_keywords() -> Dict[str, Any]:
    if not KEYWORD_FILE.exists():
        raise FileNotFoundError(f"关键词文件不存在：{KEYWORD_FILE}")
    content = KEYWORD_FILE.read_text(encoding="utf-8")
    parsed = parse_keywords(content)
    stat = KEYWORD_FILE.stat()
    parsed.update(
        {
            "path": "config/frequency_words.txt",
            "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "size": stat.st_size,
            "stats": {
                "groups": len(parsed["groups"]),
                "items": sum(len(g["items"]) for g in parsed["groups"]),
                "filters": len(parsed["global_filters"]),
            },
        }
    )
    return parsed


def normalize_keywords(
    payload: Dict[str, Any],
) -> Tuple[Optional[Dict[str, Any]], Dict[str, str], List[str]]:
    """校验并规范化页面提交的关键词数据。"""
    errors: Dict[str, str] = {}
    warnings: List[str] = []
    if not isinstance(payload.get("groups"), list):
        return None, {"groups": "词组必须是列表"}, warnings

    groups: List[Dict[str, Any]] = []
    for index, raw in enumerate(payload["groups"]):
        if not isinstance(raw, dict):
            errors[f"groups.{index}"] = "词组格式错误"
            continue
        alias = str(raw.get("alias") or "").strip()
        if "[" in alias or "]" in alias:
            errors[f"groups.{index}.alias"] = "组别名不能包含方括号"
        if len(alias) > 50:
            errors[f"groups.{index}.alias"] = "组别名不能超过 50 个字符"
        try:
            max_count = int(raw.get("max_count") or 0)
        except (TypeError, ValueError):
            errors[f"groups.{index}.max_count"] = "最大条数必须是整数"
            continue
        if max_count < 0 or max_count > 999:
            errors[f"groups.{index}.max_count"] = (
                "最大条数需在 0-999 之间（0 表示不限）"
            )

        raw_items = raw.get("items")
        if isinstance(raw_items, str):
            items = [
                line.strip() for line in raw_items.replace("\r\n", "\n").split("\n")
            ]
        elif isinstance(raw_items, list):
            items = [str(item).strip() for item in raw_items]
        else:
            errors[f"groups.{index}.items"] = "词条格式错误"
            continue
        items = [item for item in items if item]
        for item in items:
            if item.startswith("@"):
                errors[f"groups.{index}.items"] = (
                    "最大条数请填在「最大条数」字段，不要写进词条"
                )
                break
            if len(item) > 200:
                errors[f"groups.{index}.items"] = "单条词条不能超过 200 个字符"
                break
            check = item[1:] if item.startswith(("!", "+")) else item
            check = check.split("=>")[0].strip()
            if check.startswith("/"):
                match = re.match(r"^/(.+)/[a-z]*$", check)
                if not match:
                    errors[f"groups.{index}.items"] = f"正则表达式未闭合：{item}"
                    break
                try:
                    re.compile(match.group(1))
                except re.error as exc:
                    errors[f"groups.{index}.items"] = f"正则表达式无效：{item}（{exc}）"
                    break
            if item.startswith("!"):
                warnings.append(f"过滤词「{item[1:]}」会对所有标题生效（不仅当前词组）")
        if not items and not alias:
            continue
        groups.append({"alias": alias, "max_count": max_count, "items": items})

    global_filters: List[str] = []
    raw_filters = payload.get("global_filters")
    if isinstance(raw_filters, str):
        raw_filters = raw_filters.replace("\r\n", "\n").split("\n")
    if isinstance(raw_filters, list):
        for item in raw_filters:
            value = str(item).strip()
            if not value:
                continue
            if value.startswith(("!", "+", "@")):
                errors["global_filters"] = "全局过滤词不要加 !、+、@ 前缀"
                break
            check = value.split("=>")[0].strip()
            if check.startswith("/"):
                match = re.match(r"^/(.+)/[a-z]*$", check)
                if not match:
                    errors["global_filters"] = f"正则表达式未闭合：{value}"
                    break
                try:
                    re.compile(match.group(1))
                except re.error as exc:
                    errors["global_filters"] = f"正则表达式无效：{value}（{exc}）"
                    break
            global_filters.append(value)

    if not groups and not global_filters:
        warnings.append("当前没有任何关键词规则，采集程序会匹配所有标题")
    if errors:
        return None, errors, warnings
    return {"groups": groups, "global_filters": global_filters}, {}, warnings


def serialize_keywords(groups: List[Dict[str, Any]], global_filters: List[str]) -> str:
    lines = [
        "# TrendRadar 关键词规则",
        "# 由管理台维护：每个词组之间用空行分隔；[组别名] 为显示名称",
        "# 词条语法：+必须词  !过滤词（全局生效）  @数字最大条数  /正则/  => 显示别名",
        "",
        "[GLOBAL_FILTER]",
    ]
    lines.extend(global_filters)
    lines.extend(["", "[WORD_GROUPS]", ""])
    for group in groups:
        alias = str(group.get("alias") or "").strip()
        if alias:
            lines.append(f"[{alias}]")
        max_count = int(group.get("max_count") or 0)
        if max_count > 0:
            lines.append(f"@{max_count}")
        lines.extend(group.get("items") or [])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def save_keywords(payload: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    normalized, errors, warnings = normalize_keywords(payload)
    if errors or normalized is None:
        return False, {"errors": errors}
    content = serialize_keywords(normalized["groups"], normalized["global_filters"])
    backup = _backup(KEYWORD_FILE, "frequency_words.txt")
    _atomic_write(KEYWORD_FILE, content)
    stat = KEYWORD_FILE.stat()
    return True, {
        "saved_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "backup": Path(backup).name if backup else None,
        "stats": {
            "groups": len(normalized["groups"]),
            "items": sum(len(g["items"]) for g in normalized["groups"]),
            "filters": len(normalized["global_filters"]),
        },
        "warnings": warnings,
    }


def keyword_preview(content: str) -> Dict[str, Any]:
    """独立解析关键词文件，返回分组统计与错误，不依赖运行环境。

    规则与 trendradar/core/frequency.py 保持一致：
    - [GLOBAL_FILTER] / [WORD_GROUPS] 切换区域；
    - 其他 [xxx] 是词组别名，不是错误；
    - 词组由空行分隔。
    """
    groups = [
        g.strip() for g in content.replace("\r\n", "\n").split("\n\n") if g.strip()
    ]
    section = "WORD_GROUPS"
    result = {"groups": [], "global_filters": [], "errors": []}
    for group in groups:
        lines = [
            line.strip()
            for line in group.split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]
        if not lines:
            continue
        if lines[0].startswith("[") and lines[0].endswith("]"):
            name = lines[0][1:-1].upper()
            if name in ("GLOBAL_FILTER", "WORD_GROUPS"):
                section = name
                lines = lines[1:]
                if not lines:
                    continue
        if section == "GLOBAL_FILTER":
            for line in lines:
                if not line.startswith(("!", "+", "@")):
                    result["global_filters"].append(line)
            continue
        title = None
        words: List[str] = []
        for line in lines:
            if line.startswith("[") and line.endswith("]"):
                title = line[1:-1]
                continue
            if line.startswith("@"):
                continue
            words.append(line)
            check = line.split("=>")[0].strip()
            if check.startswith("/") and not re.match(r"^/.+/[a-z]*$", check):
                result["errors"].append(f"正则表达式未闭合: {line}")
        if not words and not title:
            continue
        result["groups"].append(
            {"title": title or "未命名词组", "words": words, "count": len(words)}
        )
    return result


# ---------------------------------------------------------------------------
# 设置 / 状态
# ---------------------------------------------------------------------------

DEFAULT_SETTINGS: Dict[str, Any] = {
    "cron": "*/30 * * * *",
    "run_mode": "cron",
    "immediate_run": False,
    "allow_ips": [],
    "public_url": "",
    "domain": "",
    "https_enabled": False,
    "https_cert": "data/tls/fullchain.pem",
    "https_key": "data/tls/privkey.pem",
    "https_email": "",
}


def load_settings() -> Dict[str, Any]:
    settings = dict(DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            stored = json.load(f)
        if isinstance(stored, dict):
            settings.update(stored)
    except (OSError, ValueError):
        pass
    return settings


def save_settings(settings: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = SETTINGS_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    os.replace(tmp, SETTINGS_FILE)


def load_state() -> Dict[str, Any]:
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (OSError, ValueError):
        pass
    return {}


def save_state(state: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)


def project_info() -> Dict[str, Any]:
    version_file = PROJECT_ROOT / "version"
    version = ""
    try:
        version = version_file.read_text(encoding="utf-8").strip()
    except OSError:
        version = "unknown"
    return {
        "root": str(PROJECT_ROOT),
        "config_file": str(CONFIG_FILE),
        "version": version,
        "now": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
