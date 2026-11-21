"""
数据解析服务

v2.0.0: 仅支持 SQLite 数据库，移除 TXT 文件支持
新存储结构：output/{type}/{date}.db
"""

import hashlib
import re
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime

import yaml

from ..utils.errors import FileParseError, DataNotFoundError
from .cache_service import get_cache


class ParserService:
    """数据解析服务类"""

    def __init__(self, project_root: str = None):
        """
        初始化解析服务

        Args:
            project_root: 项目根目录，默认为当前目录的父目录
        """
        if project_root is None:
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.cache = get_cache()

        # frequency_words.txt mtime 缓存
        self._freq_words_cache: Optional[List[Dict]] = None
        self._freq_words_mtime: float = 0.0

        # search_queries.txt mtime 缓存
        self._search_queries_cache: Optional[List[Dict]] = None
        self._search_queries_mtime: float = 0.0
        self._search_queries_path: Optional[str] = None

    @staticmethod
    def clean_title(title: str) -> str:
        """清理标题文本"""
        title = re.sub(r'\s+', ' ', title)
        title = title.strip()
        return title

    def get_date_folder_name(self, date: datetime = None) -> str:
        """
        获取日期字符串（ISO 格式）

        Args:
            date: 日期对象，默认为今天

        Returns:
            日期字符串（YYYY-MM-DD）
        """
        if date is None:
            date = datetime.now()
        return date.strftime("%Y-%m-%d")

    def _get_db_path(self, date: datetime = None, db_type: str = "news") -> Optional[Path]:
        """
        获取数据库文件路径

        新结构：output/{type}/{date}.db

        Args:
            date: 日期对象，默认为今天
            db_type: 数据库类型 ("news"、"rss" 或 "search")

        Returns:
            数据库文件路径，如果不存在则返回 None
        """
        date_str = self.get_date_folder_name(date)
        db_path = self.project_root / "output" / db_type / f"{date_str}.db"
        if db_path.exists():
            return db_path
        return None

    def _read_from_sqlite(
        self,
        date: datetime = None,
        platform_ids: Optional[List[str]] = None,
        db_type: str = "news"
    ) -> Optional[Tuple[Dict, Dict, Dict]]:
        """
        从 SQLite 数据库读取数据

        Args:
            date: 日期对象，默认为今天
            platform_ids: 平台/Feed/主题 ID 列表，None 表示全部
            db_type: 数据库类型 ("news"、"rss" 或 "search")

        Returns:
            (all_titles, id_to_name, all_timestamps) 元组，如果数据库不存在返回 None
        """
        db_path = self._get_db_path(date, db_type)
        if db_path is None:
            return None

        all_titles = {}
        id_to_name = {}
        all_timestamps = {}

        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if db_type == "news":
                return self._read_news_from_sqlite(cursor, platform_ids, all_titles, id_to_name, all_timestamps)
            elif db_type == "rss":
                return self._read_rss_from_sqlite(cursor, platform_ids, all_titles, id_to_name, all_timestamps)
            elif db_type == "search":
                return self._read_search_from_sqlite(cursor, platform_ids, all_titles, id_to_name, all_timestamps)

        except Exception as e:
            print(f"Warning: 从 SQLite 读取数据失败: {e}", file=sys.stderr)
            return None
        finally:
            if 'conn' in locals():
                conn.close()

    def _read_news_from_sqlite(
        self,
        cursor,
        platform_ids: Optional[List[str]],
        all_titles: Dict,
        id_to_name: Dict,
        all_timestamps: Dict
    ) -> Optional[Tuple[Dict, Dict, Dict]]:
        """从热榜数据库读取数据"""
        # 检查表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='news_items'
        """)
        if not cursor.fetchone():
            return None

        # 构建查询
        if platform_ids:
            placeholders = ','.join(['?' for _ in platform_ids])
            query = f"""
                SELECT n.id, n.platform_id, p.name as platform_name, n.title,
                       n.rank, n.url, n.mobile_url,
                       n.first_crawl_time, n.last_crawl_time, n.crawl_count
                FROM news_items n
                LEFT JOIN platforms p ON n.platform_id = p.id
                WHERE n.platform_id IN ({placeholders})
            """
            cursor.execute(query, platform_ids)
        else:
            cursor.execute("""
                SELECT n.id, n.platform_id, p.name as platform_name, n.title,
                       n.rank, n.url, n.mobile_url,
                       n.first_crawl_time, n.last_crawl_time, n.crawl_count
                FROM news_items n
                LEFT JOIN platforms p ON n.platform_id = p.id
            """)

        rows = cursor.fetchall()

        # 收集所有 news_item_id 用于查询历史排名
        news_ids = [row['id'] for row in rows]
        rank_history_map = {}

        if news_ids:
            placeholders = ",".join("?" * len(news_ids))
            cursor.execute(f"""
                SELECT news_item_id, rank FROM rank_history
                WHERE news_item_id IN ({placeholders})
                ORDER BY news_item_id, crawl_time
            """, news_ids)

            for rh_row in cursor.fetchall():
                news_id = rh_row['news_item_id']
                rank = rh_row['rank']
                if news_id not in rank_history_map:
                    rank_history_map[news_id] = []
                rank_history_map[news_id].append(rank)

        for row in rows:
            news_id = row['id']
            platform_id = row['platform_id']
            platform_name = row['platform_name'] or platform_id
            title = row['title']

            if platform_id not in id_to_name:
                id_to_name[platform_id] = platform_name

            if platform_id not in all_titles:
                all_titles[platform_id] = {}

            ranks = rank_history_map.get(news_id, [row['rank']])

            all_titles[platform_id][title] = {
                "ranks": ranks,
                "url": row['url'] or "",
                "mobileUrl": row['mobile_url'] or "",
                "first_time": row['first_crawl_time'] or "",
                "last_time": row['last_crawl_time'] or "",
                "count": row['crawl_count'] or 1,
            }

        # 获取抓取时间作为 timestamps
        cursor.execute("""
            SELECT crawl_time, created_at FROM crawl_records
            ORDER BY crawl_time
        """)
        for row in cursor.fetchall():
            crawl_time = row['crawl_time']
            created_at = row['created_at']
            try:
                ts = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S").timestamp()
            except (ValueError, TypeError):
                ts = datetime.now().timestamp()
            all_timestamps[f"{crawl_time}.db"] = ts

        if not all_titles:
            return None

        return (all_titles, id_to_name, all_timestamps)

    def _read_rss_from_sqlite(
        self,
        cursor,
        feed_ids: Optional[List[str]],
        all_items: Dict,
        id_to_name: Dict,
        all_timestamps: Dict
    ) -> Optional[Tuple[Dict, Dict, Dict]]:
        """从 RSS 数据库读取数据"""
        # 检查表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='rss_items'
        """)
        if not cursor.fetchone():
            return None

        # 构建查询
        if feed_ids:
            placeholders = ','.join(['?' for _ in feed_ids])
            query = f"""
                SELECT i.id, i.feed_id, f.name as feed_name, i.title,
                       i.url, i.published_at, i.summary, i.author,
                       i.first_crawl_time, i.last_crawl_time, i.crawl_count
                FROM rss_items i
                LEFT JOIN rss_feeds f ON i.feed_id = f.id
                WHERE i.feed_id IN ({placeholders})
                ORDER BY i.published_at DESC
            """
            cursor.execute(query, feed_ids)
        else:
            cursor.execute("""
                SELECT i.id, i.feed_id, f.name as feed_name, i.title,
                       i.url, i.published_at, i.summary, i.author,
                       i.first_crawl_time, i.last_crawl_time, i.crawl_count
                FROM rss_items i
                LEFT JOIN rss_feeds f ON i.feed_id = f.id
                ORDER BY i.published_at DESC
            """)

        rows = cursor.fetchall()

        for row in rows:
            feed_id = row['feed_id']
            feed_name = row['feed_name'] or feed_id
            title = row['title']

            if feed_id not in id_to_name:
                id_to_name[feed_id] = feed_name

            if feed_id not in all_items:
                all_items[feed_id] = {}

            all_items[feed_id][title] = {
                "url": row['url'] or "",
                "published_at": row['published_at'] or "",
                "summary": row['summary'] or "",
                "author": row['author'] or "",
                "first_time": row['first_crawl_time'] or "",
                "last_time": row['last_crawl_time'] or "",
                "count": row['crawl_count'] or 1,
            }

        # 获取抓取时间
        cursor.execute("""
            SELECT crawl_time, created_at FROM rss_crawl_records
            ORDER BY crawl_time
        """)
        for row in cursor.fetchall():
            crawl_time = row['crawl_time']
            created_at = row['created_at']
            try:
                ts = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S").timestamp()
            except (ValueError, TypeError):
                ts = datetime.now().timestamp()
            all_timestamps[f"{crawl_time}.db"] = ts

        if not all_items:
            return None

        return (all_items, id_to_name, all_timestamps)

    def _read_search_from_sqlite(
        self,
        cursor,
        topic_ids: Optional[List[str]],
        all_items: Dict,
        id_to_name: Dict,
        all_timestamps: Dict
    ) -> Optional[Tuple[Dict, Dict, Dict]]:
        """从联网搜索数据库读取数据"""
        # 检查表是否存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='search_items'
        """)
        if not cursor.fetchone():
            return None

        # 构建查询
        if topic_ids:
            placeholders = ','.join(['?' for _ in topic_ids])
            query = f"""
                SELECT i.id, i.topic_id, t.name as topic_name, i.title,
                       i.url, i.query, i.provider, i.snippet, i.summary,
                       i.site_name, i.published_at, i.score, i.raw_score,
                       i.authority, i.first_crawl_time, i.last_crawl_time,
                       i.crawl_count
                FROM search_items i
                LEFT JOIN search_topics t ON i.topic_id = t.id
                WHERE i.topic_id IN ({placeholders})
                ORDER BY i.score DESC, i.published_at DESC
            """
            cursor.execute(query, topic_ids)
        else:
            cursor.execute("""
                SELECT i.id, i.topic_id, t.name as topic_name, i.title,
                       i.url, i.query, i.provider, i.snippet, i.summary,
                       i.site_name, i.published_at, i.score, i.raw_score,
                       i.authority, i.first_crawl_time, i.last_crawl_time,
                       i.crawl_count
                FROM search_items i
                LEFT JOIN search_topics t ON i.topic_id = t.id
                ORDER BY i.score DESC, i.published_at DESC
            """)

        rows = cursor.fetchall()

        for row in rows:
            topic_id = row['topic_id']
            topic_name = row['topic_name'] or topic_id
            title = row['title']

            if topic_id not in id_to_name:
                id_to_name[topic_id] = topic_name

            if topic_id not in all_items:
                all_items[topic_id] = {}

            if title not in all_items[topic_id]:
                all_items[topic_id][title] = {
                    "url": row['url'] or "",
                    "query": row['query'] or "",
                    "provider": row['provider'] or "",
                    "snippet": row['snippet'] or "",
                    "summary": row['summary'] or "",
                    "site_name": row['site_name'] or "",
                    "published_at": row['published_at'] or "",
                    "score": float(row['score']) if row['score'] is not None else 0.0,
                    "raw_score": float(row['raw_score']) if row['raw_score'] is not None else 0.0,
                    "authority": int(row['authority']) if row['authority'] is not None else -1,
                    "first_time": row['first_crawl_time'] or "",
                    "last_time": row['last_crawl_time'] or "",
                    "count": int(row['crawl_count']) if row['crawl_count'] is not None else 1,
                }

        # 获取抓取时间
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='search_crawl_records'
        """)
        if cursor.fetchone():
            cursor.execute("""
                SELECT crawl_time, created_at FROM search_crawl_records
                ORDER BY crawl_time
            """)
            for row in cursor.fetchall():
                crawl_time = row['crawl_time']
                created_at = row['created_at']
                try:
                    ts = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S").timestamp()
                except (ValueError, TypeError):
                    ts = datetime.now().timestamp()
                all_timestamps[f"{crawl_time}.db"] = ts

        if not all_items:
            return None

        return (all_items, id_to_name, all_timestamps)

    def read_all_titles_for_date(
        self,
        date: datetime = None,
        platform_ids: Optional[List[str]] = None,
        db_type: str = "news"
    ) -> Tuple[Dict, Dict, Dict]:
        """
        读取指定日期的所有数据（带缓存）

        Args:
            date: 日期对象，默认为今天
            platform_ids: 平台/Feed/主题 ID 列表，None 表示所有
            db_type: 数据库类型 ("news"、"rss" 或 "search")

        Returns:
            (all_titles, id_to_name, all_timestamps) 元组

        Raises:
            DataNotFoundError: 数据不存在
        """
        date_str = self.get_date_folder_name(date)
        platform_key = ','.join(sorted(platform_ids)) if platform_ids else 'all'
        cache_key = f"read_all:{db_type}:{date_str}:{platform_key}"

        is_today = (date is None) or (date.date() == datetime.now().date())
        ttl = 900 if is_today else 900

        cached = self.cache.get(cache_key, ttl=ttl)
        if cached:
            return cached

        result = self._read_from_sqlite(date, platform_ids, db_type)
        if result:
            self.cache.set(cache_key, result)
            return result

        raise DataNotFoundError(
            f"未找到 {date_str} 的 {db_type} 数据",
            suggestion="请先运行爬虫或检查日期是否正确"
        )

    def parse_yaml_config(self, config_path: str = None) -> dict:
        """
        解析YAML配置文件

        Args:
            config_path: 配置文件路径，默认为 config/config.yaml

        Returns:
            配置字典

        Raises:
            FileParseError: 配置文件解析错误
        """
        if config_path is None:
            config_path = self.project_root / "config" / "config.yaml"
        else:
            config_path = Path(config_path)

        if not config_path.exists():
            raise FileParseError(str(config_path), "配置文件不存在")

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f)
            return config_data
        except Exception as e:
            raise FileParseError(str(config_path), str(e))

    def parse_frequency_words(self, words_file: str = None) -> List[Dict]:
        """
        解析关键词配置文件（带 mtime 缓存）

        仅当 frequency_words.txt 被修改时才重新解析，避免循环内重复 IO。

        复用 trendradar.core.frequency 的解析逻辑，支持：
        - # 开头的注释行
        - 空行分隔词组
        - [组别名] 作为词组第一行，给整组指定别名
        - +前缀必须词、!前缀过滤词、@数量限制
        - /pattern/ 正则表达式语法
        - => 别名 显示名称语法
        - [GLOBAL_FILTER] 全局过滤区域

        显示名称优先级：组别名 > 行别名拼接 > 关键词拼接

        Args:
            words_file: 关键词文件路径，默认为 config/frequency_words.txt

        Returns:
            词组列表

        Raises:
            FileParseError: 文件解析错误
        """
        import os
        from trendradar.core.frequency import load_frequency_words

        if words_file is None:
            words_file = str(self.project_root / "config" / "frequency_words.txt")
        else:
            words_file = str(words_file)

        try:
            current_mtime = os.path.getmtime(words_file)

            if self._freq_words_cache is not None and current_mtime == self._freq_words_mtime:
                return self._freq_words_cache

            word_groups, filter_words, global_filters = load_frequency_words(words_file)
            self._freq_words_cache = word_groups
            self._freq_words_mtime = current_mtime
            return word_groups
        except FileNotFoundError:
            return []
        except Exception as e:
            raise FileParseError(words_file, str(e))

    def _resolve_search_queries_path(self, queries_file: Optional[str] = None) -> Path:
        """解析 search_queries.txt 路径"""
        if not queries_file:
            return self.project_root / "config" / "search_queries.txt"

        candidate = Path(queries_file)
        if candidate.is_file():
            return candidate
        if not candidate.is_absolute():
            for base in (
                self.project_root,
                self.project_root / "config" / "custom" / "search",
                self.project_root / "config",
            ):
                resolved = base / queries_file
                if resolved.is_file():
                    return resolved
        return self.project_root / "config" / queries_file

    @staticmethod
    def _normalize_parsed_topic(item) -> Optional[Dict]:
        """将 query_parser 返回的对象或字典统一转为可 JSON 序列化的字典"""
        def _val(obj, *keys, default=None):
            for k in keys:
                if isinstance(obj, dict):
                    v = obj.get(k)
                else:
                    v = getattr(obj, k, None)
                if v is not None:
                    return v
            return default

        queries = _val(item, "queries", default=[])
        if isinstance(queries, str):
            queries = [queries]
        elif isinstance(queries, (list, tuple, set)):
            queries = [str(q) for q in queries if str(q).strip()]
        else:
            queries = []

        name = str(_val(item, "name", "display_name", "title", default="") or "").strip()
        if not name and queries:
            name = queries[0][:50]
        if not name and not queries:
            return None

        topic_id = str(_val(item, "id", "topic_id", default="") or "").strip()
        if not topic_id:
            topic_id = f"topic_{hashlib.md5(name.encode('utf-8')).hexdigest()[:8]}"

        def _str_list(val) -> List[str]:
            if isinstance(val, (list, tuple, set)):
                return [str(x) for x in val if str(x).strip()]
            return []

        max_items = _val(item, "max_items", "max_results", default=None)
        freshness_days = _val(item, "freshness_days", default=None)
        provider = str(_val(item, "provider", default="") or "").strip()

        return {
            "id": topic_id,
            "name": name,
            "queries": queries,
            "exclude_words": _str_list(_val(item, "exclude_words", "filter_words", default=[])),
            "exclude_sites": _str_list(_val(item, "exclude_sites", default=[])),
            "include_sites": _str_list(_val(item, "include_sites", default=[])),
            "max_items": int(max_items) if max_items is not None else None,
            "freshness_days": int(freshness_days) if freshness_days is not None else None,
            "provider": provider,
        }

    @staticmethod
    def _parse_search_queries_fallback(file_path: Path) -> List[Dict]:
        """轻量解析 config/search_queries.txt（当 query_parser 不可用时回退）"""
        with open(file_path, "r", encoding="utf-8") as f:
            raw_lines = f.readlines()

        topics: List[Dict] = []
        current_block: List[str] = []
        in_global_filter = False

        def _flush_block(block: List[str]) -> None:
            if not block:
                return
            name = ""
            lines = block
            header_match = re.match(r'^\[(.+)\]$', block[0])
            if header_match:
                name = header_match.group(1).strip()
                lines = block[1:]

            queries: List[str] = []
            exclude_words: List[str] = []
            exclude_sites: List[str] = []
            include_sites: List[str] = []
            max_items: Optional[int] = None
            freshness_days: Optional[int] = None
            provider = ""

            for line in lines:
                prov_match = re.match(r'^@provider:(.+)$', line, re.IGNORECASE)
                if prov_match:
                    provider = prov_match.group(1).strip().lower()
                    continue
                limit_match = re.match(r'^@(\d+)$', line)
                if limit_match:
                    max_items = int(limit_match.group(1))
                    continue
                fresh_match = re.match(r'^~(\d+)d$', line, re.IGNORECASE)
                if fresh_match:
                    freshness_days = int(fresh_match.group(1))
                    continue
                if line.startswith("!"):
                    word = line[1:].strip()
                    if word:
                        exclude_words.append(word)
                    continue
                if line.lower().startswith("-site:"):
                    site = line[6:].strip()
                    if site:
                        exclude_sites.append(site)
                    continue
                if line.lower().startswith("site:") and " " not in line:
                    site = line[5:].strip()
                    if site:
                        include_sites.append(site)
                    continue
                queries.append(line)

            if not queries:
                return
            if not name:
                name = queries[0][:50]

            topic_id = f"topic_{hashlib.md5(name.encode('utf-8')).hexdigest()[:8]}"
            topics.append({
                "id": topic_id,
                "name": name,
                "queries": queries,
                "exclude_words": exclude_words,
                "exclude_sites": exclude_sites,
                "include_sites": include_sites,
                "max_items": max_items,
                "freshness_days": freshness_days,
                "provider": provider,
            })

        for raw_line in raw_lines:
            line = raw_line.strip()
            if line.startswith("#"):
                continue
            if line == "[GLOBAL_FILTER]":
                _flush_block(current_block)
                current_block = []
                in_global_filter = True
                continue
            if line == "[SEARCH_TOPICS]":
                _flush_block(current_block)
                current_block = []
                in_global_filter = False
                continue
            if in_global_filter:
                continue
            if not line:
                _flush_block(current_block)
                current_block = []
                continue
            current_block.append(line)

        _flush_block(current_block)
        return topics

    def parse_search_queries(self, queries_file: str = None) -> List[Dict]:
        """
        解析联网搜索任务配置文件（带 mtime 缓存）

        优先复用 trendradar.crawler.search.query_parser，模块不可用时自动使用内置轻量解析。
        文件不存在时返回空列表，不抛出异常。

        Args:
            queries_file: 搜索任务文件路径或文件名，默认为 config/search_queries.txt

        Returns:
            搜索主题字典列表
        """
        import os

        target_path = self._resolve_search_queries_path(queries_file)
        if not target_path.is_file():
            return []

        target_str = str(target_path)
        try:
            current_mtime = os.path.getmtime(target_str)
            if (
                self._search_queries_cache is not None
                and self._search_queries_path == target_str
                and current_mtime == self._search_queries_mtime
            ):
                return self._search_queries_cache

            parsed_topics: Optional[List[Dict]] = None
            try:
                from trendradar.crawler.search import query_parser

                load_fn = (
                    getattr(query_parser, "load_search_queries", None)
                    or getattr(query_parser, "parse_search_queries", None)
                )
                if callable(load_fn):
                    raw_parsed = load_fn(target_str)
                    if isinstance(raw_parsed, tuple) and raw_parsed:
                        raw_items = raw_parsed[0]
                    elif hasattr(raw_parsed, "topics"):
                        raw_items = getattr(raw_parsed, "topics")
                    else:
                        raw_items = raw_parsed

                    if isinstance(raw_items, list):
                        normalized = []
                        for item in raw_items:
                            norm = self._normalize_parsed_topic(item)
                            if norm:
                                normalized.append(norm)
                        parsed_topics = normalized
            except Exception:
                parsed_topics = None

            if parsed_topics is None:
                parsed_topics = self._parse_search_queries_fallback(target_path)

            self._search_queries_cache = parsed_topics
            self._search_queries_mtime = current_mtime
            self._search_queries_path = target_str
            return parsed_topics
        except FileNotFoundError:
            return []
        except Exception as e:
            raise FileParseError(target_str, str(e))

    def get_available_dates(self, db_type: str = "news") -> List[str]:
        """
        获取可用的日期列表

        Args:
            db_type: 数据库类型 ("news"、"rss" 或 "search")

        Returns:
            日期字符串列表（YYYY-MM-DD 格式，降序排列）
        """
        db_dir = self.project_root / "output" / db_type
        if not db_dir.exists():
            return []

        dates = []
        for db_file in db_dir.glob("*.db"):
            date_match = re.match(r'(\d{4}-\d{2}-\d{2})\.db$', db_file.name)
            if date_match:
                dates.append(date_match.group(1))

        return sorted(dates, reverse=True)

    def get_available_date_range(self, db_type: str = "news") -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        获取可用的日期范围

        Args:
            db_type: 数据库类型 ("news"、"rss" 或 "search")

        Returns:
            (最早日期, 最新日期) 元组，如果没有数据则返回 (None, None)
        """
        dates = self.get_available_dates(db_type)
        if not dates:
            return (None, None)

        earliest = datetime.strptime(dates[-1], "%Y-%m-%d")
        latest = datetime.strptime(dates[0], "%Y-%m-%d")
        return (earliest, latest)
