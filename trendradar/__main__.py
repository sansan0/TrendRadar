# coding=utf-8
"""
TrendRadar 主程序

热点新闻聚合与分析工具
支持: python -m trendradar
"""

import argparse
import copy
import json
import os
import re
import sys
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import requests

from trendradar.context import AppContext
from trendradar import __version__
from trendradar.core import load_config, parse_multi_account_config, validate_paired_configs
from trendradar.core.analyzer import convert_keyword_stats_to_platform_stats
from trendradar.crawler import DataFetcher
from trendradar.storage import convert_crawl_results_to_news_data
from trendradar.utils.time import DEFAULT_TIMEZONE, is_within_days, calculate_days_old
from trendradar.ai import AIAnalyzer, AIAnalysisResult
from trendradar.core.scheduler import ResolvedSchedule


def _parse_version(version_str: str) -> Tuple[int, int, int]:
    """解析版本号字符串为元组"""
    try:
        parts = version_str.strip().split(".")
        if len(parts) >= 3:
            return int(parts[0]), int(parts[1]), int(parts[2])
        return 0, 0, 0
    except:
        return 0, 0, 0


def _compare_version(local: str, remote: str) -> str:
    """比较版本号，返回状态文字"""
    local_tuple = _parse_version(local)
    remote_tuple = _parse_version(remote)

    if local_tuple < remote_tuple:
        return "⚠️ 需要更新"
    elif local_tuple > remote_tuple:
        return "🔮 超前版本"
    else:
        return "✅ 已是最新"


def _fetch_remote_version(version_url: str, proxy_url: Optional[str] = None) -> Optional[str]:
    """获取远程版本号"""
    try:
        proxies = None
        if proxy_url:
            proxies = {"http": proxy_url, "https": proxy_url}

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/plain, */*",
            "Cache-Control": "no-cache",
        }

        response = requests.get(version_url, proxies=proxies, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text.strip()
    except Exception as e:
        print(f"[版本检查] 获取远程版本失败: {e}")
        return None


def _parse_config_versions(content: str) -> Dict[str, str]:
    """解析配置文件版本内容为字典"""
    versions = {}
    try:
        if not content:
            return versions
        for line in content.splitlines():
            line = line.strip()
            if not line or "=" not in line:
                continue
            name, version = line.split("=", 1)
            versions[name.strip()] = version.strip()
    except Exception as e:
        print(f"[版本检查] 解析配置版本失败: {e}")
    return versions


def check_all_versions(
    version_url: str,
    configs_version_url: Optional[str] = None,
    proxy_url: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    统一版本检查：程序版本 + 配置文件版本

    Args:
        version_url: 远程程序版本检查 URL
        configs_version_url: 远程配置文件版本检查 URL (返回格式: filename=version)
        proxy_url: 代理 URL

    Returns:
        (need_update, remote_version): 程序是否需要更新及远程版本号
    """
    # 获取远程版本
    remote_version = _fetch_remote_version(version_url, proxy_url)

    # 获取远程配置版本（如果有提供 URL）
    remote_config_versions = {}
    if configs_version_url:
        content = _fetch_remote_version(configs_version_url, proxy_url)
        if content:
            remote_config_versions = _parse_config_versions(content)

    print("=" * 60)
    print("版本检查")
    print("=" * 60)

    if remote_version:
        print(f"远程程序版本: {remote_version}")
    else:
        print("远程程序版本: 获取失败")

    if configs_version_url:
        if remote_config_versions:
            print(f"远程配置清单: 获取成功 ({len(remote_config_versions)} 个文件)")
        else:
            print("远程配置清单: 获取失败或为空")

    print("-" * 60)

    program_status = _compare_version(__version__, remote_version) if remote_version else "(无法比较)"
    print(f"  主程序版本: {__version__} {program_status}")

    config_files = [
        Path("config/config.yaml"),
        Path("config/timeline.yaml"),
        Path("config/frequency_words.txt"),
        Path("config/ai_interests.txt"),
        Path("config/ai_analysis_prompt.txt"),
        Path("config/ai_translation_prompt.txt"),
    ]

    version_pattern = re.compile(r"Version:\s*(\d+\.\d+\.\d+)", re.IGNORECASE)

    for config_file in config_files:
        if not config_file.exists():
            print(f"  {config_file.name}: 文件不存在")
            continue

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                local_version = None
                for i, line in enumerate(f):
                    if i >= 20:
                        break
                    match = version_pattern.search(line)
                    if match:
                        local_version = match.group(1)
                        break

                # 获取该文件的远程版本
                target_remote_version = remote_config_versions.get(config_file.name)

                if local_version:
                    if target_remote_version:
                        status = _compare_version(local_version, target_remote_version)
                        print(f"  {config_file.name}: {local_version} {status}")
                    else:
                        print(f"  {config_file.name}: {local_version} (未找到远程版本)")
                else:
                    print(f"  {config_file.name}: 未找到本地版本号")
        except Exception as e:
            print(f"  {config_file.name}: 读取失败 - {e}")

    print("=" * 60)

    # 返回程序版本的更新状态
    if remote_version:
        need_update = _parse_version(__version__) < _parse_version(remote_version)
        return need_update, remote_version if need_update else None
    return False, None


# === 主分析器 ===
class NewsAnalyzer:
    """新闻分析器"""

    # 模式策略定义
    MODE_STRATEGIES = {
        "incremental": {
            "mode_name": "增量模式",
            "description": "增量模式（只关注新增新闻，无新增时不推送）",
            "report_type": "增量分析",
            "should_send_notification": True,
        },
        "current": {
            "mode_name": "当前榜单模式",
            "description": "当前榜单模式（当前榜单匹配新闻 + 新增新闻区域 + 按时推送）",
            "report_type": "当前榜单",
            "should_send_notification": True,
        },
        "daily": {
            "mode_name": "全天汇总模式",
            "description": "全天汇总模式（所有匹配新闻 + 新增新闻区域 + 按时推送）",
            "report_type": "全天汇总",
            "should_send_notification": True,
        },
    }

    def __init__(self, config: Optional[Dict] = None):
        # 使用传入的配置或加载新配置
        if config is None:
            print("正在加载配置...")
            config = load_config()
        print(f"TrendRadar v{__version__} 配置加载完成")
        print(f"监控平台数量: {len(config['PLATFORMS'])}")
        print(f"时区: {config.get('TIMEZONE', DEFAULT_TIMEZONE)}")

        # 创建应用上下文
        self.ctx = AppContext(config)

        self.request_interval = self.ctx.config["REQUEST_INTERVAL"]
        self.report_mode = self.ctx.config["REPORT_MODE"]
        self.frequency_file = None
        self.filter_method = None  # None=使用全局配置 ctx.filter_method
        self.interests_file = None  # None=使用全局配置 ai_filter.interests_file
        self.rank_threshold = self.ctx.rank_threshold
        self.is_github_actions = os.environ.get("GITHUB_ACTIONS") == "true"
        self.is_docker_container = self._detect_docker_environment()
        self.update_info = None
        self.proxy_url = None
        self._setup_proxy()
        self.data_fetcher = DataFetcher(self.proxy_url)

        # 初始化存储管理器（使用 AppContext）
        self._init_storage_manager()
        # 注意：update_info 由 main() 函数设置，避免重复请求远程版本

    def _init_storage_manager(self) -> None:
        """初始化存储管理器（使用 AppContext）"""
        # 获取数据保留天数（支持环境变量覆盖）
        env_retention = os.environ.get("STORAGE_RETENTION_DAYS", "").strip()
        if env_retention:
            # 环境变量覆盖配置
            self.ctx.config["STORAGE"]["RETENTION_DAYS"] = int(env_retention)

        self.storage_manager = self.ctx.get_storage_manager()
        print(f"存储后端: {self.storage_manager.backend_name}")

        retention_days = self.ctx.config.get("STORAGE", {}).get("RETENTION_DAYS", 0)
        if retention_days > 0:
            print(f"数据保留天数: {retention_days} 天")

    def _detect_docker_environment(self) -> bool:
        """检测是否运行在 Docker 容器中"""
        try:
            if os.environ.get("DOCKER_CONTAINER") == "true":
                return True

            if os.path.exists("/.dockerenv"):
                return True

            return False
        except Exception:
            return False

    def _should_open_browser(self) -> bool:
        """判断是否应该打开浏览器"""
        return not self.is_github_actions and not self.is_docker_container

    def _setup_proxy(self) -> None:
        """设置代理配置"""
        if not self.is_github_actions and self.ctx.config["USE_PROXY"]:
            self.proxy_url = self.ctx.config["DEFAULT_PROXY"]
            print("本地环境，使用代理")
        elif not self.is_github_actions and not self.ctx.config["USE_PROXY"]:
            print("本地环境，未启用代理")
        else:
            print("GitHub Actions环境，不使用代理")

    def _set_update_info_from_config(self) -> None:
        """从已缓存的远程版本设置更新信息（不再重复请求）"""
        try:
            version_url = self.ctx.config.get("VERSION_CHECK_URL", "")
            if not version_url:
                return

            remote_version = _fetch_remote_version(version_url, self.proxy_url)
            if remote_version:
                need_update = _parse_version(__version__) < _parse_version(remote_version)
                if need_update:
                    self.update_info = {
                        "current_version": __version__,
                        "remote_version": remote_version,
                    }
        except Exception as e:
            print(f"版本检查出错: {e}")

    def _get_mode_strategy(self) -> Dict:
        """获取当前模式的策略配置"""
        return self.MODE_STRATEGIES.get(self.report_mode, self.MODE_STRATEGIES["daily"])

    def _has_notification_configured(self) -> bool:
        """检查是否配置了任何通知渠道"""
        cfg = self.ctx.config
        return any(
            [
                cfg["FEISHU_WEBHOOK_URL"],
                cfg["DINGTALK_WEBHOOK_URL"],
                cfg["WEWORK_WEBHOOK_URL"],
                (cfg["TELEGRAM_BOT_TOKEN"] and cfg["TELEGRAM_CHAT_ID"]),
                (
                    cfg["EMAIL_FROM"]
                    and cfg["EMAIL_PASSWORD"]
                    and cfg["EMAIL_TO"]
                ),
                (cfg["NTFY_SERVER_URL"] and cfg["NTFY_TOPIC"]),
                cfg["BARK_URL"],
                cfg["SLACK_WEBHOOK_URL"],
                cfg["GENERIC_WEBHOOK_URL"],
            ]
        )

    def _has_valid_content(
        self, stats: List[Dict], new_titles: Optional[Dict] = None
    ) -> bool:
        """检查是否有有效的新闻内容"""
        if self.report_mode == "incremental":
            # 增量模式：只要有匹配的新闻就推送
            # count_word_frequency 已经确保只处理新增的新闻（包括当天第一次爬取的情况）
            has_matched_news = any(stat["count"] > 0 for stat in stats)
            return has_matched_news
        elif self.report_mode == "current":
            # current模式：只要stats有内容就说明有匹配的新闻
            return any(stat["count"] > 0 for stat in stats)
        else:
            # 当日汇总模式下，检查是否有匹配的频率词新闻或新增新闻
            has_matched_news = any(stat["count"] > 0 for stat in stats)
            has_new_news = bool(
                new_titles and any(len(titles) > 0 for titles in new_titles.values())
            )
            return has_matched_news or has_new_news

    def _prepare_ai_analysis_data(
        self,
        ai_mode: str,
        current_results: Optional[Dict] = None,
        current_id_to_name: Optional[Dict] = None,
    ) -> Tuple[List[Dict], Optional[Dict]]:
        """
        为 AI 分析准备指定模式的数据

        Args:
            ai_mode: AI 分析模式 (daily/current/incremental)
            current_results: 当前抓取的结果（用于 incremental 模式）
            current_id_to_name: 当前的平台映射（用于 incremental 模式）

        Returns:
            Tuple[stats, id_to_name]: 统计数据和平台映射
        """
        try:
            word_groups, filter_words, global_filters = self.ctx.load_frequency_words(self.frequency_file)

            if ai_mode == "incremental":
                # incremental 模式：使用当前抓取的数据
                if not current_results or not current_id_to_name:
                    print("[AI] incremental 模式需要当前抓取数据，但未提供")
                    return [], None

                # 准备当前时间信息
                time_info = self.ctx.format_time()
                title_info = self._prepare_current_title_info(current_results, time_info)

                # 检测新增标题
                new_titles = self.ctx.detect_new_titles(list(current_results.keys()))

                # 统计计算
                stats, _ = self.ctx.count_frequency(
                    current_results,
                    word_groups,
                    filter_words,
                    current_id_to_name,
                    title_info,
                    new_titles,
                    mode="incremental",
                    global_filters=global_filters,
                    quiet=True,
                )

                # 如果是 platform 模式，转换数据结构
                if self.ctx.display_mode == "platform" and stats:
                    stats = convert_keyword_stats_to_platform_stats(
                        stats,
                        self.ctx.weight_config,
                        self.ctx.rank_threshold,
                    )

                return stats, current_id_to_name

            elif ai_mode in ["daily", "current"]:
                # 加载历史数据
                analysis_data = self._load_analysis_data(quiet=True)
                if not analysis_data:
                    print(f"[AI] 无法加载历史数据用于 {ai_mode} 模式分析")
                    return [], None

                (
                    all_results,
                    id_to_name,
                    title_info,
                    new_titles,
                    _,
                    _,
                    _,
                ) = analysis_data

                # 统计计算
                stats, _ = self.ctx.count_frequency(
                    all_results,
                    word_groups,
                    filter_words,
                    id_to_name,
                    title_info,
                    new_titles,
                    mode=ai_mode,
                    global_filters=global_filters,
                    quiet=True,
                )

                # 如果是 platform 模式，转换数据结构
                if self.ctx.display_mode == "platform" and stats:
                    stats = convert_keyword_stats_to_platform_stats(
                        stats,
                        self.ctx.weight_config,
                        self.ctx.rank_threshold,
                    )

                return stats, id_to_name
            else:
                print(f"[AI] 未知的 AI 模式: {ai_mode}")
                return [], None

        except Exception as e:
            print(f"[AI] 准备 {ai_mode} 模式数据时出错: {e}")
            if self.ctx.config.get("DEBUG", False):
                import traceback
                traceback.print_exc()
            return [], None

    def _run_ai_analysis(
        self,
        stats: List[Dict],
        rss_items: Optional[List[Dict]],
        mode: str,
        report_type: str,
        id_to_name: Optional[Dict],
        current_results: Optional[Dict] = None,
        schedule: ResolvedSchedule = None,
        standalone_data: Optional[Dict] = None,
    ) -> Optional[AIAnalysisResult]:
        """执行 AI 分析"""
        analysis_config = self.ctx.config.get("AI_ANALYSIS", {})
        if not analysis_config.get("ENABLED", False):
            return None

        # 调度系统决策
        if not schedule.analyze:
            print("[AI] 调度器: 当前时间段不执行 AI 分析")
            return None

        if schedule.once_analyze and schedule.period_key:
            scheduler = self.ctx.create_scheduler()
            date_str = self.ctx.format_date()
            if scheduler.already_executed(schedule.period_key, "analyze", date_str):
                print(f"[AI] 调度器: 时间段 {schedule.period_name or schedule.period_key} 今天已分析过，跳过")
                return None
            else:
                print(f"[AI] 调度器: 时间段 {schedule.period_name or schedule.period_key} 今天首次分析")

        print("[AI] 正在进行 AI 分析...")
        try:
            ai_config = self.ctx.config.get("AI", {})
            debug_mode = self.ctx.config.get("DEBUG", False)
            analyzer = AIAnalyzer(ai_config, analysis_config, self.ctx.get_time, debug=debug_mode)

            # 确定 AI 分析使用的模式
            ai_mode_config = analysis_config.get("MODE", "follow_report")
            if ai_mode_config == "follow_report":
                # 跟随推送报告模式
                ai_mode = mode
                ai_stats = stats
                ai_id_to_name = id_to_name
            elif ai_mode_config in ["daily", "current", "incremental"]:
                # 使用独立配置的模式，需要重新准备数据
                ai_mode = ai_mode_config
                if ai_mode != mode:
                    print(f"[AI] 使用独立分析模式: {ai_mode} (推送模式: {mode})")
                    print(f"[AI] 正在准备 {ai_mode} 模式的数据...")

                    # 根据 AI 模式重新准备数据
                    ai_stats, ai_id_to_name = self._prepare_ai_analysis_data(
                        ai_mode, current_results, id_to_name
                    )
                    if not ai_stats:
                        print(f"[AI] 警告: 无法准备 {ai_mode} 模式的数据，回退到推送模式数据")
                        ai_stats = stats
                        ai_id_to_name = id_to_name
                        ai_mode = mode
                else:
                    ai_stats = stats
                    ai_id_to_name = id_to_name
            else:
                # 配置错误，回退到跟随模式
                print(f"[AI] 警告: 无效的 ai_analysis.mode 配置 '{ai_mode_config}'，使用推送模式 '{mode}'")
                ai_mode = mode
                ai_stats = stats
                ai_id_to_name = id_to_name

            # 提取平台列表
            platforms = list(ai_id_to_name.values()) if ai_id_to_name else []

            # 提取关键词列表；当 RSS 接管主区时，回退使用 RSS 分组词
            keyword_source = ai_stats or rss_items or []
            keywords = [s.get("word", "") for s in keyword_source if s.get("word")]

            # 确定报告类型
            if ai_mode != mode:
                # 根据 AI 模式确定报告类型
                ai_report_type = {
                    "daily": "当日汇总",
                    "current": "当前榜单",
                    "incremental": "增量更新"
                }.get(ai_mode, report_type)
            else:
                ai_report_type = report_type

            result = analyzer.analyze(
                stats=ai_stats,
                rss_stats=rss_items,
                report_mode=ai_mode,
                report_type=ai_report_type,
                platforms=platforms,
                keywords=keywords,
                standalone_data=standalone_data,
            )

            # 设置 AI 分析使用的模式
            if result.success:
                result.ai_mode = ai_mode
                if result.error:
                    # 成功但有警告（如 JSON 解析问题但使用了原始文本）
                    print(f"[AI] 分析完成（有警告: {result.error}）")
                else:
                    print("[AI] 分析完成")

                # 记录 AI 分析
                if schedule.once_analyze and schedule.period_key:
                    scheduler = self.ctx.create_scheduler()
                    date_str = self.ctx.format_date()
                    scheduler.record_execution(schedule.period_key, "analyze", date_str)
            else:
                print(f"[AI] 分析失败: {result.error}")

            return result
        except Exception as e:
            import traceback
            error_type = type(e).__name__
            error_msg = str(e)
            # 截断过长的错误消息
            if len(error_msg) > 200:
                error_msg = error_msg[:200] + "..."
            print(f"[AI] 分析出错 ({error_type}): {error_msg}")
            # 详细错误日志到 stderr
            import sys
            print(f"[AI] 详细错误堆栈:", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return AIAnalysisResult(success=False, error=f"{error_type}: {error_msg}")

    def _load_analysis_data(
        self,
        quiet: bool = False,
    ) -> Optional[Tuple[Dict, Dict, Dict, Dict, List, List]]:
        """统一的数据加载和预处理，使用当前监控平台列表过滤历史数据"""
        try:
            if not self.ctx.config.get("ENABLE_CRAWLER", True):
                if not quiet:
                    print("热榜抓取已关闭，分析流水线将使用空热榜数据并继续处理 RSS / AI")
                word_groups, filter_words, global_filters = self.ctx.load_frequency_words(
                    self.frequency_file
                )
                return ({}, {}, {}, {}, word_groups, filter_words, global_filters)

            # 获取当前配置的监控平台ID列表
            current_platform_ids = self.ctx.platform_ids
            if not quiet:
                print(f"当前监控平台: {current_platform_ids}")

            if not current_platform_ids:
                if not quiet:
                    print("未配置热榜平台，分析流水线将继续处理 RSS / AI")
                word_groups, filter_words, global_filters = self.ctx.load_frequency_words(
                    self.frequency_file
                )
                return ({}, {}, {}, {}, word_groups, filter_words, global_filters)

            all_results, id_to_name, title_info = self.ctx.read_today_titles(
                current_platform_ids, quiet=quiet
            )

            if not all_results:
                if not quiet:
                    print("没有找到当天的热榜数据，将继续处理 RSS / AI")
                word_groups, filter_words, global_filters = self.ctx.load_frequency_words(
                    self.frequency_file
                )
                return ({}, {}, {}, {}, word_groups, filter_words, global_filters)

            total_titles = sum(len(titles) for titles in all_results.values())
            if not quiet:
                print(f"读取到 {total_titles} 个标题（已按当前监控平台过滤）")

            new_titles = self.ctx.detect_new_titles(current_platform_ids, quiet=quiet)
            word_groups, filter_words, global_filters = self.ctx.load_frequency_words(self.frequency_file)

            return (
                all_results,
                id_to_name,
                title_info,
                new_titles,
                word_groups,
                filter_words,
                global_filters,
            )
        except Exception as e:
            print(f"数据加载失败: {e}")
            return None

    def _prepare_current_title_info(self, results: Dict, time_info: str) -> Dict:
        """从当前抓取结果构建标题信息"""
        title_info = {}
        for source_id, titles_data in results.items():
            title_info[source_id] = {}
            for title, title_data in titles_data.items():
                ranks = title_data.get("ranks", [])
                url = title_data.get("url", "")
                mobile_url = title_data.get("mobileUrl", "")

                title_info[source_id][title] = {
                    "first_time": time_info,
                    "last_time": time_info,
                    "count": 1,
                    "ranks": ranks,
                    "url": url,
                    "mobileUrl": mobile_url,
                }
        return title_info

    def _prepare_standalone_data(
        self,
        results: Dict,
        id_to_name: Dict,
        title_info: Optional[Dict] = None,
        rss_items: Optional[List[Dict]] = None,
    ) -> Optional[Dict]:
        """
        从原始数据中提取独立展示区数据

        纯数据准备方法，不检查 display.regions.standalone 开关。
        各消费者自行决定是否使用：
        - AI 分析：由 ai.include_standalone 控制
        - 通知推送：由 display.regions.standalone 控制（在 dispatcher 层门控）
        - HTML 报告：始终包含（如果有数据）

        Args:
            results: 原始爬取结果 {platform_id: {title: title_data}}
            id_to_name: 平台 ID 到名称的映射
            title_info: 标题元信息（含排名历史、时间等）
            rss_items: RSS 条目列表

        Returns:
            独立展示数据字典，如果未配置数据源返回 None
        """
        display_config = self.ctx.config.get("DISPLAY", {})
        standalone_config = display_config.get("STANDALONE", {})

        platform_ids = standalone_config.get("PLATFORMS", [])
        rss_feed_ids = standalone_config.get("RSS_FEEDS", [])
        max_items = standalone_config.get("MAX_ITEMS", 20)

        if not platform_ids and not rss_feed_ids:
            return None

        standalone_data = {
            "platforms": [],
            "rss_feeds": [],
        }

        # 找出最新批次时间（类似 current 模式的过滤逻辑）
        latest_time = None
        if title_info:
            for source_titles in title_info.values():
                for title_data in source_titles.values():
                    last_time = title_data.get("last_time", "")
                    if last_time:
                        if latest_time is None or last_time > latest_time:
                            latest_time = last_time

        # 提取热榜平台数据
        for platform_id in platform_ids:
            if platform_id not in results:
                continue

            platform_name = id_to_name.get(platform_id, platform_id)
            platform_titles = results[platform_id]

            items = []
            for title, title_data in platform_titles.items():
                # 获取元信息（如果有 title_info）
                meta = {}
                if title_info and platform_id in title_info and title in title_info[platform_id]:
                    meta = title_info[platform_id][title]

                # 只保留当前在榜的话题（last_time 等于最新时间）
                if latest_time and meta:
                    if meta.get("last_time") != latest_time:
                        continue

                # 使用当前热榜的排名数据（title_data）进行排序
                # title_data 包含的是爬虫返回的当前排名，用于保证独立展示区的顺序与热榜一致
                current_ranks = title_data.get("ranks", [])
                current_rank = current_ranks[-1] if current_ranks else 0

                # 用于显示的排名范围：合并历史排名和当前排名
                historical_ranks = meta.get("ranks", []) if meta else []
                # 合并去重，保持顺序
                all_ranks = historical_ranks.copy()
                for rank in current_ranks:
                    if rank not in all_ranks:
                        all_ranks.append(rank)
                display_ranks = all_ranks if all_ranks else current_ranks

                item = {
                    "title": title,
                    "url": title_data.get("url", ""),
                    "mobileUrl": title_data.get("mobileUrl", ""),
                    "rank": current_rank,  # 用于排序的当前排名
                    "ranks": display_ranks,  # 用于显示的排名范围（历史+当前）
                    "first_time": meta.get("first_time", ""),
                    "last_time": meta.get("last_time", ""),
                    "count": meta.get("count", 1),
                    "rank_timeline": meta.get("rank_timeline", []),
                }
                items.append(item)

            # 按当前排名排序
            items.sort(key=lambda x: x["rank"] if x["rank"] > 0 else 9999)

            # 限制条数
            if max_items > 0:
                items = items[:max_items]

            if items:
                standalone_data["platforms"].append({
                    "id": platform_id,
                    "name": platform_name,
                    "items": items,
                })

        # 提取 RSS 数据
        if rss_items and rss_feed_ids:
            # 按 feed_id 分组
            feed_items_map = {}
            for item in rss_items:
                feed_id = item.get("feed_id", "")
                if feed_id in rss_feed_ids:
                    if feed_id not in feed_items_map:
                        feed_items_map[feed_id] = {
                            "name": item.get("feed_name", feed_id),
                            "items": [],
                        }
                    feed_items_map[feed_id]["items"].append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "published_at": item.get("published_at", ""),
                        "author": item.get("author", ""),
                    })

            # 限制条数并添加到结果
            for feed_id in rss_feed_ids:
                if feed_id in feed_items_map:
                    feed_data = feed_items_map[feed_id]
                    items = feed_data["items"]
                    if max_items > 0:
                        items = items[:max_items]
                    if items:
                        standalone_data["rss_feeds"].append({
                            "id": feed_id,
                            "name": feed_data["name"],
                            "items": items,
                        })

        # 如果没有任何数据，返回 None
        if not standalone_data["platforms"] and not standalone_data["rss_feeds"]:
            return None

        return standalone_data

    @staticmethod
    def _count_grouped_titles(grouped_stats: Optional[List[Dict]]) -> int:
        """统计 grouped stats 中实际展示的标题数"""
        if not grouped_stats:
            return 0
        return sum(
            len(stat.get("titles", []))
            for stat in grouped_stats
            if stat.get("count", 0) > 0
        )

    def _select_primary_stats(
        self,
        hotlist_stats: Optional[List[Dict]],
        rss_stats: Optional[List[Dict]],
    ) -> Tuple[List[Dict], Optional[List[Dict]], bool]:
        """选择主资讯区的 grouped stats，并避免 RSS 在主区/副区重复展示"""
        normalized_hotlist_stats = hotlist_stats or []
        normalized_rss_stats = rss_stats or []

        if normalized_hotlist_stats:
            return normalized_hotlist_stats, rss_stats, False

        if normalized_rss_stats:
            print("[展示] 热榜主区为空，使用 RSS / AI 结果作为主资讯区")
            return normalized_rss_stats, None, True

        return [], rss_stats, False

    def _normalize_ai_analysis_inputs(
        self,
        stats: Optional[List[Dict]],
        rss_items: Optional[List[Dict]],
    ) -> Tuple[List[Dict], Optional[List[Dict]]]:
        """热榜关闭且 RSS 已接管主区时，按 RSS 语义组织 AI 分析输入。"""
        normalized_stats = stats or []
        normalized_rss_items = rss_items or None

        if (
            not self.ctx.config.get("ENABLE_CRAWLER", True)
            and normalized_stats
            and not normalized_rss_items
        ):
            return [], normalized_stats

        return normalized_stats, normalized_rss_items

    def _run_analysis_pipeline(
        self,
        data_source: Dict,
        mode: str,
        title_info: Dict,
        new_titles: Dict,
        word_groups: List[Dict],
        filter_words: List[str],
        id_to_name: Dict,
        failed_ids: Optional[List] = None,
        global_filters: Optional[List[str]] = None,
        quiet: bool = False,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        standalone_data: Optional[Dict] = None,
        schedule: ResolvedSchedule = None,
        rss_new_urls: Optional[set] = None,
    ) -> Tuple[List[Dict], Optional[str], Optional[AIAnalysisResult], Optional[List[Dict]]]:
        """统一的分析流水线：数据处理 → 统计计算（关键词/AI筛选）→ AI分析 → HTML生成"""
        total_titles = 0

        # 根据筛选策略选择数据处理方式
        if self.filter_method == "ai":
            # === AI 筛选策略 ===
            print("[筛选] 使用 AI 智能筛选策略")
            ai_filter_result = self.ctx.run_ai_filter(interests_file=self.interests_file)

            if ai_filter_result and ai_filter_result.success:
                print(f"[筛选] AI 筛选完成: {ai_filter_result.total_matched} 条匹配, {len(ai_filter_result.tags)} 个标签")
                # 转换为与关键词匹配相同的数据结构
                stats, ai_rss_stats = self.ctx.convert_ai_filter_to_report_data(
                    ai_filter_result, mode=mode,
                    new_titles=new_titles, rss_new_urls=rss_new_urls,
                )

                # AI 筛选的 RSS 结果替换关键词匹配的 RSS 结果
                if ai_rss_stats:
                    rss_items = ai_rss_stats
            else:
                # AI 筛选失败，回退到关键词匹配
                error_msg = ai_filter_result.error if ai_filter_result else "未知错误"
                print(f"[筛选] AI 筛选失败: {error_msg}，回退到关键词匹配")
                stats, total_titles = self.ctx.count_frequency(
                    data_source, word_groups, filter_words,
                    id_to_name, title_info, new_titles,
                    mode=mode, global_filters=global_filters, quiet=quiet,
                )
        else:
            # === 关键词匹配策略（默认）===
            stats, total_titles = self.ctx.count_frequency(
                data_source, word_groups, filter_words,
                id_to_name, title_info, new_titles,
                mode=mode, global_filters=global_filters, quiet=quiet,
            )

        stats, rss_items, rss_promoted = self._select_primary_stats(stats, rss_items)

        # 如果是 platform 模式，转换数据结构
        if self.ctx.display_mode == "platform" and stats:
            stats = convert_keyword_stats_to_platform_stats(
                stats,
                self.ctx.weight_config,
                self.ctx.rank_threshold,
            )

        if self.ctx.display_mode == "platform" and rss_items:
            rss_items = convert_keyword_stats_to_platform_stats(
                rss_items,
                self.ctx.weight_config,
                self.ctx.rank_threshold,
            )

        total_titles = (
            self._count_grouped_titles(stats)
            + self._count_grouped_titles(rss_items)
        )

        if rss_promoted:
            print(f"[展示] 主资讯区已切换为 RSS / AI 分组，共 {self._count_grouped_titles(stats)} 条")

        ai_stats_input, ai_rss_input = self._normalize_ai_analysis_inputs(stats, rss_items)

        # AI 分析（如果启用，用于 HTML 报告）
        ai_result = None
        ai_config = self.ctx.config.get("AI_ANALYSIS", {})
        if ai_config.get("ENABLED", False) and (ai_stats_input or ai_rss_input):
            # 获取模式策略来确定报告类型
            mode_strategy = self._get_mode_strategy()
            report_type = mode_strategy["report_type"]
            ai_result = self._run_ai_analysis(
                ai_stats_input, ai_rss_input, mode, report_type, id_to_name,
                current_results=data_source, schedule=schedule,
                standalone_data=standalone_data
            )

        # HTML生成（如果启用）
        html_file = None
        if self.ctx.config["STORAGE"]["FORMATS"]["HTML"]:
            html_file = self.ctx.generate_html(
                stats,
                total_titles,
                failed_ids=failed_ids,
                new_titles=new_titles,
                id_to_name=id_to_name,
                mode=mode,
                update_info=self.update_info if self.ctx.config["SHOW_VERSION_UPDATE"] else None,
                rss_items=rss_items,
                rss_new_items=rss_new_items,
                ai_analysis=ai_result,
                standalone_data=standalone_data,
                frequency_file=self.frequency_file,
            )

        return stats, html_file, ai_result, rss_items

    def _send_notification_if_needed(
        self,
        stats: List[Dict],
        report_type: str,
        mode: str,
        failed_ids: Optional[List] = None,
        new_titles: Optional[Dict] = None,
        id_to_name: Optional[Dict] = None,
        html_file_path: Optional[str] = None,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        standalone_data: Optional[Dict] = None,
        ai_result: Optional[AIAnalysisResult] = None,
        current_results: Optional[Dict] = None,
        schedule: ResolvedSchedule = None,
    ) -> bool:
        """统一的通知发送逻辑，包含所有判断条件，支持热榜+RSS合并推送+AI分析+独立展示区"""
        has_notification = self._has_notification_configured()
        cfg = self.ctx.config

        # 检查是否有有效内容（主资讯区或 RSS 补充区）
        has_news_content = self._has_valid_content(stats, new_titles)
        has_rss_content = bool(rss_items and len(rss_items) > 0)
        has_any_content = has_news_content or has_rss_content

        # 计算主资讯区与 RSS 补充区条数
        news_count = sum(len(stat.get("titles", [])) for stat in stats) if stats else 0
        rss_count = sum(stat.get("count", 0) for stat in rss_items) if rss_items else 0

        if (
            cfg["ENABLE_NOTIFICATION"]
            and has_notification
            and has_any_content
        ):
            # 输出推送内容统计
            content_parts = []
            if news_count > 0:
                content_parts.append(f"主区 {news_count} 条")
            if rss_count > 0:
                content_parts.append(f"RSS {rss_count} 条")
            total_count = news_count + rss_count
            print(f"[推送] 准备发送：{' + '.join(content_parts)}，合计 {total_count} 条")

            # 调度系统决策
            if not schedule.push:
                print("[推送] 调度器: 当前时间段不执行推送")
                return False

            if schedule.once_push and schedule.period_key:
                scheduler = self.ctx.create_scheduler()
                date_str = self.ctx.format_date()
                if scheduler.already_executed(schedule.period_key, "push", date_str):
                    print(f"[推送] 调度器: 时间段 {schedule.period_name or schedule.period_key} 今天已推送过，跳过")
                    return False
                else:
                    print(f"[推送] 调度器: 时间段 {schedule.period_name or schedule.period_key} 今天首次推送")

            # AI 分析：优先使用传入的结果，避免重复分析
            if ai_result is None:
                ai_config = cfg.get("AI_ANALYSIS", {})
                if ai_config.get("ENABLED", False):
                    ai_stats_input, ai_rss_input = self._normalize_ai_analysis_inputs(
                        stats, rss_items
                    )
                    ai_result = self._run_ai_analysis(
                        ai_stats_input, ai_rss_input, mode, report_type, id_to_name,
                        current_results=current_results, schedule=schedule
                    )

            # 准备报告数据
            report_data = self.ctx.prepare_report(stats, failed_ids, new_titles, id_to_name, mode, frequency_file=self.frequency_file)

            # 是否发送版本更新信息
            update_info_to_send = self.update_info if cfg["SHOW_VERSION_UPDATE"] else None

            # 使用 NotificationDispatcher 发送到所有渠道
            dispatcher = self.ctx.create_notification_dispatcher()
            results = dispatcher.dispatch_all(
                report_data=report_data,
                report_type=report_type,
                update_info=update_info_to_send,
                proxy_url=self.proxy_url,
                mode=mode,
                html_file_path=html_file_path,
                rss_items=rss_items,
                rss_new_items=rss_new_items,
                ai_analysis=ai_result,
                standalone_data=standalone_data,
            )

            if not results:
                print("未配置任何通知渠道，跳过通知发送")
                return False

            # 记录推送成功
            if any(results.values()):
                if schedule.once_push and schedule.period_key:
                    scheduler = self.ctx.create_scheduler()
                    date_str = self.ctx.format_date()
                    scheduler.record_execution(schedule.period_key, "push", date_str)

            return True

        elif cfg["ENABLE_NOTIFICATION"] and not has_notification:
            print("⚠️ 警告：通知功能已启用但未配置任何通知渠道，将跳过通知发送")
        elif not cfg["ENABLE_NOTIFICATION"]:
            print(f"跳过{report_type}通知：通知功能已禁用")
        elif (
            cfg["ENABLE_NOTIFICATION"]
            and has_notification
            and not has_any_content
        ):
            mode_strategy = self._get_mode_strategy()
            if self.report_mode == "incremental":
                if not has_rss_content:
                    print("跳过通知：增量模式下未检测到匹配的新闻和RSS")
                else:
                    print("跳过通知：增量模式下新闻未匹配到关键词")
            else:
                print(
                    f"跳过通知：{mode_strategy['mode_name']}下未检测到匹配的新闻"
                )

        return False

    def _initialize_and_check_config(self) -> None:
        """通用初始化和配置检查"""
        now = self.ctx.get_time()
        print(f"当前北京时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")

        if not self.ctx.config["ENABLE_CRAWLER"]:
            print("热榜抓取已禁用（ENABLE_CRAWLER=False），将继续处理 RSS / AI 流程")

        has_notification = self._has_notification_configured()
        if not self.ctx.config["ENABLE_NOTIFICATION"]:
            print("通知功能已禁用（ENABLE_NOTIFICATION=False），将只进行数据抓取")
        elif not has_notification:
            print("未配置任何通知渠道，将只进行数据抓取，不发送通知")
        else:
            print("通知功能已启用，将发送通知")

        mode_strategy = self._get_mode_strategy()
        print(f"报告模式: {self.report_mode}")
        print(f"运行模式: {mode_strategy['description']}")

    def _crawl_data(self) -> Tuple[Dict, Dict, List]:
        """执行数据爬取"""
        if not self.ctx.config.get("ENABLE_CRAWLER", True):
            print("跳过热榜抓取：平台抓取已关闭")
            return {}, {}, []

        if not self.ctx.platforms:
            print("跳过热榜抓取：未配置任何监控平台")
            return {}, {}, []

        ids = []
        for platform in self.ctx.platforms:
            if "name" in platform:
                ids.append((platform["id"], platform["name"]))
            else:
                ids.append(platform["id"])

        print(
            f"配置的监控平台: {[p.get('name', p['id']) for p in self.ctx.platforms]}"
        )
        print(f"开始爬取数据，请求间隔 {self.request_interval} 毫秒")
        Path("output").mkdir(parents=True, exist_ok=True)

        results, id_to_name, failed_ids = self.data_fetcher.crawl_websites(
            ids, self.request_interval
        )

        # 转换为 NewsData 格式并保存到存储后端
        crawl_time = self.ctx.format_time()
        crawl_date = self.ctx.format_date()
        news_data = convert_crawl_results_to_news_data(
            results, id_to_name, failed_ids, crawl_time, crawl_date
        )

        # 保存到存储后端（SQLite）
        if self.storage_manager.save_news_data(news_data):
            print(f"数据已保存到存储后端: {self.storage_manager.backend_name}")

        # 保存 TXT 快照（如果启用）
        txt_file = self.storage_manager.save_txt_snapshot(news_data)
        if txt_file:
            print(f"TXT 快照已保存: {txt_file}")

        return results, id_to_name, failed_ids

    def _crawl_rss_data(self) -> Tuple[Optional[List[Dict]], Optional[List[Dict]], Optional[List[Dict]], set]:
        """
        执行 RSS 数据抓取

        Returns:
            (rss_items, rss_new_items, raw_rss_items, rss_new_urls) 元组：
            - rss_items: 统计条目列表（按模式处理，用于统计区块）
            - rss_new_items: 新增条目列表（用于新增区块）
            - raw_rss_items: 原始 RSS 条目列表（用于独立展示区）
            - rss_new_urls: 原始新增 RSS 条目的 URL 集合（用于 AI 模式 is_new 检测）
            如果未启用或失败返回 (None, None, None, set())
        """
        if not self.ctx.rss_enabled:
            return None, None, None, set()

        rss_feeds = self.ctx.rss_feeds
        if not rss_feeds:
            print("[RSS] 未配置任何 RSS 源")
            return None, None, None, set()

        try:
            from trendradar.crawler.rss import RSSFetcher, RSSFeedConfig

            # 构建 RSS 源配置
            feeds = []
            for feed_config in rss_feeds:
                # 读取并验证单个 feed 的 max_age_days（可选）
                max_age_days_raw = feed_config.get("max_age_days")
                max_age_days = None
                if max_age_days_raw is not None:
                    try:
                        max_age_days = int(max_age_days_raw)
                        if max_age_days < 0:
                            feed_id = feed_config.get("id", "unknown")
                            print(f"[警告] RSS feed '{feed_id}' 的 max_age_days 为负数，将使用全局默认值")
                            max_age_days = None
                    except (ValueError, TypeError):
                        feed_id = feed_config.get("id", "unknown")
                        print(f"[警告] RSS feed '{feed_id}' 的 max_age_days 格式错误：{max_age_days_raw}")
                        max_age_days = None

                feed = RSSFeedConfig(
                    id=feed_config.get("id", ""),
                    name=feed_config.get("name", ""),
                    url=feed_config.get("url", ""),
                    max_items=feed_config.get("max_items", 50),
                    enabled=feed_config.get("enabled", True),
                    max_age_days=max_age_days,  # None=使用全局，0=禁用，>0=覆盖
                )
                if feed.id and feed.url and feed.enabled:
                    feeds.append(feed)

            if not feeds:
                print("[RSS] 没有启用的 RSS 源")
                return None, None, None, set()

            # 创建抓取器
            rss_config = self.ctx.rss_config
            # RSS 代理：优先使用 RSS 专属代理，否则使用爬虫默认代理
            rss_proxy_url = rss_config.get("PROXY_URL", "") or self.proxy_url or ""
            # 获取配置的时区
            timezone = self.ctx.config.get("TIMEZONE", DEFAULT_TIMEZONE)
            # 获取新鲜度过滤配置
            freshness_config = rss_config.get("FRESHNESS_FILTER", {})
            freshness_enabled = freshness_config.get("ENABLED", True)
            default_max_age_days = freshness_config.get("MAX_AGE_DAYS", 3)

            fetcher = RSSFetcher(
                feeds=feeds,
                request_interval=rss_config.get("REQUEST_INTERVAL", 2000),
                timeout=rss_config.get("TIMEOUT", 15),
                use_proxy=rss_config.get("USE_PROXY", False),
                proxy_url=rss_proxy_url,
                timezone=timezone,
                freshness_enabled=freshness_enabled,
                default_max_age_days=default_max_age_days,
            )

            # 抓取数据
            rss_data = fetcher.fetch_all()

            # 保存到存储后端
            if self.storage_manager.save_rss_data(rss_data):
                print(f"[RSS] 数据已保存到存储后端")

                # 处理 RSS 数据（按模式过滤）并返回用于合并推送
                return self._process_rss_data_by_mode(rss_data)
            else:
                print(f"[RSS] 数据保存失败")
                return None, None, None, set()

        except ImportError as e:
            print(f"[RSS] 缺少依赖: {e}")
            print("[RSS] 请安装 feedparser: pip install feedparser")
            return None, None, None, set()
        except Exception as e:
            print(f"[RSS] 抓取失败: {e}")
            return None, None, None, set()

    def _process_rss_data_by_mode(self, rss_data) -> Tuple[Optional[List[Dict]], Optional[List[Dict]], Optional[List[Dict]], set]:
        """
        按报告模式处理 RSS 数据，返回与热榜相同格式的统计结构

        三种模式：
        - daily: 当日汇总，统计=当天所有条目，新增=本次新增条目
        - current: 当前榜单，统计=当前榜单条目，新增=本次新增条目
        - incremental: 增量模式，统计=新增条目，新增=无

        Args:
            rss_data: 当前抓取的 RSSData 对象

        Returns:
            (rss_stats, rss_new_stats, raw_rss_items, rss_new_urls) 元组：
            - rss_stats: RSS 关键词统计列表（与热榜 stats 格式一致）
            - rss_new_stats: RSS 新增关键词统计列表（与热榜 stats 格式一致）
            - raw_rss_items: 原始 RSS 条目列表（用于独立展示区）
            - rss_new_urls: 原始新增 RSS 条目的 URL 集合（未经关键词过滤，用于 AI 模式 is_new 检测）
        """
        from trendradar.core.analyzer import count_rss_frequency

        # 从 display.regions.rss 统一控制 RSS 分析和展示
        rss_display_enabled = self.ctx.config.get("DISPLAY", {}).get("REGIONS", {}).get("RSS", True)

        # 加载关键词配置
        try:
            word_groups, filter_words, global_filters = self.ctx.load_frequency_words(self.frequency_file)
        except FileNotFoundError:
            word_groups, filter_words, global_filters = [], [], []

        timezone = self.ctx.timezone
        max_news_per_keyword = self.ctx.config.get("MAX_NEWS_PER_KEYWORD", 0)
        sort_by_position_first = self.ctx.config.get("SORT_BY_POSITION_FIRST", False)

        rss_stats = None
        rss_new_stats = None
        raw_rss_items = None  # 原始 RSS 条目列表（用于独立展示区）
        rss_new_urls = set()  # 原始新增 RSS URLs（未经关键词过滤）

        # 1. 首先获取原始条目（用于独立展示区，不受 display.regions.rss 影响）
        # 根据模式获取原始条目
        if self.report_mode == "incremental":
            new_items_dict = self.storage_manager.detect_new_rss_items(rss_data)
            if new_items_dict:
                raw_rss_items = self._convert_rss_items_to_list(new_items_dict, rss_data.id_to_name)
        elif self.report_mode == "current":
            latest_data = self.storage_manager.get_latest_rss_data(rss_data.date)
            if latest_data:
                raw_rss_items = self._convert_rss_items_to_list(latest_data.items, latest_data.id_to_name)
        else:  # daily
            all_data = self.storage_manager.get_rss_data(rss_data.date)
            if all_data:
                raw_rss_items = self._convert_rss_items_to_list(all_data.items, all_data.id_to_name)

        # 如果 RSS 展示未启用，跳过关键词分析，只返回原始条目用于独立展示区
        if not rss_display_enabled:
            return None, None, raw_rss_items, rss_new_urls

        # 2. 获取新增条目（用于统计）
        new_items_dict = self.storage_manager.detect_new_rss_items(rss_data)
        new_items_list = None
        if new_items_dict:
            new_items_list = self._convert_rss_items_to_list(new_items_dict, rss_data.id_to_name)
            if new_items_list:
                print(f"[RSS] 检测到 {len(new_items_list)} 条新增")
                # 收集原始新增 URLs（未经关键词过滤，用于 AI 模式 is_new 检测）
                rss_new_urls = {item["url"] for item in new_items_list if item.get("url")}

        # 3. 根据模式获取统计条目
        if self.report_mode == "incremental":
            # 增量模式：统计条目就是新增条目
            if not new_items_list:
                print("[RSS] 增量模式：没有新增 RSS 条目")
                return None, None, raw_rss_items, rss_new_urls

            rss_stats, total = count_rss_frequency(
                rss_items=new_items_list,
                word_groups=word_groups,
                filter_words=filter_words,
                global_filters=global_filters,
                new_items=new_items_list,  # 增量模式所有都是新增
                max_news_per_keyword=max_news_per_keyword,
                sort_by_position_first=sort_by_position_first,
                timezone=timezone,
                rank_threshold=self.rank_threshold,
                quiet=False,
            )
            if not rss_stats:
                print("[RSS] 增量模式：关键词匹配后没有内容")
                # 即使关键词匹配为空，也返回原始条目用于独立展示区
                return None, None, raw_rss_items, rss_new_urls

        elif self.report_mode == "current":
            # 当前榜单模式：统计=当前榜单所有条目
            # raw_rss_items 已在前面获取
            if not raw_rss_items:
                print("[RSS] 当前榜单模式：没有 RSS 数据")
                return None, None, None, rss_new_urls

            rss_stats, total = count_rss_frequency(
                rss_items=raw_rss_items,
                word_groups=word_groups,
                filter_words=filter_words,
                global_filters=global_filters,
                new_items=new_items_list,  # 标记新增
                max_news_per_keyword=max_news_per_keyword,
                sort_by_position_first=sort_by_position_first,
                timezone=timezone,
                rank_threshold=self.rank_threshold,
                quiet=False,
            )
            if not rss_stats:
                print("[RSS] 当前榜单模式：关键词匹配后没有内容")
                # 即使关键词匹配为空，也返回原始条目用于独立展示区
                return None, None, raw_rss_items, rss_new_urls

            # 生成新增统计
            if new_items_list:
                rss_new_stats, _ = count_rss_frequency(
                    rss_items=new_items_list,
                    word_groups=word_groups,
                    filter_words=filter_words,
                    global_filters=global_filters,
                    new_items=new_items_list,
                    max_news_per_keyword=max_news_per_keyword,
                    sort_by_position_first=sort_by_position_first,
                    timezone=timezone,
                    rank_threshold=self.rank_threshold,
                    quiet=True,
                )

        else:
            # daily 模式：统计=当天所有条目
            # raw_rss_items 已在前面获取
            if not raw_rss_items:
                print("[RSS] 当日汇总模式：没有 RSS 数据")
                return None, None, None, rss_new_urls

            rss_stats, total = count_rss_frequency(
                rss_items=raw_rss_items,
                word_groups=word_groups,
                filter_words=filter_words,
                global_filters=global_filters,
                new_items=new_items_list,  # 标记新增
                max_news_per_keyword=max_news_per_keyword,
                sort_by_position_first=sort_by_position_first,
                timezone=timezone,
                rank_threshold=self.rank_threshold,
                quiet=False,
            )
            if not rss_stats:
                print("[RSS] 当日汇总模式：关键词匹配后没有内容")
                # 即使关键词匹配为空，也返回原始条目用于独立展示区
                return None, None, raw_rss_items, rss_new_urls

            # 生成新增统计
            if new_items_list:
                rss_new_stats, _ = count_rss_frequency(
                    rss_items=new_items_list,
                    word_groups=word_groups,
                    filter_words=filter_words,
                    global_filters=global_filters,
                    new_items=new_items_list,
                    max_news_per_keyword=max_news_per_keyword,
                    sort_by_position_first=sort_by_position_first,
                    timezone=timezone,
                    rank_threshold=self.rank_threshold,
                    quiet=True,
                )

        return rss_stats, rss_new_stats, raw_rss_items, rss_new_urls

    def _convert_rss_items_to_list(self, items_dict: Dict, id_to_name: Dict) -> List[Dict]:
        """将 RSS 条目字典转换为列表格式，并应用新鲜度过滤（用于推送）"""
        rss_items = []
        filtered_count = 0
        filtered_details = []  # 用于 DEBUG 模式下的详细日志

        # 获取新鲜度过滤配置
        rss_config = self.ctx.rss_config
        freshness_config = rss_config.get("FRESHNESS_FILTER", {})
        freshness_enabled = freshness_config.get("ENABLED", True)
        default_max_age_days = freshness_config.get("MAX_AGE_DAYS", 3)
        timezone = self.ctx.config.get("TIMEZONE", DEFAULT_TIMEZONE)
        debug_mode = self.ctx.config.get("DEBUG", False)

        # 构建 feed_id -> max_age_days 的映射
        feed_max_age_map = {}
        for feed_cfg in self.ctx.rss_feeds:
            feed_id = feed_cfg.get("id", "")
            max_age = feed_cfg.get("max_age_days")
            if max_age is not None:
                try:
                    feed_max_age_map[feed_id] = int(max_age)
                except (ValueError, TypeError):
                    pass

        for feed_id, items in items_dict.items():
            # 确定此 feed 的 max_age_days
            max_days = feed_max_age_map.get(feed_id)
            if max_days is None:
                max_days = default_max_age_days

            for item in items:
                # 应用新鲜度过滤（仅在启用时）
                if freshness_enabled and max_days > 0:
                    if item.published_at and not is_within_days(item.published_at, max_days, timezone):
                        filtered_count += 1
                        # 记录详细信息用于 DEBUG 模式
                        if debug_mode:
                            days_old = calculate_days_old(item.published_at, timezone)
                            feed_name = id_to_name.get(feed_id, feed_id)
                            filtered_details.append({
                                "title": item.title[:50] + "..." if len(item.title) > 50 else item.title,
                                "feed": feed_name,
                                "days_old": days_old,
                                "max_days": max_days,
                            })
                        continue  # 跳过超过指定天数的文章

                rss_items.append({
                    "title": item.title,
                    "feed_id": feed_id,
                    "feed_name": id_to_name.get(feed_id, feed_id),
                    "url": item.url,
                    "published_at": item.published_at,
                    "summary": item.summary,
                    "author": item.author,
                })

        # 输出过滤统计
        if filtered_count > 0:
            print(f"[RSS] 新鲜度过滤：跳过 {filtered_count} 篇超过指定天数的旧文章（仍保留在数据库中）")
            # DEBUG 模式下显示详细信息
            if debug_mode and filtered_details:
                print(f"[RSS] 被过滤的文章详情（共 {len(filtered_details)} 篇）：")
                for detail in filtered_details[:10]:  # 最多显示 10 条
                    days_str = f"{detail['days_old']:.1f}" if detail['days_old'] else "未知"
                    print(f"  - [{days_str}天前] [{detail['feed']}] {detail['title']} (限制: {detail['max_days']}天)")
                if len(filtered_details) > 10:
                    print(f"  ... 还有 {len(filtered_details) - 10} 篇被过滤")

        return rss_items

    def _filter_rss_by_keywords(self, rss_items: List[Dict]) -> List[Dict]:
        """使用关键词文件过滤 RSS 条目"""
        try:
            word_groups, filter_words, global_filters = self.ctx.load_frequency_words(self.frequency_file)
            if word_groups or filter_words or global_filters:
                from trendradar.core.frequency import matches_word_groups
                filtered_items = []
                for item in rss_items:
                    title = item.get("title", "")
                    if matches_word_groups(title, word_groups, filter_words, global_filters):
                        filtered_items.append(item)

                original_count = len(rss_items)
                rss_items = filtered_items
                print(f"[RSS] 关键词过滤后剩余 {len(rss_items)}/{original_count} 条")

                if not rss_items:
                    print("[RSS] 关键词过滤后没有匹配内容")
                    return []
        except FileNotFoundError:
            # 关键词文件不存在时跳过过滤
            pass
        return rss_items

    def _generate_rss_html_report(self, rss_items: list, feeds_info: dict) -> str:
        """生成 RSS HTML 报告"""
        try:
            from trendradar.report.rss_html import render_rss_html_content
            from pathlib import Path

            html_content = render_rss_html_content(
                rss_items=rss_items,
                total_count=len(rss_items),
                feeds_info=feeds_info,
                get_time_func=self.ctx.get_time,
            )

            # 保存 HTML 文件（扁平化结构：output/html/日期/）
            date_folder = self.ctx.format_date()
            time_filename = self.ctx.format_time()
            output_dir = Path("output") / "html" / date_folder
            output_dir.mkdir(parents=True, exist_ok=True)

            file_path = output_dir / f"rss_{time_filename}.html"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            print(f"[RSS] HTML 报告已生成: {file_path}")
            return str(file_path)

        except Exception as e:
            print(f"[RSS] 生成 HTML 报告失败: {e}")
            return None

    def _execute_mode_strategy(
        self, mode_strategy: Dict, results: Dict, id_to_name: Dict, failed_ids: List,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        raw_rss_items: Optional[List[Dict]] = None,
        rss_new_urls: Optional[set] = None,
    ) -> Optional[str]:
        """执行模式特定逻辑，支持热榜+RSS合并推送

        简化后的逻辑：
        - 每次运行都生成 HTML 报告（时间戳快照 + latest/{mode}.html + index.html）
        - 根据模式发送通知
        """
        # 调度系统
        scheduler = self.ctx.create_scheduler()
        schedule = scheduler.resolve()

        # 使用 schedule 决定的 report_mode 覆盖全局配置
        effective_mode = schedule.report_mode
        if effective_mode != self.report_mode:
            print(f"[调度] 报告模式覆盖: {self.report_mode} -> {effective_mode}")
        self.report_mode = effective_mode

        # 重新获取 mode_strategy，确保 report_type 与覆盖后的 report_mode 一致
        mode_strategy = self._get_mode_strategy()

        # 使用 schedule 决定的 frequency_file 覆盖默认值
        self.frequency_file = schedule.frequency_file

        # 使用 schedule 决定的筛选策略覆盖默认值
        self.filter_method = schedule.filter_method or self.ctx.filter_method

        # 使用 schedule 决定的 AI 筛选兴趣文件覆盖默认值
        self.interests_file = schedule.interests_file

        # 如果调度器说不采集，则直接跳过
        if not schedule.collect:
            print("[调度] 当前时间段不执行数据采集，跳过分析流水线")
            return None
        # 获取当前监控平台ID列表
        current_platform_ids = (
            self.ctx.platform_ids if self.ctx.config.get("ENABLE_CRAWLER", True) else []
        )

        new_titles = (
            self.ctx.detect_new_titles(current_platform_ids) if current_platform_ids else {}
        )
        time_info = self.ctx.format_time()
        word_groups, filter_words, global_filters = self.ctx.load_frequency_words(self.frequency_file)

        html_file = None
        stats = []
        ai_result = None
        title_info = None

        # current 模式需要使用完整的历史数据
        if self.report_mode == "current":
            analysis_data = self._load_analysis_data()
            if analysis_data:
                (
                    all_results,
                    historical_id_to_name,
                    historical_title_info,
                    historical_new_titles,
                    _,
                    _,
                    _,
                ) = analysis_data

                print(
                    f"current模式：使用过滤后的历史数据，包含平台：{list(all_results.keys())}"
                )

                # 使用历史数据准备独立展示区数据（包含完整的 title_info）
                standalone_data = self._prepare_standalone_data(
                    all_results, historical_id_to_name, historical_title_info, raw_rss_items
                )

                stats, html_file, ai_result, rss_items = self._run_analysis_pipeline(
                    all_results,
                    self.report_mode,
                    historical_title_info,
                    historical_new_titles,
                    word_groups,
                    filter_words,
                    historical_id_to_name,
                    failed_ids=failed_ids,
                    global_filters=global_filters,
                    rss_items=rss_items,
                    rss_new_items=rss_new_items,
                    standalone_data=standalone_data,
                    schedule=schedule,
                    rss_new_urls=rss_new_urls,
                )

                combined_id_to_name = {**historical_id_to_name, **id_to_name}
                new_titles = historical_new_titles
                id_to_name = combined_id_to_name
                title_info = historical_title_info
                results = all_results
            else:
                print("❌ 严重错误：无法读取刚保存的数据文件")
                raise RuntimeError("数据一致性检查失败：保存后立即读取失败")
        elif self.report_mode == "daily":
            # daily 模式：使用全天累计数据
            analysis_data = self._load_analysis_data()
            if analysis_data:
                (
                    all_results,
                    historical_id_to_name,
                    historical_title_info,
                    historical_new_titles,
                    _,
                    _,
                    _,
                ) = analysis_data

                # 使用历史数据准备独立展示区数据（包含完整的 title_info）
                standalone_data = self._prepare_standalone_data(
                    all_results, historical_id_to_name, historical_title_info, raw_rss_items
                )

                stats, html_file, ai_result, rss_items = self._run_analysis_pipeline(
                    all_results,
                    self.report_mode,
                    historical_title_info,
                    historical_new_titles,
                    word_groups,
                    filter_words,
                    historical_id_to_name,
                    failed_ids=failed_ids,
                    global_filters=global_filters,
                    rss_items=rss_items,
                    rss_new_items=rss_new_items,
                    standalone_data=standalone_data,
                    schedule=schedule,
                    rss_new_urls=rss_new_urls,
                )

                combined_id_to_name = {**historical_id_to_name, **id_to_name}
                new_titles = historical_new_titles
                id_to_name = combined_id_to_name
                title_info = historical_title_info
                results = all_results
            else:
                # 没有历史数据时使用当前数据
                title_info = self._prepare_current_title_info(results, time_info)
                standalone_data = self._prepare_standalone_data(
                    results, id_to_name, title_info, raw_rss_items
                )
                stats, html_file, ai_result, rss_items = self._run_analysis_pipeline(
                    results,
                    self.report_mode,
                    title_info,
                    new_titles,
                    word_groups,
                    filter_words,
                    id_to_name,
                    failed_ids=failed_ids,
                    global_filters=global_filters,
                    rss_items=rss_items,
                    rss_new_items=rss_new_items,
                    standalone_data=standalone_data,
                    schedule=schedule,
                    rss_new_urls=rss_new_urls,
                )
        else:
            # incremental 模式：只使用当前抓取的数据
            title_info = self._prepare_current_title_info(results, time_info)
            standalone_data = self._prepare_standalone_data(
                results, id_to_name, title_info, raw_rss_items
            )
            stats, html_file, ai_result, rss_items = self._run_analysis_pipeline(
                results,
                self.report_mode,
                title_info,
                new_titles,
                word_groups,
                filter_words,
                id_to_name,
                failed_ids=failed_ids,
                global_filters=global_filters,
                rss_items=rss_items,
                rss_new_items=rss_new_items,
                standalone_data=standalone_data,
                schedule=schedule,
                rss_new_urls=rss_new_urls,
            )

        if html_file:
            print(f"HTML报告已生成: {html_file}")
            print(f"最新报告已更新: output/html/latest/{self.report_mode}.html")

        # 发送通知
        if mode_strategy["should_send_notification"]:
            standalone_data = self._prepare_standalone_data(
                results, id_to_name, title_info, raw_rss_items
            )
            self._send_notification_if_needed(
                stats,
                mode_strategy["report_type"],
                self.report_mode,
                failed_ids=failed_ids,
                new_titles=new_titles,
                id_to_name=id_to_name,
                html_file_path=html_file,
                rss_items=rss_items,
                rss_new_items=rss_new_items,
                standalone_data=standalone_data,
                ai_result=ai_result,
                current_results=results,
                schedule=schedule,
            )

        # 打开浏览器（仅在非容器环境）
        if self._should_open_browser() and html_file:
            file_url = "file://" + str(Path(html_file).resolve())
            print(f"正在打开HTML报告: {file_url}")
            webbrowser.open(file_url)
        elif self.is_docker_container and html_file:
            print(f"HTML报告已生成（Docker环境）: {html_file}")

        return html_file

    def run(self) -> None:
        """执行分析流程"""
        try:
            self._initialize_and_check_config()

            mode_strategy = self._get_mode_strategy()

            # 抓取热榜数据
            results, id_to_name, failed_ids = self._crawl_data()

            # 抓取 RSS 数据（如果启用），返回统计条目、新增条目和原始条目
            rss_items, rss_new_items, raw_rss_items, rss_new_urls = self._crawl_rss_data()

            # 执行模式策略，传递 RSS 数据用于合并推送
            self._execute_mode_strategy(
                mode_strategy, results, id_to_name, failed_ids,
                rss_items=rss_items, rss_new_items=rss_new_items,
                raw_rss_items=raw_rss_items, rss_new_urls=rss_new_urls
            )

        except Exception as e:
            print(f"分析流程执行出错: {e}")
            if self.ctx.config.get("DEBUG", False):
                raise
        finally:
            # 清理资源（包括过期数据清理和数据库连接关闭）
            self.ctx.cleanup()


def _record_doctor_result(results: List[Tuple[str, str, str]], status: str, item: str, detail: str) -> None:
    """记录并打印 doctor 检查结果"""
    icon_map = {
        "pass": "✅",
        "warn": "⚠️",
        "fail": "❌",
    }
    icon = icon_map.get(status, "•")
    results.append((status, item, detail))
    print(f"{icon} {item}: {detail}")


def _save_doctor_report(
    results: List[Tuple[str, str, str]],
    pass_count: int,
    warn_count: int,
    fail_count: int,
    config_path: Optional[str],
) -> None:
    """保存 doctor 体检报告到 JSON 文件"""
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


def _run_doctor(config_path: Optional[str] = None) -> bool:
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
        _record_doctor_result(results, "pass", "Python版本", f"{py_version} (满足 >= 3.10)")
    else:
        _record_doctor_result(results, "fail", "Python版本", f"{py_version} (不满足 >= 3.10)")

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
            _record_doctor_result(results, "pass", desc, f"已找到: {path_str}")
        else:
            _record_doctor_result(results, "fail", desc, f"缺失: {path_str}")

    for path_str, desc in optional_files:
        if Path(path_str).exists():
            _record_doctor_result(results, "pass", desc, f"已找到: {path_str}")
        else:
            _record_doctor_result(results, "warn", desc, f"未找到: {path_str}（将使用默认调度模板）")

    # 3) 配置加载检查
    try:
        config = load_config(config_path)
        _record_doctor_result(results, "pass", "配置加载", f"加载成功: {config_path}")
    except Exception as e:
        _record_doctor_result(results, "fail", "配置加载", f"加载失败: {e}")

    # 后续检查依赖配置对象
    if config:
        # 4) 调度配置检查
        try:
            ctx = AppContext(config)
            schedule = ctx.create_scheduler().resolve()
            detail = f"调度解析成功（report_mode={schedule.report_mode}, ai_mode={schedule.ai_mode}）"
            _record_doctor_result(results, "pass", "调度配置", detail)
        except Exception as e:
            _record_doctor_result(results, "fail", "调度配置", f"解析失败: {e}")

        # 5) AI 配置检查（按功能场景区分严重级别）
        ai_analysis_enabled = config.get("AI_ANALYSIS", {}).get("ENABLED", False)
        ai_translation_enabled = config.get("AI_TRANSLATION", {}).get("ENABLED", False)
        ai_filter_enabled = config.get("FILTER", {}).get("METHOD", "keyword") == "ai"
        ai_enabled = ai_analysis_enabled or ai_translation_enabled or ai_filter_enabled

        if ai_enabled:
            try:
                from trendradar.ai.client import AIClient
                valid, message = AIClient(config.get("AI", {})).validate_config()
                if valid:
                    _record_doctor_result(results, "pass", "AI配置", f"模型: {config.get('AI', {}).get('MODEL', '')}")
                else:
                    # AI 分析/翻译是硬依赖；AI 筛选缺失时会自动回退关键词匹配
                    if ai_analysis_enabled or ai_translation_enabled:
                        _record_doctor_result(results, "fail", "AI配置", message)
                    else:
                        _record_doctor_result(results, "warn", "AI配置", f"{message}（AI 筛选将回退关键词模式）")
            except Exception as e:
                _record_doctor_result(results, "fail", "AI配置", f"校验异常: {e}")
        else:
            _record_doctor_result(results, "warn", "AI配置", "未启用 AI 功能，跳过校验")

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
                _record_doctor_result(
                    results, "fail", "存储配置",
                    f"remote 模式缺少配置: {', '.join(missing_remote_keys)}"
                )
            elif backend == "auto" and os.environ.get("GITHUB_ACTIONS") == "true" and missing_remote_keys:
                _record_doctor_result(
                    results, "warn", "存储配置",
                    "GitHub Actions + auto 模式未完整配置远程存储，可能导致数据丢失"
                )
            else:
                sm = AppContext(config).get_storage_manager()
                _record_doctor_result(results, "pass", "存储配置", f"当前后端: {sm.backend_name}")
        except Exception as e:
            _record_doctor_result(results, "fail", "存储配置", f"检查失败: {e}")

        # 7) 通知渠道配置检查
        channel_details = []
        channel_issues = []
        max_accounts = config.get("MAX_ACCOUNTS_PER_CHANNEL", 3)

        # 普通单值/多值渠道
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

        # Telegram 配对校验
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

        # ntfy 配对校验（token 可选）
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

        # 邮件配置完整性
        email_ready = all(
            [
                config.get("EMAIL_FROM"),
                config.get("EMAIL_PASSWORD"),
                config.get("EMAIL_TO"),
            ]
        )
        if email_ready:
            channel_details.append("邮件")
        elif any([config.get("EMAIL_FROM"), config.get("EMAIL_PASSWORD"), config.get("EMAIL_TO")]):
            channel_issues.append("邮件配置不完整（需要 from/password/to 同时配置）")

        if channel_issues and not channel_details:
            _record_doctor_result(results, "fail", "通知配置", "；".join(channel_issues))
        elif channel_issues and channel_details:
            detail = f"可用渠道: {', '.join(channel_details)}；问题: {'；'.join(channel_issues)}"
            _record_doctor_result(results, "warn", "通知配置", detail)
        elif channel_details:
            _record_doctor_result(results, "pass", "通知配置", f"可用渠道: {', '.join(channel_details)}")
        else:
            _record_doctor_result(results, "warn", "通知配置", "未配置任何通知渠道")

        # 8) 输出目录可写检查
        try:
            output_dir = Path("output")
            output_dir.mkdir(parents=True, exist_ok=True)
            probe_file = output_dir / ".doctor_write_probe"
            probe_file.write_text("ok", encoding="utf-8")
            probe_file.unlink(missing_ok=True)
            _record_doctor_result(results, "pass", "输出目录", f"可写: {output_dir}")
        except Exception as e:
            _record_doctor_result(results, "fail", "输出目录", f"不可写: {e}")

    pass_count = sum(1 for status, _, _ in results if status == "pass")
    warn_count = sum(1 for status, _, _ in results if status == "warn")
    fail_count = sum(1 for status, _, _ in results if status == "fail")

    _save_doctor_report(results, pass_count, warn_count, fail_count, config_path)

    print("-" * 60)
    print(f"体检结果: ✅ {pass_count} 项通过  ⚠️ {warn_count} 项警告  ❌ {fail_count} 项失败")
    print("=" * 60)

    if fail_count == 0:
        print("体检通过。")
        return True

    print("体检未通过，请先修复失败项。")
    return False


def _build_test_report_data(ctx: AppContext) -> Dict:
    """构造通知测试用报告数据"""
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
    """创建邮件测试用 HTML 文件"""
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


def _run_test_notification(config: Dict) -> bool:
    """发送测试通知到已配置渠道"""
    from trendradar.notification import NotificationDispatcher

    ctx = AppContext(config)

    try:
        # 检查是否配置了通知渠道
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
            ]
        )
        if not has_notification:
            print("未检测到可用通知渠道，请先在 config.yaml 或环境变量中配置。")
            return False

        # 测试时固定展示区域，避免用户关闭 HOTLIST 导致测试内容为空
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

        # 测试时禁用翻译，避免触发额外 AI 调用
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


def main():
    """主程序入口"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description="TrendRadar - 热点新闻聚合与分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
调度状态命令:
  --show-schedule        显示当前调度状态（时间段、行为开关）
诊断命令:
  --doctor               运行环境与配置体检
  --test-notification    发送测试通知到已配置渠道

示例:
  python -m trendradar                    # 正常运行
  python -m trendradar --show-schedule    # 查看当前调度状态
  python -m trendradar --doctor           # 运行一键体检
  python -m trendradar --test-notification # 测试通知渠道连通性
"""
    )
    parser.add_argument(
        "--show-schedule",
        action="store_true",
        help="显示当前调度状态"
    )
    parser.add_argument(
        "--doctor",
        action="store_true",
        help="运行环境与配置体检"
    )
    parser.add_argument(
        "--test-notification",
        action="store_true",
        help="发送测试通知到已配置渠道"
    )

    args = parser.parse_args()

    debug_mode = False
    try:
        # 处理 doctor 命令（不依赖完整运行流程）
        if args.doctor:
            ok = _run_doctor()
            if not ok:
                raise SystemExit(1)
            return

        # 先加载配置
        config = load_config()

        # 处理状态查看命令
        if args.show_schedule:
            _handle_status_commands(config)
            return

        # 处理通知测试命令
        if args.test_notification:
            ok = _run_test_notification(config)
            if not ok:
                raise SystemExit(1)
            return

        version_url = config.get("VERSION_CHECK_URL", "")
        configs_version_url = config.get("CONFIGS_VERSION_CHECK_URL", "")

        # 统一版本检查（程序版本 + 配置文件版本，只请求一次远程）
        need_update = False
        remote_version = None
        if version_url:
            need_update, remote_version = check_all_versions(version_url, configs_version_url)

        # 复用已加载的配置，避免重复加载
        analyzer = NewsAnalyzer(config=config)

        # 设置更新信息（复用已获取的远程版本，不再重复请求）
        if analyzer.is_github_actions and need_update and remote_version:
            analyzer.update_info = {
                "current_version": __version__,
                "remote_version": remote_version,
            }

        # 获取 debug 配置
        debug_mode = analyzer.ctx.config.get("DEBUG", False)
        analyzer.run()
    except FileNotFoundError as e:
        print(f"❌ 配置文件错误: {e}")
        print("\n请确保以下文件存在:")
        print("  • config/config.yaml")
        print("  • config/frequency_words.txt")
        print("\n参考项目文档进行正确配置")
    except Exception as e:
        print(f"❌ 程序运行错误: {e}")
        if debug_mode:
            raise


def _handle_status_commands(config: Dict) -> None:
    """处理状态查看命令 - 显示当前调度状态"""
    from trendradar.context import AppContext

    ctx = AppContext(config)

    print("=" * 60)
    print(f"TrendRadar v{__version__} 调度状态")
    print("=" * 60)

    try:
        scheduler = ctx.create_scheduler()
        schedule = scheduler.resolve()

        now = ctx.get_time()
        date_str = ctx.format_date()

        print(f"\n⏰ 当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')} ({ctx.timezone})")
        print(f"📅 当前日期: {date_str}")

        print(f"\n📋 调度信息:")
        print(f"  日计划: {schedule.day_plan}")
        if schedule.period_key:
            print(f"  当前时间段: {schedule.period_name or schedule.period_key} ({schedule.period_key})")
        else:
            print(f"  当前时间段: 无（使用默认配置）")

        print(f"\n🔧 行为开关:")
        print(f"  采集数据: {'✅ 是' if schedule.collect else '❌ 否'}")
        print(f"  AI 分析:  {'✅ 是' if schedule.analyze else '❌ 否'}")
        print(f"  推送通知: {'✅ 是' if schedule.push else '❌ 否'}")
        print(f"  报告模式: {schedule.report_mode}")
        print(f"  AI 模式:  {schedule.ai_mode}")

        if schedule.period_key:
            print(f"\n🔁 一次性控制:")
            if schedule.once_analyze:
                already_analyzed = scheduler.already_executed(schedule.period_key, "analyze", date_str)
                print(f"  AI 分析:  仅一次 {'(今日已执行 ⚠️)' if already_analyzed else '(今日未执行 ✅)'}")
            else:
                print(f"  AI 分析:  不限次数")
            if schedule.once_push:
                already_pushed = scheduler.already_executed(schedule.period_key, "push", date_str)
                print(f"  推送通知: 仅一次 {'(今日已执行 ⚠️)' if already_pushed else '(今日未执行 ✅)'}")
            else:
                print(f"  推送通知: 不限次数")

    except Exception as e:
        print(f"\n❌ 获取调度状态失败: {e}")

    print("\n" + "=" * 60)

    # 清理资源
    ctx.cleanup()


if __name__ == "__main__":
    main()
