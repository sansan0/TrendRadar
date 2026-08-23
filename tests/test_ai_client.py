# coding=utf-8
import unittest
from unittest.mock import patch


def _fake_response():
    class Message:
        content = "ok"

    class Choice:
        message = Message()

    class Resp:
        choices = [Choice()]

    return Resp()


class AIClientParamTests(unittest.TestCase):
    def _capture(self, config, kwargs=None):
        from trendradar.ai import client as client_mod

        captured = {}

        def fake_completion(**params):
            captured.update(params)
            return _fake_response()

        with patch.object(client_mod, "completion", fake_completion):
            client = client_mod.AIClient(config)
            client.chat([{"role": "user", "content": "hi"}], **(kwargs or {}))
        return captured

    def test_reasoning_effort_sent_when_set(self):
        # openai/ 前缀（含自定义兼容端点）走 extra_body 透传，避免 litellm 白名单校验
        params = self._capture(
            {"MODEL": "openai/custom-reasoner", "API_KEY": "sk-x", "REASONING_EFFORT": " HIGH "}
        )
        self.assertEqual(params["extra_body"]["reasoning_effort"], "high")
        self.assertNotIn("reasoning_effort", params)

    def test_reasoning_effort_top_level_for_other_providers(self):
        # 非 openai 提供商走顶层参数，由 litellm 完成跨商映射
        params = self._capture(
            {"MODEL": "anthropic/claude-sonnet-4", "API_KEY": "sk-x", "REASONING_EFFORT": "high"}
        )
        self.assertEqual(params["reasoning_effort"], "high")
        self.assertNotIn("extra_body", params)

    def test_reasoning_effort_omitted_when_empty(self):
        params = self._capture(
            {"MODEL": "openai/gpt-4o", "API_KEY": "sk-x", "REASONING_EFFORT": ""}
        )
        self.assertNotIn("reasoning_effort", params)
        self.assertNotIn("extra_body", params)

    def test_reasoning_effort_overridable_per_call(self):
        params = self._capture(
            {"MODEL": "openai/gpt-5", "API_KEY": "sk-x", "REASONING_EFFORT": "low"},
            {"reasoning_effort": "high"},
        )
        self.assertEqual(params["extra_body"]["reasoning_effort"], "high")

    def test_extra_params_merged_without_override(self):
        params = self._capture(
            {
                "MODEL": "openai/gpt-4o",
                "API_KEY": "sk-x",
                "TEMPERATURE": 0.5,
                "EXTRA_PARAMS": {"top_p": 0.9, "temperature": 2.0},
            }
        )
        self.assertEqual(params["top_p"], 0.9)
        # 显式配置的 temperature 优先于 extra_params
        self.assertEqual(params["temperature"], 0.5)


if __name__ == "__main__":
    unittest.main()
