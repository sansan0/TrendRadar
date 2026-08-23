# coding=utf-8
"""
TrendRadar - 热点新闻聚合与分析工具

使用方式:
  python -m trendradar        # 模块执行
  trendradar                  # 安装后执行
"""

import sys as _sys


def _configure_utf8_stdio() -> None:
    """强制 stdout/stderr 使用 UTF-8 输出。

    Windows 控制台默认编码可能是 GBK，直接用 print 输出 emoji（如 ✅/❌）
    会抛 UnicodeEncodeError 导致程序崩溃。这里在包初始化时统一将标准输出
    改为 UTF-8，Windows 与 Linux（Ubuntu 上默认即 UTF-8）均适用，且无副作用。
    errors=backslashreplace 保证极端情况下不丢信息（用 \\uXXXX 转义代替报错）。
    line_buffering 使日志在重定向到文件时也能实时落盘。
    """
    for _name in ("stdout", "stderr"):
        _stream = getattr(_sys, _name, None)
        _reconfigure = getattr(_stream, "reconfigure", None)
        if _reconfigure is None:
            continue
        try:
            _reconfigure(encoding="utf-8", errors="backslashreplace", line_buffering=True)
        except (ValueError, OSError):
            pass


_configure_utf8_stdio()

from trendradar.context import AppContext

__version__ = "6.10.0"
__all__ = ["AppContext", "__version__"]
