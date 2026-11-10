"""Anthropic workload identity federation lets the AI client run without a static key."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

# LiteLLM may otherwise fetch its model cost map while being imported.
with patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}):
    from litellm.llms.anthropic.wif import resolve_anthropic_wif_params

    from trendradar.ai.client import AIClient

WIF_ENV = {
    "AI_API_KEY": "",
    "ANTHROPIC_API_KEY": "",
    "ANTHROPIC_FEDERATION_RULE_ID": "fdrl_test",
    "ANTHROPIC_ORGANIZATION_ID": "00000000-0000-0000-0000-000000000000",
    "ANTHROPIC_SERVICE_ACCOUNT_ID": "svac_test",
    "ANTHROPIC_IDENTITY_TOKEN_FILE": "/var/run/secrets/anthropic/token",
    "ANTHROPIC_IDENTITY_TOKEN": "",
    "ANTHROPIC_IDENTITY_SOURCE": "",
}


class AIWorkloadIdentityTests(unittest.TestCase):
    def test_anthropic_model_with_federation_env_needs_no_key(self):
        with patch.dict(os.environ, WIF_ENV):
            client = AIClient({"MODEL": "anthropic/claude-haiku-5-5"})
            self.assertTrue(client.uses_workload_identity)
            self.assertTrue(client.has_credentials)
            self.assertEqual(client.validate_config(), (True, ""))

    def test_chat_omits_api_key_so_litellm_federates(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))]
        )
        with patch.dict(os.environ, WIF_ENV), patch(
            "trendradar.ai.client.completion", return_value=response
        ) as completion:
            client = AIClient({"MODEL": "anthropic/claude-haiku-5-5"})
            self.assertEqual(client.chat([{"role": "user", "content": "hi"}]), "ok")
            self.assertNotIn("api_key", completion.call_args.kwargs)

    def test_litellm_library_mode_reads_federation_env(self):
        with patch.dict(os.environ, WIF_ENV):
            params = resolve_anthropic_wif_params(None)
        self.assertIsNotNone(params)
        self.assertEqual(params.federation_rule_id, "fdrl_test")

    def test_rule_without_identity_token_source_is_not_federation(self):
        env = dict(WIF_ENV, ANTHROPIC_IDENTITY_TOKEN_FILE="")
        with patch.dict(os.environ, env):
            client = AIClient({"MODEL": "anthropic/claude-haiku-5-5"})
            self.assertFalse(client.uses_workload_identity)
            self.assertFalse(client.validate_config()[0])

    def test_federation_env_does_not_cover_other_providers(self):
        with patch.dict(os.environ, WIF_ENV):
            client = AIClient({"MODEL": "gemini/gemini-3.1-flash-lite"})
            self.assertFalse(client.has_credentials)
            self.assertFalse(client.validate_config()[0])

    def test_no_key_and_no_federation_is_still_invalid(self):
        env = {k: "" for k in WIF_ENV}
        with patch.dict(os.environ, env):
            client = AIClient({"MODEL": "anthropic/claude-haiku-5-5"})
            self.assertFalse(client.has_credentials)
            self.assertFalse(client.validate_config()[0])

    def test_static_key_still_works(self):
        with patch.dict(os.environ, {"AI_API_KEY": "", "ANTHROPIC_FEDERATION_RULE_ID": ""}):
            client = AIClient({"MODEL": "anthropic/claude-haiku-5-5", "API_KEY": "k"})
            self.assertFalse(client.uses_workload_identity)
            self.assertTrue(client.has_credentials)


if __name__ == "__main__":
    unittest.main()
