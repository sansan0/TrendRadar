#!/usr/bin/env python3
# coding=utf-8
"""
Cloudflare Worker (Static Assets) 部署推送自测脚本

用于在配置好凭证后，独立验证 Cloudflare Workers Direct Upload API 连通性与网页部署功能。
绝不硬编码任何密钥，由用户通过命令行参数、环境变量或配置文件提供。

使用方法:
  1. 直接使用命令行参数测试:
     uv run scripts/test_cloudflare_worker.py --account-id <ACCOUNT_ID> --api-token <API_TOKEN> --worker-name <WORKER_NAME>

  2. 或通过环境变量测试:
     export CLOUDFLARE_ACCOUNT_ID="your_account_id"
     export CLOUDFLARE_API_TOKEN="your_api_token"
     export CLOUDFLARE_WORKER_NAME="your_worker_name"
     uv run scripts/test_cloudflare_worker.py

  3. 或在 config/config.yaml 中配置 notification.channels.cloudflare_worker 后直接运行:
     uv run scripts/test_cloudflare_worker.py
"""

import argparse
import os
import sys
import tempfile
from pathlib import Path

# 添加项目根目录到 sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from trendradar.notification.senders import send_to_cloudflare_worker


def main():
    parser = argparse.ArgumentParser(description="Cloudflare Worker (Static Assets) 部署测试工具")
    parser.add_argument("--account-id", help="Cloudflare Account ID (或环境变量 CLOUDFLARE_WORKER_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID)")
    parser.add_argument("--api-token", help="Cloudflare API Token (或环境变量 CLOUDFLARE_WORKER_API_TOKEN / CLOUDFLARE_API_TOKEN)")
    parser.add_argument("--worker-name", help="Cloudflare Worker 服务名称 (或环境变量 CLOUDFLARE_WORKER_NAME)")
    parser.add_argument("--html-file", default=None, help="待部署的 HTML 文件路径 (可选)")

    args = parser.parse_args()

    # 1. 尝试从命令行参数与环境变量读取
    account_id = (
        args.account_id
        or os.environ.get("CLOUDFLARE_WORKER_ACCOUNT_ID", "")
        or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    )
    api_token = (
        args.api_token
        or os.environ.get("CLOUDFLARE_WORKER_API_TOKEN", "")
        or os.environ.get("CLOUDFLARE_API_TOKEN", "")
    )
    worker_name = args.worker_name or os.environ.get("CLOUDFLARE_WORKER_NAME", "")

    # 2. 如果未提供，尝试从 config/config.yaml 读取
    if not (account_id and api_token and worker_name):
        try:
            import yaml
            config_file = PROJECT_ROOT / "config" / "config.yaml"
            if config_file.exists():
                with open(config_file, "r", encoding="utf-8") as f:
                    cfg_data = yaml.safe_load(f) or {}
                channels = cfg_data.get("notification", {}).get("channels", {})
                cf_worker = channels.get("cloudflare_worker", {})
                cf_pages = channels.get("cloudflare_pages", {})

                if isinstance(cf_worker, dict):
                    worker_name = worker_name or str(cf_worker.get("worker_name") or cf_worker.get("script_name") or "")
                    account_id = account_id or str(cf_worker.get("account_id") or "")
                    api_token = api_token or str(cf_worker.get("api_token") or "")

                if not account_id and isinstance(cf_pages, dict):
                    account_id = str(cf_pages.get("account_id") or "")
                if not api_token and isinstance(cf_pages, dict):
                    api_token = str(cf_pages.get("api_token") or "")
        except Exception as e:
            print(f"[提示] 读取配置文件异常: {e}")

    # 3. 校验必要凭据
    missing = []
    if not account_id:
        missing.append("account_id / CLOUDFLARE_ACCOUNT_ID")
    if not api_token:
        missing.append("api_token / CLOUDFLARE_API_TOKEN")
    if not worker_name:
        missing.append("worker_name / CLOUDFLARE_WORKER_NAME")

    if missing:
        print("❌ 缺少必要配置：")
        for m in missing:
            print(f"   - {m}")
        print("\n使用示例:")
        print("  uv run scripts/test_cloudflare_worker.py --account-id <ID> --api-token <TOKEN> --worker-name <WORKER>")
        sys.exit(1)

    # 4. 确定要部署的 HTML 文件
    html_file = args.html_file
    temp_created = False
    temp_file_path = None

    if not html_file:
        default_output = PROJECT_ROOT / "output" / "index.html"
        root_index = PROJECT_ROOT / "index.html"
        if default_output.exists():
            html_file = str(default_output)
        elif root_index.exists():
            html_file = str(root_index)
        else:
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
                tf.write("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>TrendRadar - Cloudflare Worker 测试部署</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b0f19; color: #f8fafc; }
        .card { text-align: center; padding: 2.5rem 3.5rem; background: #111827; border-radius: 12px; border: 1px solid #1f2937; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { margin-bottom: 0.5rem; color: #f97316; font-size: 1.75rem; }
        p { color: #9ca3af; margin: 0.5rem 0 0; }
        .badge { display: inline-block; margin-top: 1.25rem; padding: 0.25rem 0.75rem; border-radius: 9999px; background: rgba(249, 115, 22, 0.15); color: #fb923c; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Cloudflare Worker 部署成功</h1>
        <p>该静态报告由 TrendRadar 自动通过 Workers Static Assets 部署生成。</p>
        <div class="badge">Workers Runtime & Edge Assets</div>
    </div>
</body>
</html>
""")
                temp_file_path = tf.name
                html_file = temp_file_path
                temp_created = True

    print("==================================================")
    print("      TrendRadar - Cloudflare Worker 推送测试      ")
    print("==================================================")
    print(f"Account ID   : {account_id[:6]}***{account_id[-4:] if len(account_id) > 10 else ''}")
    print(f"API Token    : {api_token[:4]}***{api_token[-4:] if len(api_token) > 8 else ''}")
    print(f"Worker Name  : {worker_name}")
    print(f"HTML File    : {html_file}")
    print("==================================================")
    print("正在连接 Cloudflare API 并部署...")

    try:
        success = send_to_cloudflare_worker(
            account_id=account_id,
            api_token=api_token,
            script_name=worker_name,
            html_file_path=html_file,
        )
        if success:
            print("\n🎉 测试成功！页面已成功部署至 Cloudflare Worker。")
        else:
            print("\n❌ 部署失败，请检查上方日志信息及 Cloudflare API Token 权限。")
            sys.exit(1)
    finally:
        if temp_created and temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass


if __name__ == "__main__":
    main()
