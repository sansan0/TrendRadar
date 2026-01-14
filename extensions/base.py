# coding=utf-8
"""
Extension Base Classes

Provides abstract base classes for the extension system with 4 extension points:
- ReportDataTransform: Transform report data after stats calculation
- HTMLRenderHook: Modify data before HTML rendering
- KeywordMatcher: Custom keyword matching logic
- NotificationEnhancer: Enhance notifications before sending
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable


class ExtensionPoint(ABC):
    """
    Base class for all extension points in the TrendRadar pipeline.

    All plugins must inherit from this class and implement the required methods.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Plugin name (unique identifier)"""
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        """Plugin version string"""
        pass

    @property
    def enabled(self) -> bool:
        """Whether the plugin is enabled"""
        return True

    def apply_config(self, config: Dict) -> None:
        """
        Apply plugin configuration.

        Args:
            config: Plugin configuration dictionary
        """
        self.config = config
        self.enabled = config.get("enabled", True) if config else True


class ReportDataTransform(ExtensionPoint):
    """
    Extension point for transforming report data.

    This is called AFTER statistics calculation but BEFORE HTML generation.
    Use cases:
    - Deduplication of similar news titles
    - Data enrichment
    - Custom filtering
    - Report data normalization

    Example: The report_dedupe plugin uses this to merge similar titles.
    """

    @abstractmethod
    def transform(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """
        Transform report data.

        Args:
            report_data: Report data dictionary with 'stats', 'new_titles', etc.
            config: Plugin configuration
            context: Application context (AppContext instance)

        Returns:
            Transformed report data dictionary
        """
        pass


class HTMLRenderHook(ExtensionPoint):
    """
    Extension point for HTML rendering hooks.

    This is called BEFORE HTML content is rendered.
    Use cases:
    - Inject custom HTML sections
    - Add analytics tracking
    - CSS/JS injection
    - Custom report formatting

    Example: An analytics plugin could inject Google Analytics code.
    """

    @abstractmethod
    def before_render(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Optional[Dict[str, Any]]:
        """
        Hook before HTML rendering.

        Args:
            report_data: Report data dictionary
            config: Plugin configuration
            context: Application context

        Returns:
            Modified report data dict, or None to skip rendering
        """
        pass

    def after_render(
        self,
        html_content: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        """
        Hook after HTML rendering (optional override).

        Args:
            html_content: Rendered HTML string
            config: Plugin configuration
            context: Application context

        Returns:
            Modified HTML string
        """
        return html_content


class KeywordMatcher(ExtensionPoint):
    """
    Extension point for custom keyword matching logic.

    This is called DURING word frequency matching.
    Use cases:
    - Fuzzy matching
    - Synonym expansion
    - Custom match algorithms
    - Language-specific matching

    Example: A fuzzy matcher plugin could use Levenshtein distance.
    """

    @abstractmethod
    def match(
        self,
        title: str,
        word_groups: List[Dict[str, Any]],
        filter_words: List[str],
        global_filters: List[str],
        config: Dict[str, Any],
    ) -> bool:
        """
        Check if title matches any keyword groups.

        Args:
            title: News title to check
            word_groups: Keyword groups to match against
            filter_words: Words to filter out
            global_filters: Global filter words
            config: Plugin configuration

        Returns:
            True if title matches, False otherwise
        """
        pass


class NotificationEnhancer(ExtensionPoint):
    """
    Extension point for enhancing notifications.

    This is called BEFORE notifications are sent.
    Use cases:
    - Custom formatting
    - Rate limiting
    - Logging
    - Message transformation

    Example: A logging plugin could log all notifications before sending.
    """

    @abstractmethod
    def enhance(
        self,
        content: str,
        channel: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        """
        Enhance notification content.

        Args:
            content: Notification content string
            channel: Notification channel name (e.g., 'feishu', 'dingtalk')
            config: Plugin configuration
            context: Application context

        Returns:
            Enhanced content string
        """
        pass

    def before_send(
        self,
        channel: str,
        recipients: List[str],
        config: Dict[str, Any],
        context: Any,
    ) -> List[str]:
        """
        Hook before sending (can modify recipients).

        Args:
            channel: Notification channel name
            recipients: List of recipient identifiers
            config: Plugin configuration
            context: Application context

        Returns:
            Modified recipients list
        """
        return recipients


# Type aliases for convenience
ExtensionHook = Callable[..., Any]
