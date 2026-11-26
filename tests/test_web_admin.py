# coding=utf-8
"""Web 管理台核心逻辑的离线单元测试。"""

import unittest
from datetime import datetime

from web_admin import auth, cron, store, tls


class KeywordConfigTests(unittest.TestCase):
    def test_roundtrip_preserves_groups_filters_and_syntax(self):
        content = """[GLOBAL_FILTER]
广告

[WORD_GROUPS]
[科技]
@5
AI
/DeepSeek|OpenAI/ => 大模型

[社会]
+通报
"""
        parsed = store.parse_keywords(content)
        self.assertEqual(len(parsed["groups"]), 2)
        self.assertEqual(parsed["groups"][0]["alias"], "科技")
        self.assertEqual(parsed["groups"][0]["max_count"], 5)
        self.assertEqual(parsed["global_filters"], ["广告"])

        serialized = store.serialize_keywords(
            parsed["groups"], parsed["global_filters"]
        )
        again = store.parse_keywords(serialized)
        self.assertEqual(again["groups"], parsed["groups"])
        self.assertEqual(again["global_filters"], parsed["global_filters"])

    def test_invalid_regex_is_rejected(self):
        normalized, errors, _warnings = store.normalize_keywords(
            {"groups": [{"alias": "科技", "items": ["/(/"]}], "global_filters": []}
        )
        self.assertIsNone(normalized)
        self.assertIn("groups.0.items", errors)

    def test_count_marker_is_rejected_inside_items(self):
        normalized, errors, _warnings = store.normalize_keywords(
            {"groups": [{"alias": "科技", "items": ["@5"]}], "global_filters": []}
        )
        self.assertIsNone(normalized)
        self.assertIn("groups.0.items", errors)


class CronTests(unittest.TestCase):
    def test_validate_and_next_run(self):
        self.assertTrue(cron.validate("*/30 * * * *")[0])
        self.assertFalse(cron.validate("bad cron")[0])

        start = datetime(2026, 1, 1, 10, 0)
        self.assertEqual(
            cron.next_run("*/30 * * * *", start),
            datetime(2026, 1, 1, 10, 30),
        )


class AuthTests(unittest.TestCase):
    def test_password_hash_and_verify(self):
        record = auth.hash_password("correct horse battery staple")
        self.assertTrue(auth.verify_password("correct horse battery staple", record))
        self.assertFalse(auth.verify_password("wrong password", record))


class DomainTests(unittest.TestCase):
    def test_domain_validation(self):
        self.assertTrue(tls.validate_domain("td.example.com")[0])
        self.assertFalse(tls.validate_domain("bad_domain")[0])
        self.assertEqual(
            tls.normalize_domain("https://TD.Example.com:443/path"), "td.example.com"
        )


if __name__ == "__main__":
    unittest.main()
