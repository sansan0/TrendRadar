import sys
import types
import unittest
from dataclasses import dataclass, field


def install_dependency_stubs():
    utils_time = types.ModuleType("trendradar.utils.time")
    utils_time.DEFAULT_TIMEZONE = "Asia/Shanghai"
    utils_time.get_configured_time = lambda timezone=None: None
    utils_time.format_date_folder = lambda timezone=None: "2026-03-18"
    utils_time.format_time_filename = lambda timezone=None: "17-58"
    utils_time.get_current_time_display = lambda timezone=None: "17:58"
    utils_time.convert_time_for_display = lambda value: value.replace("-", ":")
    utils_time.format_iso_time_friendly = (
        lambda value, timezone=None, include_date=False: value
    )
    utils_time.is_within_days = lambda value, days, timezone=None: True
    sys.modules["trendradar.utils.time"] = utils_time

    core = types.ModuleType("trendradar.core")
    core.load_frequency_words = lambda *args, **kwargs: ([], [], [])
    core.matches_word_groups = lambda *args, **kwargs: False
    core.read_all_today_titles = lambda *args, **kwargs: {}
    core.detect_latest_new_titles = lambda *args, **kwargs: {}
    core.count_word_frequency = lambda *args, **kwargs: ([], 0)
    core.Scheduler = object
    sys.modules["trendradar.core"] = core

    report = types.ModuleType("trendradar.report")
    report.prepare_report_data = lambda *args, **kwargs: {}
    report.generate_html_report = lambda *args, **kwargs: ""
    report.render_html_content = lambda *args, **kwargs: ""
    sys.modules["trendradar.report"] = report

    notification = types.ModuleType("trendradar.notification")
    notification.render_feishu_content = lambda *args, **kwargs: ""
    notification.render_dingtalk_content = lambda *args, **kwargs: ""
    notification.split_content_into_batches = lambda *args, **kwargs: []
    notification.NotificationDispatcher = object
    sys.modules["trendradar.notification"] = notification

    ai = types.ModuleType("trendradar.ai")
    ai.AITranslator = object
    sys.modules["trendradar.ai"] = ai

    ai_filter = types.ModuleType("trendradar.ai.filter")

    @dataclass
    class AIFilterResult:
        tags: list = field(default_factory=list)
        total_matched: int = 0
        total_processed: int = 0
        success: bool = False
        error: str = ""

    ai_filter.AIFilter = object
    ai_filter.AIFilterResult = AIFilterResult
    sys.modules["trendradar.ai.filter"] = ai_filter

    storage = types.ModuleType("trendradar.storage")
    storage.get_storage_manager = lambda *args, **kwargs: None
    sys.modules["trendradar.storage"] = storage


install_dependency_stubs()

from trendradar.context import AppContext  # noqa: E402
from trendradar.ai.filter import AIFilterResult  # noqa: E402


class ConvertAIFilterToReportDataTests(unittest.TestCase):
    def test_incremental_mode_only_keeps_new_hotlist_and_rss_items(self):
        ctx = AppContext(
            {
                "RANK_THRESHOLD": 50,
                "FILTER": {"PRIORITY_SORT_ENABLED": False},
                "AI_FILTER": {"MIN_SCORE": 0},
                "RSS": {"FRESHNESS_FILTER": {"ENABLED": False}},
                "TIMEZONE": "Asia/Shanghai",
            }
        )

        ai_filter_result = AIFilterResult(
            tags=[
                {
                    "tag": "AI tag",
                    "position": 1,
                    "items": [
                        {
                            "title": "old hotlist item",
                            "source_id": "weibo",
                            "source_name": "微博",
                            "source_type": "hotlist",
                            "first_time": "17-00",
                            "last_time": "17-30",
                        },
                        {
                            "title": "new hotlist item",
                            "source_id": "weibo",
                            "source_name": "微博",
                            "source_type": "hotlist",
                            "first_time": "17-30",
                            "last_time": "17-58",
                        },
                        {
                            "title": "old rss item",
                            "source_id": "hacker-news",
                            "source_name": "Hacker News",
                            "source_type": "rss",
                            "url": "https://example.com/old-rss",
                            "first_time": "2026-03-18T10:00:00+08:00",
                        },
                        {
                            "title": "new rss item",
                            "source_id": "hacker-news",
                            "source_name": "Hacker News",
                            "source_type": "rss",
                            "url": "https://example.com/new-rss",
                            "first_time": "2026-03-18T17:58:00+08:00",
                        },
                    ],
                }
            ],
            total_matched=4,
            success=True,
        )

        hotlist_stats, rss_stats = ctx.convert_ai_filter_to_report_data(
            ai_filter_result,
            mode="incremental",
            new_titles={"weibo": {"new hotlist item": {}}},
            rss_new_urls={"https://example.com/new-rss"},
        )

        self.assertEqual(
            [title["title"] for title in hotlist_stats[0]["titles"]],
            ["new hotlist item"],
        )
        self.assertEqual(
            [title["title"] for title in rss_stats[0]["titles"]],
            ["new rss item"],
        )


if __name__ == "__main__":
    unittest.main()
