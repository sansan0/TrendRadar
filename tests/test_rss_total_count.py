import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from trendradar.__main__ import NewsAnalyzer


def _make_analyzer(report_mode, items):
    analyzer = NewsAnalyzer.__new__(NewsAnalyzer)
    analyzer.report_mode = report_mode
    analyzer.frequency_file = None
    analyzer.rank_threshold = 5
    analyzer._rss_total_count = 0

    ctx = MagicMock()
    ctx.config = {"DISPLAY": {"REGIONS": {"RSS": True}}}
    ctx.timezone = "Asia/Shanghai"
    # 关键词不匹配任何条目（AI 筛选模式下的常态）
    ctx.load_frequency_words.return_value = (
        [{"required": [], "normal": ["不会命中的关键词"], "group_key": "不会命中的关键词"}],
        [],
        [],
    )
    analyzer.ctx = ctx

    storage = MagicMock()
    storage.detect_new_rss_items.return_value = {"feed": ["placeholder"]}
    storage.get_latest_rss_data.return_value = SimpleNamespace(items={"feed": []}, id_to_name={})
    storage.get_rss_data.return_value = SimpleNamespace(items={"feed": []}, id_to_name={})
    analyzer.storage_manager = storage

    analyzer._convert_rss_items_to_list = lambda *_args, **_kwargs: list(items)
    return analyzer


class RssTotalCountTests(unittest.TestCase):
    def setUp(self):
        self.items = [
            {"title": f"RSS 条目 {i}", "url": f"https://example.com/{i}", "feed_id": "feed",
             "feed_name": "Feed", "published_at": ""}
            for i in range(4)
        ]
        self.rss_data = SimpleNamespace(date="2026-10-29", id_to_name={})

    def test_total_count_kept_when_keyword_match_is_empty(self):
        for mode in ("incremental", "current", "daily"):
            with self.subTest(mode=mode):
                analyzer = _make_analyzer(mode, self.items)
                rss_stats, _, raw_items, _ = analyzer._process_rss_data_by_mode(self.rss_data)

                self.assertIsNone(rss_stats)
                self.assertEqual(len(raw_items), 4)
                self.assertEqual(analyzer._rss_total_count, 4)


if __name__ == "__main__":
    unittest.main()
