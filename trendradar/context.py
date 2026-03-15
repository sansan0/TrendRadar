# coding=utf-8
"""
应用上下文模块

提供配置上下文类，封装所有依赖配置的操作，消除全局状态和包装函数。
"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from trendradar.utils.time import (
    DEFAULT_TIMEZONE,
    get_configured_time,
    format_date_folder,
    format_time_filename,
    get_current_time_display,
    convert_time_for_display,
    format_iso_time_friendly,
    is_within_days,
)
from trendradar.core import (
    load_frequency_words,
    matches_word_groups,
    read_all_today_titles,
    detect_latest_new_titles,
    count_word_frequency,
    Scheduler,
)
from trendradar.report import (
    prepare_report_data,
    generate_html_report,
    render_html_content,
)
from trendradar.notification import (
    render_feishu_content,
    render_dingtalk_content,
    split_content_into_batches,
    NotificationDispatcher,
)
from trendradar.ai import AITranslator
from trendradar.ai.filter import AIFilter, AIFilterResult
from trendradar.storage import get_storage_manager


class AppContext:
    """
    应用上下文类

    封装所有依赖配置的操作，提供统一的接口。
    消除对全局 CONFIG 的依赖，提高可测试性。

    使用示例:
        config = load_config()
        ctx = AppContext(config)

        # 时间操作
        now = ctx.get_time()
        date_folder = ctx.format_date()

        # 存储操作
        storage = ctx.get_storage_manager()

        # 报告生成
        html = ctx.generate_html_report(stats, total_titles, ...)
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化应用上下文

        Args:
            config: 完整的配置字典
        """
        self.config = config
        self._storage_manager = None
        self._scheduler = None

    # === 配置访问 ===

    @property
    def timezone(self) -> str:
        """获取配置的时区"""
        return self.config.get("TIMEZONE", DEFAULT_TIMEZONE)

    @property
    def rank_threshold(self) -> int:
        """获取排名阈值"""
        return self.config.get("RANK_THRESHOLD", 50)

    @property
    def weight_config(self) -> Dict:
        """获取权重配置"""
        return self.config.get("WEIGHT_CONFIG", {})

    @property
    def platforms(self) -> List[Dict]:
        """获取平台配置列表"""
        return self.config.get("PLATFORMS", [])

    @property
    def platform_ids(self) -> List[str]:
        """获取平台ID列表"""
        return [p["id"] for p in self.platforms]

    @property
    def rss_config(self) -> Dict:
        """获取 RSS 配置"""
        return self.config.get("RSS", {})

    @property
    def rss_enabled(self) -> bool:
        """RSS 是否启用"""
        return self.rss_config.get("ENABLED", False)

    @property
    def rss_feeds(self) -> List[Dict]:
        """获取 RSS 源列表"""
        return self.rss_config.get("FEEDS", [])

    @property
    def display_mode(self) -> str:
        """获取显示模式 (keyword | platform)"""
        return self.config.get("DISPLAY_MODE", "keyword")

    @property
    def show_new_section(self) -> bool:
        """是否显示新增热点区域"""
        return self.config.get("DISPLAY", {}).get("REGIONS", {}).get("NEW_ITEMS", True)

    @property
    def region_order(self) -> List[str]:
        """获取区域显示顺序"""
        default_order = ["hotlist", "rss", "new_items", "standalone", "ai_analysis"]
        return self.config.get("DISPLAY", {}).get("REGION_ORDER", default_order)

    @property
    def filter_method(self) -> str:
        """获取筛选策略: keyword | ai"""
        return self.config.get("FILTER", {}).get("METHOD", "keyword")

    @property
    def ai_priority_sort_enabled(self) -> bool:
        """AI 模式标签排序开关（与 keyword 的 sort_by_position_first 解耦）"""
        return self.config.get("FILTER", {}).get("PRIORITY_SORT_ENABLED", False)

    @property
    def ai_filter_config(self) -> Dict:
        """获取 AI 筛选配置"""
        return self.config.get("AI_FILTER", {})

    @property
    def ai_filter_enabled(self) -> bool:
        """AI 筛选是否启用（基于 filter.method 判断）"""
        return self.filter_method == "ai"

    # === 时间操作 ===

    def get_time(self) -> datetime:
        """获取当前配置时区的时间"""
        return get_configured_time(self.timezone)

    def format_date(self) -> str:
        """格式化日期文件夹 (YYYY-MM-DD)"""
        return format_date_folder(timezone=self.timezone)

    def format_time(self) -> str:
        """格式化时间文件名 (HH-MM)"""
        return format_time_filename(self.timezone)

    def get_time_display(self) -> str:
        """获取时间显示 (HH:MM)"""
        return get_current_time_display(self.timezone)

    @staticmethod
    def convert_time_display(time_str: str) -> str:
        """将 HH-MM 转换为 HH:MM"""
        return convert_time_for_display(time_str)

    # === 存储操作 ===

    def get_storage_manager(self):
        """获取存储管理器（延迟初始化，单例）"""
        if self._storage_manager is None:
            storage_config = self.config.get("STORAGE", {})
            remote_config = storage_config.get("REMOTE", {})
            local_config = storage_config.get("LOCAL", {})
            pull_config = storage_config.get("PULL", {})

            self._storage_manager = get_storage_manager(
                backend_type=storage_config.get("BACKEND", "auto"),
                data_dir=local_config.get("DATA_DIR", "output"),
                enable_txt=storage_config.get("FORMATS", {}).get("TXT", True),
                enable_html=storage_config.get("FORMATS", {}).get("HTML", True),
                remote_config={
                    "bucket_name": remote_config.get("BUCKET_NAME", ""),
                    "access_key_id": remote_config.get("ACCESS_KEY_ID", ""),
                    "secret_access_key": remote_config.get("SECRET_ACCESS_KEY", ""),
                    "endpoint_url": remote_config.get("ENDPOINT_URL", ""),
                    "region": remote_config.get("REGION", ""),
                },
                local_retention_days=local_config.get("RETENTION_DAYS", 0),
                remote_retention_days=remote_config.get("RETENTION_DAYS", 0),
                pull_enabled=pull_config.get("ENABLED", False),
                pull_days=pull_config.get("DAYS", 7),
                timezone=self.timezone,
            )
        return self._storage_manager

    def get_output_path(self, subfolder: str, filename: str) -> str:
        """获取输出路径（扁平化结构：output/类型/日期/文件名）"""
        output_dir = Path("output") / subfolder / self.format_date()
        output_dir.mkdir(parents=True, exist_ok=True)
        return str(output_dir / filename)

    # === 数据处理 ===

    def read_today_titles(
        self, platform_ids: Optional[List[str]] = None, quiet: bool = False
    ) -> Tuple[Dict, Dict, Dict]:
        """读取当天所有标题"""
        return read_all_today_titles(self.get_storage_manager(), platform_ids, quiet=quiet)

    def detect_new_titles(
        self, platform_ids: Optional[List[str]] = None, quiet: bool = False
    ) -> Dict:
        """检测最新批次的新增标题"""
        return detect_latest_new_titles(self.get_storage_manager(), platform_ids, quiet=quiet)

    def is_first_crawl(self) -> bool:
        """检测是否是当天第一次爬取"""
        return self.get_storage_manager().is_first_crawl_today()

    # === 频率词处理 ===

    def load_frequency_words(
        self, frequency_file: Optional[str] = None
    ) -> Tuple[List[Dict], List[str], List[str]]:
        """加载频率词配置"""
        return load_frequency_words(frequency_file)

    def matches_word_groups(
        self,
        title: str,
        word_groups: List[Dict],
        filter_words: List[str],
        global_filters: Optional[List[str]] = None,
    ) -> bool:
        """检查标题是否匹配词组规则"""
        return matches_word_groups(title, word_groups, filter_words, global_filters)

    # === 统计分析 ===

    def count_frequency(
        self,
        results: Dict,
        word_groups: List[Dict],
        filter_words: List[str],
        id_to_name: Dict,
        title_info: Optional[Dict] = None,
        new_titles: Optional[Dict] = None,
        mode: str = "daily",
        global_filters: Optional[List[str]] = None,
        quiet: bool = False,
    ) -> Tuple[List[Dict], int]:
        """统计词频"""
        return count_word_frequency(
            results=results,
            word_groups=word_groups,
            filter_words=filter_words,
            id_to_name=id_to_name,
            title_info=title_info,
            rank_threshold=self.rank_threshold,
            new_titles=new_titles,
            mode=mode,
            global_filters=global_filters,
            weight_config=self.weight_config,
            max_news_per_keyword=self.config.get("MAX_NEWS_PER_KEYWORD", 0),
            sort_by_position_first=self.config.get("SORT_BY_POSITION_FIRST", False),
            is_first_crawl_func=self.is_first_crawl,
            convert_time_func=self.convert_time_display,
            quiet=quiet,
        )

    # === 报告生成 ===

    def prepare_report(
        self,
        stats: List[Dict],
        failed_ids: Optional[List] = None,
        new_titles: Optional[Dict] = None,
        id_to_name: Optional[Dict] = None,
        mode: str = "daily",
        frequency_file: Optional[str] = None,
    ) -> Dict:
        """准备报告数据"""
        return prepare_report_data(
            stats=stats,
            failed_ids=failed_ids,
            new_titles=new_titles,
            id_to_name=id_to_name,
            mode=mode,
            rank_threshold=self.rank_threshold,
            matches_word_groups_func=self.matches_word_groups,
            load_frequency_words_func=lambda: self.load_frequency_words(frequency_file),
            show_new_section=self.show_new_section,
        )

    def generate_html(
        self,
        stats: List[Dict],
        total_titles: int,
        failed_ids: Optional[List] = None,
        new_titles: Optional[Dict] = None,
        id_to_name: Optional[Dict] = None,
        mode: str = "daily",
        update_info: Optional[Dict] = None,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[Any] = None,
        standalone_data: Optional[Dict] = None,
        frequency_file: Optional[str] = None,
    ) -> str:
        """生成HTML报告"""
        return generate_html_report(
            stats=stats,
            total_titles=total_titles,
            failed_ids=failed_ids,
            new_titles=new_titles,
            id_to_name=id_to_name,
            mode=mode,
            update_info=update_info,
            rank_threshold=self.rank_threshold,
            output_dir="output",
            date_folder=self.format_date(),
            time_filename=self.format_time(),
            render_html_func=lambda *args, **kwargs: self.render_html(*args, rss_items=rss_items, rss_new_items=rss_new_items, ai_analysis=ai_analysis, standalone_data=standalone_data, **kwargs),
            matches_word_groups_func=self.matches_word_groups,
            load_frequency_words_func=lambda: self.load_frequency_words(frequency_file),
        )

    def render_html(
        self,
        report_data: Dict,
        total_titles: int,
        mode: str = "daily",
        update_info: Optional[Dict] = None,
        rss_items: Optional[List[Dict]] = None,
        rss_new_items: Optional[List[Dict]] = None,
        ai_analysis: Optional[Any] = None,
        standalone_data: Optional[Dict] = None,
    ) -> str:
        """渲染HTML内容"""
        return render_html_content(
            report_data=report_data,
            total_titles=total_titles,
            mode=mode,
            update_info=update_info,
            region_order=self.region_order,
            get_time_func=self.get_time,
            rss_items=rss_items,
            rss_new_items=rss_new_items,
            display_mode=self.display_mode,
            ai_analysis=ai_analysis,
            show_new_section=self.show_new_section,
            standalone_data=standalone_data,
        )

    # === 通知内容渲染 ===

    def render_feishu(
        self,
        report_data: Dict,
        update_info: Optional[Dict] = None,
        mode: str = "daily",
    ) -> str:
        """渲染飞书内容"""
        return render_feishu_content(
            report_data=report_data,
            update_info=update_info,
            mode=mode,
            separator=self.config.get("FEISHU_MESSAGE_SEPARATOR", "---"),
            region_order=self.region_order,
            get_time_func=self.get_time,
            show_new_section=self.show_new_section,
        )

    def render_dingtalk(
        self,
        report_data: Dict,
        update_info: Optional[Dict] = None,
        mode: str = "daily",
    ) -> str:
        """渲染钉钉内容"""
        return render_dingtalk_content(
            report_data=report_data,
            update_info=update_info,
            mode=mode,
            region_order=self.region_order,
            get_time_func=self.get_time,
            show_new_section=self.show_new_section,
        )

    def split_content(
        self,
        report_data: Dict,
        format_type: str,
        update_info: Optional[Dict] = None,
        max_bytes: Optional[int] = None,
        mode: str = "daily",
        rss_items: Optional[list] = None,
        rss_new_items: Optional[list] = None,
        ai_content: Optional[str] = None,
        standalone_data: Optional[Dict] = None,
        ai_stats: Optional[Dict] = None,
        report_type: str = "热点分析报告",
    ) -> List[str]:
        """分批处理消息内容（支持热榜+RSS合并+AI分析+独立展示区）

        Args:
            report_data: 报告数据
            format_type: 格式类型
            update_info: 更新信息
            max_bytes: 最大字节数
            mode: 报告模式
            rss_items: RSS 统计条目列表
            rss_new_items: RSS 新增条目列表
            ai_content: AI 分析内容（已渲染的字符串）
            standalone_data: 独立展示区数据
            ai_stats: AI 分析统计数据
            report_type: 报告类型

        Returns:
            分批后的消息内容列表
        """
        return split_content_into_batches(
            report_data=report_data,
            format_type=format_type,
            update_info=update_info,
            max_bytes=max_bytes,
            mode=mode,
            batch_sizes={
                "dingtalk": self.config.get("DINGTALK_BATCH_SIZE", 20000),
                "feishu": self.config.get("FEISHU_BATCH_SIZE", 29000),
                "default": self.config.get("MESSAGE_BATCH_SIZE", 4000),
            },
            feishu_separator=self.config.get("FEISHU_MESSAGE_SEPARATOR", "---"),
            region_order=self.region_order,
            get_time_func=self.get_time,
            rss_items=rss_items,
            rss_new_items=rss_new_items,
            timezone=self.config.get("TIMEZONE", DEFAULT_TIMEZONE),
            display_mode=self.display_mode,
            ai_content=ai_content,
            standalone_data=standalone_data,
            rank_threshold=self.rank_threshold,
            ai_stats=ai_stats,
            report_type=report_type,
            show_new_section=self.show_new_section,
        )

    # === 通知发送 ===

    def create_notification_dispatcher(self) -> NotificationDispatcher:
        """创建通知调度器"""
        # 创建翻译器（如果启用）
        translator = None
        trans_config = self.config.get("AI_TRANSLATION", {})
        if trans_config.get("ENABLED", False):
            ai_config = self.config.get("AI", {})
            translator = AITranslator(trans_config, ai_config)

        return NotificationDispatcher(
            config=self.config,
            get_time_func=self.get_time,
            split_content_func=self.split_content,
            translator=translator,
        )

    def create_scheduler(self) -> Scheduler:
        """
        创建调度器（延迟初始化，单例）

        基于 config.yaml 的 schedule 段 + timeline.yaml 构建。
        """
        if self._scheduler is None:
            schedule_config = self.config.get("SCHEDULE", {})
            timeline_data = self.config.get("_TIMELINE_DATA", {})

            self._scheduler = Scheduler(
                schedule_config=schedule_config,
                timeline_data=timeline_data,
                storage_backend=self.get_storage_manager(),
                get_time_func=self.get_time,
                fallback_report_mode=self.config.get("REPORT_MODE", "current"),
            )
        return self._scheduler

    # === AI 智能筛选 ===

    @staticmethod
    def _with_ordered_priorities(tags: List[Dict], start_priority: int = 1) -> List[Dict]:
        """按当前列表顺序补齐优先级（值越小优先级越高）"""
        normalized: List[Dict] = []
        priority = start_priority
        for tag_data in tags:
            if not isinstance(tag_data, dict):
                continue
            tag_name = str(tag_data.get("tag", "")).strip()
            if not tag_name:
                continue
            item = dict(tag_data)
            item["tag"] = tag_name
            item["priority"] = priority
            normalized.append(item)
            priority += 1
        return normalized

    def run_ai_filter(self, interests_file: Optional[str] = None) -> Optional[AIFilterResult]:
        """
        执行 AI 智能筛选完整流程

        Args:
            interests_file: 兴趣描述文件名（位于 config/custom/ai/），None=使用默认 config/ai_interests.txt

        1. 读取兴趣描述文件，计算 hash
        2. 对比数据库 prompt_hash，决定是否重新提取标签
        3. 收集待分类新闻（去重）
        4. 按 batch_size 分组调用 AI 分类
        5. 保存结果
        6. 查询 active 结果，按标签分组返回

        Returns:
            AIFilterResult 或 None（未启用或出错）
        """
        if not self.ai_filter_enabled:
            return None

        filter_config = self.ai_filter_config
        ai_config = self.config.get("AI", {})
        debug = self.config.get("DEBUG", False)

        # 创建 AIFilter 实例
        ai_filter = AIFilter(ai_config, filter_config, self.get_time, debug)

        # 确定实际使用的兴趣文件名
        # None = 使用默认 config/ai_interests.txt，指定文件名 = config/custom/ai/{name}
        configured_interests = interests_file or filter_config.get("INTERESTS_FILE")
        effective_interests_file = configured_interests or "ai_interests.txt"

        if debug:
            print(f"[AI筛选][DEBUG] === 配置信息 ===")
            print(f"[AI筛选][DEBUG] 存储后端: {self.get_storage_manager().backend_name}")
            print(f"[AI筛选][DEBUG] batch_size={filter_config.get('BATCH_SIZE', 200)}, "
                  f"batch_interval={filter_config.get('BATCH_INTERVAL', 5)}")
            print(f"[AI筛选][DEBUG] interests_file={effective_interests_file}")
            print(f"[AI筛选][DEBUG] prompt_file={filter_config.get('PROMPT_FILE', 'prompt.txt')}")
            print(f"[AI筛选][DEBUG] extract_prompt_file={filter_config.get('EXTRACT_PROMPT_FILE', 'extract_prompt.txt')}")

        # 1. 读取兴趣描述
        # 传 configured_interests（可能为 None）给 load_interests_content，
        # 让它区分"默认文件(config/ai_interests.txt)"和"自定义文件(config/custom/ai/)"
        interests_content = ai_filter.load_interests_content(configured_interests)
        if not interests_content:
            return AIFilterResult(success=False, error="兴趣描述文件为空或不存在")

        current_hash = ai_filter.compute_interests_hash(interests_content, effective_interests_file)
        storage = self.get_storage_manager()

        if debug:
            print(f"[AI筛选][DEBUG] 兴趣描述 hash: {current_hash}")
            print(f"[AI筛选][DEBUG] 兴趣描述内容 ({len(interests_content)} 字符):\n{interests_content}")

        # 2. 开启批量模式（远程后端延迟上传，所有写操作完成后统一上传）
        storage.begin_batch()

        # 3. 检查提示词是否变更
        stored_hash = storage.get_latest_prompt_hash(interests_file=effective_interests_file)

        if debug:
            print(f"[AI筛选][DEBUG] 数据库存储 hash: {stored_hash}")
            print(f"[AI筛选][DEBUG] hash 对比: stored={stored_hash} vs current={current_hash} → {'匹配' if stored_hash == current_hash else '不匹配'}")

        if stored_hash != current_hash:
            new_version = storage.get_latest_ai_filter_tag_version() + 1
            threshold = filter_config.get("RECLASSIFY_THRESHOLD", 0.6)

            if stored_hash is None:
                # 首次运行，直接提取并保存全部标签
                print(f"[AI筛选] 首次运行 ({effective_interests_file})，提取标签...")
                tags_data = ai_filter.extract_tags(interests_content)
                if not tags_data:
                    storage.end_batch()
                    return AIFilterResult(success=False, error="标签提取失败")
                tags_data = self._with_ordered_priorities(tags_data, start_priority=1)
                saved_count = storage.save_ai_filter_tags(tags_data, new_version, current_hash, interests_file=effective_interests_file)
                print(f"[AI筛选] 已保存 {saved_count} 个标签 (版本 {new_version})")
            else:
                # 兴趣描述已变更，让 AI 对比旧标签和新兴趣，给出更新方案
                old_tags = storage.get_active_ai_filter_tags(interests_file=effective_interests_file)
                update_result = ai_filter.update_tags(old_tags, interests_content)

                if update_result is None:
                    # AI 标签更新失败，回退到重新提取全部标签
                    print(f"[AI筛选] AI 标签更新失败，回退到重新提取")
                    tags_data = ai_filter.extract_tags(interests_content)
                    if not tags_data:
                        storage.end_batch()
                        return AIFilterResult(success=False, error="标签提取失败")
                    tags_data = self._with_ordered_priorities(tags_data, start_priority=1)
                    deprecated_count = storage.deprecate_all_ai_filter_tags(interests_file=effective_interests_file)
                    storage.clear_analyzed_news(interests_file=effective_interests_file)
                    saved_count = storage.save_ai_filter_tags(tags_data, new_version, current_hash, interests_file=effective_interests_file)
                    print(f"[AI筛选] 废弃 {deprecated_count} 个旧标签, 保存 {saved_count} 个新标签 (版本 {new_version})")
                else:
                    change_ratio = update_result["change_ratio"]
                    keep_tags = update_result["keep"]
                    add_tags = update_result["add"]
                    remove_tags = update_result["remove"]

                    if debug:
                        print(f"[AI筛选][DEBUG] AI 标签更新: keep={len(keep_tags)}, add={len(add_tags)}, remove={len(remove_tags)}, change_ratio={change_ratio:.2f}, threshold={threshold:.2f}")

                    if change_ratio >= threshold:
                        # 全量重分类：废弃所有旧标签，用 extract_tags 重新提取
                        print(f"[AI筛选] 兴趣文件变更: {effective_interests_file} (AI change_ratio={change_ratio:.2f} >= threshold={threshold:.2f} → 全量重分类)")
                        tags_data = ai_filter.extract_tags(interests_content)
                        if not tags_data:
                            storage.end_batch()
                            return AIFilterResult(success=False, error="标签提取失败")
                        tags_data = self._with_ordered_priorities(tags_data, start_priority=1)
                        deprecated_count = storage.deprecate_all_ai_filter_tags(interests_file=effective_interests_file)
                        storage.clear_analyzed_news(interests_file=effective_interests_file)
                        saved_count = storage.save_ai_filter_tags(tags_data, new_version, current_hash, interests_file=effective_interests_file)
                        print(f"[AI筛选] 废弃 {deprecated_count} 个旧标签, 保存 {saved_count} 个新标签 (版本 {new_version})")
                    else:
                        # 增量更新：按 AI 指示操作
                        print(f"[AI筛选] 兴趣文件变更: {effective_interests_file} (AI change_ratio={change_ratio:.2f} < threshold={threshold:.2f} → 增量更新)")
                        print(f"[AI筛选]   保留 {len(keep_tags)} 个标签, 新增 {len(add_tags)} 个, 废弃 {len(remove_tags)} 个")

                        # 废弃 AI 标记移除的标签
                        if remove_tags:
                            remove_set = set(remove_tags)
                            removed_ids = [t["id"] for t in old_tags if t["tag"] in remove_set]
                            if removed_ids:
                                storage.deprecate_specific_ai_filter_tags(removed_ids)
                                if debug:
                                    print(f"[AI筛选][DEBUG] 废弃标签 IDs: {removed_ids}")

                        # 更新保留标签的描述
                        keep_with_priority = []
                        if keep_tags:
                            storage.update_ai_filter_tag_descriptions(keep_tags, interests_file=effective_interests_file)
                            keep_with_priority = self._with_ordered_priorities(keep_tags, start_priority=1)
                            storage.update_ai_filter_tag_priorities(keep_with_priority, interests_file=effective_interests_file)

                        # 保存新增标签
                        if add_tags:
                            add_start = keep_with_priority[-1]["priority"] + 1 if keep_with_priority else 1
                            add_with_priority = self._with_ordered_priorities(add_tags, start_priority=add_start)
                            saved_count = storage.save_ai_filter_tags(add_with_priority, new_version, current_hash, interests_file=effective_interests_file)
                            if debug:
                                print(f"[AI筛选][DEBUG] 新增保存 {saved_count} 个标签")

                        # 更新保留标签的 hash（标记为已处理）
                        storage.update_ai_filter_tags_hash(effective_interests_file, current_hash)

                        # 增量更新：清除不匹配新闻的分析记录，让它们有机会被新标签集重新分析
                        if add_tags:
                            cleared = storage.clear_unmatched_analyzed_news(interests_file=effective_interests_file)
                            if cleared > 0:
                                print(f"[AI筛选]   清除 {cleared} 条不匹配记录，将在新标签下重新分析")

        # 3. 获取当前 active 标签
        active_tags = storage.get_active_ai_filter_tags(interests_file=effective_interests_file)
        if debug:
            print(f"[AI筛选][DEBUG] 从数据库获取 active 标签: {len(active_tags)} 个")
            for t in active_tags:
                print(f"[AI筛选][DEBUG]   id={t['id']} tag={t['tag']} priority={t.get('priority', 9999)} version={t.get('version')} hash={t.get('prompt_hash', '')[:8]}...")

        if not active_tags:
            storage.end_batch()
            return AIFilterResult(success=False, error="没有可用的标签")

        print(f"[AI筛选] 使用 {len(active_tags)} 个标签")

        # 4. 收集待分类新闻
        # 热榜：当热榜抓取关闭时，禁止从历史热榜库回流旧数据参与主区分类
        all_news = []
        analyzed_hotlist = []
        pending_news = []
        if self.config.get("ENABLE_CRAWLER", True) and self.platforms:
            all_news = storage.get_all_news_ids()
            analyzed_hotlist = storage.get_analyzed_news_ids(
                "hotlist", interests_file=effective_interests_file
            )
            pending_news = [n for n in all_news if n["id"] not in analyzed_hotlist]

        # RSS（先做新鲜度过滤，再去除已分类的）
        pending_rss = []
        freshness_filtered_rss = 0
        if self.rss_enabled:
            all_rss = storage.get_all_rss_ids()

            # 应用新鲜度过滤（与推送阶段一致）
            rss_config = self.rss_config
            freshness_config = rss_config.get("FRESHNESS_FILTER", {})
            freshness_enabled = freshness_config.get("ENABLED", True)
            default_max_age_days = freshness_config.get("MAX_AGE_DAYS", 3)
            timezone = self.config.get("TIMEZONE", DEFAULT_TIMEZONE)

            # 构建 feed_id -> max_age_days 的映射
            feed_max_age_map = {}
            for feed_cfg in self.rss_feeds:
                feed_id = feed_cfg.get("id", "")
                max_age = feed_cfg.get("max_age_days")
                if max_age is not None:
                    try:
                        feed_max_age_map[feed_id] = int(max_age)
                    except (ValueError, TypeError):
                        pass

            fresh_rss = []
            for n in all_rss:
                published_at = n.get("published_at", "")
                feed_id = n.get("source_id", "")
                max_days = feed_max_age_map.get(feed_id, default_max_age_days)
                if freshness_enabled and max_days > 0 and published_at:
                    if not is_within_days(published_at, max_days, timezone):
                        freshness_filtered_rss += 1
                        continue
                fresh_rss.append(n)

            analyzed_rss = storage.get_analyzed_news_ids("rss", interests_file=effective_interests_file)
            pending_rss = [n for n in fresh_rss if n["id"] not in analyzed_rss]

        # 始终打印总量/已分析/待分析 的详细数据
        hotlist_total = len(all_news)
        hotlist_skipped = len(analyzed_hotlist)
        hotlist_pending = len(pending_news)
        print(f"[AI筛选] 热榜: 总计 {hotlist_total} 条, 已分析跳过 {hotlist_skipped} 条, 本次发送AI分析 {hotlist_pending} 条")
        if self.rss_enabled:
            rss_total = len(all_rss)
            rss_skipped = len(analyzed_rss)
            rss_pending = len(pending_rss)
            freshness_info = f", 新鲜度过滤 {freshness_filtered_rss} 条" if freshness_filtered_rss > 0 else ""
            print(f"[AI筛选] RSS: 总计 {rss_total} 条{freshness_info}, 已分析跳过 {rss_skipped} 条, 本次发送AI分析 {rss_pending} 条")

        total_pending = len(pending_news) + len(pending_rss)
        if total_pending == 0:
            print("[AI筛选] 没有新增新闻需要分类")

        # 5. 批量分类
        batch_size = filter_config.get("BATCH_SIZE", 200)
        batch_interval = filter_config.get("BATCH_INTERVAL", 5)
        total_results = []
        batch_count = 0  # 跨热榜和 RSS 的全局批次计数

        # 处理热榜
        for i in range(0, len(pending_news), batch_size):
            if batch_count > 0 and batch_interval > 0:
                import time
                print(f"[AI筛选] 批次间隔等待 {batch_interval} 秒...")
                time.sleep(batch_interval)
            batch = pending_news[i:i + batch_size]
            titles_for_ai = [
                {"id": n["id"], "title": n["title"], "source": n.get("source_name", "")}
                for n in batch
            ]
            batch_results = ai_filter.classify_batch(titles_for_ai, active_tags, interests_content)
            for r in batch_results:
                r["source_type"] = "hotlist"
            total_results.extend(batch_results)
            batch_count += 1
            print(f"[AI筛选] 热榜批次 {i // batch_size + 1}: {len(batch)} 条 → {len(batch_results)} 条匹配")

        # 处理 RSS
        for i in range(0, len(pending_rss), batch_size):
            if batch_count > 0 and batch_interval > 0:
                import time
                print(f"[AI筛选] 批次间隔等待 {batch_interval} 秒...")
                time.sleep(batch_interval)
            batch = pending_rss[i:i + batch_size]
            titles_for_ai = [
                {"id": n["id"], "title": n["title"], "source": n.get("source_name", "")}
                for n in batch
            ]
            batch_results = ai_filter.classify_batch(titles_for_ai, active_tags, interests_content)
            for r in batch_results:
                r["source_type"] = "rss"
            total_results.extend(batch_results)
            batch_count += 1
            print(f"[AI筛选] RSS 批次 {i // batch_size + 1}: {len(batch)} 条 → {len(batch_results)} 条匹配")

        # 6. 保存结果
        if total_results:
            saved = storage.save_ai_filter_results(total_results)
            print(f"[AI筛选] 保存 {saved} 条分类结果")
            if debug and saved != len(total_results):
                print(f"[AI筛选][DEBUG] !! 保存数量不一致: 期望 {len(total_results)}, 实际 {saved}（可能有重复记录被跳过）")

        # 6.5 记录所有已分析的新闻（匹配+不匹配，用于去重）
        matched_hotlist_ids = {r["news_item_id"] for r in total_results if r.get("source_type") == "hotlist"}
        matched_rss_ids = {r["news_item_id"] for r in total_results if r.get("source_type") == "rss"}

        if pending_news:
            hotlist_ids = [n["id"] for n in pending_news]
            storage.save_analyzed_news(
                hotlist_ids, "hotlist", effective_interests_file,
                current_hash, matched_hotlist_ids
            )

        if pending_rss:
            rss_ids = [n["id"] for n in pending_rss]
            storage.save_analyzed_news(
                rss_ids, "rss", effective_interests_file,
                current_hash, matched_rss_ids
            )

        if pending_news or pending_rss:
            total_analyzed = len(pending_news) + len(pending_rss)
            total_matched = len(matched_hotlist_ids) + len(matched_rss_ids)
            print(f"[AI筛选] 已记录 {total_analyzed} 条新闻分析状态 (匹配 {total_matched}, 不匹配 {total_analyzed - total_matched})")

        # 7. 结束批量模式（统一上传数据库到远程存储）
        storage.end_batch()

        # 8. 查询并组装返回结果
        all_results = storage.get_active_ai_filter_results(interests_file=effective_interests_file)
        if not self.config.get("ENABLE_CRAWLER", True):
            all_results = [r for r in all_results if r.get("source_type") == "rss"]

        if debug:
            print(f"[AI筛选][DEBUG] === 最终汇总 ===")
            print(f"[AI筛选][DEBUG] 数据库 active 分类结果: {len(all_results)} 条")
            # 按标签统计
            tag_counts: dict = {}
            for r in all_results:
                tag_name = r.get("tag", "?")
                src_type = r.get("source_type", "?")
                key = f"{tag_name}({src_type})"
                tag_counts[key] = tag_counts.get(key, 0) + 1
            for key, count in sorted(tag_counts.items()):
                print(f"[AI筛选][DEBUG]   {key}: {count} 条")

        return self._build_filter_result(all_results, active_tags, total_pending)

    def _build_filter_result(
        self,
        raw_results: List[Dict],
        tags: List[Dict],
        total_processed: int,
    ) -> AIFilterResult:
        """将数据库查询结果组装为 AIFilterResult"""
        priority_sort_enabled = self.ai_priority_sort_enabled
        tag_priority_map = {}
        for idx, t in enumerate(tags, start=1):
            tag_name = str(t.get("tag", "")).strip() if isinstance(t, dict) else ""
            if not tag_name:
                continue
            try:
                tag_priority_map[tag_name] = int(t.get("priority", idx))
            except (TypeError, ValueError):
                tag_priority_map[tag_name] = idx

        # 按标签分组
        tag_groups: Dict[str, Dict] = {}
        seen_titles: Dict[str, set] = {}  # 每个标签下去重

        for r in raw_results:
            tag_name = r["tag"]
            if tag_name not in tag_groups:
                raw_priority = r.get("tag_priority", tag_priority_map.get(tag_name, 9999))
                try:
                    tag_position = int(raw_priority)
                except (TypeError, ValueError):
                    tag_position = 9999
                tag_groups[tag_name] = {
                    "tag": tag_name,
                    "description": r.get("tag_description", ""),
                    "position": tag_position,
                    "count": 0,
                    "items": [],
                }
                seen_titles[tag_name] = set()

            title = r["title"]
            if title in seen_titles[tag_name]:
                continue
            seen_titles[tag_name].add(title)

            tag_groups[tag_name]["items"].append({
                "title": title,
                "source_id": r.get("source_id", ""),
                "source_name": r.get("source_name", ""),
                "url": r.get("url", ""),
                "mobile_url": r.get("mobile_url", ""),
                "rank": r.get("rank", 0),
                "ranks": r.get("ranks", []),
                "first_time": r.get("first_time", ""),
                "last_time": r.get("last_time", ""),
                "count": r.get("count", 1),
                "relevance_score": r.get("relevance_score", 0),
                "source_type": r.get("source_type", "hotlist"),
            })
            tag_groups[tag_name]["count"] += 1

        # 根据配置排序：位置优先 / 数量优先
        if priority_sort_enabled:
            sorted_tags = sorted(
                tag_groups.values(),
                key=lambda x: (x.get("position", 9999), -x["count"], x["tag"]),
            )
        else:
            sorted_tags = sorted(
                tag_groups.values(),
                key=lambda x: (-x["count"], x.get("position", 9999), x["tag"]),
            )

        total_matched = sum(t["count"] for t in sorted_tags)

        return AIFilterResult(
            tags=sorted_tags,
            total_matched=total_matched,
            total_processed=total_processed,
            success=True,
        )

    def convert_ai_filter_to_report_data(
        self,
        ai_filter_result: AIFilterResult,
        mode: str = "daily",
        new_titles: Optional[Dict] = None,
        rss_new_urls: Optional[set] = None,
    ) -> tuple:
        """
        将 AI 筛选结果转换为与关键词匹配相同的数据结构

        AIFilterResult.tags 中每个 tag 对应一个 "word"（关键词组）。
        tag.items 中 source_type="hotlist" 的条目进入热榜 stats，
        source_type="rss" 的条目进入 rss_items stats。

        Args:
            ai_filter_result: AI 筛选结果
            mode: 报告模式 ("daily" | "current" | "incremental")
            new_titles: 热榜新增标题 {source_id: {title: data}}，用于 is_new 检测
            rss_new_urls: 新增 RSS 条目的 URL 集合，用于 is_new 检测

        Returns:
            (hotlist_stats, rss_stats):
            - hotlist_stats: 与 count_word_frequency() 产出格式一致
            - rss_stats: 与 rss_items 格式一致
        """
        hotlist_stats = []
        rss_stats = []
        max_news = self.config.get("MAX_NEWS_PER_KEYWORD", 0)
        min_score = self.ai_filter_config.get("MIN_SCORE", 0)

        # current 模式：计算最新时间，只保留当前在榜的热榜新闻
        # 与 count_word_frequency(mode="current") 的过滤逻辑对齐
        latest_time = None
        if mode == "current":
            for tag_data in ai_filter_result.tags:
                for item in tag_data.get("items", []):
                    if item.get("source_type", "hotlist") == "hotlist":
                        last_time = item.get("last_time", "")
                        if last_time and (latest_time is None or last_time > latest_time):
                            latest_time = last_time
            if latest_time:
                print(f"[AI筛选] current 模式：最新时间 {latest_time}，过滤已下榜新闻")

        # RSS 新鲜度过滤配置（与推送阶段一致）
        rss_config = self.rss_config
        freshness_config = rss_config.get("FRESHNESS_FILTER", {})
        freshness_enabled = freshness_config.get("ENABLED", True)
        default_max_age_days = freshness_config.get("MAX_AGE_DAYS", 3)
        timezone = self.config.get("TIMEZONE", DEFAULT_TIMEZONE)

        feed_max_age_map = {}
        for feed_cfg in self.rss_feeds:
            feed_id = feed_cfg.get("id", "")
            max_age = feed_cfg.get("max_age_days")
            if max_age is not None:
                try:
                    feed_max_age_map[feed_id] = int(max_age)
                except (ValueError, TypeError):
                    pass

        filtered_count = 0
        for tag_data in ai_filter_result.tags:
            tag_name = tag_data.get("tag", "")
            items = tag_data.get("items", [])
            if not items:
                continue

            hotlist_titles = []
            rss_titles = []

            for item in items:
                source_type = item.get("source_type", "hotlist")

                # current 模式：跳过已下榜的热榜新闻
                if mode == "current" and latest_time and source_type == "hotlist":
                    if item.get("last_time", "") != latest_time:
                        filtered_count += 1
                        continue

                # 分数阈值过滤：跳过相关度低于 min_score 的新闻
                if min_score > 0:
                    score = item.get("relevance_score", 0)
                    if score < min_score:
                        continue

                # 构建时间显示
                first_time = item.get("first_time", "")
                last_time = item.get("last_time", "")
                if source_type == "rss":
                    # RSS 新鲜度过滤：跳过超过 max_age_days 的旧文章
                    if freshness_enabled and first_time:
                        feed_id = item.get("source_id", "")
                        max_days = feed_max_age_map.get(feed_id, default_max_age_days)
                        if max_days > 0 and not is_within_days(first_time, max_days, timezone):
                            continue

                    # RSS 条目：first_time 是 ISO 格式，用友好格式显示
                    if first_time:
                        time_display = format_iso_time_friendly(first_time, timezone, include_date=True)
                    else:
                        time_display = ""
                else:
                    # 热榜条目：使用 [HH:MM ~ HH:MM] 格式（与 keyword 模式一致）
                    if first_time and last_time and first_time != last_time:
                        first_display = convert_time_for_display(first_time)
                        last_display = convert_time_for_display(last_time)
                        time_display = f"[{first_display} ~ {last_display}]"
                    elif first_time:
                        time_display = convert_time_for_display(first_time)
                    else:
                        time_display = ""

                # 计算 is_new（与 keyword 模式 core/analyzer.py:335-342 对齐）
                if source_type == "rss":
                    is_new = False
                    if rss_new_urls:
                        item_url = item.get("url", "")
                        is_new = item_url in rss_new_urls if item_url else False
                else:
                    is_new = False
                    if new_titles:
                        item_source_id = item.get("source_id", "")
                        item_title = item.get("title", "")
                        if item_source_id in new_titles:
                            is_new = item_title in new_titles[item_source_id]

                title_entry = {
                    "title": item.get("title", ""),
                    "source_name": item.get("source_name", ""),
                    "url": item.get("url", ""),
                    "mobile_url": item.get("mobile_url", ""),
                    "ranks": item.get("ranks", []),
                    "rank_threshold": self.rank_threshold,
                    "count": item.get("count", 1),
                    "is_new": is_new,
                    "time_display": time_display,
                    "matched_keyword": tag_name,
                }

                if source_type == "rss":
                    rss_titles.append(title_entry)
                else:
                    hotlist_titles.append(title_entry)

            if hotlist_titles:
                if max_news > 0:
                    hotlist_titles = hotlist_titles[:max_news]
                hotlist_stats.append({
                    "word": tag_name,
                    "count": len(hotlist_titles),
                    "position": tag_data.get("position", 9999),
                    "titles": hotlist_titles,
                })

            if rss_titles:
                if max_news > 0:
                    rss_titles = rss_titles[:max_news]
                rss_stats.append({
                    "word": tag_name,
                    "count": len(rss_titles),
                    "position": tag_data.get("position", 9999),
                    "titles": rss_titles,
                })

        if mode == "current" and filtered_count > 0:
            total_kept = sum(s["count"] for s in hotlist_stats)
            print(f"[AI筛选] current 模式：过滤 {filtered_count} 条已下榜新闻，保留 {total_kept} 条当前在榜")

        if min_score > 0:
            hotlist_kept = sum(s["count"] for s in hotlist_stats)
            rss_kept = sum(s["count"] for s in rss_stats)
            total_kept = hotlist_kept + rss_kept
            parts = [f"热榜 {hotlist_kept} 条"]
            if rss_kept > 0:
                parts.append(f"RSS {rss_kept} 条")
            print(f"[AI筛选] 分数过滤：min_score={min_score}，保留 {total_kept} 条 score≥{min_score} ({', '.join(parts)})")

        priority_sort_enabled = self.ai_priority_sort_enabled
        if priority_sort_enabled:
            hotlist_stats.sort(key=lambda x: (x.get("position", 9999), -x["count"], x["word"]))
            rss_stats.sort(key=lambda x: (x.get("position", 9999), -x["count"], x["word"]))
        else:
            hotlist_stats.sort(key=lambda x: (-x["count"], x.get("position", 9999), x["word"]))
            rss_stats.sort(key=lambda x: (-x["count"], x.get("position", 9999), x["word"]))

        return hotlist_stats, rss_stats

    # === 资源清理 ===

    def cleanup(self):
        """清理资源"""
        if self._storage_manager:
            self._storage_manager.cleanup_old_data()
            self._storage_manager.cleanup()
            self._storage_manager = None
