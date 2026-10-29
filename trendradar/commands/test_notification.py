# coding=utf-8
"""通知测试命令"""

import copy
from pathlib import Path
from typing import Dict, Optional

from trendradar.context import AppContext


def _build_test_report_data(ctx: AppContext) -> Dict:
    now = ctx.get_time()
    time_display = now.strftime("%H:%M")
    title = f"TrendRadar 通知测试消息（{now.strftime('%Y-%m-%d %H:%M:%S')}）"

    return {
        "stats": [
            {
                "word": "连通性测试",
                "count": 1,
                "titles": [
                    {
                        "title": title,
                        "source_name": "TrendRadar",
                        "url": "https://github.com/sansan0/TrendRadar",
                        "mobile_url": "",
                        "ranks": [1],
                        "rank_threshold": ctx.rank_threshold,
                        "count": 1,
                        "is_new": True,
                        "time_display": time_display,
                        "matched_keyword": "连通性测试",
                    }
                ],
            }
        ],
        "failed_ids": [],
        "new_titles": [],
        "id_to_name": {},
    }


def _create_test_html_file(ctx: AppContext) -> Optional[str]:
    try:
        now = ctx.get_time()
        output_dir = Path("output") / "html" / ctx.format_date()
        output_dir.mkdir(parents=True, exist_ok=True)
        html_path = output_dir / f"notification_test_{ctx.format_time()}.html"
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>TrendRadar 通知测试</title></head>
<body>
<h2>TrendRadar 通知连通性测试</h2>
<p>测试时间：{now.strftime('%Y-%m-%d %H:%M:%S')} ({ctx.timezone})</p>
<p>这是一条测试消息，用于验证邮件渠道是否可达。</p>
</body>
</html>"""
        html_path.write_text(html_content, encoding="utf-8")
        return str(html_path)
    except Exception as e:
        print(f"[测试通知] 创建测试 HTML 失败: {e}")
        return None


def run_test_notification(config: Dict) -> bool:
    """发送测试通知到已配置渠道"""
    from trendradar.notification import NotificationDispatcher

    ctx = AppContext(config)

    try:
        has_notification = any(
            [
                config.get("FEISHU_WEBHOOK_URL"),
                config.get("DINGTALK_WEBHOOK_URL"),
                config.get("WEWORK_WEBHOOK_URL"),
                (config.get("TELEGRAM_BOT_TOKEN") and config.get("TELEGRAM_CHAT_ID")),
                (config.get("EMAIL_FROM") and config.get("EMAIL_PASSWORD") and config.get("EMAIL_TO")),
                (config.get("NTFY_SERVER_URL") and config.get("NTFY_TOPIC")),
                config.get("BARK_URL"),
                config.get("SLACK_WEBHOOK_URL"),
                config.get("GENERIC_WEBHOOK_URL"),
                (
                    config.get("CLOUDFLARE_API_TOKEN")
                    and config.get("CLOUDFLARE_ACCOUNT_ID")
                    and config.get("CLOUDFLARE_PROJECT_NAME")
                ),
                (
                    (config.get("CLOUDFLARE_WORKER_API_TOKEN") or config.get("CLOUDFLARE_API_TOKEN"))
                    and (config.get("CLOUDFLARE_WORKER_ACCOUNT_ID") or config.get("CLOUDFLARE_ACCOUNT_ID"))
                    and config.get("CLOUDFLARE_WORKER_NAME")
                ),
            ]
        )

        if not has_notification:
            print("未检测到可用通知渠道，请先在 config.yaml 或环境变量中配置。")
            return False

        test_config = copy.deepcopy(config)
        test_display = test_config.setdefault("DISPLAY", {})
        test_regions = test_display.setdefault("REGIONS", {})
        test_regions.update(
            {
                "HOTLIST": True,
                "NEW_ITEMS": False,
                "RSS": False,
                "STANDALONE": False,
                "AI_ANALYSIS": False,
            }
        )

        if "AI_TRANSLATION" in test_config:
            test_config["AI_TRANSLATION"]["ENABLED"] = False

        proxy_url = test_config.get("DEFAULT_PROXY", "") if test_config.get("USE_PROXY") else None
        if proxy_url:
            print("[测试通知] 检测到代理配置，将使用代理发送")

        dispatcher = NotificationDispatcher(
            config=test_config,
            get_time_func=ctx.get_time,
            split_content_func=ctx.split_content,
            translator=None,
        )

        report_data = _build_test_report_data(ctx)
        html_file_path = _create_test_html_file(ctx)

        print("=" * 60)
        print("通知连通性测试")
        print("=" * 60)

        results = dispatcher.dispatch_all(
            report_data=report_data,
            report_type="通知连通性测试",
            proxy_url=proxy_url,
            mode="daily",
            html_file_path=html_file_path,
        )

        if not results:
            print("没有可测试的有效通知渠道（可能配置不完整）。")
            return False

        print("-" * 60)
        success_count = 0
        for channel, ok in results.items():
            if ok:
                success_count += 1
                print(f"✅ {channel}: 测试成功")
            else:
                print(f"❌ {channel}: 测试失败")

        print("-" * 60)
        print(f"测试结果: {success_count}/{len(results)} 个渠道成功")
        return success_count > 0
    finally:
        ctx.cleanup()
