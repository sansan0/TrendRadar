#!/usr/bin/env python3
# coding=utf-8
"""
Cloudflare Pages 部署推送自测脚本

用于在配置好凭证后，独立验证 Cloudflare Pages Direct Upload API 连通性与部署功能。
绝不硬编码任何密钥，由用户通过命令行参数、环境变量或配置文件提供。

使用方法:
  1. 直接使用命令行参数测试:
     uv run scripts/test_cloudflare_pages.py --account-id <ACCOUNT_ID> --api-token <API_TOKEN> --project-name <PROJECT_NAME>

  2. 或通过环境变量测试:
     export CLOUDFLARE_ACCOUNT_ID="your_account_id"
     export CLOUDFLARE_API_TOKEN="your_api_token"
     export CLOUDFLARE_PROJECT_NAME="your_project_name"
     uv run scripts/test_cloudflare_pages.py

  3. 或在 config/config.yaml 中配置 notification.channels.cloudflare_pages 后直接运行:
     uv run scripts/test_cloudflare_pages.py
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

from trendradar.notification.senders import send_to_cloudflare_pages


def main():
    parser = argparse.ArgumentParser(description="Cloudflare Pages 部署测试工具")
    parser.add_argument("--account-id", help="Cloudflare Account ID (或环境变量 CLOUDFLARE_ACCOUNT_ID)")
    parser.add_argument("--api-token", help="Cloudflare API Token (或环境变量 CLOUDFLARE_API_TOKEN)")
    parser.add_argument("--project-name", help="Cloudflare Pages 项目名称 (或环境变量 CLOUDFLARE_PROJECT_NAME)")
    parser.add_argument("--branch", default=None, help="目标分支 (可选，默认为主分支)")
    parser.add_argument("--html-file", default=None, help="待部署的 HTML 文件路径 (可选)")

    args = parser.parse_args()

    # 1. 尝试从命令行参数读取
    account_id = args.account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    api_token = args.api_token or os.environ.get("CLOUDFLARE_API_TOKEN", "")
    project_name = args.project_name or os.environ.get("CLOUDFLARE_PROJECT_NAME", "")
    branch = args.branch or os.environ.get("CLOUDFLARE_BRANCH", "")

    # 2. 如果未提供，尝试从 config/config.yaml 读取
    if not (account_id and api_token and project_name):
        try:
            import yaml
            config_file = PROJECT_ROOT / "config" / "config.yaml"
            if config_file.exists():
                with open(config_file, "r", encoding="utf-8") as f:
                    cfg_data = yaml.safe_load(f) or {}
                cf_cfg = cfg_data.get("notification", {}).get("channels", {}).get("cloudflare_pages", {})
                if isinstance(cf_cfg, dict):
                    account_id = account_id or str(cf_cfg.get("account_id") or "")
                    api_token = api_token or str(cf_cfg.get("api_token") or "")
                    project_name = project_name or str(cf_cfg.get("project_name") or "")
                    branch = branch or str(cf_cfg.get("branch") or "")
        except Exception as e:
            print(f"[提示] 读取配置文件异常: {e}")

    # 3. 校验必要凭据
    missing = []
    if not account_id:
        missing.append("account_id / CLOUDFLARE_ACCOUNT_ID")
    if not api_token:
        missing.append("api_token / CLOUDFLARE_API_TOKEN")
    if not project_name:
        missing.append("project_name / CLOUDFLARE_PROJECT_NAME")

    if missing:
        print("❌ 缺少必要配置：")
        for m in missing:
            print(f"   - {m}")
        print("\n使用示例:")
        print("  uv run scripts/test_cloudflare_pages.py --account-id <ID> --api-token <TOKEN> --project-name <PROJECT>")
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
            # 创建一个简短的测试页面
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
                tf.write("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>TrendRadar - Cloudflare Pages 测试部署</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
        .card { text-align: center; padding: 2rem 3rem; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
        h1 { margin-bottom: 0.5rem; color: #38bdf8; }
        p { color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <h1>TrendRadar 部署测试成功</h1>
        <p>该页面由 TrendRadar Cloudflare Pages 模块部署测试生成。</p>
    </div>
</body>
</html>
""")
                temp_file_path = tf.name
                html_file = temp_file_path
                temp_created = True

    print("==================================================")
    print("      TrendRadar - Cloudflare Pages 推送测试      ")
    print("==================================================")
    print(f"Account ID   : {account_id[:6]}***{account_id[-4:] if len(account_id) > 10 else ''}")
    print(f"API Token    : {api_token[:4]}***{api_token[-4:] if len(api_token) > 8 else ''}")
    print(f"Project Name : {project_name}")
    print(f"Branch       : {branch or '(默认)'}")
    print(f"HTML File    : {html_file}")
    print("==================================================")
    print("正在连接 Cloudflare API 并部署...")

    try:
        success = send_to_cloudflare_pages(
            account_id=account_id,
            api_token=api_token,
            project_name=project_name,
            html_file_path=html_file,
            branch=branch or None,
            commit_message="Test deployment from TrendRadar test script",
        )
        if success:
            print("\n🎉 测试成功！页面已成功部署至 Cloudflare Pages。")
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
