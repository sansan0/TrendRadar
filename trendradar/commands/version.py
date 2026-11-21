# coding=utf-8
"""版本检查命令"""

import re
from pathlib import Path
from typing import Dict, Optional, Tuple

from trendradar import __version__
from trendradar.core.cdn import fetch_with_fallback


def _parse_version(version_str: str) -> Tuple[int, int, int]:
    try:
        parts = version_str.strip().split(".")
        if len(parts) >= 3:
            return int(parts[0]), int(parts[1]), int(parts[2])
        return 0, 0, 0
    except (ValueError, AttributeError, TypeError):
        return 0, 0, 0


def _compare_version(local: str, remote: str) -> str:
    local_tuple = _parse_version(local)
    remote_tuple = _parse_version(remote)

    if local_tuple < remote_tuple:
        return "⚠️ 需要更新"
    elif local_tuple > remote_tuple:
        return "🔮 超前版本"
    else:
        return "✅ 已是最新"


def _fetch_remote_version(version_url: str, proxy_url: Optional[str] = None) -> Optional[str]:
    return fetch_with_fallback(version_url, proxy_url)


def _parse_config_versions(content: str) -> Dict[str, str]:
    versions = {}
    try:
        if not content:
            return versions
        for line in content.splitlines():
            line = line.strip()
            if not line or "=" not in line:
                continue
            name, version = line.split("=", 1)
            versions[name.strip()] = version.strip()
    except Exception as e:
        print(f"[版本检查] 解析配置版本失败: {e}")
    return versions


def check_all_versions(
    version_url: str,
    configs_version_url: Optional[str] = None,
    proxy_url: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    统一版本检查：程序版本 + 配置文件版本

    Returns:
        (need_update, remote_version): 程序是否需要更新及远程版本号
    """
    remote_version = _fetch_remote_version(version_url, proxy_url)

    remote_config_versions = {}
    if configs_version_url:
        content = _fetch_remote_version(configs_version_url, proxy_url)
        if content:
            remote_config_versions = _parse_config_versions(content)

    print("=" * 60)
    print("版本检查")
    print("=" * 60)

    if remote_version:
        print(f"远程程序版本: {remote_version}")
    else:
        print("远程程序版本: 获取失败")

    if configs_version_url:
        if remote_config_versions:
            print(f"远程配置清单: 获取成功 ({len(remote_config_versions)} 个文件)")
        else:
            print("远程配置清单: 获取失败或为空")

    print("-" * 60)

    program_status = _compare_version(__version__, remote_version) if remote_version else "(无法比较)"
    print(f"  主程序版本: {__version__} {program_status}")

    config_files = [
        Path("config/config.yaml"),
        Path("config/timeline.yaml"),
        Path("config/frequency_words.txt"),
        Path("config/search_queries.txt"),
        Path("config/ai_interests.txt"),
        Path("config/ai_analysis_prompt.txt"),
        Path("config/ai_translation_prompt.txt"),
    ]

    version_pattern = re.compile(r"Version:\s*(\d+\.\d+\.\d+)", re.IGNORECASE)

    for config_file in config_files:
        if not config_file.exists():
            print(f"  {config_file.name}: 文件不存在")
            continue

        try:
            with open(config_file, "r", encoding="utf-8") as f:
                local_version = None
                for i, line in enumerate(f):
                    if i >= 20:
                        break
                    match = version_pattern.search(line)
                    if match:
                        local_version = match.group(1)
                        break

                target_remote_version = remote_config_versions.get(config_file.name)

                if local_version:
                    if target_remote_version:
                        status = _compare_version(local_version, target_remote_version)
                        print(f"  {config_file.name}: {local_version} {status}")
                    else:
                        print(f"  {config_file.name}: {local_version} (未找到远程版本)")
                else:
                    print(f"  {config_file.name}: 未找到本地版本号")
        except Exception as e:
            print(f"  {config_file.name}: 读取失败 - {e}")

    print("=" * 60)

    if remote_version:
        need_update = _parse_version(__version__) < _parse_version(remote_version)
        return need_update, remote_version if need_update else None
    return False, None
