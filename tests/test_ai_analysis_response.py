"""Tests for normalizing structured AI analysis sections."""

import json
import unittest

from trendradar.ai.analyzer import AIAnalyzer, _coerce_analysis_text
from trendradar.ai.formatter import render_ai_analysis_markdown


class AnalysisResponseNormalizationTests(unittest.TestCase):
    def test_string_is_preserved(self):
        self.assertEqual(_coerce_analysis_text("summary"), "summary")

    def test_list_is_renderable_text(self):
        self.assertEqual(
            _coerce_analysis_text(["first", {"title": "second"}, 3]),
            'first\n{"title": "second"}\n3',
        )

    def test_null_and_scalar_values_are_safe(self):
        self.assertEqual(_coerce_analysis_text(None), "")
        self.assertEqual(_coerce_analysis_text(42), "42")

    def test_array_sections_are_renderable_after_response_parsing(self):
        response = json.dumps(
            {
                "core_trends": ["first", {"title": "second"}],
                "sentiment_controversy": ["sentiment"],
                "signals": ["signal"],
                "rss_insights": ["rss"],
                "outlook_strategy": ["outlook"],
            }
        )

        result = AIAnalyzer.__new__(AIAnalyzer)._parse_response(response)
        rendered = render_ai_analysis_markdown(result)

        self.assertTrue(result.success)
        self.assertEqual(result.core_trends, 'first\n{"title": "second"}')
        self.assertIn('first\n{"title": "second"}', rendered)
        self.assertIn("sentiment", rendered)
        self.assertIn("signal", rendered)
        self.assertIn("rss", rendered)
        self.assertIn("outlook", rendered)


if __name__ == "__main__":
    unittest.main()
