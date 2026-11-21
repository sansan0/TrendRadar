# coding=utf-8
"""管理台认证：密码哈希、会话、登录限速。"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple

PBKDF2_ITERATIONS = 240_000
SESSION_TTL = 12 * 3600
MAX_FAILURES = 5
LOCK_SECONDS = 300


def hash_password(password: str, salt: Optional[bytes] = None) -> Dict[str, object]:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return {
        "algorithm": "pbkdf2_sha256",
        "iterations": PBKDF2_ITERATIONS,
        "salt": salt.hex(),
        "hash": digest.hex(),
    }


def verify_password(password: str, record: Dict[str, object]) -> bool:
    try:
        salt = bytes.fromhex(str(record["salt"]))
        expected = bytes.fromhex(str(record["hash"]))
        iterations = int(record.get("iterations", PBKDF2_ITERATIONS))
    except (KeyError, TypeError, ValueError):
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(digest, expected)


@dataclass
class Session:
    token: str
    csrf: str
    created: float
    ip: str


class SessionStore:
    """内存会话表；服务重启后需要重新登录。"""

    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self, ip: str) -> Session:
        session = Session(
            token=secrets.token_urlsafe(32),
            csrf=secrets.token_urlsafe(24),
            created=time.time(),
            ip=ip,
        )
        with self._lock:
            self._prune_locked()
            self._sessions[session.token] = session
        return session

    def get(self, token: Optional[str]) -> Optional[Session]:
        if not token:
            return None
        with self._lock:
            session = self._sessions.get(token)
            if not session:
                return None
            if time.time() - session.created > SESSION_TTL:
                self._sessions.pop(token, None)
                return None
            return session

    def delete(self, token: Optional[str]) -> None:
        if not token:
            return
        with self._lock:
            self._sessions.pop(token, None)

    def delete_all_for_ip(self, ip: str) -> None:
        with self._lock:
            for key, value in list(self._sessions.items()):
                if value.ip == ip:
                    self._sessions.pop(key, None)

    def _prune_locked(self) -> None:
        now = time.time()
        for key, value in list(self._sessions.items()):
            if now - value.created > SESSION_TTL:
                self._sessions.pop(key, None)


class LoginLimiter:
    """按 IP 记录登录失败次数，超过阈值后临时锁定。"""

    def __init__(self) -> None:
        self._state: Dict[str, Tuple[int, float]] = {}
        self._lock = threading.Lock()

    def is_locked(self, ip: str) -> Tuple[bool, int]:
        with self._lock:
            failures, locked_at = self._state.get(ip, (0, 0.0))
        if failures < MAX_FAILURES:
            return False, 0
        remain = int(LOCK_SECONDS - (time.time() - locked_at))
        if remain <= 0:
            with self._lock:
                self._state.pop(ip, None)
            return False, 0
        return True, remain

    def record_failure(self, ip: str) -> None:
        with self._lock:
            failures, locked_at = self._state.get(ip, (0, 0.0))
            failures += 1
            if failures >= MAX_FAILURES:
                locked_at = time.time()
            self._state[ip] = (failures, locked_at)

    def record_success(self, ip: str) -> None:
        with self._lock:
            self._state.pop(ip, None)


def load_credentials(path: Path) -> Optional[Dict[str, object]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "password" in data:
            return data
    except (OSError, ValueError):
        return None
    return None


def save_credentials(path: Path, record: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def generate_password(length: int = 16) -> str:
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
