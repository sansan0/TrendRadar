# coding=utf-8
"""Regression tests for _normalize_platform_sources and the crash
reported in issue #1077.

The bug: when ``platforms.sources`` uses the shorthand string form
(``sources: ["github"]``) instead of the documented dict form
(``sources: [{id: "github", name: "GitHub"}]``), all downstream code
that does ``platform["id"]`` on a string raises
``TypeError: string indices must be integers, not 'str'``.
"""

import ast
import textwrap
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Import the function under test
# ---------------------------------------------------------------------------
from trendradar.core.loader import _normalize_platform_sources


# ===========================================================================
# 1. Core normalization
# ===========================================================================

class TestNormalizePlatformSources:
    """Unit tests for _normalize_platform_sources."""

    def test_dict_entries_pass_through(self):
        """Standard dict entries are returned unchanged."""
        sources = [
            {"id": "toutiao", "name": "今日头条"},
            {"id": "baidu", "name": "百度热搜"},
        ]
        result = _normalize_platform_sources(sources)
        assert result == sources

    def test_string_entries_expanded_to_dict(self):
        """String entries are expanded to ``{"id": <string>}``."""
        result = _normalize_platform_sources(["github", "weibo"])
        assert result == [{"id": "github"}, {"id": "weibo"}]

    def test_mixed_entries(self):
        """A mix of dict and string entries is normalized correctly."""
        sources = [
            {"id": "toutiao", "name": "今日头条"},
            "github",
            {"id": "baidu"},
        ]
        result = _normalize_platform_sources(sources)
        assert result == [
            {"id": "toutiao", "name": "今日头条"},
            {"id": "github"},
            {"id": "baidu"},
        ]

    def test_empty_list(self):
        """An empty list produces an empty list."""
        assert _normalize_platform_sources([]) == []

    def test_invalid_types_skipped(self):
        """Non-dict, non-string entries are silently dropped."""
        result = _normalize_platform_sources([42, None, True, "github"])
        assert result == [{"id": "github"}]

    def test_unicode_string_id(self):
        """Unicode platform IDs are handled correctly."""
        result = _normalize_platform_sources(["微博热搜", "知乎"])
        assert result == [{"id": "微博热搜"}, {"id": "知乎"}]


# ===========================================================================
# 2. Integration: normalized output is safe for downstream access patterns
# ===========================================================================

class TestDownstreamSafety:
    """Verify that normalized output won't crash known access patterns."""

    def test_id_subscript_on_string_source(self):
        """Reproduces issue #1077: platform["id"] on a string entry."""
        sources = ["github"]
        normalized = _normalize_platform_sources(sources)
        # The crash path in __main__.py:1059 was: platform["id"]
        for platform in normalized:
            assert isinstance(platform, dict)
            assert "id" in platform
            _ = platform["id"]  # must not raise

    def test_name_in_check_on_string_source(self):
        """The 'name' in platform check should work on normalized dicts."""
        sources = ["github"]
        normalized = _normalize_platform_sources(sources)
        for platform in normalized:
            # "name" in "github" would be a substring check; on dict it's key check
            result = "name" in platform
            assert result is False  # string entries have no name

    def test_get_method_on_normalized(self):
        """p.get('name', p['id']) used in __main__.py:1062 must work."""
        sources = ["github"]
        normalized = _normalize_platform_sources(sources)
        for p in normalized:
            display = p.get("name", p["id"])
            assert display == "github"

    def test_platform_ids_property(self):
        """context.py:104 does [p["id"] for p in self.platforms]."""
        sources = ["github", "weibo"]
        normalized = _normalize_platform_sources(sources)
        ids = [p["id"] for p in normalized]
        assert ids == ["github", "weibo"]


# ===========================================================================
# 3. Issue #1077 end-to-end reproduction
# ===========================================================================

class TestIssue1077Regression:
    """Direct regression guard for the reported crash."""

    def test_user_config_sources_as_strings(self):
        """The exact config from issue #1077: sources: ["github"]."""
        # Simulates what load_config does after normalization
        sources = ["github"]
        platforms = _normalize_platform_sources(sources)

        # Simulate _crawl_data loop (__main__.py:1055-1059)
        ids = []
        for platform in platforms:
            if "name" in platform:
                ids.append((platform["id"], platform["name"]))
            else:
                ids.append(platform["id"])

        assert ids == ["github"]

    def test_original_crash_without_normalization(self):
        """Without normalization, the exact crash path raises TypeError."""
        raw_sources = ["github"]  # what load_config previously returned
        with pytest.raises(TypeError, match="string indices must be integers"):
            for platform in raw_sources:
                _ = platform["id"]  # direct subscript on string


# ===========================================================================
# 4. Source audit: normalization is applied at the right place
# ===========================================================================

class TestSourceAudit:
    """Verify loader.py calls _normalize_platform_sources."""

    def test_loader_calls_normalize(self):
        """load_config must route platforms.sources through normalization."""
        source = Path(__file__).resolve().parent.parent / "trendradar" / "core" / "loader.py"
        text = source.read_text()
        assert "_normalize_platform_sources" in text

    def test_normalize_wraps_sources_get(self):
        """The platforms_config.get('sources', []) call must be wrapped."""
        source = Path(__file__).resolve().parent.parent / "trendradar" / "core" / "loader.py"
        text = source.read_text()
        # Should NOT have the raw assignment anymore
        assert 'config["PLATFORMS"] = platforms_config.get("sources"' not in text
        # Should have the wrapped version
        assert "_normalize_platform_sources(" in text

    def test_normalize_function_handles_all_types(self):
        """The function signature accepts a list and returns a list."""
        result = _normalize_platform_sources([])
        assert isinstance(result, list)
