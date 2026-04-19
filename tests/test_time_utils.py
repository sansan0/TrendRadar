# coding=utf-8
"""
Unit tests for trendradar/utils/time.py

Regression coverage for: negative UTC offsets (-HH:MM) not recognised as
timezone-aware, causing RSS articles from EST/PST/CET sources to be treated
as UTC, producing up to 12-hour display errors and incorrect freshness
filtering.
"""

import sys
import os
from datetime import datetime, timedelta, timezone

import pytest
import pytz

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from trendradar.utils.time import (
    _has_tz_info,
    format_iso_time_friendly,
    is_within_days,
    calculate_days_old,
)


# ---------------------------------------------------------------------------
# _has_tz_info
# ---------------------------------------------------------------------------

class TestHasTzInfo:
    @pytest.mark.parametrize("iso_time,expected", [
        ("2025-12-29T00:20:00Z",        True),
        ("2025-12-29T00:20:00+00:00",   True),
        ("2025-12-29T00:20:00+08:00",   True),
        ("2025-12-29T00:20:00+05:30",   True),
        ("2025-12-29T00:20:00-05:00",   True),   # EST - key regression
        ("2025-12-29T00:20:00-08:00",   True),   # PST - key regression
        ("2025-12-29T00:20:00-03:30",   True),   # Newfoundland
        ("2025-12-29T00:20:00-12:00",   True),
        ("2025-12-29T00:20:00",         False),
        ("2025-12-29 00:20:00",         False),
        ("2025-12-29",                  False),
        ("",                            False),
    ])
    def test_detection(self, iso_time, expected):
        assert _has_tz_info(iso_time) == expected

    def test_old_logic_missed_negative_offset(self):
        """Confirm old '+' in string logic missed negative offsets."""
        ts = "2025-12-29T00:20:00-05:00"
        old_logic = ("+" in ts) or ts.endswith("Z")
        new_logic = _has_tz_info(ts)
        assert old_logic is False, "old logic indeed missed negative offset"
        assert new_logic is True, "new logic correctly detects negative offset"


# ---------------------------------------------------------------------------
# format_iso_time_friendly
# ---------------------------------------------------------------------------

class TestFormatIsoTimeFriendly:
    BASE_UTC = "2025-12-29T08:00:00+00:00"
    BASE_EST = "2025-12-29T03:00:00-05:00"
    BASE_CST = "2025-12-29T16:00:00+08:00"

    def test_utc_to_shanghai(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00+00:00", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 08:00"

    def test_negative_offset_correctly_converted(self):
        """EST -05:00: same moment as UTC should give same CST result."""
        result = format_iso_time_friendly(
            "2025-12-29T03:00:00-05:00", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 16:00", f"got {result!r}"

    def test_same_moment_all_tz_representations_agree(self):
        r_utc = format_iso_time_friendly(self.BASE_UTC, "Asia/Shanghai", True)
        r_est = format_iso_time_friendly(self.BASE_EST, "Asia/Shanghai", True)
        r_cst = format_iso_time_friendly(self.BASE_CST, "Asia/Shanghai", True)
        assert r_utc == r_est == r_cst, (
            f"UTC={r_utc!r} EST={r_est!r} CST={r_cst!r}"
        )

    def test_pst_offset(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00-08:00", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 16:00", f"got {result!r}"

    def test_z_suffix(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00Z", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 08:00", f"got {result!r}"

    def test_no_tz_assumed_utc(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 08:00", f"got {result!r}"

    def test_include_date_false(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00+00:00", timezone="Asia/Shanghai", include_date=False
        )
        assert result == "08:00", f"got {result!r}"

    def test_empty_returns_empty(self):
        assert format_iso_time_friendly("", "Asia/Shanghai") == ""

    def test_milliseconds_stripped(self):
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00.123456Z", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 08:00", f"got {result!r}"

    def test_half_hour_offset(self):
        """Newfoundland UTC-3:30: 00:00 NST = 03:30 UTC = 11:30 CST."""
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00-03:30", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 11:30", f"got {result!r}"

    def test_ist_offset(self):
        """India Standard Time UTC+5:30: 00:00 IST = 18:30 UTC prev day = 02:30 CST."""
        result = format_iso_time_friendly(
            "2025-12-29T00:00:00+05:30", timezone="Asia/Shanghai", include_date=True
        )
        assert result == "12-29 02:30", f"got {result!r}"


# ---------------------------------------------------------------------------
# is_within_days
# ---------------------------------------------------------------------------

class TestIsWithinDays:
    def _ts(self, days_ago: float, tz_offset_hours: float = 0) -> str:
        now_utc = datetime.now(timezone.utc)
        target = now_utc - timedelta(days=days_ago)
        off = timezone(timedelta(hours=tz_offset_hours))
        return target.astimezone(off).isoformat()

    def test_fresh_article_kept(self):
        assert is_within_days(self._ts(1.0), max_days=3) is True

    def test_old_article_filtered(self):
        assert is_within_days(self._ts(5.0), max_days=3) is False

    def test_negative_offset_fresh(self):
        ts = self._ts(1.0, tz_offset_hours=-5)
        assert is_within_days(ts, max_days=3) is True, f"fresh EST article filtered: {ts}"

    def test_negative_offset_old(self):
        ts = self._ts(5.0, tz_offset_hours=-8)
        assert is_within_days(ts, max_days=3) is False, f"old PST article not filtered: {ts}"

    def test_z_suffix_fresh(self):
        now_utc = datetime.now(timezone.utc) - timedelta(days=1)
        ts = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        assert is_within_days(ts, max_days=3) is True

    def test_empty_kept(self):
        assert is_within_days("", max_days=3) is True

    def test_max_days_zero_disables_filter(self):
        assert is_within_days(self._ts(100.0), max_days=0) is True

    def test_max_days_negative_disables_filter(self):
        assert is_within_days(self._ts(100.0), max_days=-1) is True

    def test_boundary_under(self):
        assert is_within_days(self._ts(2.9), max_days=3) is True

    def test_boundary_over(self):
        assert is_within_days(self._ts(3.1), max_days=3) is False

    def test_unparseable_kept(self):
        assert is_within_days("not-a-date", max_days=3) is True

    def test_same_moment_all_offsets_agree(self):
        base = datetime.now(timezone.utc) - timedelta(days=1)
        ts_utc = base.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        ts_cst = base.astimezone(timezone(timedelta(hours=8))).isoformat()
        ts_est = base.astimezone(timezone(timedelta(hours=-5))).isoformat()
        r_u = is_within_days(ts_utc, 3)
        r_c = is_within_days(ts_cst, 3)
        r_e = is_within_days(ts_est, 3)
        assert r_u == r_c == r_e, f"UTC={r_u} CST={r_c} EST={r_e}"


# ---------------------------------------------------------------------------
# calculate_days_old
# ---------------------------------------------------------------------------

class TestCalculateDaysOld:
    def _ts(self, days_ago: float, tz_offset_hours: float = 0) -> str:
        now_utc = datetime.now(timezone.utc) - timedelta(days=days_ago)
        off = timezone(timedelta(hours=tz_offset_hours))
        return now_utc.astimezone(off).isoformat()

    def test_utc_days_old(self):
        result = calculate_days_old(self._ts(2.0, 0))
        assert result is not None and abs(result - 2.0) < 0.1

    def test_negative_offset_days_old(self):
        result = calculate_days_old(self._ts(2.0, -5))
        assert result is not None, "should parse EST timestamp"
        assert abs(result - 2.0) < 0.1, f"expected ~2.0, got {result}"

    def test_empty_returns_none(self):
        assert calculate_days_old("") is None

    def test_unparseable_returns_none(self):
        assert calculate_days_old("not-a-date") is None

    def test_same_moment_all_offsets_agree(self):
        base = datetime.now(timezone.utc) - timedelta(days=3)
        ts_utc = base.strftime("%Y-%m-%dT%H:%M:%S+00:00")
        ts_est = base.astimezone(timezone(timedelta(hours=-5))).isoformat()
        r_utc = calculate_days_old(ts_utc)
        r_est = calculate_days_old(ts_est)
        assert r_utc is not None and r_est is not None
        assert abs(r_utc - r_est) < 0.01, f"UTC={r_utc:.3f} EST={r_est:.3f}"
