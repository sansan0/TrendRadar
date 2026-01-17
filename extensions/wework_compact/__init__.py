# coding=utf-8
"""
WeWork Compact Notification Extension

Transforms verbose notification messages into a compact format optimized for
WeWork and other channels with strict size limits.

Features:
- AI-powered cross-news summary (requires AI_ANALYSIS enabled in main config)
- Compact title listing with platform sources: "titleA (微博/抖音) / titleB (知乎)"
- Fallback mode when AI is unavailable: direct title extraction
- Appends existing AI analysis section when available

Configuration (config/extensions/wework_compact.yaml):
    enabled: true
    target_channels:
      - wework
    compact_summary:
      summary_prefix: "今日热点总结:"
      source_prefix: "来源:"
      fallback_prefix: "今日热点:"
      separator: " / "
      max_titles: 20
      include_ai_analysis: true
    ai:
      use_main_config: true
      prompt_file: "wework_compact_prompt.txt"
    fallback:
      max_title_length: 25
      max_platform_display: 3
"""

import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from loguru import logger

from extensions.base import NotificationEnhancer


class WeWorkCompactPlugin(NotificationEnhancer):
    """
    Compact notification formatter for WeWork and similar channels.

    Transforms verbose news reports into a compact format:
    - With AI: "今日热点总结: {AI生成的综合摘要}\n来源: titleA (platforms) / titleB (platforms)..."
    - Fallback: "今日热点: titleA (platforms) / titleB (platforms)..."
    """

    @property
    def name(self) -> str:
        return "wework_compact"

    @property
    def version(self) -> str:
        return "1.0.0"

    def __init__(self):
        self.config: Dict[str, Any] = {}
        self._enabled = True
        self._target_channels: List[str] = ["wework"]
        self._compact_config: Dict[str, Any] = {}
        self._ai_config: Dict[str, Any] = {}
        self._ai_summary_config: Dict[str, Any] = {}
        self._fallback_config: Dict[str, Any] = {}

    def apply_config(self, config: Dict) -> None:
        """Apply plugin configuration from YAML file."""
        if config is None:
            config = {}
        self.config = config

        try:
            self._enabled = config.get("enabled", True) if config else True
            self._target_channels = config.get("target_channels", ["wework"])
            self._compact_config = config.get("compact_summary", {})
            self._ai_config = config.get("ai", {})
            self._fallback_config = config.get("fallback", {})

            # Load AI summary config with defaults
            ai_summary_config = self._ai_config.get("ai_summary", {})
            self._ai_summary_config = {
                "target_length": ai_summary_config.get("target_length", 250),
                "tone": ai_summary_config.get("tone", "journalistic"),
                "focus": ai_summary_config.get("focus", "facts"),
                "style": ai_summary_config.get("style", "concise"),
            }

            logger.info(
                "[wework_compact] Loaded plugin v{} (enabled={}, channels={})",
                self.version,
                self._enabled,
                self._target_channels,
            )
        except Exception as e:
            logger.error("[wework_compact] Error in apply_config: {}", e)
            self._enabled = False

    def enhance(
        self,
        content: str,
        channel: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        """
        Enhance notification content by replacing it with compact format.

        Args:
            content: Original notification content string
            channel: Notification channel name (e.g., 'wework')
            config: Plugin configuration
            context: Application context (AppContext instance)

        Returns:
            Compact formatted content string, or original content if not applicable
        """
        if not self._enabled:
            return content

        if channel not in self._target_channels:
            return content

        try:
            # Extract NEW titles with platforms from context
            titles_with_platforms = self._extract_titles_with_platforms(context, only_new=True)
            if not titles_with_platforms:
                logger.debug("[wework_compact] No new titles found in context")
                return content

            # Get main AI config to check if AI is enabled
            main_config = getattr(context, 'config', {})
            ai_analysis_config = self._get_ai_config(main_config)

            # Get existing AI analysis content
            existing_ai_analysis = self._get_existing_ai_analysis(context)

            # Generate compact content
            if ai_analysis_config:
                # Try AI mode
                compact_content = self._generate_ai_mode_content(
                    titles_with_platforms,
                    ai_analysis_config,
                    existing_ai_analysis,
                )
                if compact_content:
                    logger.info("[wework_compact] Generated AI-powered compact content")
                    return compact_content
                else:
                    logger.warning("[wework_compact] AI mode failed, falling back to simple mode")

            # Fallback mode
            compact_content = self._fallback_format(
                titles_with_platforms,
                existing_ai_analysis,
            )
            logger.info("[wework_compact] Generated fallback compact content")
            return compact_content

        except Exception as e:
            logger.error("[wework_compact] Error enhancing content: {}", e)
            return content

    def _extract_titles_with_platforms(
        self, context: Any, only_new: bool = False
    ) -> List[Tuple[str, List[str]]]:
        """
        Extract titles with their platform sources from context.

        Args:
            context: Application context
            only_new: If True, only extract titles that are in new_titles

        Returns:
            List of (title, [platform1, platform2, ...]) tuples
        """
        results: List[Tuple[str, List[str]]] = []
        seen_titles: set = set()

        # Try to get report_data from context
        report_data = getattr(context, 'report_data', None)
        if report_data is None:
            # Try to get from context dict if it's a dict-like object
            if hasattr(context, 'get'):
                report_data = context.get('report_data', {})
            else:
                return results

        if not report_data:
            return results

        # Build set of new titles if filtering
        new_titles_set: set = set()
        if only_new:
            new_titles_data = report_data.get('new_titles', [])
            for source_data in new_titles_data:
                if isinstance(source_data, dict):
                    for title_info in source_data.get('titles', []):
                        title = title_info.get('title') if isinstance(title_info, dict) else None
                        if title:
                            new_titles_set.add(title)

        # Extract from stats (keyword-grouped titles)
        stats = report_data.get('stats', [])
        for stat in stats:
            titles = stat.get('titles', [])
            for title_info in titles:
                if not isinstance(title_info, dict):
                    continue

                title = title_info.get('title', '')
                if not title:
                    continue

                # Clean title - remove URLs and markdown links
                title_clean = self._strip_markdown_links(title)
                title_clean = self._strip_urls(title_clean)
                title_clean = title_clean.strip()

                if not title_clean or title_clean in seen_titles:
                    continue

                # Filter to only new titles if requested
                if only_new and title_clean not in new_titles_set:
                    continue

                seen_titles.add(title_clean)

                # Get platforms this title appeared on
                platforms = title_info.get('platforms', [])
                if not platforms:
                    platform = title_info.get('platform', '')
                    source_name = title_info.get('source_name', '')
                    if platform:
                        platforms = [platform]
                    elif source_name:
                        platforms = [source_name]

                # Convert platform IDs to readable names if needed
                platforms = self._normalize_platform_names(platforms)

                results.append((title_clean, platforms))

        return results

    def _normalize_platform_names(self, platforms: List[str]) -> List[str]:
        """Normalize platform names to readable short names."""
        # Map common platform IDs to short names
        name_map = {
            'weibo': '微博',
            'zhihu': '知乎',
            'baidu': '百度',
            'douyin': '抖音',
            'bilibili': 'B站',
            'toutiao': '头条',
            '36kr': '36氪',
            'ithome': 'IT之家',
            'v2ex': 'V2EX',
            'juejin': '掘金',
            'huxiu': '虎嗅',
            'weixin': '微信',
            'kuaishou': '快手',
            'xiaohongshu': '小红书',
            'thepaper': '澎湃',
        }

        normalized = []
        for p in platforms:
            if not p:
                continue
            p_lower = p.lower().strip()
            if p_lower in name_map:
                normalized.append(name_map[p_lower])
            else:
                # Keep original if not in map, but strip whitespace
                normalized.append(p.strip())

        return normalized

    def _strip_markdown_links(self, text: str) -> str:
        """Convert [title](url) to just title."""
        link_pattern = r'\[([^\]]+)\]\([^\)]+\)'
        return re.sub(link_pattern, r'\1', text)

    def _strip_urls(self, text: str) -> str:
        """Remove URLs from text."""
        url_pattern = r'https?://\S+|www\.\S+'
        return re.sub(url_pattern, '', text).strip()

    def _get_ai_config(self, main_config: Dict) -> Optional[Dict]:
        """
        Get AI config from main AI_ANALYSIS config section.

        Reuses the same AI provider/model as the main AI analysis feature.
        """
        if not self._ai_config.get('use_main_config', True):
            return None

        ai_analysis_config = main_config.get('AI_ANALYSIS', {})
        if not ai_analysis_config.get('ENABLED', False):
            return None

        # Check if API key is available
        api_key = ai_analysis_config.get('API_KEY') or os.environ.get('AI_API_KEY', '')
        if not api_key:
            return None

        return ai_analysis_config

    def _get_existing_ai_analysis(self, context: Any) -> Optional[str]:
        """Get the existing AI analysis content from context if available."""
        # Try multiple possible locations
        ai_content = getattr(context, 'ai_content', None)
        if ai_content:
            return ai_content

        ai_analysis = getattr(context, 'ai_analysis', None)
        if ai_analysis:
            # If it's an AIAnalysisResult object, extract formatted content
            if hasattr(ai_analysis, 'summary') and ai_analysis.summary:
                return self._format_ai_analysis_section(ai_analysis)

        return None

    def _format_ai_analysis_section(self, ai_analysis: Any) -> str:
        """Format AI analysis result into a readable section."""
        lines = []
        lines.append("\n━━━━━━━━━━━━━━")
        lines.append("📊 AI 深度分析")
        lines.append("━━━━━━━━━━━━━━")

        if getattr(ai_analysis, 'summary', ''):
            lines.append(f"\n📌 趋势概述\n{ai_analysis.summary}")

        if getattr(ai_analysis, 'keyword_analysis', ''):
            lines.append(f"\n🔑 关键词分析\n{ai_analysis.keyword_analysis}")

        if getattr(ai_analysis, 'sentiment', ''):
            lines.append(f"\n💭 情感倾向\n{ai_analysis.sentiment}")

        if getattr(ai_analysis, 'cross_platform', ''):
            lines.append(f"\n🔗 跨平台关联\n{ai_analysis.cross_platform}")

        if getattr(ai_analysis, 'signals', ''):
            lines.append(f"\n⚡ 值得关注\n{ai_analysis.signals}")

        if getattr(ai_analysis, 'conclusion', ''):
            lines.append(f"\n📝 总结建议\n{ai_analysis.conclusion}")

        return '\n'.join(lines)

    def _load_prompt_template(self) -> str:
        """Load the custom prompt template for compact summary generation."""
        prompt_file = self._ai_config.get('prompt_file', 'wework_compact_prompt.txt')
        config_dir = Path(__file__).parent.parent.parent / "config"
        prompt_path = config_dir / prompt_file

        if prompt_path.exists():
            return prompt_path.read_text(encoding='utf-8')

        # Build default prompt based on config
        return self._build_default_prompt()

    def _build_default_prompt(self) -> str:
        """Build default prompt dynamically from AI summary config."""
        tone_map = {
            "journalistic": "新闻播报风格：客观、事实性、简洁",
            "analytical": "分析评论风格：深入解读、有洞察力",
            "conversational": "口语化风格：轻松、易懂、亲和",
        }

        focus_map = {
            "facts": "概括今日发生的核心事件和事实",
            "analysis": "分析事件背后的原因和影响",
            "trends": "提炼整体趋势和关联",
            "all": "综合事件、分析和趋势",
        }

        target_length = self._ai_summary_config.get("target_length", 250)
        tone_instruction = tone_map.get(
            self._ai_summary_config.get("tone", "journalistic"),
            tone_map["journalistic"]
        )
        focus_instruction = focus_map.get(
            self._ai_summary_config.get("focus", "facts"),
            focus_map["facts"]
        )

        prompt = f"""你是一位新闻编辑。请根据以下新闻标题列表，撰写一段简短的新闻简报（约{target_length}字，2-3句话），概括今日发生的主要事件。

要求：
1. 采用{tone_instruction}
2. {focus_instruction}
3. 使用新闻开篇的叙述方式（如"今日，..."、"据报道，..."）
4. 不要逐条列举标题，而是提炼出整体事件画面
5. 避免主观分析和评论，只陈述事实
6. 如果有多个独立热点，用分号分隔
7. 语言简练，避免冗余

新闻标题：
{{news_titles}}

请直接输出新闻简报内容，不需要任何前缀或格式标记："""

        return prompt

    def _generate_cross_news_summary(
        self, titles: List[str], ai_config: Dict
    ) -> Optional[str]:
        """
        Generate a holistic summary across all news using AI.

        Uses the same AI provider as main AI_ANALYSIS config.
        """
        try:
            # Load prompt template
            prompt_template = self._load_prompt_template()

            # Build news titles string
            news_titles = '\n'.join(f"- {title}" for title in titles[:30])  # Limit to 30 titles
            prompt = prompt_template.replace('{news_titles}', news_titles)

            # Get API settings
            api_key = ai_config.get('API_KEY') or os.environ.get('AI_API_KEY', '')
            provider = ai_config.get('PROVIDER', 'openai')
            model = ai_config.get('MODEL', 'gpt-4o-mini')
            base_url = ai_config.get('BASE_URL', '')
            timeout = ai_config.get('TIMEOUT', 30)

            # Determine API endpoint
            if base_url:
                api_url = f"{base_url.rstrip('/')}/chat/completions"
            elif provider == 'deepseek':
                api_url = "https://api.deepseek.com/chat/completions"
            else:
                api_url = "https://api.openai.com/v1/chat/completions"

            # Make API request
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
            }

            payload = {
                'model': model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 200,
                'temperature': 0.7,
            }

            response = requests.post(
                api_url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()

            result = response.json()
            summary = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            return summary.strip() if summary else None

        except Exception as e:
            logger.error("[wework_compact] AI summary generation failed: {}", e)
            return None

    def _format_sources_line(
        self, titles_with_platforms: List[Tuple[str, List[str]]]
    ) -> str:
        """Format the sources line: 'titleA (platformA/B) / titleB (platformC)...'"""
        max_titles = self._compact_config.get('max_titles', 20)
        max_title_length = self._fallback_config.get('max_title_length', 25)
        max_platform_display = self._fallback_config.get('max_platform_display', 3)
        separator = self._compact_config.get('separator', ' / ')

        parts = []
        for title, platforms in titles_with_platforms[:max_titles]:
            # Truncate title if needed
            if len(title) > max_title_length:
                title = title[:max_title_length - 1] + '…'

            # Format platforms
            if platforms:
                platform_str = '/'.join(platforms[:max_platform_display])
                parts.append(f"{title} ({platform_str})")
            else:
                parts.append(title)

        return separator.join(parts)

    def _generate_ai_mode_content(
        self,
        titles_with_platforms: List[Tuple[str, List[str]]],
        ai_config: Dict,
        existing_ai_analysis: Optional[str],
    ) -> Optional[str]:
        """Generate content in AI mode with cross-news summary."""
        # Extract just titles for AI summarization
        titles = [t[0] for t in titles_with_platforms]

        # Generate cross-news summary
        summary = self._generate_cross_news_summary(titles, ai_config)
        if not summary:
            return None

        # Build content with new format
        lines = []
        lines.append(f"今日热点: {summary}")
        lines.append("")

        # Add each title as a bullet point
        max_titles = self._compact_config.get('max_titles', 20)
        max_platform_display = self._fallback_config.get('max_platform_display', 3)

        for title, platforms in titles_with_platforms[:max_titles]:
            if platforms:
                platform_str = '/'.join(platforms[:max_platform_display])
                lines.append(f"- {title} ({platform_str})")
            else:
                lines.append(f"- {title}")

        # Append existing AI analysis if configured
        include_ai_analysis = self._compact_config.get('include_ai_analysis', True)
        if include_ai_analysis and existing_ai_analysis:
            lines.append("")
            lines.append(existing_ai_analysis)

        return '\n'.join(lines)

    def _fallback_format(
        self,
        titles_with_platforms: List[Tuple[str, List[str]]],
        existing_ai_analysis: Optional[str],
    ) -> str:
        """Generate compact format without AI (fallback mode)."""
        # Build content with new format
        lines = []

        # Use simple fallback summary
        count = len(titles_with_platforms)
        summary = f"共发现 {count} 条新热点" if count > 0 else "暂无新热点"
        lines.append(f"今日热点: {summary}")
        lines.append("")

        # Add each title as a bullet point
        max_titles = self._compact_config.get('max_titles', 20)
        max_platform_display = self._fallback_config.get('max_platform_display', 3)

        for title, platforms in titles_with_platforms[:max_titles]:
            if platforms:
                platform_str = '/'.join(platforms[:max_platform_display])
                lines.append(f"- {title} ({platform_str})")
            else:
                lines.append(f"- {title}")

        # Append existing AI analysis if configured (even in fallback mode)
        include_ai_analysis = self._compact_config.get('include_ai_analysis', True)
        if include_ai_analysis and existing_ai_analysis:
            lines.append("")
            lines.append(existing_ai_analysis)

        return '\n'.join(lines)


# Plugin instance for entry point discovery
plugin = WeWorkCompactPlugin()
