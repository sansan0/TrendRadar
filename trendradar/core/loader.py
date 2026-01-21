# coding=utf-8
"""
配置加载模块

负责从 YAML 配置文件和环境变量加载配置。
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

import yaml

from .config import parse_multi_account_config, validate_paired_configs


def _get_env_bool(key: str, default: bool = False) -> Optional[bool]:
    """从环境变量获取布尔值，如果未设置返回 None"""
    value = os.environ.get(key, "").strip().lower()
    if not value:
        return None
    return value in ("true", "1")


def _get_env_int(key: str, default: int = 0) -> int:
    """从环境变量获取整数值"""
    value = os.environ.get(key, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _get_env_int_or_none(key: str) -> Optional[int]:
    """从环境变量获取整数值，未设置时返回 None"""
    value = os.environ.get(key, "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _get_env_str(key: str, default: str = "") -> str:
    """从环境变量获取字符串值"""
    return os.environ.get(key, "").strip() or default


def _load_app_config(config_data: Dict) -> Dict:
    """加载应用配置"""
    app_config = config_data.get("app", {})
    advanced = config_data.get("advanced", {})
    return {
        "VERSION_CHECK_URL": advanced.get("version_check_url", ""),
        "SHOW_VERSION_UPDATE": app_config.get("show_version_update", True),
        "TIMEZONE": _get_env_str("TIMEZONE") or app_config.get("timezone", "Asia/Shanghai"),
        "DEBUG": _get_env_bool("DEBUG") if _get_env_bool("DEBUG") is not None else advanced.get("debug", False),
    }


def _load_crawler_config(config_data: Dict) -> Dict:
    """加载爬虫配置"""
    advanced = config_data.get("advanced", {})
    crawler_config = advanced.get("crawler", {})
    platforms_config = config_data.get("platforms", {})
    return {
        "REQUEST_INTERVAL": crawler_config.get("request_interval", 100),
        "USE_PROXY": crawler_config.get("use_proxy", False),
        "DEFAULT_PROXY": crawler_config.get("default_proxy", ""),
        "ENABLE_CRAWLER": platforms_config.get("enabled", True),
    }


def _load_report_config(config_data: Dict) -> Dict:
    """加载报告配置"""
    report_config = config_data.get("report", {})

    # 环境变量覆盖
    sort_by_position_env = _get_env_bool("SORT_BY_POSITION_FIRST")
    max_news_env = _get_env_int("MAX_NEWS_PER_KEYWORD")

    return {
        "REPORT_MODE": report_config.get("mode", "daily"),
        "DISPLAY_MODE": report_config.get("display_mode", "keyword"),
        "RANK_THRESHOLD": report_config.get("rank_threshold", 10),
        "SORT_BY_POSITION_FIRST": sort_by_position_env if sort_by_position_env is not None else report_config.get("sort_by_position_first", False),
        "MAX_NEWS_PER_KEYWORD": max_news_env or report_config.get("max_news_per_keyword", 0),
    }


def _load_notification_config(config_data: Dict) -> Dict:
    """加载通知配置"""
    notification = config_data.get("notification", {})
    advanced = config_data.get("advanced", {})
    batch_size = advanced.get("batch_size", {})

    return {
        "ENABLE_NOTIFICATION": notification.get("enabled", True),
        "MESSAGE_BATCH_SIZE": batch_size.get("default", 4000),
        "DINGTALK_BATCH_SIZE": batch_size.get("dingtalk", 20000),
        "FEISHU_BATCH_SIZE": batch_size.get("feishu", 29000),
        "BARK_BATCH_SIZE": batch_size.get("bark", 3600),
        "SLACK_BATCH_SIZE": batch_size.get("slack", 4000),
        "BATCH_SEND_INTERVAL": advanced.get("batch_send_interval", 1.0),
        "FEISHU_MESSAGE_SEPARATOR": advanced.get("feishu_message_separator", "---"),
        "MAX_ACCOUNTS_PER_CHANNEL": _get_env_int("MAX_ACCOUNTS_PER_CHANNEL") or advanced.get("max_accounts_per_channel", 3),
    }


def _load_push_window_config(config_data: Dict) -> Dict:
    """加载推送窗口配置"""
    notification = config_data.get("notification", {})
    push_window = notification.get("push_window", {})

    enabled_env = _get_env_bool("PUSH_WINDOW_ENABLED")
    once_per_day_env = _get_env_bool("PUSH_WINDOW_ONCE_PER_DAY")

    return {
        "ENABLED": enabled_env if enabled_env is not None else push_window.get("enabled", False),
        "TIME_RANGE": {
            "START": _get_env_str("PUSH_WINDOW_START") or push_window.get("start", "08:00"),
            "END": _get_env_str("PUSH_WINDOW_END") or push_window.get("end", "22:00"),
        },
        "ONCE_PER_DAY": once_per_day_env if once_per_day_env is not None else push_window.get("once_per_day", True),
    }


def _load_weight_config(config_data: Dict) -> Dict:
    """加载权重配置"""
    advanced = config_data.get("advanced", {})
    weight = advanced.get("weight", {})
    return {
        "RANK_WEIGHT": weight.get("rank", 0.6),
        "FREQUENCY_WEIGHT": weight.get("frequency", 0.3),
        "HOTNESS_WEIGHT": weight.get("hotness", 0.1),
    }


def _load_rss_config(config_data: Dict) -> Dict:
    """加载 RSS 配置"""
    rss = config_data.get("rss", {})
    advanced = config_data.get("advanced", {})
    advanced_rss = advanced.get("rss", {})
    advanced_crawler = advanced.get("crawler", {})

    # RSS 代理配置：优先使用 RSS 专属代理，否则复用 crawler 的 default_proxy
    rss_proxy_url = advanced_rss.get("proxy_url", "") or advanced_crawler.get("default_proxy", "")

    # 新鲜度过滤配置
    freshness_filter = rss.get("freshness_filter", {})

    # 验证并设置 max_age_days 默认值
    raw_max_age = freshness_filter.get("max_age_days", 3)
    try:
        max_age_days = int(raw_max_age)
        if max_age_days < 0:
            print(f"[警告] RSS freshness_filter.max_age_days 为负数 ({max_age_days})，使用默认值 3")
            max_age_days = 3
    except (ValueError, TypeError):
        print(f"[警告] RSS freshness_filter.max_age_days 格式错误 ({raw_max_age})，使用默认值 3")
        max_age_days = 3

    # RSS 配置直接从 config.yaml 读取，不再支持环境变量
    return {
        "ENABLED": rss.get("enabled", False),
        "REQUEST_INTERVAL": advanced_rss.get("request_interval", 2000),
        "TIMEOUT": advanced_rss.get("timeout", 15),
        "USE_PROXY": advanced_rss.get("use_proxy", False),
        "PROXY_URL": rss_proxy_url,
        "FEEDS": rss.get("feeds", []),
        "FRESHNESS_FILTER": {
            "ENABLED": freshness_filter.get("enabled", True),  # 默认启用
            "MAX_AGE_DAYS": max_age_days,
        },
    }


def _load_display_config(config_data: Dict) -> Dict:
    """加载推送内容显示配置"""
    display = config_data.get("display", {})
    regions = display.get("regions", {})
    standalone = display.get("standalone", {})

    # 默认区域顺序
    default_region_order = ["hotlist", "rss", "new_items", "standalone", "ai_analysis"]
    region_order = display.get("region_order", default_region_order)

    # 验证 region_order 中的值是否合法
    valid_regions = {"hotlist", "rss", "new_items", "standalone", "ai_analysis"}
    region_order = [r for r in region_order if r in valid_regions]

    # 如果过滤后为空，使用默认顺序
    if not region_order:
        region_order = default_region_order

    return {
        # 区域显示顺序
        "REGION_ORDER": region_order,
        # 区域开关
        "REGIONS": {
            "HOTLIST": regions.get("hotlist", True),
            "NEW_ITEMS": regions.get("new_items", True),
            "RSS": regions.get("rss", True),
            "STANDALONE": regions.get("standalone", False),
            "AI_ANALYSIS": regions.get("ai_analysis", True),
        },
        # 独立展示区配置
        "STANDALONE": {
            "PLATFORMS": standalone.get("platforms", []),
            "RSS_FEEDS": standalone.get("rss_feeds", []),
            "MAX_ITEMS": standalone.get("max_items", 20),
        },
    }


def _load_ai_config(config_data: Dict) -> Dict:
    """加载 AI 模型配置（LiteLLM 格式）"""
    ai_config = config_data.get("ai", {})

    timeout_env = _get_env_int_or_none("AI_TIMEOUT")

    return {
        # LiteLLM 核心配置
        "MODEL": _get_env_str("AI_MODEL") or ai_config.get("model", "deepseek/deepseek-chat"),
        "API_KEY": _get_env_str("AI_API_KEY") or ai_config.get("api_key", ""),
        "API_BASE": _get_env_str("AI_API_BASE") or ai_config.get("api_base", ""),

        # 生成参数
        "TIMEOUT": timeout_env if timeout_env is not None else ai_config.get("timeout", 120),
        "TEMPERATURE": ai_config.get("temperature", 1.0),
        "MAX_TOKENS": ai_config.get("max_tokens", 5000),

        # LiteLLM 高级选项
        "NUM_RETRIES": ai_config.get("num_retries", 2),
        "FALLBACK_MODELS": ai_config.get("fallback_models", []),
        "EXTRA_PARAMS": ai_config.get("extra_params", {}),
    }


def _load_ai_analysis_config(config_data: Dict) -> Dict:
    """加载 AI 分析配置（功能配置，模型配置见 _load_ai_config）"""
    ai_config = config_data.get("ai_analysis", {})

    enabled_env = _get_env_bool("AI_ANALYSIS_ENABLED")

    return {
        "ENABLED": enabled_env if enabled_env is not None else ai_config.get("enabled", False),
        "LANGUAGE": ai_config.get("language", "Chinese"),
        "PROMPT_FILE": ai_config.get("prompt_file", "ai_analysis_prompt.txt"),
        "MAX_NEWS_FOR_ANALYSIS": ai_config.get("max_news_for_analysis", 50),
        "INCLUDE_RSS": ai_config.get("include_rss", True),
        "INCLUDE_RANK_TIMELINE": ai_config.get("include_rank_timeline", False),
    }


def _load_ai_translation_config(config_data: Dict) -> Dict:
    """加载 AI 翻译配置（功能配置，模型配置见 _load_ai_config）"""
    trans_config = config_data.get("ai_translation", {})

    enabled_env = _get_env_bool("AI_TRANSLATION_ENABLED")

    return {
        "ENABLED": enabled_env if enabled_env is not None else trans_config.get("enabled", False),
        "LANGUAGE": _get_env_str("AI_TRANSLATION_LANGUAGE") or trans_config.get("language", "English"),
        "PROMPT_FILE": trans_config.get("prompt_file", "ai_translation_prompt.txt"),
    }


def _load_storage_config(config_data: Dict) -> Dict:
    """加载存储配置"""
    storage = config_data.get("storage", {})
    formats = storage.get("formats", {})
    local = storage.get("local", {})
    remote = storage.get("remote", {})
    pull = storage.get("pull", {})

    txt_enabled_env = _get_env_bool("STORAGE_TXT_ENABLED")
    html_enabled_env = _get_env_bool("STORAGE_HTML_ENABLED")
    pull_enabled_env = _get_env_bool("PULL_ENABLED")

    return {
        "BACKEND": _get_env_str("STORAGE_BACKEND") or storage.get("backend", "auto"),
        "FORMATS": {
            "SQLITE": formats.get("sqlite", True),
            "TXT": txt_enabled_env if txt_enabled_env is not None else formats.get("txt", True),
            "HTML": html_enabled_env if html_enabled_env is not None else formats.get("html", True),
        },
        "LOCAL": {
            "DATA_DIR": local.get("data_dir", "output"),
            "RETENTION_DAYS": _get_env_int("LOCAL_RETENTION_DAYS") or local.get("retention_days", 0),
        },
        "REMOTE": {
            "ENDPOINT_URL": _get_env_str("S3_ENDPOINT_URL") or remote.get("endpoint_url", ""),
            "BUCKET_NAME": _get_env_str("S3_BUCKET_NAME") or remote.get("bucket_name", ""),
            "ACCESS_KEY_ID": _get_env_str("S3_ACCESS_KEY_ID") or remote.get("access_key_id", ""),
            "SECRET_ACCESS_KEY": _get_env_str("S3_SECRET_ACCESS_KEY") or remote.get("secret_access_key", ""),
            "REGION": _get_env_str("S3_REGION") or remote.get("region", ""),
            "RETENTION_DAYS": _get_env_int("REMOTE_RETENTION_DAYS") or remote.get("retention_days", 0),
        },
        "PULL": {
            "ENABLED": pull_enabled_env if pull_enabled_env is not None else pull.get("enabled", False),
            "DAYS": _get_env_int("PULL_DAYS") or pull.get("days", 7),
        },
    }


def _load_webhook_config(config_data: Dict) -> Dict:
    """加载 Webhook 配置"""
    notification = config_data.get("notification", {})
    channels = notification.get("channels", {})

    # 各渠道配置
    feishu = channels.get("feishu", {})
    dingtalk = channels.get("dingtalk", {})
    wework = channels.get("wework", {})
    telegram = channels.get("telegram", {})
    email = channels.get("email", {})
    ntfy = channels.get("ntfy", {})
    bark = channels.get("bark", {})
    slack = channels.get("slack", {})
    generic = channels.get("generic_webhook", {})

    return {
        # 飞书
        "FEISHU_WEBHOOK_URL": _get_env_str("FEISHU_WEBHOOK_URL") or feishu.get("webhook_url", ""),
        # 钉钉
        "DINGTALK_WEBHOOK_URL": _get_env_str("DINGTALK_WEBHOOK_URL") or dingtalk.get("webhook_url", ""),
        # 企业微信
        "WEWORK_WEBHOOK_URL": _get_env_str("WEWORK_WEBHOOK_URL") or wework.get("webhook_url", ""),
        "WEWORK_MSG_TYPE": _get_env_str("WEWORK_MSG_TYPE") or wework.get("msg_type", "markdown"),
        # Telegram
        "TELEGRAM_BOT_TOKEN": _get_env_str("TELEGRAM_BOT_TOKEN") or telegram.get("bot_token", ""),
        "TELEGRAM_CHAT_ID": _get_env_str("TELEGRAM_CHAT_ID") or telegram.get("chat_id", ""),
        # 邮件
        "EMAIL_FROM": _get_env_str("EMAIL_FROM") or email.get("from", ""),
        "EMAIL_PASSWORD": _get_env_str("EMAIL_PASSWORD") or email.get("password", ""),
        "EMAIL_TO": _get_env_str("EMAIL_TO") or email.get("to", ""),
        "EMAIL_SMTP_SERVER": _get_env_str("EMAIL_SMTP_SERVER") or email.get("smtp_server", ""),
        "EMAIL_SMTP_PORT": _get_env_str("EMAIL_SMTP_PORT") or email.get("smtp_port", ""),
        # ntfy
        "NTFY_SERVER_URL": _get_env_str("NTFY_SERVER_URL") or ntfy.get("server_url") or "https://ntfy.sh",
        "NTFY_TOPIC": _get_env_str("NTFY_TOPIC") or ntfy.get("topic", ""),
        "NTFY_TOKEN": _get_env_str("NTFY_TOKEN") or ntfy.get("token", ""),
        # Bark
        "BARK_URL": _get_env_str("BARK_URL") or bark.get("url", ""),
        # Slack
        "SLACK_WEBHOOK_URL": _get_env_str("SLACK_WEBHOOK_URL") or slack.get("webhook_url", ""),
        # 通用 Webhook
        "GENERIC_WEBHOOK_URL": _get_env_str("GENERIC_WEBHOOK_URL") or generic.get("webhook_url", ""),
        "GENERIC_WEBHOOK_TEMPLATE": _get_env_str("GENERIC_WEBHOOK_TEMPLATE") or generic.get("payload_template", ""),
    }


def _print_notification_sources(config: Dict) -> None:
    """打印通知渠道配置来源信息"""
    notification_sources = []
    max_accounts = config["MAX_ACCOUNTS_PER_CHANNEL"]

    if config["FEISHU_WEBHOOK_URL"]:
        accounts = parse_multi_account_config(config["FEISHU_WEBHOOK_URL"])
        count = min(len(accounts), max_accounts)
        source = "环境变量" if os.environ.get("FEISHU_WEBHOOK_URL") else "配置文件"
        notification_sources.append(f"飞书({source}, {count}个账号)")

    if config["DINGTALK_WEBHOOK_URL"]:
        accounts = parse_multi_account_config(config["DINGTALK_WEBHOOK_URL"])
        count = min(len(accounts), max_accounts)
        source = "环境变量" if os.environ.get("DINGTALK_WEBHOOK_URL") else "配置文件"
        notification_sources.append(f"钉钉({source}, {count}个账号)")

    if config["WEWORK_WEBHOOK_URL"]:
        accounts = parse_multi_account_config(config["WEWORK_WEBHOOK_URL"])
        count = min(len(accounts), max_accounts)
        source = "环境变量" if os.environ.get("WEWORK_WEBHOOK_URL") else "配置文件"
        notification_sources.append(f"企业微信({source}, {count}个账号)")

    if config["TELEGRAM_BOT_TOKEN"] and config["TELEGRAM_CHAT_ID"]:
        tokens = parse_multi_account_config(config["TELEGRAM_BOT_TOKEN"])
        chat_ids = parse_multi_account_config(config["TELEGRAM_CHAT_ID"])
        valid, count = validate_paired_configs(
            {"bot_token": tokens, "chat_id": chat_ids},
            "Telegram",
            required_keys=["bot_token", "chat_id"]
        )
        if valid and count > 0:
            count = min(count, max_accounts)
            token_source = "环境变量" if os.environ.get("TELEGRAM_BOT_TOKEN") else "配置文件"
            notification_sources.append(f"Telegram({token_source}, {count}个账号)")

    if config["EMAIL_FROM"] and config["EMAIL_PASSWORD"] and config["EMAIL_TO"]:
        from_source = "环境变量" if os.environ.get("EMAIL_FROM") else "配置文件"
        notification_sources.append(f"邮件({from_source})")

    if config["NTFY_SERVER_URL"] and config["NTFY_TOPIC"]:
        topics = parse_multi_account_config(config["NTFY_TOPIC"])
        tokens = parse_multi_account_config(config["NTFY_TOKEN"])
        if tokens:
            valid, count = validate_paired_configs(
                {"topic": topics, "token": tokens},
                "ntfy"
            )
            if valid and count > 0:
                count = min(count, max_accounts)
                server_source = "环境变量" if os.environ.get("NTFY_SERVER_URL") else "配置文件"
                notification_sources.append(f"ntfy({server_source}, {count}个账号)")
        else:
            count = min(len(topics), max_accounts)
            server_source = "环境变量" if os.environ.get("NTFY_SERVER_URL") else "配置文件"
            notification_sources.append(f"ntfy({server_source}, {count}个账号)")

    if config["BARK_URL"]:
        accounts = parse_multi_account_config(config["BARK_URL"])
        count = min(len(accounts), max_accounts)
        bark_source = "环境变量" if os.environ.get("BARK_URL") else "配置文件"
        notification_sources.append(f"Bark({bark_source}, {count}个账号)")

    if config["SLACK_WEBHOOK_URL"]:
        accounts = parse_multi_account_config(config["SLACK_WEBHOOK_URL"])
        count = min(len(accounts), max_accounts)
        slack_source = "环境变量" if os.environ.get("SLACK_WEBHOOK_URL") else "配置文件"
        notification_sources.append(f"Slack({slack_source}, {count}个账号)")

    if config.get("GENERIC_WEBHOOK_URL"):
        accounts = parse_multi_account_config(config["GENERIC_WEBHOOK_URL"])
        count = min(len(accounts), max_accounts)
        source = "环境变量" if os.environ.get("GENERIC_WEBHOOK_URL") else "配置文件"
        notification_sources.append(f"通用Webhook({source}, {count}个账号)")

    if notification_sources:
        print(f"通知渠道配置来源: {', '.join(notification_sources)}")
        print(f"每个渠道最大账号数: {max_accounts}")
    else:
        print("未配置任何通知渠道")


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    加载配置文件

    Args:
        config_path: 配置文件路径，默认从环境变量 CONFIG_PATH 获取或使用 config/config.yaml

    Returns:
        包含所有配置的字典

    Raises:
        FileNotFoundError: 配置文件不存在
    """
    if config_path is None:
        config_path = os.environ.get("CONFIG_PATH", "config/config.yaml")

    if not Path(config_path).exists():
        raise FileNotFoundError(f"配置文件 {config_path} 不存在")

    with open(config_path, "r", encoding="utf-8") as f:
        config_data = yaml.safe_load(f)

    print(f"配置文件加载成功: {config_path}")

    # 合并所有配置
    config = {}

    # 应用配置
    config.update(_load_app_config(config_data))

    # 爬虫配置
    config.update(_load_crawler_config(config_data))

    # 报告配置
    config.update(_load_report_config(config_data))

    # 通知配置
    config.update(_load_notification_config(config_data))

    # 推送窗口配置
    config["PUSH_WINDOW"] = _load_push_window_config(config_data)

    # 权重配置
    config["WEIGHT_CONFIG"] = _load_weight_config(config_data)

    # 平台配置
    platforms_config = config_data.get("platforms", {})
    config["PLATFORMS"] = platforms_config.get("sources", [])

    # RSS 配置
    config["RSS"] = _load_rss_config(config_data)

    # AI 模型共享配置
    config["AI"] = _load_ai_config(config_data)

    # AI 分析配置
    config["AI_ANALYSIS"] = _load_ai_analysis_config(config_data)

    # AI 翻译配置
    config["AI_TRANSLATION"] = _load_ai_translation_config(config_data)

    # 推送内容显示配置
    config["DISPLAY"] = _load_display_config(config_data)

    # 存储配置
    config["STORAGE"] = _load_storage_config(config_data)

    # Webhook 配置
    config.update(_load_webhook_config(config_data))

    # 打印通知渠道配置来源
    _print_notification_sources(config)

    return config
