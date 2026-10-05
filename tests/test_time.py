from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from trendradar.utils.time import (
    calculate_days_old,
    format_iso_time_friendly,
    is_within_days,
)


@pytest.mark.parametrize("stamp", [
    "2026-10-01T00:00:00.500-05:00",
    "2026-10-01T05:00:00.500Z",
    "2026-10-01T13:00:00.500+08:00",
    "2026-10-01T05:00:00.500",
])
def test_equivalent_fractional_timestamps(stamp):
    now = datetime(2026, 10, 2, 5, tzinfo=timezone.utc)
    with patch("trendradar.utils.time.get_configured_time", return_value=now):
        assert calculate_days_old(stamp) == pytest.approx((86400 - 0.5) / 86400)
        assert is_within_days(stamp, 1)
    assert format_iso_time_friendly(stamp, "Asia/Shanghai") == "10-01 13:00"


def test_fractional_negative_offset_at_freshness_boundary():
    now = datetime(2026, 10, 2, 3, tzinfo=timezone.utc)
    with patch("trendradar.utils.time.get_configured_time", return_value=now):
        assert is_within_days("2026-10-01T00:00:00.500-05:00", 1)
        assert not is_within_days("2026-09-30T00:00:00.500-05:00", 1)


def test_invalid_timestamp_and_disabled_filter_fallbacks():
    assert calculate_days_old("invalid") is None
    assert is_within_days("invalid", 1)
    assert is_within_days("2020-01-01T00:00:00Z", 0)
