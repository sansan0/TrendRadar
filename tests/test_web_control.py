# coding=utf-8
import json
import os
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch


class ParseJobProgressTests(unittest.TestCase):
    def test_parse_platform_and_rss_progress(self):
        from trendradar.web_control import parse_job_progress

        log = """
配置的监控平台: ['今日头条', '百度热搜', '微博']
开始爬取数据，请求间隔 2000 毫秒
正在获取 今日头条（1/3）...
获取 toutiao 成功（缓存数据）
正在获取 百度热搜（2/3）...
获取 baidu 成功（缓存数据）
正在获取 微博（3/3）...
获取 weibo 成功（缓存数据）
成功: ['toutiao', 'baidu', 'weibo'], 失败: []
[RSS] 开始抓取 2 个 RSS 源...
[RSS] 正在获取 Hacker News（1/2）...
[RSS] Hacker News: 获取 20 条
"""
        progress = parse_job_progress(log, mode="crawl")
        self.assertEqual(progress["phase"], "rss")
        self.assertIn("Hacker News", progress["message"])
        self.assertEqual(progress["platforms_total"], 3)
        self.assertEqual(progress["rss_total"], 2)
        self.assertGreaterEqual(progress["percent"], 50)
        self.assertLess(progress["percent"], 100)

    def test_parse_ai_phase(self):
        from trendradar.web_control import parse_job_progress

        progress = parse_job_progress("[AI] 正在进行 AI 分析...\n", mode="analyze")
        self.assertEqual(progress["phase"], "ai")
        self.assertIn("AI", progress["message"])
        self.assertGreaterEqual(progress["percent"], 40)


class WebControlApiTests(unittest.TestCase):
    def setUp(self):
        from trendradar.web_control import ControlState, make_handler

        self.tmp = TemporaryDirectory()
        self.output = Path(self.tmp.name)
        (self.output / "index.html").write_text("<html><body>report</body></html>", encoding="utf-8")

        # 模拟项目根目录：config/frequency_words.txt + config/config.yaml
        self.project_root = self.output / "project"
        self.config_dir = self.project_root / "config"
        self.config_dir.mkdir(parents=True)
        (self.config_dir / "frequency_words.txt").write_text(
            "[GLOBAL_FILTER]\n震惊\n\n[WORD_GROUPS]\n华为\n", encoding="utf-8"
        )
        (self.config_dir / "config.yaml").write_text(
            "rss:\n"
            "  enabled: true\n"
            "  feeds:\n"
            "    - id: hacker-news\n"
            "      name: Hacker News\n"
            "      url: https://hnrss.org/frontpage\n"
            "ai:\n"
            "  model: deepseek/deepseek-v4-flash\n"
            "  api_key: \"\"\n"
            "  api_base: \"\"\n",
            encoding="utf-8",
        )

        self.runner = MagicMock()
        self.runner.is_running.return_value = False
        self.runner.status.return_value = {
            "running": False,
            "mode": None,
            "error": None,
            "progress": {"phase": "idle", "message": "", "percent": 0},
            "log_lines": 0,
        }
        self.runner.read_log.return_value = {
            "text": "hello log",
            "lines": 1,
            "tail": 1,
            "path": ".webui-job.log",
            "exists": True,
        }
        self.state = ControlState(
            output_dir=self.output, runner=self.runner, project_root=self.project_root
        )

        handler = make_handler(self.state)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def _request(self, method, path, body=None):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if payload else {}
        conn.request(method, path, body=payload, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, resp.getheader("Content-Type"), data

    def test_root_serves_index_and_injects_toolbar(self):
        status, content_type, data = self._request("GET", "/")
        html = data.decode("utf-8")
        self.assertEqual(status, 200)
        self.assertIn("text/html", content_type)
        self.assertIn("tr-toolbar", html)
        self.assertIn("tr-progress-wrap", html)
        self.assertIn("tr-log-panel", html)
        self.assertIn("report", html)

    def test_get_settings_contains_presets_and_ai_flag(self):
        status, _, data = self._request("GET", "/api/settings")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertIn("ai_analysis_enabled", payload)
        ids = [item["id"] for item in payload["presets"]]
        self.assertIn("morning_evening", ids)
        self.assertIn("off", ids)

    def test_post_settings_persists_overlay(self):
        status, _, data = self._request(
            "POST",
            "/api/settings",
            {"ai_analysis_enabled": False, "schedule_preset": "office_hours"},
        )
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertFalse(payload["ai_analysis_enabled"])
        self.assertEqual(payload["schedule_preset"], "office_hours")
        self.assertTrue(payload["schedule_enabled"])

        _, _, again = self._request("GET", "/api/settings")
        self.assertEqual(json.loads(again)["schedule_preset"], "office_hours")

    def test_post_run_crawl_starts_job(self):
        status, _, data = self._request("POST", "/api/run", {"mode": "crawl"})
        payload = json.loads(data)
        self.assertEqual(status, 202)
        self.assertEqual(payload["mode"], "crawl")
        self.runner.start.assert_called_once_with("crawl")

    def test_post_run_analyze_starts_job(self):
        status, _, data = self._request("POST", "/api/run", {"mode": "analyze"})
        self.assertEqual(status, 202)
        self.assertEqual(json.loads(data)["mode"], "analyze")
        self.runner.start.assert_called_once_with("analyze")

    def test_post_run_rejects_when_busy(self):
        self.runner.is_running.return_value = True
        status, _, data = self._request("POST", "/api/run", {"mode": "crawl"})
        self.assertEqual(status, 409)
        self.assertIn("running", json.loads(data)["error"])

    def test_get_logs_returns_text_and_progress(self):
        status, _, data = self._request("GET", "/api/logs?tail=100")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["text"], "hello log")
        self.assertIn("progress", payload)
        self.runner.read_log.assert_called()
        # tail query should be forwarded
        args, kwargs = self.runner.read_log.call_args
        self.assertEqual(kwargs.get("tail") or (args[0] if args else None), 100)

    def test_get_topics_reads_file_when_no_overlay(self):
        status, _, data = self._request("GET", "/api/topics")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "file")
        self.assertIn("[WORD_GROUPS]", payload["content"])
        self.assertIn("华为", payload["content"])
        self.assertGreaterEqual(payload["group_count"], 1)

    def test_post_and_delete_topics(self):
        content = "[WORD_GROUPS]\nwebui词\n"
        status, _, data = self._request("POST", "/api/topics", {"content": content})
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "overlay")
        self.assertIn("webui词", payload["content"])
        self.assertEqual(payload["group_count"], 1)

        _, _, again = self._request("GET", "/api/topics")
        self.assertEqual(json.loads(again)["source"], "overlay")

        status, _, data = self._request("DELETE", "/api/topics")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "file")
        self.assertIn("华为", payload["content"])

    def test_post_topics_rejects_non_string(self):
        status, _, data = self._request("POST", "/api/topics", {"content": 123})
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(data))

    def test_get_feeds_reads_yaml_when_no_overlay(self):
        status, _, data = self._request("GET", "/api/feeds")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "config")
        self.assertTrue(payload["rss_enabled"])
        self.assertEqual(len(payload["feeds"]), 1)
        self.assertEqual(payload["feeds"][0]["id"], "hacker-news")
        self.assertTrue(payload["feeds"][0]["enabled"])

    def test_post_and_delete_feeds(self):
        body = {
            "rss_enabled": False,
            "feeds": [
                {"name": "My Feed", "url": "https://example.com/rss.xml"},
                {
                    "id": "second",
                    "name": "Second",
                    "url": "https://example.org/feed",
                    "enabled": False,
                    "max_age_days": 5,
                },
            ],
        }
        status, _, data = self._request("POST", "/api/feeds", body)
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "overlay")
        self.assertFalse(payload["rss_enabled"])
        self.assertEqual(payload["feeds"][0]["id"], "my-feed")
        self.assertEqual(payload["feeds"][1]["max_age_days"], 5)

        # overlay 应被 apply_overlay 应用到运行配置
        from trendradar.webui_settings import apply_overlay

        config = {
            "RSS": {
                "ENABLED": True,
                "FEEDS": [{"id": "old", "name": "旧", "url": "https://old.example/rss"}],
            }
        }
        apply_overlay(config, output_dir=self.output)
        self.assertFalse(config["RSS"]["ENABLED"])
        self.assertEqual(len(config["RSS"]["FEEDS"]), 2)

        status, _, data = self._request("DELETE", "/api/feeds")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "config")
        self.assertEqual(payload["feeds"][0]["id"], "hacker-news")

    def test_post_feeds_rejects_invalid(self):
        status, _, data = self._request(
            "POST", "/api/feeds", {"rss_enabled": True, "feeds": [{"name": "x", "url": "not-a-url"}]}
        )
        self.assertEqual(status, 400)
        self.assertIn("error", json.loads(data))

    def _clean_ai_env(self):
        return patch.dict(
            os.environ, {"AI_API_KEY": "", "AI_MODEL": "", "AI_API_BASE": ""}, clear=False
        )

    def test_get_ai_reads_yaml_when_no_overlay(self):
        with self._clean_ai_env():
            status, _, data = self._request("GET", "/api/ai")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["source"], "config")
        self.assertEqual(payload["model"], "deepseek/deepseek-v4-flash")
        self.assertFalse(payload["api_key_set"])
        self.assertIsNone(payload["api_key_masked"])
        self.assertEqual(payload["reasoning_effort"], "")
        # 默认不返回明文密钥字段
        self.assertNotIn("api_key", payload)

    def test_post_and_delete_ai(self):
        with self._clean_ai_env():
            status, _, data = self._request(
                "POST",
                "/api/ai",
                {
                    "model": "openai/gpt-4o",
                    "api_base": "",
                    "api_key": "sk-test-1234567890",
                    "reasoning_effort": "high",
                },
            )
            payload = json.loads(data)
            self.assertEqual(status, 200)
            self.assertEqual(payload["source"], "overlay")
            self.assertTrue(payload["api_key_set"])
            self.assertEqual(payload["api_key_masked"], "sk-***7890")
            self.assertEqual(payload["reasoning_effort"], "high")
            # 明文密钥绝不能出现在响应里
            self.assertNotIn("sk-test-1234567890", data.decode("utf-8"))

            # 密钥留空再次保存：密钥保留，仅更新模型
            status, _, data = self._request(
                "POST",
                "/api/ai",
                {"model": "deepseek/deepseek-v4-pro", "api_base": "", "api_key": "", "reasoning_effort": ""},
            )
            payload = json.loads(data)
            self.assertEqual(status, 200)
            self.assertEqual(payload["model"], "deepseek/deepseek-v4-pro")
            self.assertEqual(payload["reasoning_effort"], "")
            self.assertTrue(payload["api_key_set"])
            self.assertNotIn("sk-test-1234567890", data.decode("utf-8"))

            # overlay 应覆盖运行配置中的 AI 设置
            from trendradar.webui_settings import apply_overlay

            config = {"AI": {"MODEL": "old", "API_KEY": "old", "API_BASE": "", "REASONING_EFFORT": ""}}
            apply_overlay(config, output_dir=self.output)
            self.assertEqual(config["AI"]["MODEL"], "deepseek/deepseek-v4-pro")
            self.assertEqual(config["AI"]["API_KEY"], "sk-test-1234567890")
            self.assertEqual(config["AI"]["REASONING_EFFORT"], "")

            status, _, data = self._request("DELETE", "/api/ai")
            payload = json.loads(data)
            self.assertEqual(status, 200)
            self.assertEqual(payload["source"], "config")
            self.assertFalse(payload["api_key_set"])

    def test_get_ai_reveal_returns_plaintext_on_request(self):
        with self._clean_ai_env():
            self._request(
                "POST", "/api/ai", {"model": "m", "api_base": "", "api_key": "sk-reveal-123456", "reasoning_effort": ""}
            )
            # 普通GET：无明文
            _, _, data = self._request("GET", "/api/ai")
            self.assertNotIn("sk-reveal-123456", data.decode("utf-8"))
            # reveal=1：返回明文（面板“显示”按钮查看已保存密钥）
            status, _, data = self._request("GET", "/api/ai?reveal=1")
            payload = json.loads(data)
            self.assertEqual(status, 200)
            self.assertEqual(payload["api_key"], "sk-reveal-123456")
            self._request("DELETE", "/api/ai")

    def test_post_ai_rejects_invalid(self):
        with self._clean_ai_env():
            status, _, data = self._request("POST", "/api/ai", {"model": " ", "api_key": "sk-x"})
            self.assertEqual(status, 400)
            self.assertIn("model", json.loads(data)["error"])
            status, _, data = self._request(
                "POST", "/api/ai", {"model": "m", "api_base": "ftp://x"}
            )
            self.assertEqual(status, 400)
            self.assertIn("api_base", json.loads(data)["error"])
            status, _, data = self._request(
                "POST", "/api/ai", {"model": "m", "reasoning_effort": "extreme"}
            )
            self.assertEqual(status, 400)
            self.assertIn("reasoning_effort", json.loads(data)["error"])

    def test_toolbar_contains_config_modal(self):
        status, _, data = self._request("GET", "/")
        html = data.decode("utf-8")
        self.assertEqual(status, 200)
        self.assertIn("tr-config-overlay", html)
        self.assertIn("tr-topics-text", html)
        self.assertIn("tr-feeds-list", html)
        self.assertIn("tr-panel-ai", html)
        self.assertIn("tr-ai-key", html)

    def test_get_status_includes_progress_field(self):
        self.runner.status.return_value = {
            "running": True,
            "mode": "crawl",
            "error": None,
            "progress": {"phase": "platforms", "message": "正在抓取热榜：微博（3/11）", "percent": 40},
            "log_lines": 12,
        }
        status, _, data = self._request("GET", "/api/status")
        payload = json.loads(data)
        self.assertEqual(status, 200)
        self.assertTrue(payload["running"])
        self.assertEqual(payload["progress"]["percent"], 40)
        self.assertIn("微博", payload["progress"]["message"])


class JobRunnerLogTests(unittest.TestCase):
    def test_read_log_tail(self):
        from trendradar.web_control import JobRunner

        with TemporaryDirectory() as tmp:
            output = Path(tmp)
            runner = JobRunner(project_root=tmp, output_dir=output)
            log_path = output / ".webui-job.log"
            log_path.write_text("\n".join(f"line-{i}" for i in range(1, 21)), encoding="utf-8")
            payload = runner.read_log(tail=5)
            self.assertTrue(payload["exists"])
            self.assertEqual(payload["lines"], 20)
            self.assertIn("line-20", payload["text"])
            self.assertIn("已省略前 15 行", payload["text"])
            self.assertNotIn("line-1\n", payload["text"].split("…", 1)[-1] if "…" in payload["text"] else payload["text"])


if __name__ == "__main__":
    unittest.main()
