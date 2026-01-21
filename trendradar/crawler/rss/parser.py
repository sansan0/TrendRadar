# coding=utf-8
"""
RSS 解析器

支持 RSS 2.0、Atom 和 JSON Feed 1.1 格式的解析
"""

import re
import html
import json
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any
from email.utils import parsedate_to_datetime

try:
    import feedparser
    HAS_FEEDPARSER = True
except ImportError:
    HAS_FEEDPARSER = False
    feedparser = None


@dataclass
class ParsedRSSItem:
    """解析后的 RSS 条目"""
    title: str
    url: str
    published_at: Optional[str] = None
    summary: Optional[str] = None
    author: Optional[str] = None
    guid: Optional[str] = None


class RSSParser:
    """RSS 解析器"""

    def __init__(self, max_summary_length: int = 500):
        """
        初始化解析器

        Args:
            max_summary_length: 摘要最大长度
        """
        if not HAS_FEEDPARSER:
            raise ImportError("RSS 解析需要安装 feedparser: pip install feedparser")

        self.max_summary_length = max_summary_length

    def parse(self, content: str, feed_url: str = "") -> List[ParsedRSSItem]:
        """
        解析 RSS/Atom/JSON Feed 内容

        Args:
            content: Feed 内容（XML 或 JSON）
            feed_url: Feed URL（用于错误提示）

        Returns:
            解析后的条目列表
        """
        # 先尝试检测 JSON Feed
        if self._is_json_feed(content):
            return self._parse_json_feed(content, feed_url)

        # 使用 feedparser 解析 RSS/Atom
        feed = feedparser.parse(content)

        if feed.bozo and not feed.entries:
            raise ValueError(f"RSS 解析失败 ({feed_url}): {feed.bozo_exception}")

        items = []
        for entry in feed.entries:
            item = self._parse_entry(entry)
            if item:
                items.append(item)

        return items

    def _is_json_feed(self, content: str) -> bool:
        """
        检测内容是否为 JSON Feed 格式

        JSON Feed 必须包含 version 字段，值为 https://jsonfeed.org/version/1 或 1.1
        """
        content = content.strip()
        if not content.startswith("{"):
            return False

        try:
            data = json.loads(content)
            version = data.get("version", "")
            return "jsonfeed.org" in version
        except (json.JSONDecodeError, TypeError):
            return False

    def _parse_json_feed(self, content: str, feed_url: str = "") -> List[ParsedRSSItem]:
        """
        解析 JSON Feed 1.1 格式

        JSON Feed 规范: https://www.jsonfeed.org/version/1.1/

        Args:
            content: JSON Feed 内容
            feed_url: Feed URL（用于错误提示）

        Returns:
            解析后的条目列表
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON Feed 解析失败 ({feed_url}): {e}")

        items_data = data.get("items", [])
        if not items_data:
            return []

        items = []
        for item_data in items_data:
            item = self._parse_json_feed_item(item_data)
            if item:
                items.append(item)

        return items

    def _parse_json_feed_item(self, item_data: Dict[str, Any]) -> Optional[ParsedRSSItem]:
        """解析单个 JSON Feed 条目"""
        # 标题：优先 title，否则使用 content_text 的前 100 字符
        title = item_data.get("title", "")
        if not title:
            content_text = item_data.get("content_text", "")
            if content_text:
                title = content_text[:100] + ("..." if len(content_text) > 100 else "")

        title = self._clean_text(title)
        if not title:
            return None

        # URL
        url = item_data.get("url", "") or item_data.get("external_url", "")

        # 发布时间（ISO 8601 格式）
        published_at = None
        date_str = item_data.get("date_published") or item_data.get("date_modified")
        if date_str:
            published_at = self._parse_iso_date(date_str)

        # 摘要：优先 summary，否则使用 content_text
        summary = item_data.get("summary", "")
        if not summary:
            content_text = item_data.get("content_text", "")
            content_html = item_data.get("content_html", "")
            summary = content_text or self._clean_text(content_html)

        if summary:
            summary = self._clean_text(summary)
            if len(summary) > self.max_summary_length:
                summary = summary[:self.max_summary_length] + "..."

        # 作者
        author = None
        authors = item_data.get("authors", [])
        if authors:
            names = [a.get("name", "") for a in authors if isinstance(a, dict) and a.get("name")]
            if names:
                author = ", ".join(names)

        # GUID
        guid = item_data.get("id", "") or url

        return ParsedRSSItem(
            title=title,
            url=url,
            published_at=published_at,
            summary=summary or None,
            author=author,
            guid=guid,
        )

    def _parse_iso_date(self, date_str: str) -> Optional[str]:
        """解析 ISO 8601 日期格式"""
        if not date_str:
            return None

        try:
            # 处理常见的 ISO 8601 格式
            # 替换 Z 为 +00:00
            date_str = date_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(date_str)
            return dt.isoformat()
        except (ValueError, TypeError):
            pass

        return None

    def parse_url(self, url: str, timeout: int = 10) -> List[ParsedRSSItem]:
        """
        从 URL 解析 RSS

        Args:
            url: RSS URL
            timeout: 超时时间（秒）

        Returns:
            解析后的条目列表
        """
        import requests

        response = requests.get(url, timeout=timeout, headers={
            "User-Agent": "TrendRadar/2.0 RSS Reader"
        })
        response.raise_for_status()

        return self.parse(response.text, url)

    def _parse_entry(self, entry: Any) -> Optional[ParsedRSSItem]:
        """解析单个条目"""
        title = self._clean_text(entry.get("title", ""))
        if not title:
            return None

        url = entry.get("link", "")
        if not url:
            # 尝试从 links 中获取
            links = entry.get("links", [])
            for link in links:
                if link.get("rel") == "alternate" or link.get("type", "").startswith("text/html"):
                    url = link.get("href", "")
                    break
            if not url and links:
                url = links[0].get("href", "")

        published_at = self._parse_date(entry)
        summary = self._parse_summary(entry)
        author = self._parse_author(entry)
        guid = entry.get("id") or entry.get("guid", {}).get("value") or url

        return ParsedRSSItem(
            title=title,
            url=url,
            published_at=published_at,
            summary=summary,
            author=author,
            guid=guid,
        )

    def _clean_text(self, text: str) -> str:
        """清理文本"""
        if not text:
            return ""

        # 解码 HTML 实体
        text = html.unescape(text)

        # 移除 HTML 标签
        text = re.sub(r'<[^>]+>', '', text)

        # 移除多余空白
        text = re.sub(r'\s+', ' ', text)

        return text.strip()

    def _parse_date(self, entry: Any) -> Optional[str]:
        """解析发布日期"""
        # feedparser 会自动解析日期到 published_parsed
        date_struct = entry.get("published_parsed") or entry.get("updated_parsed")

        if date_struct:
            try:
                dt = datetime(*date_struct[:6])
                return dt.isoformat()
            except (ValueError, TypeError):
                pass

        # 尝试手动解析
        date_str = entry.get("published") or entry.get("updated")
        if date_str:
            try:
                dt = parsedate_to_datetime(date_str)
                return dt.isoformat()
            except (ValueError, TypeError):
                pass

            # 尝试 ISO 格式
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                return dt.isoformat()
            except (ValueError, TypeError):
                pass

        return None

    def _parse_summary(self, entry: Any) -> Optional[str]:
        """解析摘要"""
        summary = entry.get("summary") or entry.get("description", "")

        if not summary:
            # 尝试从 content 获取
            content = entry.get("content", [])
            if content and isinstance(content, list):
                summary = content[0].get("value", "")

        if not summary:
            return None

        summary = self._clean_text(summary)

        # 截断过长的摘要
        if len(summary) > self.max_summary_length:
            summary = summary[:self.max_summary_length] + "..."

        return summary

    def _parse_author(self, entry: Any) -> Optional[str]:
        """解析作者"""
        author = entry.get("author")
        if author:
            return self._clean_text(author)

        # 尝试从 dc:creator 获取
        author = entry.get("dc_creator")
        if author:
            return self._clean_text(author)

        # 尝试从 authors 列表获取
        authors = entry.get("authors", [])
        if authors:
            names = [a.get("name", "") for a in authors if a.get("name")]
            if names:
                return ", ".join(names)

        return None
