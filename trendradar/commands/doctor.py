# coding=utf-8
"""环境体检命令"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from trendradar import __version__
from trendradar.context import AppContext
from trendradar.core import load_config, parse_multi_account_config, validate_paired_configs


def _record_result(results: List[Tuple[str, str, str]], status: str, item: str, detail: str) -> None:
    icon_map = {"pass": "✅", "warn": "⚠️", "fail": "❌"}
    icon = icon_map.get(status, "•")
    results.append((status, item, detail))
    print(f"{icon} {item}: {detail}")


def _save_report(
    results: List[Tuple[str, str, str]],
    pass_count: int,
    warn_count: int,
    fail_count: int,
    config_path: Optional[str],
) -> None:
    report = {
        "version": __version__,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config_path": config_path or os.environ.get("CONFIG_PATH", "config/config.yaml"),
        "summary": {
            "pass": pass_count,
            "warn": warn_count,
            "fail": fail_count,
            "ok": fail_count == 0,
        },
        "checks": [
            {"status": status, "item": item, "detail": detail}
            for status, item, detail in results
        ],
    }

    try:
        output_dir = Path("output") / "meta"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "doctor_report.json"
        output_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"体检报告已保存: {output_path}")
    except Exception as e:
        print(f"⚠️ 体检报告保存失败: {e}")


def run_doctor(config_path: Optional[str] = None) -> bool:
    """运行环境体检"""
    print("=" * 60)
    print(f"TrendRadar v{__version__} 环境体检")
    print("=" * 60)

    results: List[Tuple[str, str, str]] = []
    config = None

    # 1) Python 版本检查
    py_ok = sys.version_info >= (3, 10)
    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if py_ok:
        _record_result(results, "pass", "Python版本", f"{py_version} (满足 >= 3.10)")
    else:
        _record_result(results, "fail", "Python版本", f"{py_version} (不满足 >= 3.10)")

    # 2) 关键文件检查
    if config_path is None:
        config_path = os.environ.get("CONFIG_PATH", "config/config.yaml")

    required_files = [
        (config_path, "主配置文件"),
        ("config/frequency_words.txt", "关键词文件"),
    ]
    optional_files = [
        ("config/timeline.yaml", "调度文件"),
    ]

    for path_str, desc in required_files:
        if Path(path_str).exists():
            _record_result(results, "pass", desc, f"已找到: {path_str}")
        else:
            _record_result(results, "fail", desc, f"缺失: {path_str}")

    for path_str, desc in optional_files:
        if Path(path_str).exists():
            _record_result(results, "pass", desc, f"已找到: {path_str}")
        else:
            _record_result(results, "warn", desc, f"未找到: {path_str}（将使用默认调度模板）")

    # 3) 配置加载检查
    try:
        config = load_config(config_path)
        _record_result(results, "pass", "配置加载", f"加载成功: {config_path}")
    except Exception as e:
        _record_result(results, "fail", "配置加载", f"加载失败: {e}")

    if config:
        _check_with_config(results, config)

    pass_count = sum(1 for status, _, _ in results if status == "pass")
    warn_count = sum(1 for status, _, _ in results if status == "warn")
    fail_count = sum(1 for status, _, _ in results if status == "fail")

    _save_report(results, pass_count, warn_count, fail_count, config_path)

    print("-" * 60)
    print(f"体检结果: ✅ {pass_count} 项通过  ⚠️ {warn_count} 项警告  ❌ {fail_count} 项失败")
    print("=" * 60)

    if fail_count == 0:
        print("体检通过。")
        return True

    print("体检未通过，请先修复失败项。")
    return False


def _check_with_config(results: List[Tuple[str, str, str]], config: Dict) -> None:
    # 4) 调度配置检查
    try:
        ctx = AppContext(config)
        schedule = ctx.create_scheduler().resolve()
        detail = f"调度解析成功（report_mode={schedule.report_mode}, ai_mode={schedule.ai_mode}）"
        _record_result(results, "pass", "调度配置", detail)
    except Exception as e:
        _record_result(results, "fail", "调度配置", f"解析失败: {e}")

    # 5) AI 配置检查
    ai_analysis_enabled = config.get("AI_ANALYSIS", {}).get("ENABLED", False)
    ai_translation_enabled = config.get("AI_TRANSLATION", {}).get("ENABLED", False)
    ai_filter_enabled = config.get("FILTER", {}).get("METHOD", "keyword") == "ai"
    ai_enabled = ai_analysis_enabled or ai_translation_enabled or ai_filter_enabled

    if ai_enabled:
        try:
            from trendradar.ai.client import AIClient
            valid, message = AIClient(config.get("AI", {})).validate_config()
            if valid:
                _record_result(results, "pass", "AI配置", f"模型: {config.get('AI', {}).get('MODEL', '')}")
            else:
                if ai_analysis_enabled or ai_translation_enabled:
                    _record_result(results, "fail", "AI配置", message)
                else:
                    _record_result(results, "warn", "AI配置", f"{message}（AI 筛选将回退关键词模式）")
        except Exception as e:
            _record_result(results, "fail", "AI配置", f"校验异常: {e}")
    else:
        _record_result(results, "warn", "AI配置", "未启用 AI 功能，跳过校验")

    # 6) 存储配置检查
    try:
        storage_cfg = config.get("STORAGE", {})
        backend = storage_cfg.get("BACKEND", "auto")
        remote = storage_cfg.get("REMOTE", {})
        missing_remote_keys = [
            k for k in ("BUCKET_NAME", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT_URL")
            if not remote.get(k)
        ]

        if backend == "remote" and missing_remote_keys:
            _record_result(
                results, "fail", "存储配置",
                f"remote 模式缺少配置: {', '.join(missing_remote_keys)}"
            )
        elif backend == "auto" and os.environ.get("GITHUB_ACTIONS") == "true" and missing_remote_keys:
            _record_result(
                results, "warn", "存储配置",
                "GitHub Actions + auto 模式未完整配置远程存储，可能导致数据丢失"
            )
        else:
            sm = AppContext(config).get_storage_manager()
            _record_result(results, "pass", "存储配置", f"当前后端: {sm.backend_name}")
    except Exception as e:
        _record_result(results, "fail", "存储配置", f"检查失败: {e}")

    # 7) 通知渠道配置检查
    _check_notification_channels(results, config)

    # 8) 输出目录可写检查
    try:
        output_dir = Path("output")
        output_dir.mkdir(parents=True, exist_ok=True)
        probe_file = output_dir / ".doctor_write_probe"
        probe_file.write_text("ok", encoding="utf-8")
        probe_file.unlink(missing_ok=True)
        _record_result(results, "pass", "输出目录", f"可写: {output_dir}")
    except Exception as e:
        _record_result(results, "fail", "输出目录", f"不可写: {e}")


def _check_notification_channels(results: List[Tuple[str, str, str]], config: Dict) -> None:
    channel_details = []
    channel_issues = []
    max_accounts = config.get("MAX_ACCOUNTS_PER_CHANNEL", 3)

    for key, name in [
        ("FEISHU_WEBHOOK_URL", "飞书"),
        ("DINGTALK_WEBHOOK_URL", "钉钉"),
        ("WEWORK_WEBHOOK_URL", "企业微信"),
        ("BARK_URL", "Bark"),
        ("SLACK_WEBHOOK_URL", "Slack"),
        ("GENERIC_WEBHOOK_URL", "通用Webhook"),
    ]:
        values = parse_multi_account_config(config.get(key, ""))
        if values:
            channel_details.append(f"{name}({min(len(values), max_accounts)}个)")

    tg_tokens = parse_multi_account_config(config.get("TELEGRAM_BOT_TOKEN", ""))
    tg_chats = parse_multi_account_config(config.get("TELEGRAM_CHAT_ID", ""))
    if tg_tokens or tg_chats:
        valid, count = validate_paired_configs(
            {"bot_token": tg_tokens, "chat_id": tg_chats},
            "Telegram",
            required_keys=["bot_token", "chat_id"],
        )
        if valid and count > 0:
            channel_details.append(f"Telegram({min(count, max_accounts)}个)")
        else:
            channel_issues.append("Telegram bot_token/chat_id 配置不完整或数量不一致")

    ntfy_server = config.get("NTFY_SERVER_URL", "")
    ntfy_topics = parse_multi_account_config(config.get("NTFY_TOPIC", ""))
    ntfy_tokens = parse_multi_account_config(config.get("NTFY_TOKEN", ""))
    if ntfy_server and ntfy_topics:
        if ntfy_tokens:
            valid, count = validate_paired_configs(
                {"topic": ntfy_topics, "token": ntfy_tokens},
                "ntfy",
            )
            if valid and count > 0:
                channel_details.append(f"ntfy({min(count, max_accounts)}个)")
            else:
                channel_issues.append("ntfy topic/token 数量不一致")
        else:
            channel_details.append(f"ntfy({min(len(ntfy_topics), max_accounts)}个)")

    email_ready = all(
        [config.get("EMAIL_FROM"), config.get("EMAIL_PASSWORD"), config.get("EMAIL_TO")]
    )
    if email_ready:
        channel_details.append("邮件")
    elif any([config.get("EMAIL_FROM"), config.get("EMAIL_PASSWORD"), config.get("EMAIL_TO")]):
        channel_issues.append("邮件配置不完整（需要 from/password/to 同时配置）")

    cf_tokens = parse_multi_account_config(config.get("CLOUDFLARE_API_TOKEN", ""))
    cf_accounts = parse_multi_account_config(config.get("CLOUDFLARE_ACCOUNT_ID", ""))
    cf_projects = parse_multi_account_config(config.get("CLOUDFLARE_PROJECT_NAME", ""))
    if cf_tokens or cf_accounts or cf_projects:
        valid, count = validate_paired_configs(
            {"api_token": cf_tokens, "account_id": cf_accounts, "project_name": cf_projects},
            "Cloudflare Pages",
            required_keys=["api_token", "account_id", "project_name"],
        )
        if valid and count > 0:
            channel_details.append(f"Cloudflare Pages({min(count, max_accounts)}个)")
        else:
            channel_issues.append("Cloudflare Pages api_token/account_id/project_name 配置不完整或数量不一致")

    cf_w_token = config.get("CLOUDFLARE_WORKER_API_TOKEN") or config.get("CLOUDFLARE_API_TOKEN", "")
    cf_w_account = config.get("CLOUDFLARE_WORKER_ACCOUNT_ID") or config.get("CLOUDFLARE_ACCOUNT_ID", "")
    cf_w_name = config.get("CLOUDFLARE_WORKER_NAME", "")
    if cf_w_token or cf_w_account or cf_w_name:
        tokens = parse_multi_account_config(cf_w_token)
        account_ids = parse_multi_account_config(cf_w_account)
        worker_names = parse_multi_account_config(cf_w_name)
        if len(tokens) == 1 and len(worker_names) > 1:
            tokens = tokens * len(worker_names)
        if len(account_ids) == 1 and len(worker_names) > 1:
            account_ids = account_ids * len(worker_names)
        valid, count = validate_paired_configs(
            {"api_token": tokens, "account_id": account_ids, "script_name": worker_names},
            "Cloudflare Worker",
            required_keys=["api_token", "account_id", "script_name"],
        )
        if valid and count > 0:
            channel_details.append(f"Cloudflare Worker({min(count, max_accounts)}个)")
        else:
            channel_issues.append("Cloudflare Worker api_token/account_id/worker_name 配置不完整或数量不一致")

    if channel_issues and not channel_details:
        _record_result(results, "fail", "通知配置", "；".join(channel_issues))
    elif channel_issues and channel_details:
        detail = f"可用渠道: {', '.join(channel_details)}；问题: {'；'.join(channel_issues)}"
        _record_result(results, "warn", "通知配置", detail)
    elif channel_details:
        _record_result(results, "pass", "通知配置", f"可用渠道: {', '.join(channel_details)}")
    else:
        _record_result(results, "warn", "通知配置", "未配置任何通知渠道")
