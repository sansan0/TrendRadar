# coding=utf-8
"""联网搜索（Web Search）端到端与单元测试套件"""

import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from trendradar.core.loader import load_config
from trendradar.core.scheduler import Scheduler
from trendradar.storage.base import SearchData, SearchItem
from trendradar.storage.local import LocalStorageBackend


class QueryParserTests(unittest.TestCase):
    """search_queries.txt 语法解析测试"""

    def test_parse_blank_line_blocks_and_directives(self):
        from trendradar.crawler.search.query_parser import parse_search_queries_content

        content = """
# 顶部注释
[GLOBAL_FILTER]
震惊
!标题党
-site:baijiahao.baidu.com

[SEARCH_TOPICS]

# 第一个主题：带名称、多子查询、各种修饰符
[低空经济政策]
低空经济 最新政策 试点 site:gov.cn
低空经济 补贴 实施方案
!招聘
-site:spam.example.com
@5
~14d

# 第二个主题：不写主题名，直接一行
DeepSeek 最新模型 发布
@provider:deepseek
~3d
"""
        topics, global_words, global_sites = parse_search_queries_content(content)

        self.assertEqual(global_words, ["震惊", "标题党"])
        self.assertEqual(global_sites, ["baijiahao.baidu.com"])
        self.assertEqual(len(topics), 2)

        t1 = topics[0]
        self.assertEqual(t1.name, "低空经济政策")
        self.assertEqual(
            t1.queries,
            ["低空经济 最新政策 试点 site:gov.cn", "低空经济 补贴 实施方案"],
        )
        self.assertEqual(t1.exclude_words, ["招聘"])
        self.assertEqual(t1.exclude_sites, ["spam.example.com"])
        self.assertEqual(t1.max_items, 5)
        self.assertEqual(t1.freshness_days, 14)

        t2 = topics[1]
        self.assertIn("DeepSeek", t2.name)
        self.assertEqual(t2.queries, ["DeepSeek 最新模型 发布"])
        self.assertEqual(t2.provider, "deepseek")
        self.assertEqual(t2.freshness_days, 3)
        self.assertTrue(t1.id.startswith("topic_"))
        self.assertNotEqual(t1.id, t2.id)


class DeepSeekProviderAndFunnelTests(unittest.TestCase):
    """DeepSeek Provider 与两段式质量漏斗测试"""

    def test_deepseek_search_mapping_and_128_char_guard(self):
        from trendradar.crawler.search.providers.deepseek import DeepSeekSearchProvider

        provider = DeepSeekSearchProvider(
            {"api_key": "sk-test-key", "api_base": "https://api.deepseek.com"},
            timeout=10,
            max_retries=1,
        )

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [
                {
                    "title": "工信部印发算力基础设施政策",
                    "url": "https://www.miit.gov.cn/doc/123",
                    "snippet": "短摘要内容",
                    "summary": "这是专门给大模型消费的 600 字长摘要内容",
                    "content": "",
                    "rerank_score": 2.4,
                    "authority": 4,
                    "site_name": "工业和信息化部",
                    "site_icon": "https://www.miit.gov.cn/favicon.ico",
                    "date": "2026-11-20T08:00:00Z",
                }
            ]
        }

        with patch.object(provider.session, "post", return_value=mock_resp) as mock_post:
            long_query = "人工智能算力基础设施最新政策" * 15  # 超过 128 字符
            items = provider.search(
                long_query,
                count=80,  # 超出 50 应自动裁剪到 50
                topic_id="topic_1",
                topic_name="AI政策",
                freshness_days=7,
                reference_date=datetime(2026, 11, 21),
            )

        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item.title, "工信部印发算力基础设施政策")
        self.assertAlmostEqual(item.score, 0.8, places=2)
        self.assertAlmostEqual(item.raw_score, 2.4, places=2)
        self.assertEqual(item.authority, 4)
        self.assertEqual(item.site_name, "工业和信息化部")

        # 检查发送给 API 的 payload 严格满足 128 字符上限与 count <= 50
        sent_payload = mock_post.call_args.kwargs["json"]
        self.assertLessEqual(len(sent_payload["query"]), 128)
        self.assertEqual(sent_payload["count"], 50)
        self.assertIn("after:2026-11-14", sent_payload["query"])

    def test_deepseek_fetch_returns_markdown(self):
        from trendradar.crawler.search.providers.deepseek import DeepSeekSearchProvider

        provider = DeepSeekSearchProvider({"api_key": "sk-test-key"})
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "title": "政策原文标题",
            "content": "# 政策原文标题\n\n正文 Markdown 内容",
        }

        with patch.object(provider.session, "post", return_value=mock_resp):
            page = provider.fetch("https://www.gov.cn/policy/1")

        self.assertEqual(page.title, "政策原文标题")
        self.assertIn("正文 Markdown 内容", page.content)
        self.assertEqual(page.provider, "deepseek")

    def test_fetcher_quality_and_count_funnel(self):
        from trendradar.crawler.search.base import SearchTopicConfig
        from trendradar.crawler.search.fetcher import WebSearchFetcher

        now = datetime.now()
        recent_iso = (now - timedelta(days=1)).strftime("%Y-%m-%dT08:00:00Z")
        stale_iso = (now - timedelta(days=30)).strftime("%Y-%m-%dT08:00:00Z")

        mock_items = [
            SearchItem(
                title="高分权威新政策",
                topic_id="topic_p",
                topic_name="政策",
                url="https://www.gov.cn/1",
                score=0.85,
                raw_score=2.55,
                authority=4,
                published_at=recent_iso,
                snippet="权威政策细则",
            ),
            SearchItem(
                title="普通可信新闻",
                topic_id="topic_p",
                topic_name="政策",
                url="https://news.example.com/2",
                score=0.60,
                raw_score=1.80,
                authority=-1,
                published_at=recent_iso,
                snippet="普通报道",
            ),
            SearchItem(
                title="低质量水文",
                topic_id="topic_p",
                topic_name="政策",
                url="https://low.example.com/3",
                score=0.25,
                raw_score=0.75,
                authority=1,
                published_at=recent_iso,
                snippet="低质内容",
            ),
            SearchItem(
                title="半年前的旧政策",
                topic_id="topic_p",
                topic_name="政策",
                url="https://www.gov.cn/old",
                score=0.90,
                raw_score=2.70,
                authority=4,
                published_at=stale_iso,
                snippet="过时旧闻",
            ),
            SearchItem(
                title="震惊！这是标题党文章",
                topic_id="topic_p",
                topic_name="政策",
                url="https://clickbait.example.com/5",
                score=0.88,
                raw_score=2.64,
                authority=3,
                published_at=recent_iso,
                snippet="营销号",
            ),
            SearchItem(
                title="被屏蔽域名的文章",
                topic_id="topic_p",
                topic_name="政策",
                url="https://baijiahao.baidu.com/s?id=999",
                score=0.80,
                raw_score=2.40,
                authority=2,
                published_at=recent_iso,
                snippet="百家号",
            ),
            SearchItem(
                title="第二条高分新政策",
                topic_id="topic_p",
                topic_name="政策",
                url="https://www.miit.gov.cn/6",
                score=0.78,
                raw_score=2.34,
                authority=3,
                published_at=recent_iso,
                snippet="工信部细则",
            ),
        ]

        fake_provider = MagicMock()
        fake_provider.name = "deepseek"
        fake_provider.max_query_length = 128
        fake_provider.validate_config.return_value = (True, "")
        fake_provider.search.return_value = mock_items

        topic = SearchTopicConfig(
            id="topic_p",
            name="政策",
            queries=["低空经济 最新政策"],
            max_items=2,  # 截断只保留前 2 条
            freshness_days=7,
        )
        ws_config = {
            "ENABLED": True,
            "PROVIDER": "deepseek",
            "QUERY_MODE": "direct",
            "FETCH_COUNT": 20,
            "MAX_ITEMS_PER_TOPIC": 8,
            "FRESHNESS_DAYS": 7,
            "MIN_SCORE": 0.5,
            "MIN_AUTHORITY": 2,
            "ALLOW_UNKNOWN_AUTHORITY": True,
            "NEED_CONTENT": False,
            "REQUEST_INTERVAL": 0,
            "PROVIDERS": {"deepseek": {"api_key": "sk-test"}},
        }

        with patch(
            "trendradar.crawler.search.fetcher.create_search_provider_from_config",
            return_value=fake_provider,
        ):
            fetcher = WebSearchFetcher(
                web_search_config=ws_config,
                topics=[topic],
                global_exclude_words=["震惊"],
                global_exclude_sites=["baijiahao.baidu.com"],
            )
            result = fetcher.fetch_all()

        kept = result.items["topic_p"]
        # 过滤后剩余 3 条（0.85, 0.78, 0.60），截断 max_items=2 只留前两条高分
        self.assertEqual([x.title for x in kept], ["高分权威新政策", "第二条高分新政策"])

    def test_query_rewriter_smart_mode_and_cache(self):
        from trendradar.crawler.search.query_rewriter import SearchQueryRewriter

        with tempfile.TemporaryDirectory() as tmp:
            backend = LocalStorageBackend(data_dir=tmp)
            rewriter = SearchQueryRewriter(
                ai_config={"MODEL": "deepseek/deepseek-v4-flash", "API_KEY": "sk-test"},
                storage_manager=backend,
            )
            prompt = "帮我关注国家发改委和工信部关于人工智能算力基础设施补贴以及低空经济试点的最新政策动态"
            self.assertTrue(rewriter.should_rewrite(prompt))
            self.assertFalse(rewriter.should_rewrite("DeepSeek 最新模型"))

            fake_resp = json.dumps(
                {
                    "ori_question": "人工智能算力补贴与低空经济最新政策",
                    "queries": [
                        "发改委 工信部 人工智能 算力补贴 最新政策",
                        "低空经济 试点 最新政策 site:gov.cn",
                    ],
                },
                ensure_ascii=False,
            )
            with patch("trendradar.crawler.search.query_rewriter.AIClient") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.validate_config.return_value = (True, "")
                mock_client.chat.return_value = fake_resp

                q1, ori1 = rewriter.rewrite(prompt, "2026-11-21")
                self.assertEqual(len(q1), 2)
                self.assertIn("算力补贴", q1[0])
                self.assertEqual(ori1, "人工智能算力补贴与低空经济最新政策")
                self.assertEqual(mock_client.chat.call_count, 1)

                # 第二次同一天同一提示词应命中缓存，不再调用 AI
                q2, ori2 = rewriter.rewrite(prompt, "2026-11-21")
                self.assertEqual(q2, q1)
                self.assertEqual(ori2, ori1)
                self.assertEqual(mock_client.chat.call_count, 1)
            backend.cleanup()


class StorageAndDedupTests(unittest.TestCase):
    """联网搜索 SQLite 存储与跨天去重测试"""

    def test_save_load_and_cross_day_dedup(self):
        with tempfile.TemporaryDirectory() as tmp:
            backend = LocalStorageBackend(data_dir=tmp)
            day1_data = SearchData(
                date="2026-11-20",
                crawl_time="09-00",
                items={
                    "topic_1": [
                        SearchItem(
                            title="昨日政策A",
                            topic_id="topic_1",
                            topic_name="AI政策",
                            url="https://gov.cn/a",
                            snippet="政策A摘要",
                            summary="政策A长摘要",
                            site_name="中国政府网",
                            score=0.85,
                            raw_score=2.55,
                            authority=4,
                            published_at="2026-11-20T08:00:00Z",
                            crawl_time="09-00",
                        )
                    ]
                },
                id_to_name={"topic_1": "AI政策"},
                id_to_query={"topic_1": "AI 最新政策"},
                id_to_provider={"topic_1": "deepseek"},
            )
            self.assertTrue(backend.save_search_data(day1_data))

            # 次日搜到了昨日政策A + 今日新政策B
            day2_data = SearchData(
                date="2026-11-21",
                crawl_time="09-00",
                items={
                    "topic_1": [
                        SearchItem(
                            title="昨日政策A",
                            topic_id="topic_1",
                            topic_name="AI政策",
                            url="https://gov.cn/a",
                            score=0.85,
                            crawl_time="09-00",
                        ),
                        SearchItem(
                            title="今日新政策B",
                            topic_id="topic_1",
                            topic_name="AI政策",
                            url="https://gov.cn/b",
                            score=0.80,
                            crawl_time="09-00",
                        ),
                    ]
                },
                id_to_name={"topic_1": "AI政策"},
                id_to_query={"topic_1": "AI 最新政策"},
                id_to_provider={"topic_1": "deepseek"},
            )

            # 跨天去重 7 天：仅政策B算新增，且不会创建不存在的历史日期空库
            new_items = backend.detect_new_search_items(day2_data, dedup_days=7)
            self.assertEqual(len(new_items.get("topic_1", [])), 1)
            self.assertEqual(new_items["topic_1"][0].title, "今日新政策B")
            self.assertFalse((Path(tmp) / "search" / "2026-11-19.db").exists())

            # 保存并读取次日数据 + 改写缓存读写
            self.assertTrue(backend.save_search_data(day2_data))
            loaded = backend.get_search_data("2026-11-21")
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded.get_total_count(), 2)

            self.assertTrue(
                backend.save_search_query_cache(
                    "hash123", "帮我找低空经济政策", ["低空经济 最新政策"], "低空经济政策", "2026-11-21"
                )
            )
            cached = backend.get_search_query_cache("hash123", "2026-11-21")
            self.assertEqual(cached["queries"], ["低空经济 最新政策"])
            backend.cleanup()


class ConfigAndSchedulerTests(unittest.TestCase):
    """配置加载与时间线调度扩展测试"""

    def test_deepseek_reuses_ai_api_key_and_region_order_backcompat(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg_path = Path(tmp) / "config.yaml"
            cfg_path.write_text(
                """
ai:
  model: "deepseek/deepseek-v4-flash"
  api_key: "sk-shared-from-ai"
web_search:
  enabled: true
display:
  region_order:
    - hotlist
    - rss
    - ai_analysis
""",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                cfg = load_config(str(cfg_path))

            self.assertTrue(cfg["WEB_SEARCH"]["ENABLED"])
            self.assertEqual(cfg["WEB_SEARCH"]["PROVIDERS"]["deepseek"]["api_key"], "sk-shared-from-ai")
            # 旧配置未写 web_search 时自动补入 region_order
            self.assertIn("web_search", cfg["DISPLAY"]["REGION_ORDER"])

    def test_scheduler_resolves_search_fields(self):
        timeline_data = {
            "presets": {
                "custom_test": {
                    "default": {
                        "collect": True,
                        "search": False,
                        "analyze": False,
                        "push": False,
                        "report_mode": "current",
                        "once": {"analyze": False, "push": False, "search": False},
                    },
                    "periods": {
                        "morning": {
                            "name": "早间搜索",
                            "start": "08:00",
                            "end": "10:00",
                            "search": True,
                            "search_file": "policy.txt",
                            "once": {"search": True},
                        }
                    },
                    "day_plans": {"all": {"periods": ["morning"]}},
                    "week_map": {i: "all" for i in range(1, 8)},
                }
            }
        }
        scheduler = Scheduler(
            schedule_config={"enabled": True, "preset": "custom_test"},
            timeline_data=timeline_data,
            storage_backend=MagicMock(),
            get_time_func=lambda: datetime(2026, 11, 21, 9, 0),
        )
        resolved = scheduler.resolve()
        self.assertTrue(resolved.search)
        self.assertTrue(resolved.once_search)
        self.assertEqual(resolved.search_file, "policy.txt")


class ReportNotificationAndAIIntegrationTests(unittest.TestCase):
    """HTML 报告三块区域、多渠道推送、AI 分析集成测试"""

    def _sample_search_items(self):
        return [
            {
                "topic_id": "topic_1",
                "word": "低空经济政策",
                "query": "低空经济 最新政策 site:gov.cn",
                "provider": "deepseek",
                "count": 1,
                "titles": [
                    {
                        "title": "工信部印发低空经济实施方案",
                        "url": "https://www.miit.gov.cn/1",
                        "source_name": "工业和信息化部",
                        "time_display": "11-20 08:00",
                        "published_at": "2026-11-20T08:00:00Z",
                        "snippet": "提出建设低空智联网络与财政补贴措施。",
                        "summary": "详细长摘要：明确2028年前在重点城市群建设低空基础设施，给予专项债贴息。",
                        "score": 0.85,
                        "raw_score": 2.55,
                        "authority": 4,
                        "provider": "deepseek",
                        "is_new": True,
                    }
                ],
            }
        ]

    def test_html_renders_three_sources_and_section_nav(self):
        from trendradar.report.html import render_html_content

        report_data = {
            "stats": [
                {
                    "word": "AI",
                    "count": 1,
                    "percentage": 100,
                    "titles": [
                        {
                            "title": "热榜测试新闻",
                            "source_name": "知乎",
                            "time_display": "09:00",
                            "count": 1,
                            "ranks": [1],
                            "rank_threshold": 5,
                            "url": "https://zhihu.com/1",
                            "mobile_url": "",
                            "is_new": True,
                        }
                    ],
                }
            ],
            "new_titles": [],
            "failed_ids": [],
            "total_new_count": 1,
            "hotlist_total": 10,
            "platform_total": 1,
            "rss_matched_count": 1,
            "rss_total_count": 5,
            "rss_source_total": 1,
            "rss_source_failed": 0,
            "search_matched_count": 1,
            "search_total_count": 1,
            "search_topic_total": 1,
            "search_topic_failed": 0,
            "search_new_count": 1,
        }
        rss_items = [
            {
                "word": "AI",
                "count": 1,
                "titles": [
                    {
                        "title": "RSS测试文章",
                        "source_name": "Hacker News",
                        "time_display": "11-20 09:00",
                        "url": "https://hn.example.com/1",
                        "is_new": False,
                    }
                ],
            }
        ]
        html = render_html_content(
            report_data=report_data,
            total_titles=10,
            rss_items=rss_items,
            search_items=self._sample_search_items(),
            region_order=["hotlist", "rss", "web_search", "ai_analysis"],
        )
        self.assertIn("search-section", html)
        self.assertIn("section-nav-bar", html)
        self.assertIn("工信部印发低空经济实施方案", html)
        self.assertIn("提出建设低空智联网络与财政补贴措施", html)
        self.assertIn("权威", html)

    def test_email_html_sanitization_strips_interactive_tabs_and_preserves_all_topics(self):
        from trendradar.report.html import render_html_content, prepare_html_for_email

        report_data = {
            "stats": [
                {
                    "word": "AI",
                    "count": 1,
                    "titles": [
                        {
                            "title": "热榜新闻",
                            "source_name": "知乎",
                            "ranks": [8, 4, 1],
                            "rank_threshold": 5,
                            "rank_timeline": [
                                {"time": "08:00", "rank": 8},
                                {"time": "09:00", "rank": None},
                                {"time": "10:00", "rank": 1},
                            ],
                            "time_display": "08:00 ~ 10:00",
                            "count": 2,
                            "url": "https://zhihu.com/1",
                            "is_new": True,
                        }
                    ],
                }
            ],
            "new_titles": [],
            "failed_ids": [],
            "total_new_count": 1,
            "hotlist_total": 10,
            "platform_total": 2,
            "search_matched_count": 2,
            "search_total_count": 2,
            "search_topic_total": 2,
            "search_topic_failed": 0,
            "search_new_count": 1,
        }
        multi_topics = [
            *self._sample_search_items(),
            {
                "topic_id": "topic_2",
                "word": "人工智能监管",
                "query": "人工智能 监管 法规",
                "provider": "deepseek",
                "count": 1,
                "titles": [
                    {
                        "title": "第二主题政策要点",
                        "url": "https://www.gov.cn/ai-reg",
                        "source_name": "中国政府网",
                        "time_display": "11-21 08:30",
                        "snippet": "明确生成式 AI 备案要求与行业标准。",
                        "authority": 4,
                        "score": 0.85,
                        "provider": "deepseek",
                        "is_new": False,
                    }
                ],
            },
        ]
        standalone_data = {
            "platforms": [
                {"id": "zhihu", "name": "知乎热榜", "items": [{"title": "独立热榜1", "url": "https://zhihu.com/a", "rank": 1}]},
                {"id": "weibo", "name": "微博热搜", "items": [{"title": "独立热榜2", "url": "https://weibo.com/b", "rank": 2}]},
            ],
            "rss_feeds": [],
        }

        browser_html = render_html_content(
            report_data=report_data,
            total_titles=10,
            search_items=multi_topics,
            standalone_data=standalone_data,
            region_order=["hotlist", "web_search", "standalone"],
        )
        # 浏览器版应包含完整交互元素、指标悬停明细浮层、分段滑块导航、排名变化轨迹与脚本
        self.assertIn("<script>", browser_html)
        self.assertIn("section-nav-bar", browser_html)
        self.assertIn("section-nav-indicator", browser_html)
        self.assertIn("metric-tooltip", browser_html)
        self.assertIn("新增条目构成", browser_html)
        self.assertIn("search-tab-bar-wrapper", browser_html)
        self.assertIn("standalone-tab-bar", browser_html)
        self.assertIn("data-rank-timeline=", browser_html)
        self.assertIn('id="rank-timeline-popover"', browser_html)
        self.assertIn("trend-badge trend-up", browser_html)
        # 浏览器版与邮件版均不应出现 emoji 符号
        for forbidden_emoji in ("📈", "📉", "🔥", "📰", "🔍", "✨", "⚠", "⛶", "☽", "⊡", "☀"):
            self.assertNotIn(forbidden_emoji, browser_html)

        email_html = prepare_html_for_email(browser_html)
        # 邮件版必须彻底移除脚本和所有需要点击/悬停的 Tab/工具栏/浮层/轨迹数据属性
        self.assertNotIn("<script", email_html.lower())
        self.assertNotIn("section-nav-bar", email_html)
        self.assertNotIn("section-nav-indicator", email_html)
        self.assertNotIn("metric-tooltip", email_html)
        self.assertNotIn("rank-timeline-popover", email_html)
        self.assertNotIn("data-rank-timeline", email_html)
        self.assertNotIn("search-tab-bar-wrapper", email_html)
        self.assertNotIn("standalone-tab-bar", email_html)
        self.assertNotIn("tab-bar-wrapper", email_html)
        self.assertNotIn("save-buttons", email_html)
        self.assertNotIn("fab-bar", email_html)
        self.assertNotIn("toggleWideMode", email_html)
        for forbidden_emoji in ("📈", "📉", "🔥", "📰", "🔍", "✨", "⚠", "⛶", "☽", "⊡", "☀"):
            self.assertNotIn(forbidden_emoji, email_html)
        # 邮件版应包含零 JS 锚点目录并完整保留全部主题内容、纯字符趋势符号与样式兜底
        self.assertIn('class="email-toc"', email_html)
        self.assertIn('class="trend-email-glyph"', email_html)
        self.assertIn('href="#region-web_search"', email_html)
        self.assertIn('id="region-web_search"', email_html)
        self.assertIn("低空经济政策", email_html)
        self.assertIn("人工智能监管", email_html)
        self.assertIn("第二主题政策要点", email_html)
        self.assertIn("background-color: #4f46e5;", email_html)
        self.assertLess(len(email_html.encode("utf-8")), len(browser_html.encode("utf-8")) * 0.55)

    def test_notification_splitter_renders_web_search(self):
        from trendradar.notification.splitter import split_content_into_batches

        report_data = {
            "stats": [],
            "new_titles": [],
            "failed_ids": [],
            "total_new_count": 0,
            "search_matched_count": 1,
            "search_topic_total": 1,
            "search_topic_failed": 0,
        }
        for fmt in ("feishu", "dingtalk", "wework", "telegram", "slack", "ntfy", "bark"):
            batches = split_content_into_batches(
                report_data=report_data,
                format_type=fmt,
                search_items=self._sample_search_items(),
                show_search_snippet=True,
                region_order=["hotlist", "rss", "web_search", "ai_analysis"],
            )
            self.assertTrue(batches, f"{fmt} should produce non-empty batches")
            joined = "\n".join(batches)
            self.assertIn("低空经济政策", joined)
            self.assertIn("工信部印发低空经济实施方案", joined)

    def test_ai_analyzer_supports_search_only_and_parses_search_insights(self):
        from trendradar.ai.analyzer import AIAnalyzer
        from trendradar.ai.formatter import render_ai_analysis_html_rich, render_ai_analysis_markdown

        analyzer = AIAnalyzer(
            ai_config={"MODEL": "deepseek/deepseek-v4-flash", "API_KEY": "sk-test"},
            analysis_config={"INCLUDE_WEB_SEARCH": True, "SEARCH_SUMMARY_MAX_CHARS": 100},
            get_time_func=lambda: datetime(2026, 11, 21, 9, 0),
        )
        fake_json = json.dumps(
            {
                "core_trends": "低空经济政策加速落地。",
                "search_insights": "1. 「低空经济政策」：明确2028年前基建与专项债贴息方向。",
                "outlook_strategy": "1. 投资者：关注低空基建与空管系统龙头。",
            },
            ensure_ascii=False,
        )
        with patch.object(analyzer, "_call_ai", return_value=fake_json):
            res = analyzer.analyze(stats=[], search_stats=self._sample_search_items())

        self.assertTrue(res.success)
        self.assertEqual(res.search_count, 1)
        self.assertEqual(res.search_analyzed, 1)
        self.assertIn("低空经济政策", res.search_insights)
        self.assertIn("联网搜索专题研判", render_ai_analysis_markdown(res))
        self.assertIn("联网搜索专题研判", render_ai_analysis_html_rich(res))


class MCPWebSearchTests(unittest.TestCase):
    """MCP Server 联网搜索历史查询、实时搜索与 DeepSeek Fetch 测试"""

    def test_mcp_data_service_and_tools_for_web_search(self):
        from mcp_server.services.data_service import DataService
        from mcp_server.tools.data_query import DataQueryTools

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "config").mkdir()
            (root / "config" / "config.yaml").write_text(
                "web_search:\n  enabled: true\n  provider: deepseek\n  providers:\n    deepseek:\n      api_key: secret-must-not-leak\n",
                encoding="utf-8",
            )
            (root / "config" / "search_queries.txt").write_text(
                "[低空经济政策]\n低空经济 最新政策\n",
                encoding="utf-8",
            )

            today = datetime.now().strftime("%Y-%m-%d")
            backend = LocalStorageBackend(data_dir=str(root / "output"))
            backend.save_search_data(
                SearchData(
                    date=today,
                    crawl_time="09-00",
                    items={
                        "topic_1": [
                            SearchItem(
                                title="低空经济专项政策发布",
                                topic_id="topic_1",
                                topic_name="低空经济政策",
                                url="https://www.gov.cn/low-alt",
                                snippet="重点支持通用机场建设",
                                summary="长摘要内容",
                                site_name="中国政府网",
                                score=0.88,
                                raw_score=2.64,
                                authority=4,
                                published_at=f"{today}T08:00:00Z",
                                crawl_time="09-00",
                            )
                        ]
                    },
                    id_to_name={"topic_1": "低空经济政策"},
                    id_to_query={"topic_1": "低空经济 最新政策"},
                    id_to_provider={"topic_1": "deepseek"},
                )
            )
            backend.cleanup()

            ds = DataService(str(root))
            cfg = ds.get_current_config("web_search")
            self.assertNotIn("secret-must-not-leak", json.dumps(cfg))
            self.assertTrue(cfg.get("api_key_configured"))

            dq = DataQueryTools(str(root))
            latest = dq.get_latest_web_search(days=1, limit=10, include_summary=True)
            self.assertTrue(latest["success"], latest)
            self.assertEqual(len(latest["data"]), 1)
            self.assertEqual(latest["data"][0]["title"], "低空经济专项政策发布")
            self.assertEqual(latest["data"][0]["summary"], "长摘要内容")

            hist = dq.search_web_history(keyword="通用机场", days=3)
            self.assertTrue(hist["success"], hist)
            self.assertEqual(len(hist["data"]), 1)

            status = dq.get_web_search_status()
            self.assertTrue(status["success"], status)
            self.assertIn(today, status["available_dates"])
            self.assertEqual(status["today_topics"]["topic_1"]["item_count"], 1)
            self.assertEqual(status["configured_topics_count"], 1)

    def test_mcp_live_web_search_and_missing_key(self):
        from mcp_server.tools.web_search import WebSearchTools

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "config").mkdir()
            # 1) 未配置任何 API Key 时应给出清晰错误提示
            (root / "config" / "config.yaml").write_text(
                "web_search:\n  enabled: true\n  provider: deepseek\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {}, clear=True):
                tools = WebSearchTools(str(root))
                missing = tools.live_web_search("低空经济政策")
            self.assertFalse(missing["success"])
            self.assertEqual(missing["error"]["code"], "API_KEY_MISSING")

            # 2) 配置 Key 后应调用搜索引擎、过滤质量分/权威度且不污染 stdout
            (root / "config" / "config.yaml").write_text(
                "web_search:\n  enabled: true\n  provider: deepseek\n  providers:\n    deepseek:\n      api_key: sk-live-test\n",
                encoding="utf-8",
            )
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "results": [
                    {
                        "title": "权威低空经济政策解读",
                        "url": "https://www.gov.cn/policy1",
                        "snippet": "重点支持通用机场建设",
                        "summary": "详细长摘要",
                        "rerank_score": 2.4,
                        "authority": 4,
                        "site_name": "中国政府网",
                        "date": "2026-11-21T08:00:00Z",
                    },
                    {
                        "title": "低分灌水内容",
                        "url": "https://spam.example.com/1",
                        "snippet": "凑字数",
                        "summary": "凑字数",
                        "rerank_score": 0.6,
                        "authority": 1,
                        "site_name": "某营销号",
                        "date": "2026-11-21T07:00:00Z",
                    },
                ]
            }
            with patch("requests.Session.post", return_value=mock_resp):
                tools = WebSearchTools(str(root))
                res = tools.live_web_search(
                    "低空经济最新政策",
                    count=5,
                    freshness_days=7,
                    min_score=0.5,
                    min_authority=3,
                )

            self.assertTrue(res["success"], res)
            self.assertEqual(len(res["data"]), 1)
            self.assertEqual(res["data"][0]["title"], "权威低空经济政策解读")
            self.assertAlmostEqual(res["data"][0]["score"], 0.8, places=3)

    def test_mcp_article_reader_deepseek_fetch(self):
        from mcp_server.tools.article_reader import ArticleReaderTools

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "config").mkdir()
            (root / "config" / "config.yaml").write_text(
                "web_search:\n  providers:\n    deepseek:\n      api_key: sk-fetch-test\n",
                encoding="utf-8",
            )
            reader = ArticleReaderTools(str(root))
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "title": "测试网页",
                "content": "# 测试网页\n\nMarkdown 正文",
            }
            with patch("requests.post", return_value=mock_resp):
                res = reader.read_article("https://example.com/article", provider="deepseek")

            self.assertTrue(res["success"], res)
            self.assertEqual(res["data"]["provider"], "deepseek")
            self.assertIn("Markdown 正文", res["data"]["content"])


class EndToEndAndCLITests(unittest.TestCase):
    """纯联网搜索端到端流程与 CLI 体检/状态测试"""

    def test_pure_web_search_runs_without_hotlist_or_rss(self):
        from trendradar.__main__ import NewsAnalyzer

        with tempfile.TemporaryDirectory() as tmp:
            old_cwd = os.getcwd()
            os.chdir(tmp)
            try:
                cfg_dir = Path(tmp) / "config"
                cfg_dir.mkdir()
                queries_path = cfg_dir / "search_queries.txt"
                queries_path.write_text(
                    "[低空经济政策]\n低空经济 最新政策\n",
                    encoding="utf-8",
                )
                cfg_path = cfg_dir / "config.yaml"
                cfg_path.write_text(
                    "\n".join(
                        [
                            "app:",
                            "  timezone: Asia/Shanghai",
                            "  show_version_update: false",
                            "platforms:",
                            "  enabled: false",
                            "  sources: []",
                            "rss:",
                            "  enabled: false",
                            "  feeds: []",
                            "web_search:",
                            "  enabled: true",
                            "  provider: deepseek",
                            f"  queries_file: {queries_path.as_posix()}",
                            "  query_mode: direct",
                            "  fetch_count: 10",
                            "  max_items_per_topic: 5",
                            "  min_score: 0.4",
                            "  min_authority: -1",
                            "  freshness_days: 30",
                            "  dedup_days: 7",
                            "  request_interval: 0",
                            "  providers:",
                            "    deepseek:",
                            "      api_key: sk-e2e-test",
                            "report:",
                            "  mode: daily",
                            "display:",
                            "  region_order:",
                            "    - web_search",
                            "    - hotlist",
                            "    - rss",
                            "  regions:",
                            "    hotlist: false",
                            "    rss: false",
                            "    web_search: true",
                            "    new_items: true",
                            "    ai_analysis: false",
                            "notification:",
                            "  enabled: false",
                            "storage:",
                            "  backend: local",
                            "  formats:",
                            "    sqlite: true",
                            "    txt: false",
                            "    html: true",
                            "  local:",
                            "    data_dir: output",
                            "schedule:",
                            "  enabled: false",
                        ]
                    ),
                    encoding="utf-8",
                )

                cfg = load_config(str(cfg_path))
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {
                    "results": [
                        {
                            "title": "国家发改委发布低空经济高质量发展指导意见",
                            "url": "https://www.ndrc.gov.cn/low-altitude-2026",
                            "snippet": "支持重点城市建设低空飞行服务保障体系。",
                            "summary": "详细解读指导意见全文。",
                            "rerank_score": 2.4,
                            "authority": 4,
                            "site_name": "国家发改委",
                            "date": datetime.now().strftime("%Y-%m-%dT08:00:00Z"),
                        }
                    ]
                }

                with patch("requests.Session.post", return_value=mock_resp), patch("webbrowser.open"):
                    analyzer = NewsAnalyzer(config=cfg)
                    analyzer.is_github_actions = True  # 禁止打开浏览器
                    analyzer.run()

                latest_html = Path(tmp) / "output" / "html" / "latest" / "daily.html"
                self.assertTrue(latest_html.exists(), "纯联网搜索模式应生成 HTML 报告")
                html_text = latest_html.read_text(encoding="utf-8")
                self.assertIn("低空经济政策", html_text)
                self.assertIn("国家发改委发布低空经济高质量发展指导意见", html_text)

                today_db = Path(tmp) / "output" / "search" / f"{datetime.now().strftime('%Y-%m-%d')}.db"
                self.assertTrue(today_db.exists(), "应持久化到 output/search/{date}.db")
            finally:
                os.chdir(old_cwd)

    def test_doctor_checks_web_search(self):
        from trendradar.commands.doctor import _check_web_search

        with tempfile.TemporaryDirectory() as tmp:
            qfile = Path(tmp) / "search_queries.txt"
            qfile.write_text("[AI监管]\n人工智能 监管政策\n", encoding="utf-8")
            cfg = {
                "WEB_SEARCH": {
                    "ENABLED": True,
                    "PROVIDER": "deepseek",
                    "QUERIES_FILE": str(qfile),
                    "PROVIDERS": {"deepseek": {"api_key": "sk-test-key"}},
                }
            }
            checks = []
            _check_web_search(checks, cfg)
            self.assertTrue(checks)
            self.assertTrue(all(status in ("pass", "warn") for status, _, _ in checks), checks)


if __name__ == "__main__":
    unittest.main()
