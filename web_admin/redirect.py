# coding=utf-8
"""HTTP → HTTPS 跳转服务。

与主管理台同进程运行：
- 普通请求 301 到 https://<host>[:port]/<path>
- /.well-known/acme-challenge/ 直接返回校验文件，保证证书初次签发与续期不中断
"""

from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Optional, Tuple
from urllib.parse import unquote, urlparse

from . import store


class RedirectHandler(BaseHTTPRequestHandler):
    server_version = "TrendRadarRedirect/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        # 跳转请求量大时避免刷屏，只在异常时输出
        return

    def do_GET(self) -> None:  # noqa: N802
        self._handle()

    def do_HEAD(self) -> None:  # noqa: N802
        self._handle()

    def _handle(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path.startswith("/.well-known/acme-challenge/"):
            self._serve_acme(path)
            return

        configured_domain = str(getattr(self.server, "domain", "") or "").strip()
        host = configured_domain
        if not host:
            host = (self.headers.get("Host") or "").strip()
            if host.startswith("["):
                # IPv6 字面量，保留方括号
                end = host.find("]")
                host = host[: end + 1] if end > 0 else host
            elif ":" in host:
                host = host.split(":", 1)[0]
            if not host:
                host = str(self.server.server_address[0])

        port = int(getattr(self.server, "https_port", 443))
        suffix = "" if port == 443 else f":{port}"
        location = f"https://{host}{suffix}{self.path}"

        self.send_response(301)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _serve_acme(self, path: str) -> None:
        token = path.rsplit("/", 1)[-1]
        target = store.acme_challenge_file(token)
        if not target:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        try:
            body = target.read_bytes()
        except OSError:
            body = b""
        self.send_response(200 if body else 404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


class _RedirectServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_redirect_server(
    http_port: int,
    https_port: int = 443,
    host: str = "0.0.0.0",
    domain: str = "",
) -> Tuple[_RedirectServer, Thread]:
    server = _RedirectServer((host, http_port), RedirectHandler)
    server.https_port = https_port  # type: ignore[attr-defined]
    server.domain = domain  # type: ignore[attr-defined]
    thread = Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.5}, daemon=True
    )
    thread.start()
    return server, thread
