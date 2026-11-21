import random
from unittest import TestCase
from unittest.mock import patch

from mcp_server.tools.analytics import AnalyticsTools


def _make_news():
    """Titles with a skewed character distribution plus edited copies on other platforms."""
    rng = random.Random(20251101)
    common = "的是在了中国人大发新会年将"
    rare = "".join(chr(code) for code in range(0x4E50, 0x4F50))
    platforms = ["weibo", "zhihu", "baidu", "toutiao"]

    def random_title():
        length = rng.randint(4, 24)
        return "".join(
            rng.choice(common) if rng.random() < 0.35 else rng.choice(rare)
            for _ in range(length)
        )

    def edit(title):
        chars = list(title)
        for _ in range(rng.randint(1, 4)):
            pos = rng.randrange(len(chars) + 1)
            op = rng.random()
            if op < 0.4 and pos < len(chars):
                chars[pos] = rng.choice(rare)
            elif op < 0.7:
                chars.insert(pos, rng.choice(common + rare))
            elif len(chars) > 1 and pos < len(chars):
                del chars[pos]
        return "".join(chars)

    titles = []
    for _ in range(120):
        title = random_title()
        titles.append(title)
        titles.extend(edit(title) for _ in range(rng.randint(0, 3)))
    titles.extend(["", "国", "国国", "新闻"])

    news = []
    for idx, title in enumerate(titles):
        rank = rng.randint(1, 50)
        news.append({
            "title": title,
            "platform": platforms[idx % len(platforms)],
            "platform_name": platforms[idx % len(platforms)],
            "date": "2026-01-01",
            "ranks": [rank],
            "count": 1,
            "rank": rank,
            "weight": rng.random(),
            "url": f"https://example.com/{idx}",
        })
    return news


class AggregateSimilarNewsTests(TestCase):
    def test_prefix_index_finds_the_same_groups_as_full_scan(self):
        tools = AnalyticsTools.__new__(AnalyticsTools)
        news = _make_news()

        for threshold in (0.3, 0.5, 0.7, 0.9, 1.0):
            with self.subTest(threshold=threshold):
                indexed = tools._aggregate_similar_news(news, threshold, True)
                with patch.object(AnalyticsTools, "_build_char_prefix_index", return_value=None):
                    full_scan = tools._aggregate_similar_news(news, threshold, True)

                self.assertEqual(indexed, full_scan)
                self.assertLess(len(indexed), len(news))
