# coding=utf-8
"""
Extension Manager

Provides plugin discovery, loading, and execution for the TrendRadar extension system.

Usage:
    from extensions import get_extension_manager

    em = get_extension_manager()
    plugins = em.plugins  # dict of loaded plugins
    config = em.load_plugin_config('my_plugin')
"""

import os
import sys
from importlib.metadata import entry_points
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Type

import yaml
from loguru import logger


def _configure_logger():
    """Configure loguru log level based on environment or config."""
    # Check environment variable first (highest priority for Docker)
    log_level = os.environ.get("LOG_LEVEL", "").upper()

    # If not set, try to read from config file
    if not log_level:
        try:
            config_path = Path("config/config.yaml")
            if not config_path.exists():
                config_path = Path("/app/config/config.yaml")
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    config = yaml.safe_load(f) or {}
                    debug = config.get("advanced", {}).get("debug", False)
                    log_level = "DEBUG" if debug else "INFO"
        except Exception:
            log_level = "INFO"

    if not log_level:
        log_level = "INFO"

    # Remove default handler and add new one with configured level
    logger.remove()
    logger.add(sys.stderr, level=log_level)


# Configure logger on module import
_configure_logger()

from .base import (
    ExtensionPoint,
    ReportDataTransform,
    HTMLRenderHook,
    KeywordMatcher,
    NotificationEnhancer,
    ChannelFilter,
)


class ExtensionManager:
    """
    Manages plugin lifecycle: discovery, loading, configuration, and execution.

    Features:
    - Auto-discovery via entry points
    - Per-plugin configuration files
    - Type-safe plugin execution
    - Error handling (skips failed plugins)
    """

    def __init__(self):
        self.plugins: Dict[str, ExtensionPoint] = {}
        self._discovered = False

    def _discover_plugins(self) -> None:
        """
        Auto-discover plugins via entry points.

        Plugins are registered in pyproject.toml:
            [project.entry-points."trendradar.extensions"]
            my_plugin = "extensions.my_plugin.plugin:MyPlugin"
        """
        if self._discovered:
            return

        try:
            # Python 3.10+ style entry points
            eps = entry_points(group="trendradar.extensions")
        except (TypeError, AttributeError):
            # Python 3.9 fallback
            eps = list(entry_points().get("trendradar.extensions", []))

        for ep in eps:
            try:
                plugin_class = ep.load()
                if isinstance(plugin_class, type) and issubclass(
                    plugin_class, ExtensionPoint
                ):
                    plugin = plugin_class()
                    self.plugins[plugin.name] = plugin
                    # Apply configuration
                    config = self.load_plugin_config(plugin.name)
                    plugin.apply_config(config)
                    logger.info(
                        "[Extension] Loaded plugin: {} v{} (enabled={})",
                        plugin.name,
                        plugin.version,
                        plugin.enabled,
                    )
                else:
                    logger.warning(
                        "[Extension] Warning: {} is not an ExtensionPoint subclass",
                        ep.name,
                    )
            except Exception as e:
                logger.error("[Extension] Error loading {}: {}", ep.name, e)

        self._discovered = True

    def load_plugin_config(self, plugin_name: str) -> Dict[str, Any]:
        """
        Load configuration for a specific plugin.

        Config is loaded from: config/extensions/{plugin_name}.yaml

        Args:
            plugin_name: Plugin name (should match plugin.name property)

        Returns:
            Configuration dictionary, or empty dict if not found
        """
        config_path = Path(f"config/extensions/{plugin_name}.yaml")

        if not config_path.exists():
            logger.debug(
                "[Extension] Config not found for '{}': {}", plugin_name, config_path
            )
            return {}

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
                return config if config else {}
        except yaml.YAMLError as e:
            logger.error(
                "[Extension] Error parsing config for '{}': {}", plugin_name, e
            )
            return {}
        except Exception as e:
            logger.error(
                "[Extension] Error loading config for '{}': {}", plugin_name, e
            )
            return {}

    def apply_transforms(
        self,
        report_data: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """
        Apply all ReportDataTransform plugins to report data.

        Plugins are applied in order of registration.

        Args:
            report_data: Report data dictionary
            context: Application context (AppContext instance)

        Returns:
            Transformed report data dictionary
        """
        self._discover_plugins()

        for plugin in self.plugins.values():
            if isinstance(plugin, ReportDataTransform):
                try:
                    if plugin.enabled:
                        config = self.load_plugin_config(plugin.name)
                        report_data = plugin.transform(report_data, config, context)
                except Exception as e:
                    logger.error("[Extension] Error in {}: {}", plugin.name, e)
                    # Continue with other plugins

        return report_data

    def apply_html_hooks(
        self,
        report_data: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """
        Apply all HTMLRenderHook plugins.

        Args:
            report_data: Report data dictionary
            context: Application context

        Returns:
            Modified report data dictionary
        """
        self._discover_plugins()

        for plugin in self.plugins.values():
            if isinstance(plugin, HTMLRenderHook):
                try:
                    if plugin.enabled:
                        config = self.load_plugin_config(plugin.name)
                        result = plugin.before_render(report_data, config, context)
                        if result:
                            report_data.update(result)
                except Exception as e:
                    logger.error("[Extension] Error in {}: {}", plugin.name, e)

        return report_data

    def apply_html_post_processing(
        self,
        html_content: str,
        context: Any,
    ) -> str:
        """
        Apply all HTMLRenderHook.after_render() plugins to post-process HTML.

        Args:
            html_content: Rendered HTML string
            context: Application context

        Returns:
            Post-processed HTML string
        """
        self._discover_plugins()

        for plugin in self.plugins.values():
            if isinstance(plugin, HTMLRenderHook):
                try:
                    if plugin.enabled:
                        config = self.load_plugin_config(plugin.name)
                        html_content = plugin.after_render(
                            html_content, config, context
                        )
                except Exception as e:
                    logger.error(
                        "[Extension] HTML post-processing error in {}: {}",
                        plugin.name,
                        e,
                    )

        return html_content

    def apply_keyword_match(
        self,
        title: str,
        word_groups: List[Dict[str, Any]],
        filter_words: List[str],
        global_filters: List[str],
    ) -> bool:
        """
        Apply all KeywordMatcher plugins.

        Returns True if any plugin matches.

        Args:
            title: News title to check
            word_groups: Keyword groups to match against
            filter_words: Words to filter out
            global_filters: Global filter words

        Returns:
            True if title matches any keyword, False otherwise
        """
        self._discover_plugins()

        # If no keyword matchers, use default behavior (match all)
        matchers = [p for p in self.plugins.values() if isinstance(p, KeywordMatcher)]
        if not matchers:
            return True

        for plugin in matchers:
            try:
                if plugin.enabled:
                    config = self.load_plugin_config(plugin.name)
                    if plugin.match(
                        title, word_groups, filter_words, global_filters, config
                    ):
                        return True
            except Exception as e:
                logger.error("[Extension] Error in {}: {}", plugin.name, e)

        return False

    def apply_notification_enhancement(
        self,
        content: str,
        channel: str,
        context: Any,
    ) -> str:
        """
        Apply all NotificationEnhancer plugins.

        Args:
            content: Notification content
            channel: Notification channel name
            context: Application context

        Returns:
            Enhanced content string
        """
        self._discover_plugins()

        for plugin in self.plugins.values():
            if isinstance(plugin, NotificationEnhancer):
                try:
                    if plugin.enabled:
                        config = self.load_plugin_config(plugin.name)
                        content = plugin.enhance(content, channel, config, context)
                except Exception as e:
                    logger.error("[Extension] Error in {}: {}", plugin.name, e)

        return content

    def apply_channel_filter(
        self,
        config: Dict[str, Any],
        context: Any,
    ) -> Tuple[Optional[List[str]], Optional[Dict[str, Any]], Optional[str]]:
        """
        Apply all ChannelFilter plugins to get enabled channels, overrides, and frequency_words path.

        This is called before dispatching notifications to allow plugins
        to filter which channels should receive notifications and optionally
        specify a custom frequency_words configuration.

        Plugins are applied in order, and results are combined (union).
        If any plugin returns a list of channels, those channels are included.
        If all plugins return None, default behavior (all configured channels) is used.

        Args:
            config: Plugin configuration (shared across all ChannelFilter plugins)
            context: Application context (AppContext instance)

        Returns:
            Tuple of (enabled_channels, channel_overrides, frequency_words_path):
            - enabled_channels: List of enabled channel names, or None if no filtering
            - channel_overrides: Dict with channel-specific overrides, or None
              Format: {"email": {"to": "recipient@example.com"}, ...}
            - frequency_words_path: Custom frequency_words file path, or None to use default.
              The first plugin that specifies a frequency_words path will be used.
        """
        self._discover_plugins()

        filters = [p for p in self.plugins.values() if isinstance(p, ChannelFilter)]
        if not filters:
            return None, None, None

        all_enabled_channels: List[str] = []
        all_channel_overrides: Dict[str, Any] = {}
        frequency_words_path: Optional[str] = None

        for plugin in filters:
            try:
                if plugin.enabled:
                    plugin_config = self.load_plugin_config(plugin.name)
                    # Merge plugin-specific config with global config
                    merged_config = {**(config or {}), **(plugin_config or {})}
                    result = plugin.get_enabled_channels(merged_config, context)
                    if result is not None:
                        # Handle both 2-tuple and 3-tuple for backward compatibility
                        if len(result) == 2:
                            enabled, channel_overrides = result
                            freq_words = None
                        else:
                            enabled, channel_overrides, freq_words = result

                        if enabled is not None:
                            # Add enabled channels to the union
                            for channel in enabled:
                                if channel not in all_enabled_channels:
                                    all_enabled_channels.append(channel)
                        # Merge channel overrides
                        if channel_overrides is not None:
                            all_channel_overrides.update(channel_overrides)
                        # First plugin that specifies frequency_words wins
                        if freq_words and frequency_words_path is None:
                            frequency_words_path = freq_words
            except Exception as e:
                logger.error(
                    "[Extension] Error in ChannelFilter {}: {}", plugin.name, e
                )

        if not all_enabled_channels:
            return (
                None,
                None if not all_channel_overrides else all_channel_overrides,
                frequency_words_path,
            )

        return (
            all_enabled_channels,
            all_channel_overrides if all_channel_overrides else None,
            frequency_words_path,
        )

    def get_plugin(self, name: str) -> Optional[ExtensionPoint]:
        """
        Get a specific plugin by name.

        Args:
            name: Plugin name

        Returns:
            Plugin instance or None if not found
        """
        self._discover_plugins()
        return self.plugins.get(name)

    def list_plugins(self) -> List[Dict[str, Any]]:
        """
        List all loaded plugins with their info.

        Returns:
            List of dicts with 'name', 'version', 'enabled' keys
        """
        self._discover_plugins()
        return [
            {"name": name, "version": plugin.version, "enabled": plugin.enabled}
            for name, plugin in self.plugins.items()
        ]


# Global singleton instance
_extension_manager: Optional[ExtensionManager] = None


def get_extension_manager() -> ExtensionManager:
    """
    Get the global ExtensionManager instance.

    Returns:
        ExtensionManager singleton
    """
    global _extension_manager
    if _extension_manager is None:
        _extension_manager = ExtensionManager()
    return _extension_manager


def reset_extension_manager() -> None:
    """Reset the global ExtensionManager (useful for testing)."""
    global _extension_manager
    _extension_manager = None


# Convenience function to check if any transform plugins are enabled
def has_transform_plugins() -> bool:
    """Check if any ReportDataTransform plugins are loaded and enabled."""
    em = get_extension_manager()
    em._discover_plugins()
    return any(
        isinstance(p, ReportDataTransform) and p.enabled for p in em.plugins.values()
    )
