"""RSS totals follow the selected report data, including early-return paths."""

import os
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# Keep standalone test runs offline during LiteLLM's import.
with patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}):
    from trendradar.__main__ import NewsAnalyzer
    from trendradar.storage.base import RSSData, RSSItem


def _rss_data(items):
    return RSSData(
        date="2026-10-29", crawl_time="12:00",
        items={"feed": list(items)}, id_to_name={"feed": "Feed"},
    )


def _make_analyzer(report_mode, new_items, current_items, daily_items):
    analyzer = NewsAnalyzer.__new__(NewsAnalyzer)
    analyzer.report_mode = report_mode
    analyzer.frequency_file = None
    analyzer.rank_threshold = 5
    analyzer._rss_total_count = 0

    ctx = MagicMock()
    ctx.config = {
        "DISPLAY": {"REGIONS": {"RSS": True}},
        "TIMEZONE": "Asia/Shanghai",
    }
    ctx.timezone = "Asia/Shanghai"
    ctx.rss_config = {"FRESHNESS_FILTER": {"ENABLED": False, "MAX_AGE_DAYS": 1}}
    ctx.rss_feeds = []
    # 模拟关键词未命中、后续仍可能由 AI 筛选出内容的情况。
    ctx.load_frequency_words.return_value = (
        [{"required": [], "normal": ["不会命中的关键词"], "group_key": "不会命中的关键词"}],
        [],
        [],
    )
    analyzer.ctx = ctx

    storage = MagicMock()
    storage.detect_new_rss_items.return_value = {"feed": list(new_items)}
    storage.get_latest_rss_data.return_value = _rss_data(current_items)
    storage.get_rss_data.return_value = _rss_data(daily_items)
    analyzer.storage_manager = storage

    return analyzer


class RssTotalCountTests(unittest.TestCase):
    MODE_TOTALS = (("incremental", 2), ("current", 4), ("daily", 6))

    def setUp(self):
        self.items = [
            RSSItem(
                title=f"RSS 条目 {i}", url=f"https://example.com/{i}",
                feed_id="feed", published_at="2026-10-29T08:00:00+08:00",
            )
            for i in range(6)
        ]
        self.rss_data = _rss_data(self.items[:4])

    def make_analyzer(self, mode):
        return _make_analyzer(mode, self.items[:2], self.items[:4], self.items)

    def test_total_count_kept_when_keyword_match_is_empty(self):
        for mode, expected in self.MODE_TOTALS:
            with self.subTest(mode=mode):
                analyzer = self.make_analyzer(mode)
                rss_stats, _, raw_items, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                self.assertIsNone(rss_stats)
                self.assertEqual(len(raw_items), expected)
                self.assertEqual(analyzer._rss_total_count, expected)

    def test_total_count_preserved_when_keywords_match_or_are_unconfigured(self):
        keyword_groups = [{"required": [], "normal": ["RSS"], "group_key": "RSS"}]
        for mode, expected in self.MODE_TOTALS:
            for groups in (keyword_groups, []):
                with self.subTest(mode=mode, groups=groups):
                    analyzer = self.make_analyzer(mode)
                    analyzer.ctx.load_frequency_words.return_value = (groups, [], [])
                    rss_stats, _, _, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                    self.assertEqual(sum(stat["count"] for stat in rss_stats), expected)
                    self.assertEqual(analyzer._rss_total_count, expected)

    def test_total_count_kept_when_rss_display_is_disabled(self):
        for mode, expected in self.MODE_TOTALS:
            with self.subTest(mode=mode):
                analyzer = self.make_analyzer(mode)
                analyzer.ctx.config["DISPLAY"]["REGIONS"]["RSS"] = False
                rss_stats, new_stats, raw_items, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                self.assertIsNone(rss_stats)
                self.assertIsNone(new_stats)
                self.assertEqual(len(raw_items), expected)
                self.assertEqual(analyzer._rss_total_count, expected)

    def test_total_count_is_cleared_when_there_are_no_items(self):
        for mode, _ in self.MODE_TOTALS:
            with self.subTest(mode=mode):
                analyzer = self.make_analyzer(mode)
                analyzer._process_rss_data_by_mode(self.rss_data)
                self.assertGreater(analyzer._rss_total_count, 0)
                analyzer.storage_manager.detect_new_rss_items.return_value = {}
                analyzer.storage_manager.get_latest_rss_data.return_value = None
                analyzer.storage_manager.get_rss_data.return_value = None

                rss_stats, _, _, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                self.assertIsNone(rss_stats)
                self.assertEqual(analyzer._rss_total_count, 0)

    def test_total_count_excludes_items_removed_by_freshness_filter(self):
        self.items[0].published_at = "2026-10-20T08:00:00+08:00"
        now = datetime(2026, 10, 29, 4, tzinfo=timezone.utc)
        with patch("trendradar.utils.time.get_configured_time", return_value=now):
            for mode, expected in self.MODE_TOTALS:
                with self.subTest(mode=mode):
                    analyzer = self.make_analyzer(mode)
                    analyzer.ctx.rss_config["FRESHNESS_FILTER"]["ENABLED"] = True
                    _, _, raw_items, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                    self.assertEqual(len(raw_items), expected - 1)
                    self.assertEqual(analyzer._rss_total_count, expected - 1)


if __name__ == "__main__":
    unittest.main()
