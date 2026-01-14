# coding=utf-8
"""
Report Dedupe Plugin

Plugin that merges similar news titles from different platforms,
reducing duplicates and presenting cleaner results.
"""

import re
from typing import Any, Dict, List, Optional

from loguru import logger

from extensions.base import ReportDataTransform, HTMLRenderHook
from .report_dedupe import transform_report_data


class ReportDedupePlugin(ReportDataTransform, HTMLRenderHook):
    """
    Plugin for deduplicating similar news titles.

    This plugin uses configurable similarity thresholds and optionally
    AI-powered (Ollama) judgment to merge similar titles from different
    platforms into unified entries.

    Also implements HTMLRenderHook to post-process HTML and add clickable
    links for multi-platform merged items.
    """

    # Class attributes (used as default values before config is applied)
    _name = "report_dedupe"
    _version = "1.0.0"

    def __init__(self):
        self._enabled = True
        self.config: Dict[str, Any] = {}
        # Store URL mappings for post-processing
        # Key: (source_name, title) tuple, Value: list of {url, source} dicts
        self._url_mappings: Dict[tuple, List[Dict[str, str]]] = {}

    @property
    def name(self) -> str:
        return self._name

    @property
    def version(self) -> str:
        return self._version

    @property
    def enabled(self) -> bool:
        return self._enabled

    def apply_config(self, config: Dict[str, Any]) -> None:
        """
        Apply plugin configuration.

        Config format (from config/extensions/report_dedupe.yaml):
        ```yaml
        enabled: true
        strategy: "auto"
        similarity:
          threshold: 0.85
          max_ai_checks: 50
        ollama:
          base_url: "http://localhost:11434"
          model: "qwen2.5:14b-instruct"
        merge:
          source_separator: " / "
          count_strategy: "sum"
          max_items_per_group: 10
        ```
        """
        self.config = config or {}
        self._enabled = self.config.get("enabled", False)

    def transform(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """
        Transform report data by deduplicating similar titles.

        Args:
            report_data: Report data dictionary
            config: Plugin configuration
            context: Application context (not used in this plugin)

        Returns:
            Transformed report data with deduplicated titles
        """
        # Merge config: parameter takes precedence over stored config
        merged_config = {**self.config, **config}

        logger.debug("[report_dedupe] Config loaded: {}", merged_config)
        logger.debug("[report_dedupe] Plugin enabled: {}", self.enabled)
        logger.debug(
            "[report_dedupe] Checking enabled flag: {}", merged_config.get("enabled")
        )

        if not merged_config.get("enabled"):
            logger.warning(
                "[report_dedupe] Plugin disabled by config, skipping transform"
            )
            return report_data

        logger.info(
            "[report_dedupe] Starting deduplication on {} stats",
            len(report_data.get("stats", [])),
        )
        result = transform_report_data(report_data, merged_config)

        # Store URL mappings for HTML post-processing
        self._url_mappings.clear()
        for stat in result.get("stats", []):
            for title_data in stat.get("titles", []):
                urls = title_data.get("urls", [])
                if urls and len(urls) > 1:
                    # Store mapping using (source_name, title) as key
                    key = (title_data.get("source_name", ""), title_data.get("title", ""))
                    self._url_mappings[key] = urls

        logger.info(
            "[report_dedupe] Deduplication complete. Stats count: {}, URL mappings: {}",
            len(result.get("stats", [])),
            len(self._url_mappings),
        )
        return result

    def before_render(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Optional[Dict[str, Any]]:
        """
        Hook before HTML rendering. Not used by this plugin.
        """
        return None

    def after_render(
        self,
        html_content: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        """
        Post-process HTML to add clickable links for multi-platform merged items.

        Finds source-name spans with merged platforms (containing " / ") and
        replaces them with clickable links to each platform.
        """
        if not self._url_mappings:
            return html_content

        merged_config = {**self.config, **config}
        if not merged_config.get("enabled"):
            return html_content

        logger.debug("[report_dedupe] Post-processing HTML with {} URL mappings",
                    len(self._url_mappings))

        # Inject CSS for source-link class if not present
        if ".source-link" not in html_content:
            css_injection = """
            .source-link {
                color: #2563eb;
                text-decoration: none;
            }
            .source-link:hover {
                text-decoration: underline;
            }
            .source-link:visited {
                color: #7c3aed;
            }
            """
            # Insert before </style>
            html_content = html_content.replace("</style>", css_injection + "</style>", 1)

        # Process each URL mapping
        for (source_name, title), urls in self._url_mappings.items():
            if not source_name or " / " not in source_name:
                continue

            # Find and replace the source-name span
            # Pattern: <span class="source-name">source_name</span>
            escaped_source = re.escape(_html_escape(source_name))
            pattern = rf'<span class="source-name">{escaped_source}</span>'

            # Build replacement with clickable links
            links = []
            for url_info in urls:
                url = _html_escape(url_info.get("url", ""))
                source = _html_escape(url_info.get("source", "链接"))
                links.append(f'<a href="{url}" target="_blank" class="source-link">{source}</a>')

            replacement = f'<span class="source-name">{" / ".join(links)}</span>'

            html_content = re.sub(pattern, replacement, html_content, count=0)

        return html_content


def _html_escape(text: str) -> str:
    """Escape HTML special characters."""
    if not text:
        return ""
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;"))


# Plugin instance for auto-discovery via entry points
plugin = ReportDedupePlugin
