# coding=utf-8
"""
通知调度器模块

提供统一的通知分发接口。
支持所有通知渠道的多账号配置，使用 `;` 分隔多个账号。

使用示例:
    dispatcher = NotificationDispatcher(config, get_time_func, split_content_func)
    results = dispatcher.dispatch_all(report_data, report_type, ...)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional

from trendradar.core.config import (
    get_account_at_index,
    limit_accounts,
    parse_multi_account_config,
    validate_paired_configs,
)

from .senders import (
    send_to_bark,
    send_to_dingtalk,
    send_to_email,
    send_to_feishu,
    send_to_ntfy,
    send_to_slack,
    send_to_telegram,
    send_to_wework,
    send_to_generic_webhook,
)
from .renderer import (
    render_rss_feishu_content,
    render_rss_dingtalk_content,
    render_rss_markdown_content,
)

# 类型检查时导入，运行时不导入（避免循环导入）
if TYPE_CHECKING:
    from trendradar.ai import AIAnalysisResult, AITranslator


class NotificationDispatcher:
    """
    统一的多账号通知调度器

    将多账号发送逻辑封装，提供简洁的 dispatch_all 接口。
    内部处理账号解析、数量限制、配对验证等逻辑。
    """

    def __init__(
        self,
        config: Dict[str, Any],
        get_time_func: Callable,
        split_content_func: Callable,
        translator: Optional["AITranslator"] = None,
    ):
        """
        初始化通知调度器

        Args:
            config: 完整的配置字典，包含所有通知渠道的配置
            get_time_func: 获取当前时间的函数
            split_content_func: 内容分批函数
            translator: AI 翻译器实例（可选）
        """
        self.config = config
        self.get_time_func = get_time_func
        self.split_content_func = split_content_func
        self.max_accounts = config.get("MAX_ACCOUNTS_PER_CHANNEL", 3)
        self.translator = translator

    def translate_content(
        self,
        report_data: Dict,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        standalone_data: Optional[Dict] = None,
        display_regions: Optional[Dict] = None,
        skip_rss: bool = False,
    ) -> tuple:
        """
        翻译推送内容

        Args:
            report_data: 报告数据
            rss_items: RSS 统计条目
            rss_new_items: RSS 新增条目
            standalone_data: 独立展示区数据
            display_regions: 区域显示配置（不展示的区域跳过翻译）
            skip_rss: 跳过 RSS 和独立展示区翻译（当数据已在上游翻译过时使用）

        Returns:
            tuple: (翻译后的 report_data, rss_items, rss_new_items, standalone_data)
        """
        if not self.translator or not self.translator.enabled:
            return report_data, rss_items, rss_new_items, standalone_data

        import copy
        print(f"[翻译] 开始翻译内容到 {self.translator.target_language}...")

        scope = self.translator.scope
        display_regions = display_regions or {}

        # 深拷贝避免修改原始数据
        report_data = copy.deepcopy(report_data)
        rss_items = copy.deepcopy(rss_items) if rss_items else None
        rss_new_items = copy.deepcopy(rss_new_items) if rss_new_items else None
        standalone_data = copy.deepcopy(standalone_data) if standalone_data else None

        # 收集所有需要翻译的标题
        titles_to_translate = []
        title_locations = []  # 记录标题位置，用于回填

        # 1. 热榜标题（scope 开启 且 区域展示）
        if scope.get("HOTLIST", True) and display_regions.get("HOTLIST", True):
            for stat_idx, stat in enumerate(report_data.get("stats", [])):
                for title_idx, title_data in enumerate(stat.get("titles", [])):
                    titles_to_translate.append(title_data.get("title", ""))
                    title_locations.append(("stats", stat_idx, title_idx))

            # 2. 新增热点标题
            for source_idx, source in enumerate(report_data.get("new_titles", [])):
                for title_idx, title_data in enumerate(source.get("titles", [])):
                    titles_to_translate.append(title_data.get("title", ""))
                    title_locations.append(("new_titles", source_idx, title_idx))

        # 3. RSS 统计标题（结构与 stats 一致：[{word, count, titles: [{title, ...}]}]）
        if not skip_rss and rss_items and scope.get("RSS", True) and display_regions.get("RSS", True):
            for stat_idx, stat in enumerate(rss_items):
                for title_idx, title_data in enumerate(stat.get("titles", [])):
                    titles_to_translate.append(title_data.get("title", ""))
                    title_locations.append(("rss_items", stat_idx, title_idx))

        # 4. RSS 新增标题（结构与 stats 一致）
        if not skip_rss and rss_new_items and scope.get("RSS", True) and display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True):
            for stat_idx, stat in enumerate(rss_new_items):
                for title_idx, title_data in enumerate(stat.get("titles", [])):
                    titles_to_translate.append(title_data.get("title", ""))
                    title_locations.append(("rss_new_items", stat_idx, title_idx))

        # 5. 独立展示区 - 热榜平台
        if standalone_data and scope.get("STANDALONE", True) and display_regions.get("STANDALONE", False):
            for plat_idx, platform in enumerate(standalone_data.get("platforms", [])):
                for item_idx, item in enumerate(platform.get("items", [])):
                    titles_to_translate.append(item.get("title", ""))
                    title_locations.append(("standalone_platforms", plat_idx, item_idx))

            # 6. 独立展示区 - RSS 源（跳过已翻译的）
            if not skip_rss:
                for feed_idx, feed in enumerate(standalone_data.get("rss_feeds", [])):
                    for item_idx, item in enumerate(feed.get("items", [])):
                        titles_to_translate.append(item.get("title", ""))
                        title_locations.append(("standalone_rss", feed_idx, item_idx))

        if not titles_to_translate:
            print("[翻译] 没有需要翻译的内容")
            return report_data, rss_items, rss_new_items, standalone_data

        print(f"[翻译] 共 {len(titles_to_translate)} 条标题待翻译")

        # 批量翻译
        result = self.translator.translate_batch(titles_to_translate)

        if result.success_count == 0:
            print(f"[翻译] 翻译失败: {result.results[0].error if result.results else '未知错误'}")
            return report_data, rss_items, rss_new_items, standalone_data

        print(f"[翻译] 翻译完成: {result.success_count}/{result.total_count} 成功")

        # debug 模式：输出完整 prompt、AI 原始响应、逐条对照
        if self.config.get("DEBUG", False):
            if result.prompt:
                print(f"[翻译][DEBUG] === 发送给 AI 的 Prompt ===")
                print(result.prompt)
                print(f"[翻译][DEBUG] === Prompt 结束 ===")
            if result.raw_response:
                print(f"[翻译][DEBUG] === AI 原始响应 ===")
                print(result.raw_response)
                print(f"[翻译][DEBUG] === 响应结束 ===")
            # 行数不匹配警告
            expected = len(titles_to_translate)
            if result.parsed_count != expected:
                print(f"[翻译][DEBUG] ⚠️ 行数不匹配：期望 {expected} 条，AI 返回 {result.parsed_count} 条")
            # 逐条对照
            unchanged_count = 0
            for i, res in enumerate(result.results):
                if not res.success and res.error:
                    print(f"[翻译][DEBUG] [{i+1}] !! 失败: {res.error}")
                elif res.original_text == res.translated_text:
                    unchanged_count += 1
                else:
                    print(f"[翻译][DEBUG] [{i+1}] {res.original_text} => {res.translated_text}")
            if unchanged_count > 0:
                print(f"[翻译][DEBUG] （另有 {unchanged_count} 条未变化，已省略）")

        # 回填翻译结果
        for i, (loc_type, idx1, idx2) in enumerate(title_locations):
            if i < len(result.results) and result.results[i].success:
                translated = result.results[i].translated_text
                if loc_type == "stats":
                    report_data["stats"][idx1]["titles"][idx2]["title"] = translated
                elif loc_type == "new_titles":
                    report_data["new_titles"][idx1]["titles"][idx2]["title"] = translated
                elif loc_type == "rss_items" and rss_items:
                    rss_items[idx1]["titles"][idx2]["title"] = translated
                elif loc_type == "rss_new_items" and rss_new_items:
                    rss_new_items[idx1]["titles"][idx2]["title"] = translated
                elif loc_type == "standalone_platforms" and standalone_data:
                    standalone_data["platforms"][idx1]["items"][idx2]["title"] = translated
                elif loc_type == "standalone_rss" and standalone_data:
                    standalone_data["rss_feeds"][idx1]["items"][idx2]["title"] = translated

        return report_data, rss_items, rss_new_items, standalone_data

    def dispatch_all(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict] = None,
        proxy_url: Optional[str] = None,
        mode: str = "daily",
        html_file_path: Optional[str] = None,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        standalone_data: Optional[Dict] = None,
        skip_translation: bool = False,
    ) -> Dict[str, bool]:
        """
        分发通知到所有已配置的渠道（支持热榜+RSS合并推送+AI分析+独立展示区）

        Args:
            report_data: 报告数据（由 prepare_report_data 生成）
            report_type: 报告类型（如 "全天汇总"、"当前榜单"、"增量分析"）
            update_info: 版本更新信息（可选）
            proxy_url: 代理 URL（可选）
            mode: 报告模式 (daily/current/incremental)
            html_file_path: HTML 报告文件路径（邮件使用）
            rss_items: RSS 统计条目列表（用于 RSS 统计区块）
            rss_new_items: RSS 新增条目列表（用于 RSS 新增区块）
            ai_analysis: AI 分析结果（可选）
            standalone_data: 独立展示区数据（可选）
            skip_translation: 跳过翻译（当数据已在上游翻译过时使用）

        Returns:
            Dict[str, bool]: 每个渠道的发送结果，key 为渠道名，value 为是否成功
        """
        results = {}

        # 获取区域显示配置
        display_regions = self.config.get("DISPLAY", {}).get("REGIONS", {})

        # 执行翻译（如果启用，根据 display_regions 跳过不展示的区域）
        # skip_translation=True 时，RSS 已在上游翻译过，跳过 RSS 重复翻译
        if not skip_translation:
            report_data, rss_items, rss_new_items, standalone_data = self.translate_content(
                report_data, rss_items, rss_new_items, standalone_data, display_regions
            )
        else:
            # RSS 已翻译，仅翻译热榜 report_data 和独立展示区热榜部分
            report_data, _, _, standalone_data = self.translate_content(
                report_data, standalone_data=standalone_data, display_regions=display_regions,
                skip_rss=True,
            )

        # 飞书
        if self.config.get("FEISHU_WEBHOOK_URL"):
            results["feishu"] = self._send_feishu(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # 钉钉
        if self.config.get("DINGTALK_WEBHOOK_URL"):
            results["dingtalk"] = self._send_dingtalk(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # 企业微信
        if self.config.get("WEWORK_WEBHOOK_URL"):
            results["wework"] = self._send_wework(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # Telegram（需要配对验证）
        if self.config.get("TELEGRAM_BOT_TOKEN") and self.config.get("TELEGRAM_CHAT_ID"):
            results["telegram"] = self._send_telegram(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # ntfy（需要配对验证）
        if self.config.get("NTFY_SERVER_URL") and self.config.get("NTFY_TOPIC"):
            results["ntfy"] = self._send_ntfy(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # Bark
        if self.config.get("BARK_URL"):
            results["bark"] = self._send_bark(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # Slack
        if self.config.get("SLACK_WEBHOOK_URL"):
            results["slack"] = self._send_slack(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # 通用 Webhook
        if self.config.get("GENERIC_WEBHOOK_URL"):
            results["generic_webhook"] = self._send_generic_webhook(
                report_data, report_type, update_info, proxy_url, mode, rss_items, rss_new_items,
                ai_analysis, display_regions, standalone_data
            )

        # 邮件（保持原有逻辑，已支持多收件人，AI 分析已嵌入 HTML）
        if (
            self.config.get("EMAIL_FROM")
            and self.config.get("EMAIL_PASSWORD")
            and self.config.get("EMAIL_TO")
        ):
            results["email"] = self._send_email(report_type, html_file_path)

        return results

    def _send_to_multi_accounts(
        self,
        channel_name: str,
        config_value: str,
        send_func: Callable[..., bool],
        **kwargs,
    ) -> bool:
        """
        通用多账号发送逻辑

        Args:
            channel_name: 渠道名称（用于日志和账号数量限制提示）
            config_value: 配置值（可能包含多个账号，用 ; 分隔）
            send_func: 发送函数，签名为 (account, account_label=..., **kwargs) -> bool
            **kwargs: 传递给发送函数的其他参数

        Returns:
            bool: 任一账号发送成功则返回 True
        """
        accounts = parse_multi_account_config(config_value)
        if not accounts:
            return False

        accounts = limit_accounts(accounts, self.max_accounts, channel_name)
        results = []

        for i, account in enumerate(accounts):
            if account:
                account_label = f"账号{i+1}" if len(accounts) > 1 else ""
                result = send_func(account, account_label=account_label, **kwargs)
                results.append(result)

        return any(results) if results else False

    def _send_feishu(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到飞书（多账号，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        return self._send_to_multi_accounts(
            channel_name="飞书",
            config_value=self.config["FEISHU_WEBHOOK_URL"],
            send_func=lambda url, account_label: send_to_feishu(
                webhook_url=url,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                batch_size=self.config.get("FEISHU_BATCH_SIZE", 29000),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                split_content_func=self.split_content_func,
                get_time_func=self.get_time_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            ),
        )

    def _send_dingtalk(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到钉钉（多账号，支持热榜+RSS合并+AI分析+独立展示区，支持加签）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        webhooks = parse_multi_account_config(self.config["DINGTALK_WEBHOOK_URL"])
        secrets = parse_multi_account_config(self.config.get("DINGTALK_SECRET", ""))
        webhooks = limit_accounts(webhooks, self.max_accounts, "钉钉")

        results = []
        for i, webhook_url in enumerate(webhooks):
            if not webhook_url:
                continue

            account_label = f"账号{i+1}" if len(webhooks) > 1 else ""
            secret = secrets[i] if i < len(secrets) else ""

            result = send_to_dingtalk(
                webhook_url=webhook_url,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                secret=secret,
                batch_size=self.config.get("DINGTALK_BATCH_SIZE", 20000),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                split_content_func=self.split_content_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            )
            results.append(result)

        return any(results) if results else False

    def _send_wework(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到企业微信（多账号，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        return self._send_to_multi_accounts(
            channel_name="企业微信",
            config_value=self.config["WEWORK_WEBHOOK_URL"],
            send_func=lambda url, account_label: send_to_wework(
                webhook_url=url,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                batch_size=self.config.get("MESSAGE_BATCH_SIZE", 4000),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                msg_type=self.config.get("WEWORK_MSG_TYPE", "markdown"),
                split_content_func=self.split_content_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            ),
        )

    def _send_telegram(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到 Telegram（多账号，需验证 token 和 chat_id 配对，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        telegram_tokens = parse_multi_account_config(self.config["TELEGRAM_BOT_TOKEN"])
        telegram_chat_ids = parse_multi_account_config(self.config["TELEGRAM_CHAT_ID"])

        if not telegram_tokens or not telegram_chat_ids:
            return False

        valid, count = validate_paired_configs(
            {"bot_token": telegram_tokens, "chat_id": telegram_chat_ids},
            "Telegram",
            required_keys=["bot_token", "chat_id"],
        )
        if not valid or count == 0:
            return False

        telegram_tokens = limit_accounts(telegram_tokens, self.max_accounts, "Telegram")
        telegram_chat_ids = telegram_chat_ids[: len(telegram_tokens)]

        results = []
        for i in range(len(telegram_tokens)):
            token = telegram_tokens[i]
            chat_id = telegram_chat_ids[i]
            if token and chat_id:
                account_label = f"账号{i+1}" if len(telegram_tokens) > 1 else ""
                result = send_to_telegram(
                    bot_token=token,
                    chat_id=chat_id,
                    report_data=report_data,
                    report_type=report_type,
                    update_info=update_info,
                    proxy_url=proxy_url,
                    mode=mode,
                    account_label=account_label,
                    batch_size=self.config.get("MESSAGE_BATCH_SIZE", 4000),
                    batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                    split_content_func=self.split_content_func,
                    rss_items=rss_items if display_regions.get("RSS", True) else None,
                    rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                    ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                    display_regions=display_regions,
                    standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
                )
                results.append(result)

        return any(results) if results else False

    def _send_ntfy(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到 ntfy（多账号，需验证 topic 和 token 配对，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        ntfy_server_url = self.config["NTFY_SERVER_URL"]
        ntfy_topics = parse_multi_account_config(self.config["NTFY_TOPIC"])
        ntfy_tokens = parse_multi_account_config(self.config.get("NTFY_TOKEN", ""))

        if not ntfy_server_url or not ntfy_topics:
            return False

        if ntfy_tokens and len(ntfy_tokens) != len(ntfy_topics):
            print(
                f"❌ ntfy 配置错误：topic 数量({len(ntfy_topics)})与 token 数量({len(ntfy_tokens)})不一致，跳过 ntfy 推送"
            )
            return False

        ntfy_topics = limit_accounts(ntfy_topics, self.max_accounts, "ntfy")
        if ntfy_tokens:
            ntfy_tokens = ntfy_tokens[: len(ntfy_topics)]

        results = []
        for i, topic in enumerate(ntfy_topics):
            if topic:
                token = get_account_at_index(ntfy_tokens, i, "") if ntfy_tokens else ""
                account_label = f"账号{i+1}" if len(ntfy_topics) > 1 else ""
                result = send_to_ntfy(
                    server_url=ntfy_server_url,
                    topic=topic,
                    token=token,
                    report_data=report_data,
                    report_type=report_type,
                    update_info=update_info,
                    proxy_url=proxy_url,
                    mode=mode,
                    account_label=account_label,
                    batch_size=3800,
                    split_content_func=self.split_content_func,
                    rss_items=rss_items if display_regions.get("RSS", True) else None,
                    rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                    ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                    display_regions=display_regions,
                    standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
                )
                results.append(result)

        return any(results) if results else False

    def _send_bark(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到 Bark（多账号，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        return self._send_to_multi_accounts(
            channel_name="Bark",
            config_value=self.config["BARK_URL"],
            send_func=lambda url, account_label: send_to_bark(
                bark_url=url,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                batch_size=self.config.get("BARK_BATCH_SIZE", 3600),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                split_content_func=self.split_content_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            ),
        )

    def _send_slack(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到 Slack（多账号，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        return self._send_to_multi_accounts(
            channel_name="Slack",
            config_value=self.config["SLACK_WEBHOOK_URL"],
            send_func=lambda url, account_label: send_to_slack(
                webhook_url=url,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                batch_size=self.config.get("SLACK_BATCH_SIZE", 4000),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                split_content_func=self.split_content_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            ),
        )

    def _send_generic_webhook(
        self,
        report_data: Dict,
        report_type: str,
        update_info: Optional[Dict],
        proxy_url: Optional[str],
        mode: str,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[AIAnalysisResult] = None,
        display_regions: Optional[Dict] = None,
        standalone_data: Optional[Dict] = None,
    ) -> bool:
        """发送到通用 Webhook（多账号，支持热榜+RSS合并+AI分析+独立展示区）"""
        display_regions = display_regions or {}
        if not display_regions.get("HOTLIST", True):
            report_data = {"stats": [], "failed_ids": [], "new_titles": [], "id_to_name": {}}

        urls = parse_multi_account_config(self.config.get("GENERIC_WEBHOOK_URL", ""))
        templates = parse_multi_account_config(self.config.get("GENERIC_WEBHOOK_TEMPLATE", ""))

        if not urls:
            return False

        urls = limit_accounts(urls, self.max_accounts, "通用Webhook")
        results = []

        for i, url in enumerate(urls):
            if not url:
                continue

            template = ""
            if templates:
                if i < len(templates):
                    template = templates[i]
                elif len(templates) == 1:
                    template = templates[0]

            account_label = f"账号{i+1}" if len(urls) > 1 else ""

            result = send_to_generic_webhook(
                webhook_url=url,
                payload_template=template,
                report_data=report_data,
                report_type=report_type,
                update_info=update_info,
                proxy_url=proxy_url,
                mode=mode,
                account_label=account_label,
                batch_size=self.config.get("MESSAGE_BATCH_SIZE", 4000),
                batch_interval=self.config.get("BATCH_SEND_INTERVAL", 1.0),
                split_content_func=self.split_content_func,
                rss_items=rss_items if display_regions.get("RSS", True) else None,
                rss_new_items=rss_new_items if (display_regions.get("RSS", True) and display_regions.get("NEW_ITEMS", True)) else None,
                ai_analysis=ai_analysis if display_regions.get("AI_ANALYSIS", True) else None,
                display_regions=display_regions,
                standalone_data=standalone_data if display_regions.get("STANDALONE", False) else None,
            )
            results.append(result)

        return any(results) if results else False

    def _send_email(
        self,
        report_type: str,
        html_file_path: Optional[str],
    ) -> bool:
        """发送邮件（保持原有逻辑，已支持多收件人）

        Note:
            AI 分析内容已在 HTML 生成时嵌入，无需在此传递
        """
        return send_to_email(
            from_email=self.config["EMAIL_FROM"],
            password=self.config["EMAIL_PASSWORD"],
            to_email=self.config["EMAIL_TO"],
            report_type=report_type,
            html_file_path=html_file_path,
            custom_smtp_server=self.config.get("EMAIL_SMTP_SERVER", ""),
            custom_smtp_port=self.config.get("EMAIL_SMTP_PORT", ""),
            get_time_func=self.get_time_func,
        )

    # === RSS 通知方法 ===

    def dispatch_rss(
        self,
        rss_items: List[Dict],
        feeds_info: Optional[Dict[str, str]] = None,
        proxy_url: Optional[str] = None,
        html_file_path: Optional[str] = None,
    ) -> Dict[str, bool]:
        """
        分发 RSS 通知到所有已配置的渠道

        Args:
            rss_items: RSS 条目列表，每个条目包含:
                - title: 标题
                - feed_id: RSS 源 ID
                - feed_name: RSS 源名称
                - url: 链接
                - published_at: 发布时间
                - summary: 摘要（可选）
                - author: 作者（可选）
            feeds_info: RSS 源 ID 到名称的映射
            proxy_url: 代理 URL（可选）
            html_file_path: HTML 报告文件路径（邮件使用）

        Returns:
            Dict[str, bool]: 每个渠道的发送结果
        """
        if not rss_items:
            print("[RSS通知] 没有 RSS 内容，跳过通知")
            return {}

        results = {}
        report_type = "RSS 订阅更新"

        # 飞书
        if self.config.get("FEISHU_WEBHOOK_URL"):
            results["feishu"] = self._send_rss_feishu(
                rss_items, feeds_info, proxy_url
            )

        # 钉钉
        if self.config.get("DINGTALK_WEBHOOK_URL"):
            results["dingtalk"] = self._send_rss_dingtalk(
                rss_items, feeds_info, proxy_url
            )

        # 企业微信
        if self.config.get("WEWORK_WEBHOOK_URL"):
            results["wework"] = self._send_rss_markdown(
                rss_items, feeds_info, proxy_url, "wework"
            )

        # Telegram
        if self.config.get("TELEGRAM_BOT_TOKEN") and self.config.get("TELEGRAM_CHAT_ID"):
            results["telegram"] = self._send_rss_markdown(
                rss_items, feeds_info, proxy_url, "telegram"
            )

        # ntfy
        if self.config.get("NTFY_SERVER_URL") and self.config.get("NTFY_TOPIC"):
            results["ntfy"] = self._send_rss_markdown(
                rss_items, feeds_info, proxy_url, "ntfy"
            )

        # Bark
        if self.config.get("BARK_URL"):
            results["bark"] = self._send_rss_markdown(
                rss_items, feeds_info, proxy_url, "bark"
            )

        # Slack
        if self.config.get("SLACK_WEBHOOK_URL"):
            results["slack"] = self._send_rss_markdown(
                rss_items, feeds_info, proxy_url, "slack"
            )

        # 邮件
        if (
            self.config.get("EMAIL_FROM")
            and self.config.get("EMAIL_PASSWORD")
            and self.config.get("EMAIL_TO")
        ):
            results["email"] = self._send_email(report_type, html_file_path)

        return results

    def _send_rss_feishu(
        self,
        rss_items: List[Dict],
        feeds_info: Optional[Dict[str, str]],
        proxy_url: Optional[str],
    ) -> bool:
        """发送 RSS 到飞书"""
        import requests

        content = render_rss_feishu_content(
            rss_items=rss_items,
            feeds_info=feeds_info,
            get_time_func=self.get_time_func,
        )

        webhooks = parse_multi_account_config(self.config["FEISHU_WEBHOOK_URL"])
        webhooks = limit_accounts(webhooks, self.max_accounts, "飞书")

        results = []
        for i, webhook_url in enumerate(webhooks):
            if not webhook_url:
                continue

            account_label = f"账号{i+1}" if len(webhooks) > 1 else ""
            try:
                # 分批发送
                batches = self.split_content_func(
                    content, self.config.get("FEISHU_BATCH_SIZE", 29000)
                )

                for batch_idx, batch_content in enumerate(batches):
                    payload = {
                        "msg_type": "interactive",
                        "card": {
                            "header": {
                                "title": {
                                    "tag": "plain_text",
                                    "content": f"📰 RSS 订阅更新 {f'({batch_idx + 1}/{len(batches)})' if len(batches) > 1 else ''}",
                                },
                                "template": "green",
                            },
                            "elements": [
                                {"tag": "markdown", "content": batch_content}
                            ],
                        },
                    }

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(webhook_url, json=payload, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ 飞书{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ 飞书{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_dingtalk(
        self,
        rss_items: List[Dict],
        feeds_info: Optional[Dict[str, str]],
        proxy_url: Optional[str],
    ) -> bool:
        """发送 RSS 到钉钉"""
        import requests

        content = render_rss_dingtalk_content(
            rss_items=rss_items,
            feeds_info=feeds_info,
            get_time_func=self.get_time_func,
        )

        webhooks = parse_multi_account_config(self.config["DINGTALK_WEBHOOK_URL"])
        webhooks = limit_accounts(webhooks, self.max_accounts, "钉钉")

        results = []
        for i, webhook_url in enumerate(webhooks):
            if not webhook_url:
                continue

            account_label = f"账号{i+1}" if len(webhooks) > 1 else ""
            try:
                batches = self.split_content_func(
                    content, self.config.get("DINGTALK_BATCH_SIZE", 20000)
                )

                for batch_idx, batch_content in enumerate(batches):
                    title = f"📰 RSS 订阅更新 {f'({batch_idx + 1}/{len(batches)})' if len(batches) > 1 else ''}"
                    payload = {
                        "msgtype": "markdown",
                        "markdown": {
                            "title": title,
                            "text": batch_content,
                        },
                    }

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(webhook_url, json=payload, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ 钉钉{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ 钉钉{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_markdown(
        self,
        rss_items: List[Dict],
        feeds_info: Optional[Dict[str, str]],
        proxy_url: Optional[str],
        channel: str,
    ) -> bool:
        """发送 RSS 到 Markdown 兼容渠道（企业微信、Telegram、ntfy、Bark、Slack）"""

        content = render_rss_markdown_content(
            rss_items=rss_items,
            feeds_info=feeds_info,
            get_time_func=self.get_time_func,
        )

        try:
            if channel == "wework":
                return self._send_rss_wework(content, proxy_url)
            elif channel == "telegram":
                return self._send_rss_telegram(content, proxy_url)
            elif channel == "ntfy":
                return self._send_rss_ntfy(content, proxy_url)
            elif channel == "bark":
                return self._send_rss_bark(content, proxy_url)
            elif channel == "slack":
                return self._send_rss_slack(content, proxy_url)
        except Exception as e:
            print(f"❌ {channel} RSS 通知发送失败: {e}")
            return False

        return False

    def _send_rss_wework(self, content: str, proxy_url: Optional[str]) -> bool:
        """发送 RSS 到企业微信"""
        import requests

        webhooks = parse_multi_account_config(self.config["WEWORK_WEBHOOK_URL"])
        webhooks = limit_accounts(webhooks, self.max_accounts, "企业微信")

        results = []
        for i, webhook_url in enumerate(webhooks):
            if not webhook_url:
                continue

            account_label = f"账号{i+1}" if len(webhooks) > 1 else ""
            try:
                batches = self.split_content_func(
                    content, self.config.get("MESSAGE_BATCH_SIZE", 4000)
                )

                for batch_content in batches:
                    payload = {
                        "msgtype": "markdown",
                        "markdown": {"content": batch_content},
                    }

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(webhook_url, json=payload, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ 企业微信{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ 企业微信{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_telegram(self, content: str, proxy_url: Optional[str]) -> bool:
        """发送 RSS 到 Telegram"""
        import requests

        tokens = parse_multi_account_config(self.config["TELEGRAM_BOT_TOKEN"])
        chat_ids = parse_multi_account_config(self.config["TELEGRAM_CHAT_ID"])

        if not tokens or not chat_ids:
            return False

        results = []
        for i in range(min(len(tokens), len(chat_ids), self.max_accounts)):
            token = tokens[i]
            chat_id = chat_ids[i]

            if not token or not chat_id:
                continue

            account_label = f"账号{i+1}" if len(tokens) > 1 else ""
            try:
                batches = self.split_content_func(
                    content, self.config.get("MESSAGE_BATCH_SIZE", 4000)
                )

                for batch_content in batches:
                    url = f"https://api.telegram.org/bot{token}/sendMessage"
                    payload = {
                        "chat_id": chat_id,
                        "text": batch_content,
                        "parse_mode": "Markdown",
                    }

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(url, json=payload, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ Telegram{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ Telegram{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_ntfy(self, content: str, proxy_url: Optional[str]) -> bool:
        """发送 RSS 到 ntfy"""
        import requests

        server_url = self.config["NTFY_SERVER_URL"]
        topics = parse_multi_account_config(self.config["NTFY_TOPIC"])
        tokens = parse_multi_account_config(self.config.get("NTFY_TOKEN", ""))

        if not server_url or not topics:
            return False

        topics = limit_accounts(topics, self.max_accounts, "ntfy")

        results = []
        for i, topic in enumerate(topics):
            if not topic:
                continue

            token = tokens[i] if tokens and i < len(tokens) else ""
            account_label = f"账号{i+1}" if len(topics) > 1 else ""

            try:
                batches = self.split_content_func(content, 3800)

                for batch_content in batches:
                    url = f"{server_url.rstrip('/')}/{topic}"
                    headers = {"Title": "RSS 订阅更新", "Markdown": "yes"}
                    if token:
                        headers["Authorization"] = f"Bearer {token}"

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(
                        url, data=batch_content.encode("utf-8"),
                        headers=headers, proxies=proxies, timeout=30
                    )
                    resp.raise_for_status()

                print(f"✅ ntfy{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ ntfy{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_bark(self, content: str, proxy_url: Optional[str]) -> bool:
        """发送 RSS 到 Bark"""
        import requests
        import urllib.parse

        urls = parse_multi_account_config(self.config["BARK_URL"])
        urls = limit_accounts(urls, self.max_accounts, "Bark")

        results = []
        for i, bark_url in enumerate(urls):
            if not bark_url:
                continue

            account_label = f"账号{i+1}" if len(urls) > 1 else ""
            try:
                batches = self.split_content_func(
                    content, self.config.get("BARK_BATCH_SIZE", 3600)
                )

                for batch_content in batches:
                    title = urllib.parse.quote("📰 RSS 订阅更新")
                    body = urllib.parse.quote(batch_content)
                    url = f"{bark_url.rstrip('/')}/{title}/{body}"

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.get(url, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ Bark{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ Bark{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False

    def _send_rss_slack(self, content: str, proxy_url: Optional[str]) -> bool:
        """发送 RSS 到 Slack"""
        import requests

        webhooks = parse_multi_account_config(self.config["SLACK_WEBHOOK_URL"])
        webhooks = limit_accounts(webhooks, self.max_accounts, "Slack")

        results = []
        for i, webhook_url in enumerate(webhooks):
            if not webhook_url:
                continue

            account_label = f"账号{i+1}" if len(webhooks) > 1 else ""
            try:
                batches = self.split_content_func(
                    content, self.config.get("SLACK_BATCH_SIZE", 4000)
                )

                for batch_content in batches:
                    payload = {
                        "blocks": [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": batch_content,
                                },
                            }
                        ]
                    }

                    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
                    resp = requests.post(webhook_url, json=payload, proxies=proxies, timeout=30)
                    resp.raise_for_status()

                print(f"✅ Slack{account_label} RSS 通知发送成功")
                results.append(True)
            except Exception as e:
                print(f"❌ Slack{account_label} RSS 通知发送失败: {e}")
                results.append(False)

        return any(results) if results else False
