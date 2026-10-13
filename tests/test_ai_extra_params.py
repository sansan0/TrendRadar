"""Regression coverage for configured LiteLLM parameters without API requests."""

import io
import os
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch

# LiteLLM may otherwise fetch its model cost map while being imported.
with patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}):
    from trendradar.ai.client import AIClient


class AIExtraParamsTests(unittest.TestCase):
    def setUp(self):
        env_patch = patch.dict(os.environ, {"AI_API_KEY": ""})
        env_patch.start()
        self.addCleanup(env_patch.stop)

        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="mocked reply"))]
        )
        completion_patch = patch(
            "trendradar.ai.client.completion", return_value=response
        )
        self.completion = completion_patch.start()
        self.addCleanup(completion_patch.stop)

        self.messages = [{"role": "user", "content": "Summarize this test item."}]
        self.config = {
            "MODEL": "test/model",
            "API_KEY": "test-api-key",
            "API_BASE": "https://api.example.invalid/v1",
            "TEMPERATURE": 0.6,
            "MAX_TOKENS": 128,
            "TIMEOUT": 30,
            "NUM_RETRIES": 0,
            "FALLBACK_MODELS": ["test/backup"],
        }
        self.expected = {
            "model": "test/model",
            "messages": self.messages,
            "api_key": "test-api-key",
            "api_base": "https://api.example.invalid/v1",
            "temperature": 0.6,
            "max_tokens": 128,
            "timeout": 30,
            "num_retries": 0,
            "fallbacks": ["test/backup"],
        }

    def chat_params(self, overrides=None, **kwargs):
        self.completion.reset_mock()
        client = AIClient({**self.config, **(overrides or {})})
        self.assertEqual(client.chat(self.messages, **kwargs), "mocked reply")
        self.completion.assert_called_once()
        return self.completion.call_args.kwargs

    def test_missing_none_or_empty_extra_params_preserve_existing_request(self):
        for overrides in ({}, {"EXTRA_PARAMS": None}, {"EXTRA_PARAMS": {}}):
            with self.subTest(overrides=overrides):
                self.assertEqual(self.chat_params(overrides), self.expected)

    def test_extra_request_parameters_and_headers_are_forwarded(self):
        extra = {
            "top_p": 0.8,
            "presence_penalty": 0.0,
            "stop": ["END"],
            "extra_headers": {"X-Example-Trace": "test-trace"},
        }
        self.assertEqual(
            self.chat_params({"EXTRA_PARAMS": extra}), {**self.expected, **extra}
        )

    def test_non_dict_extra_params_are_ignored(self):
        for invalid in ("invalid", 42, True, ["unexpected"]):
            with self.subTest(value=invalid), redirect_stdout(io.StringIO()) as output:
                self.assertEqual(
                    self.chat_params({"EXTRA_PARAMS": invalid}), self.expected
                )
                self.assertIn("extra_params", output.getvalue())

    def test_call_kwargs_override_configured_supplemental_parameters(self):
        extra = {
            "top_p": 0.8,
            "stop": ["CONFIG_END"],
            "presence_penalty": 0.4,
        }
        self.assertEqual(
            self.chat_params(
                {"EXTRA_PARAMS": extra}, top_p=0.2, stop=["CALL_END"]
            ),
            {
                **self.expected,
                "top_p": 0.2,
                "stop": ["CALL_END"],
                "presence_penalty": 0.4,
            },
        )

    def test_extra_params_cannot_replace_assembled_core_parameters(self):
        extra = {
            "model": "test/other",
            "messages": [{"role": "user", "content": "Replace the request."}],
            "api_key": "other-test-key",
            "api_base": "https://other.example.invalid/v1",
            "temperature": 0.1,
            "max_tokens": 512,
            "timeout": 1,
            "num_retries": 3,
            "fallbacks": ["test/other-backup"],
        }
        self.assertEqual(self.chat_params({"EXTRA_PARAMS": extra}), self.expected)

    def test_existing_core_call_overrides_still_work_without_extra_params(self):
        call_options = {
            "temperature": 0.1,
            "max_tokens": 64,
            "timeout": 5,
            "num_retries": 2,
        }
        self.assertEqual(
            self.chat_params(**call_options), {**self.expected, **call_options}
        )

    def test_extra_params_can_supply_optional_parameters_not_yet_assembled(self):
        # Empty optional settings do not occupy keys in the request. Keep the
        # PR's supplemental behavior while preserving call-argument priority.
        extra = {
            "api_base": "https://extra.example.invalid/v1",
            "max_tokens": 256,
            "fallbacks": ["test/extra-backup"],
        }
        actual = self.chat_params(
            {
                "API_BASE": "",
                "MAX_TOKENS": 0,
                "FALLBACK_MODELS": [],
                "EXTRA_PARAMS": extra,
            },
            api_base="https://call.example.invalid/v1",
        )
        self.assertEqual(
            actual,
            {**self.expected, **extra, "api_base": "https://call.example.invalid/v1"},
        )


if __name__ == "__main__":
    unittest.main()
