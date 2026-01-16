# coding=utf-8
"""
Notification Scheduler Extension

Provides time-based notification scheduling and platform filtering.

Features:
- Schedule notifications at specific daily times (e.g., 9:00, 14:00, 18:00)
- Filter platforms per schedule (e.g., only feishu and telegram at 9:00)
- ±5 minute time tolerance (configurable)
- Email recipient override per schedule
- Fallback to default behavior when no schedule matches

Configuration (config/extensions/notification_scheduler.yaml):
    enabled: true
    tolerance_minutes: 5
    schedules:
      - time: "09:00"
        platforms: ["feishu", "telegram"]
      - time: "14:00"
        platforms: ["feishu", "dingtalk", "wework"]
      - time: "18:00"
        platforms: ["feishu", "dingtalk", "wework", "telegram", "email"]
        email:
          to: "recipient@example.com"
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from extensions.base import ChannelFilter


# Type alias for channel filter result (3-tuple with optional frequency_words path)
ChannelFilterResult = Tuple[Optional[List[str]], Optional[Dict[str, Any]], Optional[str]]


class NotificationSchedulerPlugin(ChannelFilter):
    """
    Notification scheduler with time-based channel filtering.

    This plugin allows configuring specific times when notifications should be sent,
    along with which platforms should receive notifications at each time.

    Example configuration:
        schedules:
          - time: "09:00"
            platforms: ["feishu", "telegram"]  # Morning: only instant messaging
          - time: "14:00"
            platforms: ["feishu", "dingtalk", "wework"]  # Afternoon: add work platforms
          - time: "18:00"
            platforms: ["feishu", "dingtalk", "wework", "telegram", "email"]  # Evening: all platforms

    When no schedule matches, notifications are sent to all configured channels
    (default behavior, preserving existing push_window logic).
    """

    @property
    def name(self) -> str:
        return "notification_scheduler"

    @property
    def version(self) -> str:
        return "1.0.0"

    def __init__(self):
        self.config: Dict[str, Any] = {}
        self._enabled = True
        self._schedules: List[Dict] = []
        self._tolerance_minutes: int = 5

    def apply_config(self, config: Dict) -> None:
        """Apply plugin configuration from YAML file."""
        # Safely handle None or empty config
        if config is None:
            config = {}
        self.config = config
        try:
            self._enabled = config.get("enabled", True) if config else True
            # Load schedules - ensure it's always a list
            schedules_data = config.get("schedules") if config else None
            if schedules_data is None:
                self._schedules = []
            elif isinstance(schedules_data, list):
                self._schedules = schedules_data
            else:
                self._schedules = []
            # Load tolerance
            self._tolerance_minutes = (
                config.get("tolerance_minutes", 5) if config else 5
            )

            logger.info(
                "[notification_scheduler] Loaded plugin v{} (enabled={}, schedules={}, tolerance={}min)",
                self.version,
                self._enabled,
                len(self._schedules),
                self._tolerance_minutes,
            )
        except Exception as e:
            logger.error("[notification_scheduler] Error in apply_config: {}", e)
            self._enabled = False
            self._schedules = []

    def get_enabled_channels(
        self,
        config: Dict[str, Any],
        context: Any,
    ) -> ChannelFilterResult:
        """
        Get enabled channels based on current time and configured schedules.

        Args:
            config: Plugin configuration (not used, we use self.config)
            context: Application context with get_time_func

        Returns:
            Tuple of (enabled_channels, channel_overrides, frequency_words_path):
            - enabled_channels: List of channel names to enable, or None for default behavior
            - channel_overrides: Dict with channel-specific overrides (e.g., email.to), or None
            - frequency_words_path: Custom frequency_words file path, or None to use default
        """
        if not self._enabled:
            logger.debug(
                "[notification_scheduler] Plugin disabled, returning (None, None, None)"
            )
            return None, None, None

        if not self._schedules:
            logger.debug(
                "[notification_scheduler] No schedules configured, returning (None, None, None)"
            )
            return None, None, None

        # Get current time from context
        get_time_func = getattr(context, "get_time", None)
        if get_time_func is None:
            logger.warning("[notification_scheduler] No get_time function in context")
            return None, None, None

        try:
            current_time = get_time_func()
        except Exception as e:
            logger.error("[notification_scheduler] Failed to get current time: {}", e)
            return None, None, None

        current_hour = current_time.hour
        current_minute = current_time.minute
        current_total_minutes = current_hour * 60 + current_minute

        logger.debug(
            "[notification_scheduler] Checking schedules at {:02d}:{:02d}",
            current_hour,
            current_minute,
        )

        # Check each schedule
        for schedule in self._schedules:
            schedule_time_str = schedule.get("time", "")
            platforms = schedule.get("platforms", [])

            if not schedule_time_str or not platforms:
                continue

            # Parse schedule time (HH:MM format)
            try:
                schedule_parts = schedule_time_str.split(":")
                schedule_hour = int(schedule_parts[0])
                schedule_minute = int(schedule_parts[1])
                schedule_total_minutes = schedule_hour * 60 + schedule_minute
            except (ValueError, IndexError) as e:
                logger.warning(
                    "[notification_scheduler] Invalid schedule time '{}': {}",
                    schedule_time_str,
                    e,
                )
                continue

            # Check if current time is within tolerance of schedule time
            time_diff = abs(current_total_minutes - schedule_total_minutes)

            if time_diff <= self._tolerance_minutes:
                # Get email override if configured
                email_config = schedule.get("email")
                channel_overrides = None
                if email_config and isinstance(email_config, dict):
                    email_to = email_config.get("to")
                    if email_to:
                        # Handle both list and string (comma-separated) formats
                        if isinstance(email_to, list):
                            # Convert list to comma-separated string
                            email_to = ",".join(str(e).strip() for e in email_to if e)
                        elif isinstance(email_to, str):
                            # Already a string, strip whitespace
                            email_to = email_to.strip()
                        else:
                            email_to = None

                        if email_to:
                            channel_overrides = {"email": {"to": email_to}}

                # Get custom frequency_words path if configured
                frequency_words = schedule.get("frequency_words")
                if frequency_words and isinstance(frequency_words, str):
                    frequency_words = frequency_words.strip()
                    if not frequency_words:
                        frequency_words = None
                else:
                    frequency_words = None

                # Build log message with all configured options
                log_parts = [
                    f"schedule: {schedule_hour:02d}:{schedule_minute:02d}",
                    f"tolerance: {self._tolerance_minutes}min",
                    f"channels: {', '.join(platforms)}",
                ]
                if channel_overrides and "email" in channel_overrides:
                    log_parts.append(f"email_to: {channel_overrides['email'].get('to')}")
                if frequency_words:
                    log_parts.append(f"frequency_words: {frequency_words}")

                logger.info(
                    "[notification_scheduler] Schedule matched at {:02d}:{:02d} ({})",
                    current_hour,
                    current_minute,
                    ", ".join(log_parts),
                )

                return platforms, channel_overrides, frequency_words

        logger.debug(
            "[notification_scheduler] No schedule matched at {:02d}:{:02d}, returning (None, None, None)",
            current_hour,
            current_minute,
        )
        return None, None, None


# Plugin instance for entry point discovery
plugin = NotificationSchedulerPlugin()
