import tempfile
import unittest
from pathlib import Path

from trendradar.core.frequency import load_frequency_words, matches_word_groups


class GlobalFilterTests(unittest.TestCase):
    def test_global_filter_supports_regular_expressions(self):
        config = """[GLOBAL_FILTER]
/spam|clickbait/

[WORD_GROUPS]
news
"""

        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "frequency_words.txt"
            config_path.write_text(config, encoding="utf-8")
            word_groups, filter_words, global_filters = load_frequency_words(
                str(config_path)
            )

        self.assertFalse(
            matches_word_groups(
                "Breaking news: spam", word_groups, filter_words, global_filters
            )
        )
        self.assertFalse(
            matches_word_groups(
                "Clickbait news", word_groups, filter_words, global_filters
            )
        )
        self.assertTrue(
            matches_word_groups(
                "Breaking news", word_groups, filter_words, global_filters
            )
        )


if __name__ == "__main__":
    unittest.main()
