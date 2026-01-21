# coding=utf-8
"""
TrendRadar AI 模块

提供 AI 大模型对热点新闻的深度分析和翻译功能
"""

from .analyzer import AIAnalyzer, AIAnalysisResult
from .translator import AITranslator, TranslationResult, BatchTranslationResult
from .formatter import (
    get_ai_analysis_renderer,
    render_ai_analysis_markdown,
    render_ai_analysis_feishu,
    render_ai_analysis_dingtalk,
    render_ai_analysis_html,
    render_ai_analysis_html_rich,
    render_ai_analysis_plain,
)

__all__ = [
    # 分析器
    "AIAnalyzer",
    "AIAnalysisResult",
    # 翻译器
    "AITranslator",
    "TranslationResult",
    "BatchTranslationResult",
    # 格式化
    "get_ai_analysis_renderer",
    "render_ai_analysis_markdown",
    "render_ai_analysis_feishu",
    "render_ai_analysis_dingtalk",
    "render_ai_analysis_html",
    "render_ai_analysis_html_rich",
    "render_ai_analysis_plain",
]
