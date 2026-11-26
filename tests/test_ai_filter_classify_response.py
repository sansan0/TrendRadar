"""Tests for AI filter classification responses that cannot be parsed."""

import os
import unittest
from unittest.mock import patch

# Keep standalone test runs offline during LiteLLM's import.
with patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}):
    from trendradar.ai.filter import AIFilter
    from trendradar.ai.filter_pipeline import AIFilterPipeline


TAGS = [{"id": 1, "tag": "AI", "description": "AI news"}]
# The shipped prompt files, as the config loader names them by default.
FILTER_CONFIG = {
    "PROMPT_FILE": "prompt.txt",
    "EXTRACT_PROMPT_FILE": "extract_prompt.txt",
    "UPDATE_TAGS_PROMPT_FILE": "update_tags_prompt.txt",
}


def make_filter():
    ai_filter = AIFilter({"MODEL": "openai/test-model"}, FILTER_CONFIG, lambda: None)
    assert ai_filter.classify_user, "classification prompt template must load"
    return ai_filter


def make_titles(start, count):
    return [{"id": i, "title": f"title {i}", "source": "src"} for i in range(start, start + count)]


class ClassifyResponseTests(unittest.TestCase):
    def test_unparseable_responses_are_failures(self):
        ai_filter = make_filter()
        # An empty string is what a model returns when thinking tokens use the
        # whole max_tokens budget (finish_reason=length) before any text.
        for response in ("", "   ", "not json", "```json\n[{\"id\": 1,", '{"id": 1, "tag_id": 1}'):
            with self.subTest(response=response), patch.object(ai_filter.client, "chat", return_value=response):
                self.assertIsNone(ai_filter.classify_batch(make_titles(1, 2), TAGS))

    def test_empty_array_is_a_valid_no_match(self):
        ai_filter = make_filter()
        with patch.object(ai_filter.client, "chat", return_value="[]"):
            self.assertEqual(ai_filter.classify_batch(make_titles(1, 2), TAGS), [])

    def test_valid_array_is_parsed(self):
        ai_filter = make_filter()
        response = '```json\n[{"id": 2, "tag_id": 1, "score": 0.9}]\n```'
        with patch.object(ai_filter.client, "chat", return_value=response):
            self.assertEqual(
                ai_filter.classify_batch(make_titles(1, 2), TAGS),
                [{"news_item_id": 2, "tag_id": 1, "relevance_score": 0.9}],
            )


class ClassifyBatchesRetryTests(unittest.TestCase):
    def test_empty_response_batch_is_not_marked_analyzed(self):
        ai_filter = make_filter()
        pending_rss = [
            {"id": i, "title": f"title {i}", "source_name": "src"} for i in range(1, 5)
        ]
        responses = ["", '[{"id": 3, "tag_id": 1, "score": 0.8}]']
        pipeline = AIFilterPipeline.__new__(AIFilterPipeline)

        with patch.object(ai_filter.client, "chat", side_effect=responses):
            results, news_ids, rss_ids = pipeline._classify_batches(
                ai_filter, [], pending_rss, TAGS, "", {"BATCH_SIZE": 2, "BATCH_INTERVAL": 0},
            )

        # The first batch failed and must be retried next run; only the second
        # batch is recorded as analyzed.
        self.assertEqual(news_ids, [])
        self.assertEqual(rss_ids, [3, 4])
        self.assertEqual(
            results,
            [{"news_item_id": 3, "tag_id": 1, "relevance_score": 0.8, "source_type": "rss"}],
        )


if __name__ == "__main__":
    unittest.main()
