# coding=utf-8
"""
HTML AI Analysis Extension

Adds AI-powered analysis section to HTML reports.
Uses the same AI analyzer as notifications but injects results into HTML.
"""

import re
from typing import Any, Dict, List, Optional

from loguru import logger

from extensions.base import ReportDataTransform, HTMLRenderHook


class HTMLAIAnalysisPlugin(ReportDataTransform, HTMLRenderHook):
    """
    Plugin that adds AI analysis to HTML reports.

    This plugin:
    1. During transform: Runs AI analysis on report data
    2. After render: Injects the analysis HTML at the top of the report
    """

    _name = "html_ai_analysis"
    _version = "1.0.0"

    def __init__(self):
        self._enabled = False
        self.config: Dict[str, Any] = {}
        self._ai_result = None  # Store AI analysis result

    @property
    def name(self) -> str:
        return self._name

    @property
    def version(self) -> str:
        return self._version

    @property
    def enabled(self) -> bool:
        return self._enabled

    def apply_config(self, config: Dict[str, Any]) -> None:
        """Apply plugin configuration."""
        self.config = config or {}
        self._enabled = self.config.get("enabled", False)

    def transform(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """
        Transform phase: Run AI analysis and store result.

        Args:
            report_data: Report data dictionary
            config: Plugin configuration
            context: Application context (AppContext instance)

        Returns:
            Unchanged report data (analysis stored internally)
        """
        merged_config = {**self.config, **config}
        if not merged_config.get("enabled"):
            return report_data

        # Check if main AI analysis is enabled
        app_config = getattr(context, 'config', {})
        ai_config = app_config.get("AI_ANALYSIS", {})
        if not ai_config.get("ENABLED", False):
            logger.warning("[html_ai_analysis] Main AI_ANALYSIS is disabled, skipping")
            return report_data

        stats = report_data.get("stats", [])
        if not stats:
            logger.debug("[html_ai_analysis] No stats to analyze")
            return report_data

        logger.info("[html_ai_analysis] Running AI analysis for HTML report...")

        try:
            from trendradar.ai.analyzer import AIAnalyzer

            # Create analyzer with same config as main app
            analyzer = AIAnalyzer(ai_config, context.get_time)

            # Get platforms and keywords from context
            platforms = list(getattr(context, 'platform_ids', []))
            keywords = [s.get("word", "") for s in stats if s.get("word")]

            # Run analysis
            result = analyzer.analyze(
                stats=stats,
                rss_stats=None,  # RSS handled separately if needed
                report_mode=merged_config.get("report_mode", "daily"),
                report_type=merged_config.get("report_type", "HTML Report"),
                platforms=platforms,
                keywords=keywords,
            )

            if result.success:
                self._ai_result = result
                logger.info("[html_ai_analysis] AI analysis completed successfully")
            else:
                logger.warning("[html_ai_analysis] AI analysis failed: {}", result.error)
                self._ai_result = None

        except Exception as e:
            logger.error("[html_ai_analysis] Error running AI analysis: {}", e)
            self._ai_result = None

        return report_data

    def before_render(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Optional[Dict[str, Any]]:
        """Not used by this plugin."""
        return None

    def after_render(
        self,
        html_content: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        """
        Post-process HTML to inject AI analysis section at the top.

        Args:
            html_content: Rendered HTML string
            config: Plugin configuration
            context: Application context

        Returns:
            Modified HTML with AI analysis section
        """
        merged_config = {**self.config, **config}
        if not merged_config.get("enabled"):
            return html_content

        if not self._ai_result or not self._ai_result.success:
            return html_content

        logger.debug("[html_ai_analysis] Injecting AI analysis into HTML")

        # Build AI analysis HTML section
        ai_html = self._build_ai_section(self._ai_result, merged_config)

        # Inject CSS if not present
        if ".ai-analysis" not in html_content:
            css = self._get_css(merged_config)
            html_content = html_content.replace("</style>", css + "\n</style>", 1)

        # Find insertion point: after the header block, before main content
        # The header ends with </div> and content starts with <div class="content">
        # Insert AI analysis between them

        # Pattern 1: After header, before content div
        pattern = r'(</div>\s*)(<div class="content">)'
        if re.search(pattern, html_content):
            html_content = re.sub(
                pattern,
                r'\1\n' + ai_html + r'\n            \2',
                html_content,
                count=1
            )
        else:
            # Fallback: after container start
            pattern = r'(<div class="container[^"]*">)'
            html_content = re.sub(pattern, r'\1\n' + ai_html, html_content, count=1)

        # Clear result after use
        self._ai_result = None

        return html_content

    def _build_ai_section(self, result, config: Dict[str, Any]) -> str:
        """Build HTML section for AI analysis."""
        sections = []

        # Title
        title = config.get("section_title", "AI Analysis")
        sections.append(f'<div class="ai-analysis">')
        sections.append(f'<h2 class="ai-title">{_html_escape(title)}</h2>')

        # Stats bar
        if result.analyzed_news > 0:
            stats_text = f"Analyzed {result.analyzed_news} of {result.total_news} news items"
            if result.hotlist_count > 0:
                stats_text += f" (Hotlist: {result.hotlist_count}"
            if result.rss_count > 0:
                stats_text += f", RSS: {result.rss_count}"
            if result.hotlist_count > 0 or result.rss_count > 0:
                stats_text += ")"
            sections.append(f'<div class="ai-stats">{stats_text}</div>')

        # Summary
        if result.summary:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Summary</h3>')
            sections.append(f'<p>{_html_escape(result.summary)}</p>')
            sections.append(f'</div>')

        # Keyword Analysis
        if result.keyword_analysis:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Keyword Analysis</h3>')
            sections.append(f'<p>{_html_escape(result.keyword_analysis)}</p>')
            sections.append(f'</div>')

        # Sentiment
        if result.sentiment:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Sentiment</h3>')
            sections.append(f'<p>{_html_escape(result.sentiment)}</p>')
            sections.append(f'</div>')

        # Cross-platform
        if result.cross_platform:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Cross-platform Trends</h3>')
            sections.append(f'<p>{_html_escape(result.cross_platform)}</p>')
            sections.append(f'</div>')

        # Impact
        if result.impact:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Potential Impact</h3>')
            sections.append(f'<p>{_html_escape(result.impact)}</p>')
            sections.append(f'</div>')

        # Signals
        if result.signals:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Signals to Watch</h3>')
            sections.append(f'<p>{_html_escape(result.signals)}</p>')
            sections.append(f'</div>')

        # Conclusion
        if result.conclusion:
            sections.append(f'<div class="ai-section">')
            sections.append(f'<h3>Conclusion</h3>')
            sections.append(f'<p>{_html_escape(result.conclusion)}</p>')
            sections.append(f'</div>')

        # If no structured content, show raw response
        if not any([result.summary, result.keyword_analysis, result.sentiment,
                    result.cross_platform, result.impact, result.signals, result.conclusion]):
            if result.raw_response:
                sections.append(f'<div class="ai-section">')
                sections.append(f'<pre class="ai-raw">{_html_escape(result.raw_response[:2000])}</pre>')
                sections.append(f'</div>')

        sections.append('</div>')

        return '\n'.join(sections)

    def _get_css(self, config: Dict[str, Any]) -> str:
        """Get CSS styles for AI analysis section."""
        accent_color = config.get("accent_color", "#6366f1")
        bg_color = config.get("background_color", "#f8fafc")

        return f"""
        .ai-analysis {{
            background: {bg_color};
            border: 1px solid #e2e8f0;
            border-left: 4px solid {accent_color};
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }}
        .ai-title {{
            color: {accent_color};
            font-size: 1.5rem;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .ai-title::before {{
            content: "🤖";
        }}
        .ai-stats {{
            color: #64748b;
            font-size: 0.875rem;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
        }}
        .ai-section {{
            margin-bottom: 16px;
        }}
        .ai-section:last-child {{
            margin-bottom: 0;
        }}
        .ai-section h3 {{
            color: #334155;
            font-size: 1rem;
            margin: 0 0 8px 0;
        }}
        .ai-section p {{
            color: #475569;
            line-height: 1.6;
            margin: 0;
            white-space: pre-wrap;
        }}
        .ai-raw {{
            background: #1e293b;
            color: #e2e8f0;
            padding: 12px;
            border-radius: 4px;
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
        }}
        """


def _html_escape(text: str) -> str:
    """Escape HTML special characters."""
    if not text:
        return ""
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("\n", "<br>"))


# Plugin instance for auto-discovery
plugin = HTMLAIAnalysisPlugin
