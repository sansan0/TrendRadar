#!/usr/bin/env python3
"""
Scheduler daemon for TrendRadar Docker container.

Replaces supercronic with a persistent scheduling loop that:
- Runs TrendRadar at scheduled times (from CRON_SCHEDULE)
- Catches up on missed runs after system wake-from-sleep
- Avoids the supercronic limitation where missed cron jobs are never fired

Usage (in entrypoint.sh):
    python scheduler_daemon.py "0 11,15 * * *" --immediate
"""

import os
import re
import sys
import time
import signal
import subprocess
from datetime import datetime, timedelta
from pathlib import Path


def parse_cron_field(field: str, min_val: int, max_val: int) -> set[int]:
    """
    Parse a cron field (minute or hour) into a set of matching values.

    Supports: *, */N, N, N,M,O-P
    """
    values: set[int] = set()
    field = field.strip()

    if field == "*":
        return set(range(min_val, max_val + 1))

    for part in field.split(","):
        part = part.strip()
        if not part:
            continue

        if part.startswith("*/"):
            step = int(part[2:])
            values.update(range(min_val, max_val + 1, step))
        elif "-" in part:
            start_s, end_s = part.split("-", 1)
            start_v = int(start_s)
            end_v = int(end_s)
            values.update(range(start_v, end_v + 1))
        else:
            values.add(int(part))

    return values


class CronSchedule:
    """Represents a cron schedule and provides 'should run at time' checks."""

    def __init__(self, cron_expr: str):
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            raise ValueError(
                f"Invalid cron expression: '{cron_expr}' — expected 5 fields"
            )

        self.minutes = parse_cron_field(parts[0], 0, 59)
        self.hours = parse_cron_field(parts[1], 0, 23)
        # day-of-month, month, day-of-week are not used for this simple check
        self._raw = cron_expr

    def is_scheduled_at(self, dt: datetime) -> bool:
        """Check if a given datetime matches the cron schedule."""
        return dt.minute in self.minutes and dt.hour in self.hours

    def get_next_run_time(self, after: datetime) -> datetime:
        """Find the next scheduled time strictly after `after`."""
        candidate = after + timedelta(minutes=1)
        # Search up to 48 hours ahead to avoid infinite loop
        deadline = after + timedelta(hours=48)
        while candidate <= deadline:
            if self.is_scheduled_at(candidate):
                return candidate
            candidate += timedelta(minutes=1)
        return deadline  # fallback

    def get_missed_runs_since(self, last_run: datetime, now: datetime) -> list[datetime]:
        """Find all scheduled runs between last_run and now that were missed."""
        missed = []
        candidate = self.get_next_run_time(last_run)
        while candidate <= now:
            missed.append(candidate)
            candidate = self.get_next_run_time(candidate)
        return missed


def run_trendradar() -> int:
    """Execute python -m trendradar and return the exit code."""
    print(f"[daemon] Running TrendRadar at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    result = subprocess.run(
        ["python", "-m", "trendradar"],
        cwd="/app",
        capture_output=False,
    )
    return result.returncode


def main():
    cron_expr = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CRON_SCHEDULE", "*/30 * * * *")
    immediate = "--immediate" in sys.argv

    schedule = CronSchedule(cron_expr)
    print(f"[daemon] Starting scheduler daemon")
    print(f"[daemon] Cron schedule: {cron_expr}")

    last_run_time = datetime.now()

    # Immediate run on startup if requested
    if immediate:
        print("[daemon] --immediate: running once on startup")
        run_trendradar()
        last_run_time = datetime.now()
    else:
        # Even without --immediate, check if any scheduled time was missed
        # since a reasonable window (e.g., last 2 hours) — covers wake-from-sleep
        wake_window = datetime.now() - timedelta(hours=2)
        missed = schedule.get_missed_runs_since(wake_window, datetime.now())
        if missed:
            print(f"[daemon] System wake-from-sleep detected: {len(missed)} missed run(s)")
            print(f"[daemon] Running catch-up for scheduled times: "
                  f"{[m.strftime('%H:%M') for m in missed]}")
            run_trendradar()
            last_run_time = datetime.now()

    # Shutdown handling
    shutdown_requested = False

    def _handle_signal(signum, frame):
        nonlocal shutdown_requested
        print(f"[daemon] Received signal {signum}, shutting down...")
        shutdown_requested = True

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    print("[daemon] Entering main loop (checking every 60 seconds)")
    while not shutdown_requested:
        time.sleep(60)
        now = datetime.now()

        if shutdown_requested:
            break

        if schedule.is_scheduled_at(now):
            # Check if we already ran this scheduled slot
            if (now - last_run_time).total_seconds() > 90:
                print(f"[daemon] Scheduled time reached: {now.strftime('%H:%M')}")
                run_trendradar()
                last_run_time = now
        else:
            # Check for missed runs (system sleep recovery)
            missed = schedule.get_missed_runs_since(last_run_time, now)
            # Filter out any that are within the last 2 minutes (current running)
            missed = [m for m in missed if (now - m).total_seconds() > 120]
            if missed:
                print(f"[daemon] Missed {len(missed)} scheduled run(s) during sleep: "
                      f"{[m.strftime('%H:%M') for m in missed]}")
                run_trendradar()
                last_run_time = now

    print("[daemon] Scheduler daemon stopped")


if __name__ == "__main__":
    main()
