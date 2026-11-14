# coding=utf-8
"""TrendRadar 管理台入口。

用法:
    python -m web_admin --port 8080
    python -m web_admin --port 443 --cert /path/fullchain.pem --key /path/privkey.pem
    python -m web_admin --set-password '新的强密码'
"""

from __future__ import annotations

import argparse
import signal
import sys
from datetime import datetime
from pathlib import Path

from . import auth, redirect, store, tls
from .server import AdminApp, create_server


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TrendRadar Web 管理台")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认 0.0.0.0")
    parser.add_argument("--port", type=int, default=8080, help="监听端口，默认 8080")
    parser.add_argument("--cert", default="", help="TLS 证书路径（PEM）")
    parser.add_argument("--key", default="", help="TLS 私钥路径（PEM）")
    parser.add_argument(
        "--http-port",
        type=int,
        default=0,
        help="HTTP 自动跳转到 HTTPS 的端口（默认 0 表示不启用，常用 80）",
    )
    parser.add_argument(
        "--https-port",
        type=int,
        default=443,
        help="启用 HTTPS 时监听的端口，默认 443",
    )
    parser.add_argument(
        "--settings-tls",
        action="store_true",
        help="按管理台保存的域名与证书设置启动 HTTPS",
    )
    parser.add_argument("--set-password", default="", help="设置管理员密码后退出")
    parser.add_argument("--print-password", action="store_true", help=argparse.SUPPRESS)
    return parser


def _set_password(password: str) -> int:
    if len(password) < 10:
        print("密码至少需要 10 位。", file=sys.stderr)
        return 2
    record = auth.load_credentials(store.CREDENTIALS_FILE) or {"username": "admin"}
    record["password"] = auth.hash_password(password)
    record["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    auth.save_credentials(store.CREDENTIALS_FILE, record)
    print(f"管理员密码已更新：{store.CREDENTIALS_FILE}")
    return 0


def main(argv: list | None = None) -> int:
    args = _build_parser().parse_args(argv)

    store.DATA_DIR.mkdir(parents=True, exist_ok=True)
    store.LOG_DIR.mkdir(parents=True, exist_ok=True)
    store.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    if not store.CONFIG_FILE.exists():
        print(f"未找到配置文件：{store.CONFIG_FILE}", file=sys.stderr)
        print("请在项目根目录运行，或先复制 config/config.yaml 模板。", file=sys.stderr)
        return 1

    if args.set_password:
        return _set_password(args.set_password)

    app = AdminApp(store.PROJECT_ROOT, args.host, args.port)
    settings = store.load_settings()
    domain = str(settings.get("domain") or "").strip()

    https_cert = args.cert or None
    https_key = args.key or None
    if args.settings_tls and not (args.cert and args.key):
        if settings.get("https_enabled"):
            try:
                cert_path = tls.resolve_path(str(settings.get("https_cert") or ""))
                key_path = tls.resolve_path(str(settings.get("https_key") or ""))
                valid, errors, _info = tls.validate_pair(cert_path, key_path, domain)
            except ValueError as exc:
                valid, errors = False, [str(exc)]
            if valid:
                https_cert, https_key = str(cert_path), str(key_path)
                app.port = args.https_port
            else:
                app.port = args.port
                print("  HTTPS 配置不可用，暂以 HTTP 启动：" + "；".join(errors))
        else:
            app.port = args.port
    else:
        app.port = args.port

    server = create_server(app, args.host, app.port, https_cert, https_key)
    app.scheduler.start()

    redirect_server = None
    if args.http_port:
        if app.tls:
            redirect_server, _ = redirect.start_redirect_server(
                args.http_port, app.port, args.host, domain
            )
        else:
            print("  提示: 未启用 TLS，--http-port 已忽略。")

    scheme = "https" if app.tls else "http"
    display_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    if app.tls and domain:
        display_host = domain
    port_suffix = "" if app.tls and app.port == 443 else f":{app.port}"
    print("")
    print("  TrendRadar 管理台已启动")
    print(f"  本地访问: {scheme}://{display_host}{port_suffix}/")
    if args.host in ("0.0.0.0", "::"):
        public_host = domain if (app.tls and domain) else "<服务器公网IP>"
        print(f"  公网访问: {scheme}://{public_host}{port_suffix}/")
    print(f"  凭据文件: {store.CREDENTIALS_FILE}")
    if not app.tls:
        print(
            "  安全提示: 当前为 HTTP 明文访问，可在「系统设置 → 域名与 HTTPS」中启用证书。"
        )
    if redirect_server is not None:
        target = f"https://{domain}" if domain else "HTTPS"
        print(f"  HTTP 跳转: {args.http_port} 端口自动跳转到 {target}")
    print("  按 Ctrl+C 停止服务")
    print("")

    def _shutdown(signum, frame):  # noqa: ARG001
        print("\n正在停止管理台...")
        app.scheduler.stop()
        server.shutdown()

    signal.signal(signal.SIGINT, _shutdown)
    try:
        signal.signal(signal.SIGTERM, _shutdown)
    except (AttributeError, ValueError):
        pass

    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        if redirect_server is not None:
            redirect_server.shutdown()
            redirect_server.server_close()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
