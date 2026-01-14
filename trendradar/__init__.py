# coding=utf-8
"""
TrendRadar - 热点新闻聚合与分析工具

使用方式:
  python -m trendradar        # 模块执行
  trendradar                  # 安装后执行
"""

from pathlib import Path

from trendradar.context import AppContext


def _get_version() -> str:
    """Get version from version file or fallback to default."""
    # Try to find version file in project root
    for parent in [Path(__file__).parent.parent, Path("/app")]:
        version_file = parent / "version"
        if version_file.exists():
            return version_file.read_text().strip()
    return "5.0.0"  # Fallback


__version__ = _get_version()
__all__ = ["AppContext", "__version__"]
