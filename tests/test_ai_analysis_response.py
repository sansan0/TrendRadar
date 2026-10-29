"""Tests for normalizing structured AI analysis sections."""

import json
import os
import unittest
from unittest.mock import patch

# Keep standalone test runs offline during LiteLLM's import.
with patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}):
    from trendradar.ai.analyzer import AIAnalyzer, _coerce_analysis_text
    from trendradar.ai.formatter import render_ai_analysis_markdown
    from trendradar.report.html import render_html_content


class AnalysisResponseNormalizationTests(unittest.TestCase):
    def test_string_is_preserved(self):
        self.assertEqual(_coerce_analysis_text("summary"), "summary")
        self.assertEqual(_coerce_analysis_text("  中文\n"), "  中文\n")

    def test_list_is_renderable_text(self):
        self.assertEqual(
            _coerce_analysis_text(["first", {"title": "second"}, 3]),
            'first\n{"title": "second"}\n3',
        )

    def test_null_and_scalar_values_are_safe(self):
        self.assertEqual(_coerce_analysis_text(None), "")
        self.assertEqual(_coerce_analysis_text([]), "")
        self.assertEqual(_coerce_analysis_text(42), "42")

    def test_json_values_have_consistent_text_inside_and_outside_lists(self):
        cases = (
            (True, "true"),
            (False, "false"),
            (
                {"title": "中文", "flag": True, "note": None},
                '{"title": "中文", "flag": true, "note": null}',
            ),
        )
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(_coerce_analysis_text(value), expected)
                self.assertEqual(_coerce_analysis_text([value]), expected)

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

    def test_html_report_renders_and_escapes_each_structured_section(self):
        fields = (
            "core_trends", "sentiment_controversy", "signals",
            "rss_insights", "outlook_strategy",
        )
        for field in fields:
            with self.subTest(field=field):
                response = json.dumps({field: [
                    "<script>alert(1)</script>",
                    {"title": "中文 & <热点>"},
                ]}, ensure_ascii=False)
                result = AIAnalyzer.__new__(AIAnalyzer)._parse_response(response)
                rendered = render_html_content(
                    report_data={
                        "stats": [], "new_titles": [], "failed_ids": [],
                        "total_new_count": 0,
                    },
                    total_titles=0,
                    ai_analysis=result,
                )

                self.assertTrue(result.success)
                self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", rendered)
                self.assertIn("中文 &amp; &lt;热点&gt;", rendered)
                self.assertNotIn("<script>alert(1)</script>", rendered)


if __name__ == "__main__":
    unittest.main()
