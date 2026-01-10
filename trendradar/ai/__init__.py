# coding=utf-8
"""
TrendRadar AI 分析模块

提供 AI 大模型对热点新闻的深度分析功能
"""

from .analyzer import AIAnalyzer, AIAnalysisResult
from .formatter import (
    get_ai_analysis_renderer,
    render_ai_analysis_markdown,
    render_ai_analysis_feishu,
    render_ai_analysis_dingtalk,
    render_ai_analysis_html,
    render_ai_analysis_plain,
)

__all__ = [
    "AIAnalyzer",
    "AIAnalysisResult",
    "get_ai_analysis_renderer",
    "render_ai_analysis_markdown",
    "render_ai_analysis_feishu",
    "render_ai_analysis_dingtalk",
    "render_ai_analysis_html",
    "render_ai_analysis_plain",
]
