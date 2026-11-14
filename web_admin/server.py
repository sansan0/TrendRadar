# coding=utf-8
"""TrendRadar 管理台 HTTP 服务。

只用 Python 标准库实现，便于在最小化 VPS 上直接运行：
- 密码登录 + 会话 + CSRF + 登录限速
- 配置读写、原始 YAML / 关键词 / 提示词编辑
- 手动运行、日志、内置 cron 调度
- 托管 output/html 下的历史报告
"""

from __future__ import annotations

import ipaddress
import json
import mimetypes
import os
import posixpath
import ssl
import sys
import threading
import traceback
from datetime import datetime
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, unquote, urlparse

from . import auth, cron, runner, store, tls

STATIC_DIR = Path(__file__).resolve().parent / "static"
REPORT_ROOT = store.PROJECT_ROOT / "output" / "html"
MAX_BODY = 4 * 1024 * 1024
SESSION_COOKIE = "tr_session"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
}


def _json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _normalize_ip(value: str) -> str:
    value = (value or "").strip()
    if value.startswith("::ffff:"):
        value = value[7:]
    return value


def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def schedule_restart(delay: float = 2.0) -> None:
    """保存域名/HTTPS 配置后由 systemd 自动拉起，避免在请求线程内重启。"""

    def _exit() -> None:
        os._exit(0)

    timer = threading.Timer(delay, _exit)
    timer.daemon = True
    timer.start()


class AdminApp:
    def __init__(
        self, root: Path, host: str, port: int, *, tls_enabled: bool = False
    ) -> None:
        self.root = root
        self.host = host
        self.port = port
        self.tls = tls_enabled
        self.sessions = auth.SessionStore()
        self.limiter = auth.LoginLimiter()
        self.runner = runner.Runner(root)
        self.scheduler = runner.Scheduler(self.runner)
        self.credentials = self._ensure_credentials()

    # -- 凭据 ---------------------------------------------------------------

    def _ensure_credentials(self) -> Dict[str, object]:
        record = auth.load_credentials(store.CREDENTIALS_FILE)
        if record:
            return record
        password = os.environ.get("ADMIN_PASSWORD", "").strip()
        generated = not password
        if not password:
            password = auth.generate_password()
        record = {
            "username": "admin",
            "password": auth.hash_password(password),
            "created_at": _timestamp(),
        }
        auth.save_credentials(store.CREDENTIALS_FILE, record)
        if generated:
            print("=" * 62)
            print("  首次启动，已生成管理台登录密码：")
            print(f"  用户名: admin")
            print(f"  密码:   {password}")
            print(f"  凭据文件: {store.CREDENTIALS_FILE}")
            print("  请登录后立即修改密码。")
            print("=" * 62)
        return record

    def verify_password(self, password: str) -> bool:
        record = self.credentials.get("password")
        return isinstance(record, dict) and auth.verify_password(password, record)

    def verify_login(self, username: str, password: str) -> bool:
        expected = str(self.credentials.get("username") or "admin")
        return username == expected and self.verify_password(password)

    def update_password(self, new_password: str) -> None:
        self.credentials["password"] = auth.hash_password(new_password)
        self.credentials["updated_at"] = _timestamp()
        auth.save_credentials(store.CREDENTIALS_FILE, self.credentials)

    # -- 访问控制 -----------------------------------------------------------

    def ip_allowed(self, ip: str) -> bool:
        settings = store.load_settings()
        allow = settings.get("allow_ips") or []
        if not allow:
            return True
        candidate = _normalize_ip(ip)
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            return False
        for entry in allow:
            try:
                if "/" in str(entry):
                    if address in ipaddress.ip_network(str(entry), strict=False):
                        return True
                elif address == ipaddress.ip_address(str(entry)):
                    return True
            except ValueError:
                continue
        return False

    # -- 数据 ---------------------------------------------------------------

    def overview(self) -> Dict[str, Any]:
        try:
            data = store.read_config()
            summary = {
                "timezone": store.deep_get(data, "app.timezone"),
                "platform_enabled": store.deep_get(data, "platforms.enabled", True),
                "platform_count": len(
                    store.deep_get(data, "platforms.sources", []) or []
                ),
                "rss_enabled": store.deep_get(data, "rss.enabled", True),
                "rss_count": len(store.deep_get(data, "rss.feeds", []) or []),
                "report_mode": store.deep_get(data, "report.mode"),
                "filter_method": store.deep_get(data, "filter.method"),
                "ai_analysis": store.deep_get(data, "ai_analysis.enabled", False),
                "ai_translation": store.deep_get(data, "ai_translation.enabled", False),
                "schedule_enabled": store.deep_get(data, "schedule.enabled", False),
                "schedule_preset": store.deep_get(data, "schedule.preset"),
                "notification": store.deep_get(data, "notification.enabled", True),
                "channels": self._enabled_channels(data),
            }
            notes = store.validation_summary(data)
        except Exception as exc:
            summary = {}
            notes = [{"level": "error", "text": f"读取配置失败: {exc}"}]

        status = self.runner.status()
        reports = self._list_reports()[:6]
        logs = self.runner.list_logs(6)
        settings = store.load_settings()
        return {
            "project": store.project_info(),
            "summary": summary,
            "status": status,
            "notes": notes,
            "reports": reports,
            "logs": logs,
            "settings": settings,
            "security": {
                "host": self.host,
                "port": self.port,
                "tls": self.tls,
                "allow_ips": settings.get("allow_ips") or [],
                "scheme": "https" if self.tls else "http",
            },
        }

    @staticmethod
    def _enabled_channels(data: Dict[str, Any]) -> list:
        labels = []
        mapping = [
            ("feishu", "飞书", ["webhook_url"]),
            ("dingtalk", "钉钉", ["webhook_url"]),
            ("wework", "企业微信", ["webhook_url"]),
            ("telegram", "Telegram", ["bot_token", "chat_id"]),
            ("email", "邮件", ["from", "password", "to"]),
            ("ntfy", "ntfy", ["topic"]),
            ("bark", "Bark", ["url"]),
            ("slack", "Slack", ["webhook_url"]),
            ("generic_webhook", "通用 Webhook", ["webhook_url"]),
        ]
        for key, label, fields in mapping:
            channel = store.deep_get(data, f"notification.channels.{key}", {}) or {}
            if any(str(channel.get(name) or "").strip() for name in fields):
                labels.append(label)
        return labels

    def config_payload(self) -> Dict[str, Any]:
        data = store.read_config()
        values, hints = store.collect_values(data)
        stat = store.CONFIG_FILE.stat()
        return {
            "values": values,
            "hints": hints,
            "schema": store.SCHEMA,
            "notes": store.validation_summary(data),
            "meta": {
                "path": str(store.CONFIG_FILE),
                "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
                "size": stat.st_size,
            },
        }

    def save_config(self, submitted: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        if not isinstance(submitted, dict):
            return False, {"error": "请求体格式错误"}
        base = store.read_config()
        data, errors = store.apply_values(base, submitted)
        if errors:
            return False, {"error": "部分配置未通过校验", "errors": errors}
        backup = store.write_config(data)
        return True, {
            "saved_at": _timestamp(),
            "backup": Path(backup).name if backup else None,
            "notes": store.validation_summary(data),
        }

    # -- 报告 ---------------------------------------------------------------

    def _list_reports(self) -> list:
        if not REPORT_ROOT.exists():
            return []
        items = []
        for path in REPORT_ROOT.rglob("*.html"):
            try:
                stat = path.stat()
            except OSError:
                continue
            rel = path.relative_to(REPORT_ROOT).as_posix()
            items.append(
                {
                    "path": rel,
                    "name": path.name,
                    "date": rel.split("/")[0] if "/" in rel else "",
                    "size": stat.st_size,
                    "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
                    "mtime": stat.st_mtime,
                }
            )
        items.sort(key=lambda item: item["mtime"], reverse=True)
        for item in items:
            item.pop("mtime", None)
        return items[:300]

    def report_file(self, rel: str) -> Optional[Path]:
        root = REPORT_ROOT.resolve()
        candidate = (root / rel).resolve()
        if root not in candidate.parents and candidate != root:
            return None
        if not candidate.is_file():
            return None
        return candidate


class AdminHandler(BaseHTTPRequestHandler):
    server_version = "TrendRadarAdmin/1.0"
    protocol_version = "HTTP/1.1"

    @property
    def app(self) -> AdminApp:
        return self.server.app  # type: ignore[attr-defined]

    # -- 基础响应 -----------------------------------------------------------

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write(f"[{_timestamp()}] {self.address_string()} {fmt % args}\n")

    def _security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        self.send_header("Cache-Control", "no-store")

    def _send(
        self,
        status: int,
        body: bytes,
        content_type: str,
        extra: Optional[Dict[str, str]] = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._security_headers()
        if extra:
            for key, value in extra.items():
                self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(
        self, status: int, payload: Any, extra: Optional[Dict[str, str]] = None
    ) -> None:
        self._send(
            status, _json_bytes(payload), "application/json; charset=utf-8", extra
        )

    def send_error_json(self, status: int, message: str, **kwargs: Any) -> None:
        payload = {"ok": False, "error": message}
        payload.update(kwargs)
        self.send_json(status, payload)

    # -- 请求工具 -----------------------------------------------------------

    def client_ip(self) -> str:
        return _normalize_ip(self.client_address[0])

    def cookie_token(self) -> Optional[str]:
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        cookie = SimpleCookie()
        try:
            cookie.load(raw)
        except Exception:
            return None
        morsel = cookie.get(SESSION_COOKIE)
        return morsel.value if morsel else None

    def session(self):
        return self.app.sessions.get(self.cookie_token())

    def read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise ValueError("请求体过大")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise ValueError(f"JSON 解析失败: {exc}")
        if not isinstance(data, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return data

    def require_session(self):
        session = self.session()
        if not session:
            self.send_error_json(401, "请先登录")
            return None
        if not self.app.ip_allowed(self.client_ip()):
            self.send_error_json(403, "当前 IP 不在允许范围内")
            return None
        return session

    def require_csrf(self, session) -> bool:
        token = self.headers.get("X-CSRF-Token") or ""
        if not token or token != session.csrf:
            self.send_error_json(403, "CSRF 校验失败，请刷新页面后重试")
            return False
        return True

    # -- 路由 ---------------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802
        self._route("GET")

    def do_HEAD(self) -> None:  # noqa: N802
        self._route("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._route("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._route("PUT")

    def do_DELETE(self) -> None:  # noqa: N802
        self._route("DELETE")

    def _route(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)

        # ACME HTTP-01 校验文件不要求登录，也不能受 IP 白名单影响
        if path.startswith("/.well-known/acme-challenge/"):
            self._serve_acme_challenge(path)
            return

        if not self.app.ip_allowed(self.client_ip()):
            # 登录页也返回 JSON，前端显示为错误
            self.send_error_json(403, "当前 IP 不在允许范围内")
            return

        try:
            if path.startswith("/api/"):
                self._handle_api(method, path, query)
            elif path.startswith("/reports/"):
                self._serve_report(path)
            elif path in ("/", "/index.html"):
                self._serve_static("index.html")
            else:
                self._serve_static(path.lstrip("/"))
        except BrokenPipeError:
            pass
        except ValueError as exc:
            self.send_error_json(400, str(exc))
        except FileNotFoundError as exc:
            self.send_error_json(404, str(exc))
        except Exception as exc:
            sys.stderr.write(traceback.format_exc())
            self.send_error_json(500, f"服务器内部错误: {exc}")

    # -- API ----------------------------------------------------------------

    def _handle_api(self, method: str, path: str, query: Dict[str, list]) -> None:
        app = self.app
        if method == "GET" and path == "/api/health":
            self.send_json(
                200, {"ok": True, "service": "trendradar-admin", "time": _timestamp()}
            )
            return

        if method == "POST" and path == "/api/login":
            self._login()
            return

        if method == "GET" and path == "/api/session":
            session = self.require_session()
            if not session:
                return
            self.send_json(
                200,
                {
                    "ok": True,
                    "username": app.credentials.get("username", "admin"),
                    "csrf": session.csrf,
                    "version": store.project_info()["version"],
                },
            )
            return

        session = self.require_session()
        if not session:
            return

        if method == "POST" and path == "/api/logout":
            if not self.require_csrf(session):
                return
            app.sessions.delete(session.token)
            self.send_json(200, {"ok": True}, {"Set-Cookie": self._clear_cookie()})
            return

        if method == "GET" and path == "/api/overview":
            payload = app.overview()
            payload.setdefault("security", {})["current_ip"] = self.client_ip()
            self.send_json(200, {"ok": True, "data": payload})
            return

        if method == "GET" and path == "/api/config":
            self.send_json(200, {"ok": True, "data": app.config_payload()})
            return

        if method == "PUT" and path == "/api/config":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            positive, result = app.save_config(body.get("values") or {})
            if not positive:
                self.send_json(400, {"ok": False, **result})
            else:
                self.send_json(200, {"ok": True, **result})
            return

        if method == "GET" and path == "/api/files":
            items = []
            for name in store.TEXT_FILES:
                try:
                    meta = store.read_text(name)
                    items.append(
                        {
                            "name": name,
                            "label": meta["label"],
                            "kind": meta["kind"],
                            "path": meta["path"],
                            "size": meta["size"],
                            "updated_at": meta["updated_at"],
                        }
                    )
                except Exception:
                    continue
            self.send_json(200, {"ok": True, "data": items})
            return

        if method == "GET" and path == "/api/file":
            name = (query.get("name") or [""])[0]
            self.send_json(200, {"ok": True, "data": store.read_text(name)})
            return

        if method == "PUT" and path == "/api/file":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            name = str(body.get("name") or "")
            content = str(body.get("content") or "")
            if name not in store.TEXT_FILES:
                self.send_error_json(400, "不允许编辑该文件")
                return
            if len(content) > 2_000_000:
                self.send_error_json(400, "文件内容过大")
                return
            backup = store.write_text(name, content)
            self.send_json(
                200,
                {
                    "ok": True,
                    "saved_at": _timestamp(),
                    "backup": Path(backup).name if backup else None,
                },
            )
            return

        if method == "GET" and path == "/api/keywords":
            self.send_json(200, {"ok": True, "data": store.read_keywords()})
            return

        if method == "PUT" and path == "/api/keywords":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            if len(json.dumps(body, ensure_ascii=False)) > 2_000_000:
                self.send_error_json(400, "内容过大")
                return
            ok, result = store.save_keywords(body)
            if not ok:
                self.send_json(
                    400, {"ok": False, "error": "关键词未通过校验", **result}
                )
            else:
                self.send_json(200, {"ok": True, **result})
            return

        if method == "POST" and path == "/api/keywords/preview":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            content = str(body.get("content") or "")
            if len(content) > 2_000_000:
                self.send_error_json(400, "内容过大")
                return
            self.send_json(200, {"ok": True, "data": store.keyword_preview(content)})
            return

        if method == "GET" and path == "/api/run/status":
            self.send_json(200, {"ok": True, "data": app.runner.status()})
            return

        if method == "POST" and path == "/api/run":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            kind = str(body.get("kind") or "run")
            try:
                result = app.runner.start(kind)
            except ValueError as exc:
                self.send_error_json(400, str(exc))
                return
            if not result.get("ok"):
                self.send_error_json(409, result.get("error", "启动失败"))
            else:
                self.send_json(200, {"ok": True, **result})
            return

        if method == "POST" and path == "/api/run/stop":
            if not self.require_csrf(session):
                return
            result = app.runner.stop()
            if not result.get("ok"):
                self.send_error_json(409, result.get("error", "停止失败"))
            else:
                self.send_json(200, {"ok": True})
            return

        if method == "GET" and path == "/api/run/log":
            lines = int((query.get("lines") or ["200"])[0] or 200)
            self.send_json(200, {"ok": True, "data": app.runner.tail_current(lines)})
            return

        if method == "GET" and path == "/api/logs":
            self.send_json(200, {"ok": True, "data": app.runner.list_logs(60)})
            return

        if method == "GET" and path == "/api/log":
            name = (query.get("name") or [""])[0]
            lines = int((query.get("lines") or ["500"])[0] or 500)
            self.send_json(200, {"ok": True, "data": app.runner.read_log(name, lines)})
            return

        if method == "GET" and path == "/api/reports":
            self.send_json(200, {"ok": True, "data": app._list_reports()})
            return

        if method == "GET" and path == "/api/settings":
            settings = store.load_settings()
            valid, error = cron.validate(str(settings.get("cron") or ""))
            nxt = None
            if valid:
                next_dt = cron.next_run(str(settings.get("cron")), datetime.now())
                nxt = next_dt.strftime("%Y-%m-%d %H:%M") if next_dt else None
            self.send_json(
                200,
                {
                    "ok": True,
                    "data": {
                        **settings,
                        "cron_valid": valid,
                        "cron_error": error,
                        "cron_desc": runner.Runner._describe_safely(
                            str(settings.get("cron") or "")
                        ),
                        "next_run": nxt,
                    },
                },
            )
            return

        if method == "PUT" and path == "/api/settings":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            settings = store.load_settings()
            if "cron" in body:
                expr = str(body.get("cron") or "").strip()
                valid, error = cron.validate(expr)
                if not valid:
                    self.send_error_json(400, f"cron 表达式无效：{error}", field="cron")
                    return
                settings["cron"] = expr
            if "run_mode" in body:
                mode = str(body.get("run_mode") or "").strip()
                if mode not in ("cron", "off"):
                    self.send_error_json(400, "运行模式取值不合法", field="run_mode")
                    return
                settings["run_mode"] = mode
            if "immediate_run" in body:
                settings["immediate_run"] = bool(body.get("immediate_run"))
            if "allow_ips" in body:
                raw = body.get("allow_ips")
                if isinstance(raw, str):
                    entries = [
                        item.strip() for item in raw.replace("，", ",").split(",")
                    ]
                elif isinstance(raw, list):
                    entries = [str(item).strip() for item in raw]
                else:
                    entries = []
                entries = [item for item in entries if item]
                for entry in entries:
                    try:
                        ipaddress.ip_network(entry, strict=False)
                    except ValueError:
                        self.send_error_json(
                            400, f"IP 或网段格式无效：{entry}", field="allow_ips"
                        )
                        return
                if entries:
                    # 防止把自己锁在外面：当前 IP 必须落在白名单中
                    try:
                        current = ipaddress.ip_address(self.client_ip())
                        if not any(
                            current in ipaddress.ip_network(entry, strict=False)
                            for entry in entries
                        ):
                            self.send_error_json(
                                400,
                                "当前访问 IP 不在新白名单内，保存后将无法访问",
                                field="allow_ips",
                            )
                            return
                    except ValueError:
                        pass
                settings["allow_ips"] = entries
            store.save_settings(settings)
            self.send_json(
                200,
                {
                    "ok": True,
                    "saved_at": _timestamp(),
                    "settings": settings,
                    "next_run": (
                        cron.next_run(settings["cron"], datetime.now()).strftime(
                            "%Y-%m-%d %H:%M"
                        )
                        if cron.validate(settings["cron"])[0]
                        else None
                    ),
                },
            )
            return

        if method == "GET" and path == "/api/https":
            payload = tls.status_payload()
            payload["current"] = {
                "scheme": "https" if app.tls else "http",
                "port": app.port,
                "host": self.headers.get("Host", ""),
            }
            self.send_json(200, {"ok": True, "data": payload})
            return

        if method == "PUT" and path == "/api/https":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            settings = store.load_settings()
            enabled = bool(body.get("https_enabled", settings.get("https_enabled")))
            domain = tls.normalize_domain(
                str(body.get("domain") or settings.get("domain") or "")
            )
            if enabled or domain:
                valid_domain, domain_error = tls.validate_domain(domain)
                if not valid_domain:
                    self.send_error_json(400, domain_error, field="domain")
                    return
            settings["domain"] = domain
            if "https_cert" in body:
                settings["https_cert"] = str(body.get("https_cert") or "").strip()
            if "https_key" in body:
                settings["https_key"] = str(body.get("https_key") or "").strip()
            if "https_email" in body:
                settings["https_email"] = str(body.get("https_email") or "").strip()

            settings["https_enabled"] = enabled

            info = None
            if enabled:
                try:
                    cert_path = tls.resolve_path(str(settings.get("https_cert") or ""))
                    key_path = tls.resolve_path(str(settings.get("https_key") or ""))
                except ValueError as exc:
                    self.send_error_json(400, str(exc), field="https_cert")
                    return
                valid, errors, info = tls.validate_pair(cert_path, key_path, domain)
                if not valid:
                    self.send_json(
                        400,
                        {"ok": False, "error": "证书校验未通过", "errors": errors},
                    )
                    return

            store.save_settings(settings)
            apply_now = bool(body.get("apply"))
            if apply_now:
                schedule_restart()
            self.send_json(
                200,
                {
                    "ok": True,
                    "saved_at": _timestamp(),
                    "restart_scheduled": apply_now,
                    "cert": info,
                    "settings": {
                        key: settings[key]
                        for key in (
                            "domain",
                            "https_enabled",
                            "https_cert",
                            "https_key",
                            "https_email",
                        )
                    },
                },
            )
            return

        if method == "POST" and path == "/api/https/restart":
            if not self.require_csrf(session):
                return
            schedule_restart()
            self.send_json(200, {"ok": True, "restart_scheduled": True})
            return

        if method == "POST" and path == "/api/password":
            if not self.require_csrf(session):
                return
            body = self.read_json()
            old = str(body.get("old_password") or "")
            new = str(body.get("new_password") or "")
            if not app.verify_password(old):
                self.send_error_json(400, "原密码不正确", field="old_password")
                return
            if len(new) < 10:
                self.send_error_json(400, "新密码至少 10 位", field="new_password")
                return
            app.update_password(new)
            self.send_json(
                200, {"ok": True, "message": "密码已更新，请使用新密码重新登录"}
            )
            return

        self.send_error_json(404, "接口不存在")

    # -- 登录 ---------------------------------------------------------------

    def _login(self) -> None:
        ip = self.client_ip()
        locked, remain = self.app.limiter.is_locked(ip)
        if locked:
            self.send_error_json(429, f"尝试次数过多，请 {remain} 秒后再试")
            return
        body = self.read_json()
        username = str(body.get("username") or "").strip()
        password = str(body.get("password") or "")
        if not username:
            self.send_error_json(400, "请输入用户名")
            return
        if not password:
            self.send_error_json(400, "请输入密码")
            return
        if not self.app.verify_login(username, password):
            self.app.limiter.record_failure(ip)
            self.send_error_json(401, "用户名或密码不正确")
            return
        self.app.limiter.record_success(ip)
        session = self.app.sessions.create(ip)
        cookie = f"{SESSION_COOKIE}={session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={auth.SESSION_TTL}"
        if self.app.tls:
            cookie += "; Secure"
        self.send_json(
            200,
            {
                "ok": True,
                "csrf": session.csrf,
                "username": self.app.credentials.get("username", "admin"),
            },
            {"Set-Cookie": cookie},
        )

    @staticmethod
    def _clear_cookie() -> str:
        return f"{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"

    # -- ACME 校验与静态文件 ------------------------------------------------

    def _serve_acme_challenge(self, path: str) -> None:
        token = path.rsplit("/", 1)[-1]
        target = store.acme_challenge_file(token)
        if not target:
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        try:
            body = target.read_bytes()
        except OSError:
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        self._send(200, body, "text/plain; charset=utf-8")

    def _serve_static(self, rel: str) -> None:
        rel = posixpath.normpath("/" + rel).lstrip("/")
        if not rel or rel.startswith(".."):
            rel = "index.html"
        candidate = (STATIC_DIR / rel).resolve()
        if (
            STATIC_DIR.resolve() not in candidate.parents
            and candidate != STATIC_DIR.resolve()
        ):
            self.send_error_json(404, "文件不存在")
            return
        if not candidate.is_file():
            self.send_error_json(404, "文件不存在")
            return
        content_type = (
            CONTENT_TYPES.get(candidate.suffix.lower())
            or mimetypes.guess_type(candidate.name)[0]
            or "application/octet-stream"
        )
        body = candidate.read_bytes()
        headers = {}
        if candidate.suffix.lower() == ".html":
            headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
            )
        self._send(200, body, content_type, headers)

    def _serve_report(self, path: str) -> None:
        session = self.session()
        if not session:
            self.send_error_json(401, "请先登录")
            return
        rel = unquote(path[len("/reports/") :])
        target = self.app.report_file(rel)
        if not target:
            self.send_error_json(404, "报告不存在")
            return
        content_type = (
            CONTENT_TYPES.get(target.suffix.lower()) or "application/octet-stream"
        )
        body = target.read_bytes()
        extra = {
            "Content-Security-Policy": (
                "default-src 'self' 'unsafe-inline' data: https:; script-src 'self' 'unsafe-inline' https:; "
                "img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:"
            )
        }
        self._send(200, body, content_type, extra)


class AdminServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: Tuple[str, int], app: AdminApp) -> None:
        self.app = app
        super().__init__(address, AdminHandler)


def create_server(
    app: AdminApp, host: str, port: int, cert: Optional[str], key: Optional[str]
) -> AdminServer:
    server = AdminServer((host, port), app)
    if cert and key:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(certfile=cert, keyfile=key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        app.tls = True
    return server
