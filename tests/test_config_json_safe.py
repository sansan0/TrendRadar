import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mcp_server.tools.config_mgmt import ConfigManagementTools


class GetCurrentConfigJsonSafeTest(unittest.TestCase):
    def test_keywords_config_with_compiled_regex_is_json_serializable(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            (project_root / "config").mkdir(parents=True, exist_ok=True)
            (project_root / "config" / "config.yaml").write_text(
                "advanced: {}\nplatforms:\n  enabled: true\n  sources: []\n",
                encoding="utf-8",
            )

            tools = ConfigManagementTools(str(project_root))

            fake_word_groups = [
                {
                    "name": "regex-group",
                    "patterns": [re.compile(r"AI|LLM", re.IGNORECASE)],
                }
            ]

            with patch.object(
                tools.data_service.parser,
                "parse_frequency_words",
                return_value=fake_word_groups,
            ):
                result = tools.get_current_config(section="keywords")

            self.assertTrue(result["success"])
            payload = json.dumps(result, ensure_ascii=False)
            self.assertIn("regex-group", payload)


if __name__ == "__main__":
    unittest.main()
