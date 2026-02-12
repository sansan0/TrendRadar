#!/usr/bin/env python3
"""
OpenClaw integration runner for TrendRadar.

Goals:
- Single stable entrypoint for cron/manual runs.
- Structured JSON result for OpenClaw agent consumption.
- Idempotency hints via state file (latest_db/checksum/last_sent_at).
- Failure classification + degraded summary (avoid silent failures).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_latest_db(news_dir: Path) -> Path | None:
    if not news_dir.exists():
        return None
    dbs = sorted(news_dir.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return dbs[0] if dbs else None


def classify_error(log_text: str, return_code: int) -> str:
    txt = log_text.lower()
    if "fetch failed" in txt:
        return "fetch_failed"
    if "db" in txt and ("not found" in txt or "不存在" in txt):
        return "db_missing"
    if "send" in txt and ("failed" in txt or "失败" in txt):
        return "notify_failed"
    if "分析流程执行出错" in log_text:
        return "pipeline_failed"
    if return_code != 0:
        return "process_nonzero"
    return "unknown"


@dataclass
class RunResult:
    status: str
    run_mode: str
    start_at: str
    end_at: str
    duration_seconds: float
    return_code: int
    error_type: str | None
    summary: str
    latest_db: str | None
    latest_db_mtime: str | None
    latest_db_checksum: str | None
    changed_since_last: bool | None
    state_file: str
    log_file: str


class StateStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save(self, data: dict[str, Any]) -> None:
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Run TrendRadar for OpenClaw with structured JSON output.")
    p.add_argument("--project-root", default=".", help="TrendRadar project root")
    p.add_argument("--python-bin", default=sys.executable, help="Python executable")
    p.add_argument("--state-file", default="output/openclaw/openclaw_state.json")
    p.add_argument("--log-file", default="output/openclaw/openclaw_runner.log")
    p.add_argument("--run-mode", choices=["scheduled", "manual"], default="manual")
    p.add_argument("--dry-run", action="store_true", help="Do not execute trendradar, only report current state")
    p.add_argument("--fallback-last-on-failure", action="store_true", help="On failure, include fallback hint in summary")
    return p


def main() -> int:
    args = build_parser().parse_args()

    root = Path(args.project_root).resolve()
    os.chdir(root)

    state_path = Path(args.state_file)
    log_path = Path(args.log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    state = StateStore(state_path).load()

    start_ts = time.time()
    start_at = now_iso()

    latest_db_before = detect_latest_db(Path("output/news"))

    stdout_text = ""
    stderr_text = ""
    return_code = 0

    if not args.dry_run:
        proc = subprocess.run(
            [args.python_bin, "-m", "trendradar"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        stdout_text = proc.stdout or ""
        stderr_text = proc.stderr or ""
        return_code = proc.returncode

        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"\n===== {start_at} run_mode={args.run_mode} =====\n")
            if stdout_text:
                f.write("[stdout]\n" + stdout_text + "\n")
            if stderr_text:
                f.write("[stderr]\n" + stderr_text + "\n")
            f.write(f"[return_code] {return_code}\n")

    end_at = now_iso()
    duration = round(time.time() - start_ts, 3)

    latest_db_after = detect_latest_db(Path("output/news"))
    latest_db = latest_db_after or latest_db_before

    checksum = None
    latest_db_mtime = None
    if latest_db and latest_db.exists():
        checksum = sha256_file(latest_db)
        latest_db_mtime = datetime.fromtimestamp(latest_db.stat().st_mtime, tz=timezone.utc).astimezone().isoformat(timespec="seconds")

    prev_checksum = state.get("latest_db_checksum")
    changed_since_last = None if checksum is None else (checksum != prev_checksum)

    log_text = stdout_text + "\n" + stderr_text
    success_markers = ["HTML报告已生成", "HTML 报告已生成", "最新报告已更新"]
    has_success_marker = any(m in log_text for m in success_markers)

    failed_in_log = bool(re.search(r"(程序运行错误|分析流程执行出错|Traceback)", log_text))
    is_success = (return_code == 0 and not failed_in_log and (has_success_marker or args.dry_run))

    if is_success:
        status = "success"
        error_type = None
        summary = "TrendRadar run succeeded"
    else:
        status = "failed"
        error_type = classify_error(log_text, return_code)
        summary = f"TrendRadar run failed: {error_type}"
        if args.fallback_last_on_failure and state.get("last_success_summary"):
            summary += " | fallback_available=true"

    # update state (for idempotency and audit)
    new_state = {
        "last_run_at": end_at,
        "last_status": status,
        "last_error_type": error_type,
        "latest_db": str(latest_db) if latest_db else None,
        "latest_db_mtime": latest_db_mtime,
        "latest_db_checksum": checksum,
        "changed_since_last": changed_since_last,
        "last_sent_at": end_at if status == "success" else state.get("last_sent_at"),
        "last_success_summary": summary if status == "success" else state.get("last_success_summary"),
    }
    StateStore(state_path).save(new_state)

    result = RunResult(
        status=status,
        run_mode=args.run_mode,
        start_at=start_at,
        end_at=end_at,
        duration_seconds=duration,
        return_code=return_code,
        error_type=error_type,
        summary=summary,
        latest_db=str(latest_db) if latest_db else None,
        latest_db_mtime=latest_db_mtime,
        latest_db_checksum=checksum,
        changed_since_last=changed_since_last,
        state_file=str(state_path),
        log_file=str(log_path),
    )

    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    return 0 if status == "success" else 1


if __name__ == "__main__":
    raise SystemExit(main())
