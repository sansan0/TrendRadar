"""Configuration responses serialize regexes without changing cached matchers."""

import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mcp_server.services.data_service import DataService
from trendradar.core.frequency import matches_word_groups


class ConfigSerializationTests(unittest.TestCase):
    def test_config_response_keeps_cached_regexes_usable(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "config"
            config.mkdir()
            (config / "config.yaml").write_text("{}\n", encoding="utf-8")
            (config / "frequency_words.txt").write_text(
                "[WORD_GROUPS]\n/ai|ml/i\n", encoding="utf-8"
            )
            service = DataService(directory)
            cached_groups = service.parser.parse_frequency_words()
            self.assertTrue(matches_word_groups("AI news", cached_groups, []))

            with patch.dict("os.environ", {}, clear=True):
                for section in ("keywords", "all"):
                    with self.subTest(section=section):
                        result = service.get_current_config(section)
                        decoded = json.loads(json.dumps(result))
                        keywords = decoded if section == "keywords" else decoded["keywords"]
                        self.assertEqual(keywords["total_groups"], 1)
                        self.assertTrue(keywords["word_groups"])

            self.assertIs(service.parser.parse_frequency_words(), cached_groups)
            regexes = []

            def collect_regexes(value):
                if isinstance(value, re.Pattern):
                    regexes.append(value)
                elif isinstance(value, dict):
                    for child in value.values():
                        collect_regexes(child)
                elif isinstance(value, list):
                    for child in value:
                        collect_regexes(child)

            collect_regexes(cached_groups)
            self.assertTrue(regexes)
            self.assertTrue(matches_word_groups("ML update", cached_groups, []))
            self.assertFalse(matches_word_groups("unrelated headline", cached_groups, []))


if __name__ == "__main__":
    unittest.main()
