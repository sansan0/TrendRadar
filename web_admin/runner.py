# coding=utf-8
"""运行管理：手动执行、日志、状态与内置定时调度。"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import cron
from . import store

KINDS = {
    "run": {"label": "采集 / 分析 / 推送", "args": []},
    "test-notification": {"label": "测试通知渠道", "args": ["--test-notification"]},
    "doctor": {"label": "配置与环境体检", "args": ["--doctor"]},
    "show-schedule": {"label": "查看调度状态", "args": ["--show-schedule"]},
}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Runner:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._lock = threading.Lock()
        self._process: Optional[subprocess.Popen] = None
        self._kind: Optional[str] = None
        self._log_path: Optional[Path] = None
        self._started_at: Optional[float] = None
        self._started_display: Optional[str] = None
        self._trigger = "manual"

    # -- 状态 ---------------------------------------------------------------

    def is_running(self) -> bool:
        with self._lock:
            return self._process is not None and self._process.poll() is None

    def status(self) -> Dict[str, Any]:
        state = store.load_state()
        with self._lock:
            running = self._process is not None and self._process.poll() is None
            payload: Dict[str, Any] = {
                "running": running,
                "kind": self._kind if running else None,
                "pid": self._process.pid if running and self._process else None,
                "started_at": self._started_display if running else None,
                "elapsed": int(time.time() - self._started_at)
                if running and self._started_at
                else 0,
                "log": str(self._log_path) if running and self._log_path else None,
                "last_run": state.get("last_run"),
                "scheduler": state.get("scheduler", {}),
            }
        settings = store.load_settings()
        payload["settings"] = {
            "cron": settings.get("cron"),
            "run_mode": settings.get("run_mode"),
            "immediate_run": settings.get("immediate_run"),
            "cron_desc": self._describe_safely(settings.get("cron", "")),
        }
        try:
            next_run = cron.next_run(settings.get("cron", ""), datetime.now())
            payload["settings"]["next_run"] = (
                next_run.strftime("%Y-%m-%d %H:%M") if next_run else None
            )
        except cron.CronError:
            payload["settings"]["next_run"] = None
        return payload

    @staticmethod
    def _describe_safely(expr: str) -> str:
        try:
            return cron.describe(expr)
        except cron.CronError:
            return "表达式无效"

    # -- 执行 ---------------------------------------------------------------

    def start(self, kind: str = "run", trigger: str = "manual") -> Dict[str, Any]:
        if kind not in KINDS:
            raise ValueError(f"未知的执行类型: {kind}")
        with self._lock:
            if self._process is not None and self._process.poll() is None:
                return {"ok": False, "error": "已有任务正在运行，请等待完成或先停止"}
            log_dir = store.LOG_DIR
            log_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            log_path = log_dir / f"{stamp}-{kind}.log"
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env.setdefault("CONFIG_PATH", str(store.CONFIG_FILE))
            command = [sys.executable, "-m", "trendradar", *KINDS[kind]["args"]]
            try:
                log_file = open(log_path, "wb")
            except OSError as exc:
                return {"ok": False, "error": f"无法创建日志文件: {exc}"}
            try:
                process = subprocess.Popen(
                    command,
                    cwd=str(self.root),
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    env=env,
                    start_new_session=(os.name != "nt"),
                )
            except Exception as exc:
                log_file.close()
                return {"ok": False, "error": f"启动失败: {exc}"}
            log_file.close()
            self._process = process
            self._kind = kind
            self._log_path = log_path
            self._started_at = time.time()
            self._started_display = _now()
            self._trigger = trigger

        thread = threading.Thread(
            target=self._wait,
            args=(process, kind, log_path, self._started_at, trigger),
            daemon=True,
        )
        thread.start()

        state = store.load_state()
        state["last_run"] = {
            "kind": kind,
            "label": KINDS[kind]["label"],
            "started_at": self._started_display,
            "finished_at": None,
            "exit_code": None,
            "log": log_path.name,
            "ok": None,
            "trigger": trigger,
        }
        store.save_state(state)
        return {
            "ok": True,
            "pid": process.pid,
            "log": log_path.name,
            "started_at": self._started_display,
        }

    def _wait(
        self,
        process: subprocess.Popen,
        kind: str,
        log_path: Path,
        started_at: float,
        trigger: str,
    ) -> None:
        try:
            exit_code = process.wait()
        except Exception:
            exit_code = -1
        finished = _now()
        with self._lock:
            if self._process is process:
                self._process = None
            duration = int(time.time() - started_at)
        state = store.load_state()
        state["last_run"] = {
            "kind": kind,
            "label": KINDS[kind]["label"],
            "started_at": datetime.fromtimestamp(started_at).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "finished_at": finished,
            "exit_code": exit_code,
            "duration": duration,
            "log": log_path.name,
            "ok": exit_code == 0,
            "trigger": trigger,
        }
        store.save_state(state)

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            process = self._process
            if process is None or process.poll() is not None:
                return {"ok": False, "error": "当前没有正在运行的任务"}
            try:
                if os.name != "nt":
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                else:
                    process.terminate()
            except Exception as exc:
                return {"ok": False, "error": f"停止失败: {exc}"}
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            try:
                if os.name != "nt":
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                else:
                    process.kill()
            except Exception:
                pass
        return {"ok": True}

    def tail_current(self, lines: int = 200) -> Dict[str, Any]:
        with self._lock:
            path = self._log_path
        if not path:
            state = store.load_state()
            last = state.get("last_run") or {}
            if last.get("log"):
                path = store.LOG_DIR / last["log"]
        if not path or not path.exists():
            return {"content": "", "path": None}
        return {"content": tail_file(path, lines), "path": path.name}

    def list_logs(self, limit: int = 30) -> List[Dict[str, Any]]:
        store.LOG_DIR.mkdir(parents=True, exist_ok=True)
        files = sorted(
            store.LOG_DIR.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True
        )
        result = []
        for path in files[:limit]:
            stat = path.stat()
            result.append(
                {
                    "name": path.name,
                    "size": stat.st_size,
                    "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                }
            )
        return result

    def read_log(self, name: str, lines: int = 500) -> Dict[str, Any]:
        path = resolve_log(name)
        if not path or not path.exists():
            raise FileNotFoundError(name)
        return {"name": path.name, "content": tail_file(path, lines)}


def resolve_log(name: str) -> Optional[Path]:
    base = store.LOG_DIR.resolve()
    candidate = (base / Path(name).name).resolve()
    if base not in candidate.parents and candidate != base:
        return None
    return candidate


def tail_file(path: Path, lines: int = 200, max_bytes: int = 512_000) -> str:
    try:
        size = path.stat().st_size
        with open(path, "rb") as f:
            if size > max_bytes:
                f.seek(size - max_bytes)
                f.readline()
            data = f.read()
        text = data.decode("utf-8", errors="replace")
        rows = text.splitlines()
        return "\n".join(rows[-lines:])
    except OSError as exc:
        return f"读取日志失败: {exc}"


class Scheduler:
    """每 20 秒检查一次计划，命中时触发一次完整运行。"""

    def __init__(self, runner: Runner) -> None:
        self.runner = runner
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_fire: Optional[str] = None
        self._last_error = ""
        self._startup_done = False

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop, name="trendradar-scheduler", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        # 启动后稍等，避免与初始化/首次请求竞争
        if self._stop.wait(3):
            return
        if not self._startup_done:
            self._startup_done = True
            settings = store.load_settings()
            if settings.get("immediate_run"):
                if not self.runner.is_running():
                    self.runner.start("run", trigger="startup")
                    self._write_state("startup", None)
        while not self._stop.wait(20):
            try:
                self._tick()
            except Exception as exc:  # 调度线程不能因为异常退出
                self._last_error = str(exc)
                self._write_state("error", str(exc))

    def _tick(self) -> None:
        settings = store.load_settings()
        if settings.get("run_mode") != "cron":
            return
        expr = str(settings.get("cron") or "").strip()
        if not expr:
            return
        try:
            parsed = cron.parse(expr)
        except cron.CronError as exc:
            self._last_error = f"cron 表达式无效: {exc}"
            return
        now = datetime.now()
        marker = now.strftime("%Y-%m-%d %H:%M")
        if not cron.matches(now, parsed):
            return
        if marker == self._last_fire:
            return
        self._last_fire = marker
        if self.runner.is_running():
            self._write_state("skip", "上一次任务尚未结束，本次跳过")
            return
        result = self.runner.start("run", trigger="schedule")
        self._write_state(
            "fire" if result.get("ok") else "error", result.get("error", "")
        )

    def _write_state(self, event: str, message: Optional[str]) -> None:
        state = store.load_state()
        scheduler = state.get("scheduler") or {}
        scheduler.update(
            {
                "last_event": event,
                "last_message": message or "",
                "last_check": _now(),
                "next_run": self._next_run_text(),
            }
        )
        state["scheduler"] = scheduler
        store.save_state(state)

    @staticmethod
    def _next_run_text() -> Optional[str]:
        settings = store.load_settings()
        try:
            nxt = cron.next_run(settings.get("cron", ""), datetime.now())
            return nxt.strftime("%Y-%m-%d %H:%M") if nxt else None
        except cron.CronError:
            return None
