# coding=utf-8
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class WebuiSettingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.output = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_overlay_returns_empty_dict(self):
        from trendradar.webui_settings import load_overlay

        self.assertEqual(load_overlay(self.output), {})

    def test_save_and_load_roundtrip(self):
        from trendradar.webui_settings import load_overlay, save_overlay

        saved = save_overlay(
            {
                "ai_analysis_enabled": False,
                "schedule_enabled": True,
                "schedule_preset": "morning_evening",
            },
            self.output,
        )
        self.assertFalse(saved["ai_analysis_enabled"])
        self.assertEqual(load_overlay(self.output)["schedule_preset"], "morning_evening")
        self.assertTrue((self.output / ".webui.json").exists())

    def test_rejects_unknown_preset(self):
        from trendradar.webui_settings import save_overlay

        with self.assertRaises(ValueError):
            save_overlay({"schedule_preset": "not-a-preset"}, self.output)

    def test_apply_overlay_overrides_yaml_and_env(self):
        from trendradar.webui_settings import apply_overlay, save_overlay

        save_overlay(
            {
                "ai_analysis_enabled": False,
                "schedule_enabled": True,
                "schedule_preset": "office_hours",
            },
            self.output,
        )
        config = {
            "AI_ANALYSIS": {"ENABLED": True},
            "SCHEDULE": {"enabled": False, "preset": "always_on"},
        }
        apply_overlay(config, output_dir=self.output)
        self.assertFalse(config["AI_ANALYSIS"]["ENABLED"])
        self.assertTrue(config["SCHEDULE"]["enabled"])
        self.assertEqual(config["SCHEDULE"]["preset"], "office_hours")

    def test_one_shot_env_beats_overlay(self):
        from trendradar.webui_settings import apply_overlay, save_overlay

        save_overlay({"ai_analysis_enabled": False}, self.output)
        config = {"AI_ANALYSIS": {"ENABLED": False}, "SCHEDULE": {"enabled": False, "preset": "always_on"}}
        with patch.dict(os.environ, {"WEBUI_RUN_AI": "true"}, clear=False):
            apply_overlay(config, output_dir=self.output)
        self.assertTrue(config["AI_ANALYSIS"]["ENABLED"])

    def test_preset_off_disables_schedule(self):
        from trendradar.webui_settings import save_overlay

        saved = save_overlay({"schedule_preset": "off"}, self.output)
        self.assertFalse(saved["schedule_enabled"])
        self.assertEqual(saved["schedule_preset"], "off")


class WebuiSettingsTopicsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.output = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_and_load_frequency_words(self):
        from trendradar.webui_settings import load_overlay, save_overlay

        content = "[GLOBAL_FILTER]\n震惊\n\n[WORD_GROUPS]\n华为\n/抖音|TikTok/ => 字节跳动\n"
        save_overlay({"frequency_words": content}, self.output)
        self.assertEqual(load_overlay(self.output)["frequency_words"], content)

    def test_rejects_non_string_frequency_words(self):
        from trendradar.webui_settings import save_overlay

        with self.assertRaises(ValueError):
            save_overlay({"frequency_words": ["not", "a", "string"]}, self.output)

    def test_remove_overlay_keys_restores_file_behavior(self):
        from trendradar.webui_settings import load_overlay, remove_overlay_keys, save_overlay

        save_overlay({"frequency_words": "华为", "ai_analysis_enabled": False}, self.output)
        remove_overlay_keys(["frequency_words"], self.output)
        data = load_overlay(self.output)
        self.assertNotIn("frequency_words", data)
        self.assertFalse(data["ai_analysis_enabled"])


class WebuiSettingsFeedsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.output = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_valid_feeds_normalized(self):
        from trendradar.webui_settings import load_overlay, save_overlay

        save_overlay(
            {
                "rss": {
                    "enabled": True,
                    "feeds": [
                        {"name": "Hacker News", "url": "https://hnrss.org/frontpage"},
                        {
                            "id": "ruanyifeng",
                            "name": "阮一峰",
                            "url": "http://www.ruanyifeng.com/blog/atom.xml",
                            "enabled": False,
                            "max_age_days": "3",
                        },
                    ],
                }
            },
            self.output,
        )
        feeds = load_overlay(self.output)["rss"]["feeds"]
        self.assertEqual(feeds[0]["id"], "hacker-news")
        self.assertTrue(feeds[0]["enabled"])
        self.assertNotIn("max_age_days", feeds[0])
        self.assertEqual(feeds[1]["max_age_days"], 3)
        self.assertFalse(feeds[1]["enabled"])

    def test_chinese_name_falls_back_to_url_host(self):
        from trendradar.webui_settings import save_overlay, load_overlay

        save_overlay(
            {
                "rss": {
                    "feeds": [
                        {"name": "阮一峰", "url": "http://www.ruanyifeng.com/blog/atom.xml"},
                        {"name": "阮一峰备份", "url": "http://www.ruanyifeng.com/blog/feed.xml"},
                    ],
                }
            },
            self.output,
        )
        feeds = load_overlay(self.output)["rss"]["feeds"]
        self.assertEqual(feeds[0]["id"], "ruanyifeng")
        self.assertEqual(feeds[1]["id"], "ruanyifeng-2")

    def test_rejects_bad_url_and_duplicate_ids(self):
        from trendradar.webui_settings import save_overlay

        with self.assertRaises(ValueError):
            save_overlay(
                {"rss": {"feeds": [{"id": "a", "url": "ftp://example.com/rss"}]}},
                self.output,
            )
        with self.assertRaises(ValueError):
            save_overlay(
                {
                    "rss": {
                        "feeds": [
                            {"id": "a", "url": "https://x.com/1"},
                            {"id": "a", "url": "https://x.com/2"},
                        ]
                    }
                },
                self.output,
            )

    def test_rejects_unknown_rss_fields(self):
        from trendradar.webui_settings import save_overlay

        with self.assertRaises(ValueError):
            save_overlay({"rss": {"enabled": True, "timeout": 15}}, self.output)

    def test_apply_overlay_overrides_rss_config(self):
        from trendradar.webui_settings import apply_overlay, save_overlay

        feeds = [{"id": "hn", "name": "HN", "url": "https://hnrss.org/frontpage", "enabled": True}]
        save_overlay({"rss": {"enabled": False, "feeds": feeds}}, self.output)
        config = {
            "RSS": {
                "ENABLED": True,
                "FEEDS": [{"id": "old", "name": "旧", "url": "https://old.example/rss"}],
            }
        }
        apply_overlay(config, output_dir=self.output)
        self.assertFalse(config["RSS"]["ENABLED"])
        self.assertEqual(config["RSS"]["FEEDS"], feeds)


class WebuiSettingsAiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.output = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_save_valid_ai(self):
        from trendradar.webui_settings import load_overlay, save_overlay

        save_overlay(
            {"ai": {"model": "deepseek/deepseek-v4-flash", "api_key": "sk-test-123456789", "api_base": ""}},
            self.output,
        )
        data = load_overlay(self.output)["ai"]
        self.assertEqual(data["model"], "deepseek/deepseek-v4-flash")
        self.assertEqual(data["api_key"], "sk-test-123456789")
        self.assertEqual(data["api_base"], "")

    def test_rejects_empty_model_and_bad_base(self):
        from trendradar.webui_settings import save_overlay

        with self.assertRaises(ValueError):
            save_overlay({"ai": {"model": "  "}}, self.output)
        with self.assertRaises(ValueError):
            save_overlay({"ai": {"model": "m", "api_base": "ftp://x"}}, self.output)
        with self.assertRaises(ValueError):
            save_overlay({"ai": {"model": "m", "timeout": 5}}, self.output)

    def test_reasoning_effort_validated_and_applied(self):
        from trendradar.webui_settings import apply_overlay, load_overlay, save_overlay

        with self.assertRaises(ValueError):
            save_overlay({"ai": {"model": "m", "reasoning_effort": "extreme"}}, self.output)

        save_overlay({"ai": {"model": "m", "reasoning_effort": "HIGH"}}, self.output)
        self.assertEqual(load_overlay(self.output)["ai"]["reasoning_effort"], "high")

        config = {"AI": {"MODEL": "m", "REASONING_EFFORT": ""}}
        apply_overlay(config, output_dir=self.output)
        self.assertEqual(config["AI"]["REASONING_EFFORT"], "high")

    def test_mask_secret(self):
        from trendradar.webui_settings import mask_secret

        self.assertIsNone(mask_secret(""))
        self.assertIsNone(mask_secret(None))
        self.assertEqual(mask_secret("short"), "***")
        self.assertEqual(mask_secret("sk-1234567890abcd"), "sk-***abcd")

    def test_apply_overlay_overrides_ai(self):
        from trendradar.webui_settings import apply_overlay, save_overlay

        save_overlay(
            {"ai": {"model": "openai/gpt-4o", "api_key": "sk-new-key", "api_base": ""}},
            self.output,
        )
        config = {"AI": {"MODEL": "old-model", "API_KEY": "old-key", "API_BASE": "https://old/v1"}}
        apply_overlay(config, output_dir=self.output)
        self.assertEqual(config["AI"]["MODEL"], "openai/gpt-4o")
        self.assertEqual(config["AI"]["API_KEY"], "sk-new-key")
        self.assertEqual(config["AI"]["API_BASE"], "")


class FrequencyWordsOverlayTests(unittest.TestCase):
    def test_context_load_prefers_overlay(self):
        from trendradar.context import AppContext
        from trendradar.webui_settings import save_overlay

        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            save_overlay({"frequency_words": "[WORD_GROUPS]\noverlay词"}, output)
            config = {"STORAGE": {"LOCAL": {"DATA_DIR": str(output)}}}
            ctx = AppContext(config)
            groups, _filters, _global = ctx.load_frequency_words()
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["normal"][0]["word"], "overlay词")

    def test_context_load_falls_back_to_file(self):
        from trendradar.context import AppContext

        with tempfile.TemporaryDirectory() as tmp:
            config = {"STORAGE": {"LOCAL": {"DATA_DIR": tmp}}}
            ctx = AppContext(config)
            # 未设置 overlay 且指定不存在的文件时应抛 FileNotFoundError
            with self.assertRaises(FileNotFoundError):
                ctx.load_frequency_words("config/__no_such_file__.txt")


if __name__ == "__main__":
    unittest.main()
