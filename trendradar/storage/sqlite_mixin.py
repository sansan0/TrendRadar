# coding=utf-8
"""
SQLite 存储 Mixin

提供共用的 SQLite 数据库操作逻辑，供 LocalStorageBackend 和 RemoteStorageBackend 复用。
"""

import sqlite3
from abc import abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from trendradar.storage.base import NewsItem, NewsData, RSSItem, RSSData
from trendradar.utils.url import normalize_url


class SQLiteStorageMixin:
    """
    SQLite 存储操作 Mixin

    子类需要实现以下抽象方法：
    - _get_connection(date, db_type) -> sqlite3.Connection
    - _get_configured_time() -> datetime
    - _format_date_folder(date) -> str
    - _format_time_filename() -> str
    """

    # ========================================
    # 抽象方法 - 子类必须实现
    # ========================================

    @abstractmethod
    def _get_connection(self, date: Optional[str] = None, db_type: str = "news") -> sqlite3.Connection:
        """获取数据库连接"""
        pass

    @abstractmethod
    def _get_configured_time(self) -> datetime:
        """获取配置时区的当前时间"""
        pass

    @abstractmethod
    def _format_date_folder(self, date: Optional[str] = None) -> str:
        """格式化日期文件夹名 (ISO 格式: YYYY-MM-DD)"""
        pass

    @abstractmethod
    def _format_time_filename(self) -> str:
        """格式化时间文件名 (格式: HH-MM)"""
        pass

    # ========================================
    # Schema 管理
    # ========================================

    def _get_schema_path(self, db_type: str = "news") -> Path:
        """
        获取 schema.sql 文件路径

        Args:
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            schema 文件路径
        """
        if db_type == "rss":
            return Path(__file__).parent / "rss_schema.sql"
        return Path(__file__).parent / "schema.sql"

    def _init_tables(self, conn: sqlite3.Connection, db_type: str = "news") -> None:
        """
        从 schema.sql 初始化数据库表结构

        Args:
            conn: 数据库连接
            db_type: 数据库类型 ("news" 或 "rss")
        """
        schema_path = self._get_schema_path(db_type)

        if schema_path.exists():
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            conn.executescript(schema_sql)
        else:
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        conn.commit()

    # ========================================
    # 新闻数据存储
    # ========================================

    def _save_news_data_impl(self, data: NewsData, log_prefix: str = "[存储]") -> tuple[bool, int, int, int, int]:
        """
        保存新闻数据到 SQLite（核心实现）

        Args:
            data: 新闻数据
            log_prefix: 日志前缀

        Returns:
            (success, new_count, updated_count, title_changed_count, off_list_count)
        """
        try:
            conn = self._get_connection(data.date)
            cursor = conn.cursor()

            # 获取配置时区的当前时间
            now_str = self._get_configured_time().strftime("%Y-%m-%d %H:%M:%S")

            # 首先同步平台信息到 platforms 表
            for source_id, source_name in data.id_to_name.items():
                cursor.execute("""
                    INSERT INTO platforms (id, name, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        updated_at = excluded.updated_at
                """, (source_id, source_name, now_str))

            # 统计计数器
            new_count = 0
            updated_count = 0
            title_changed_count = 0
            success_sources = []

            for source_id, news_list in data.items.items():
                success_sources.append(source_id)

                for item in news_list:
                    try:
                        # 标准化 URL（去除动态参数，如微博的 band_rank）
                        normalized_url = normalize_url(item.url, source_id) if item.url else ""

                        # 检查是否已存在（通过标准化 URL + platform_id）
                        if normalized_url:
                            cursor.execute("""
                                SELECT id, title FROM news_items
                                WHERE url = ? AND platform_id = ?
                            """, (normalized_url, source_id))
                            existing = cursor.fetchone()

                            if existing:
                                # 已存在，更新记录
                                existing_id, existing_title = existing

                                # 检查标题是否变化
                                if existing_title != item.title:
                                    # 记录标题变更
                                    cursor.execute("""
                                        INSERT INTO title_changes
                                        (news_item_id, old_title, new_title, changed_at)
                                        VALUES (?, ?, ?, ?)
                                    """, (existing_id, existing_title, item.title, now_str))
                                    title_changed_count += 1

                                # 记录排名历史
                                cursor.execute("""
                                    INSERT INTO rank_history
                                    (news_item_id, rank, crawl_time, created_at)
                                    VALUES (?, ?, ?, ?)
                                """, (existing_id, item.rank, data.crawl_time, now_str))

                                # 更新现有记录
                                cursor.execute("""
                                    UPDATE news_items SET
                                        title = ?,
                                        rank = ?,
                                        mobile_url = ?,
                                        last_crawl_time = ?,
                                        crawl_count = crawl_count + 1,
                                        updated_at = ?
                                    WHERE id = ?
                                """, (item.title, item.rank, item.mobile_url,
                                      data.crawl_time, now_str, existing_id))
                                updated_count += 1
                            else:
                                # 不存在，插入新记录（存储标准化后的 URL）
                                cursor.execute("""
                                    INSERT INTO news_items
                                    (title, platform_id, rank, url, mobile_url,
                                     first_crawl_time, last_crawl_time, crawl_count,
                                     created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                                """, (item.title, source_id, item.rank, normalized_url,
                                      item.mobile_url, data.crawl_time, data.crawl_time,
                                      now_str, now_str))
                                new_id = cursor.lastrowid
                                # 记录初始排名
                                cursor.execute("""
                                    INSERT INTO rank_history
                                    (news_item_id, rank, crawl_time, created_at)
                                    VALUES (?, ?, ?, ?)
                                """, (new_id, item.rank, data.crawl_time, now_str))
                                new_count += 1
                        else:
                            # URL 为空的情况，直接插入（不做去重）
                            cursor.execute("""
                                INSERT INTO news_items
                                (title, platform_id, rank, url, mobile_url,
                                 first_crawl_time, last_crawl_time, crawl_count,
                                 created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                            """, (item.title, source_id, item.rank, "",
                                  item.mobile_url, data.crawl_time, data.crawl_time,
                                  now_str, now_str))
                            new_id = cursor.lastrowid
                            # 记录初始排名
                            cursor.execute("""
                                INSERT INTO rank_history
                                (news_item_id, rank, crawl_time, created_at)
                                VALUES (?, ?, ?, ?)
                            """, (new_id, item.rank, data.crawl_time, now_str))
                            new_count += 1

                    except sqlite3.Error as e:
                        print(f"{log_prefix} 保存新闻条目失败 [{item.title[:30]}...]: {e}")

            total_items = new_count + updated_count

            # ========================================
            # 脱榜检测：检测上次在榜但这次不在榜的新闻
            # ========================================
            off_list_count = 0

            # 获取上一次抓取时间
            cursor.execute("""
                SELECT crawl_time FROM crawl_records
                WHERE crawl_time < ?
                ORDER BY crawl_time DESC
                LIMIT 1
            """, (data.crawl_time,))
            prev_record = cursor.fetchone()

            if prev_record:
                prev_crawl_time = prev_record[0]

                # 对于每个成功抓取的平台，检测脱榜
                for source_id in success_sources:
                    # 获取当前抓取中该平台的所有标准化 URL
                    current_urls = set()
                    for item in data.items.get(source_id, []):
                        normalized_url = normalize_url(item.url, source_id) if item.url else ""
                        if normalized_url:
                            current_urls.add(normalized_url)

                    # 查询上次在榜（last_crawl_time = prev_crawl_time）但这次不在榜的新闻
                    # 这些新闻是"第一次脱榜"，需要记录
                    cursor.execute("""
                        SELECT id, url FROM news_items
                        WHERE platform_id = ?
                          AND last_crawl_time = ?
                          AND url != ''
                    """, (source_id, prev_crawl_time))

                    for row in cursor.fetchall():
                        news_id, url = row[0], row[1]
                        if url not in current_urls:
                            # 插入脱榜记录（rank=0 表示脱榜）
                            cursor.execute("""
                                INSERT INTO rank_history
                                (news_item_id, rank, crawl_time, created_at)
                                VALUES (?, 0, ?, ?)
                            """, (news_id, data.crawl_time, now_str))
                            off_list_count += 1

            # 记录抓取信息
            cursor.execute("""
                INSERT OR REPLACE INTO crawl_records
                (crawl_time, total_items, created_at)
                VALUES (?, ?, ?)
            """, (data.crawl_time, total_items, now_str))

            # 获取刚插入的 crawl_record 的 ID
            cursor.execute("""
                SELECT id FROM crawl_records WHERE crawl_time = ?
            """, (data.crawl_time,))
            record_row = cursor.fetchone()
            if record_row:
                crawl_record_id = record_row[0]

                # 记录成功的来源
                for source_id in success_sources:
                    cursor.execute("""
                        INSERT OR REPLACE INTO crawl_source_status
                        (crawl_record_id, platform_id, status)
                        VALUES (?, ?, 'success')
                    """, (crawl_record_id, source_id))

                # 记录失败的来源
                for failed_id in data.failed_ids:
                    # 确保失败的平台也在 platforms 表中
                    cursor.execute("""
                        INSERT OR IGNORE INTO platforms (id, name, updated_at)
                        VALUES (?, ?, ?)
                    """, (failed_id, failed_id, now_str))

                    cursor.execute("""
                        INSERT OR REPLACE INTO crawl_source_status
                        (crawl_record_id, platform_id, status)
                        VALUES (?, ?, 'failed')
                    """, (crawl_record_id, failed_id))

            conn.commit()

            return True, new_count, updated_count, title_changed_count, off_list_count

        except Exception as e:
            print(f"{log_prefix} 保存失败: {e}")
            return False, 0, 0, 0, 0

    def _get_today_all_data_impl(self, date: Optional[str] = None) -> Optional[NewsData]:
        """
        获取指定日期的所有新闻数据（合并后）

        Args:
            date: 日期字符串，默认为今天

        Returns:
            合并后的新闻数据
        """
        try:
            conn = self._get_connection(date)
            cursor = conn.cursor()

            # 获取所有新闻数据（包含 id 用于查询排名历史）
            cursor.execute("""
                SELECT n.id, n.title, n.platform_id, p.name as platform_name,
                       n.rank, n.url, n.mobile_url,
                       n.first_crawl_time, n.last_crawl_time, n.crawl_count
                FROM news_items n
                LEFT JOIN platforms p ON n.platform_id = p.id
                ORDER BY n.platform_id, n.last_crawl_time
            """)

            rows = cursor.fetchall()
            if not rows:
                return None

            # 收集所有 news_item_id
            news_ids = [row[0] for row in rows]

            # 批量查询排名历史（同时获取时间和排名）
            # 过滤逻辑：只保留 last_crawl_time 之前的脱榜记录（rank=0）
            # 这样可以避免显示新闻永久脱榜后的无意义记录
            rank_history_map: Dict[int, List[int]] = {}
            rank_timeline_map: Dict[int, List[Dict[str, Any]]] = {}
            if news_ids:
                placeholders = ",".join("?" * len(news_ids))
                cursor.execute(f"""
                    SELECT rh.news_item_id, rh.rank, rh.crawl_time
                    FROM rank_history rh
                    JOIN news_items ni ON rh.news_item_id = ni.id
                    WHERE rh.news_item_id IN ({placeholders})
                      AND NOT (rh.rank = 0 AND rh.crawl_time > ni.last_crawl_time)
                    ORDER BY rh.news_item_id, rh.crawl_time
                """, news_ids)
                for rh_row in cursor.fetchall():
                    news_id, rank, crawl_time = rh_row[0], rh_row[1], rh_row[2]

                    # 构建 ranks 列表（去重，排除脱榜记录 rank=0）
                    if news_id not in rank_history_map:
                        rank_history_map[news_id] = []
                    if rank != 0 and rank not in rank_history_map[news_id]:
                        rank_history_map[news_id].append(rank)

                    # 构建 rank_timeline 列表（完整时间线，包含脱榜）
                    if news_id not in rank_timeline_map:
                        rank_timeline_map[news_id] = []
                    # 提取时间部分（HH:MM）
                    time_part = crawl_time.split()[1][:5] if ' ' in crawl_time else crawl_time[:5]
                    rank_timeline_map[news_id].append({
                        "time": time_part,
                        "rank": rank if rank != 0 else None  # 0 转为 None 表示脱榜
                    })

            # 按 platform_id 分组
            items: Dict[str, List[NewsItem]] = {}
            id_to_name: Dict[str, str] = {}
            crawl_date = self._format_date_folder(date)

            for row in rows:
                news_id = row[0]
                platform_id = row[2]
                title = row[1]
                platform_name = row[3] or platform_id

                id_to_name[platform_id] = platform_name

                if platform_id not in items:
                    items[platform_id] = []

                # 获取排名历史，如果没有则使用当前排名
                ranks = rank_history_map.get(news_id, [row[4]])
                rank_timeline = rank_timeline_map.get(news_id, [])

                items[platform_id].append(NewsItem(
                    title=title,
                    source_id=platform_id,
                    source_name=platform_name,
                    rank=row[4],
                    url=row[5] or "",
                    mobile_url=row[6] or "",
                    crawl_time=row[8],  # last_crawl_time
                    ranks=ranks,
                    first_time=row[7],  # first_crawl_time
                    last_time=row[8],   # last_crawl_time
                    count=row[9],       # crawl_count
                    rank_timeline=rank_timeline,
                ))

            final_items = items

            # 获取失败的来源
            cursor.execute("""
                SELECT DISTINCT css.platform_id
                FROM crawl_source_status css
                JOIN crawl_records cr ON css.crawl_record_id = cr.id
                WHERE css.status = 'failed'
            """)
            failed_ids = [row[0] for row in cursor.fetchall()]

            # 获取最新的抓取时间
            cursor.execute("""
                SELECT crawl_time FROM crawl_records
                ORDER BY crawl_time DESC
                LIMIT 1
            """)

            time_row = cursor.fetchone()
            crawl_time = time_row[0] if time_row else self._format_time_filename()

            return NewsData(
                date=crawl_date,
                crawl_time=crawl_time,
                items=final_items,
                id_to_name=id_to_name,
                failed_ids=failed_ids,
            )

        except Exception as e:
            print(f"[存储] 读取数据失败: {e}")
            return None

    def _get_latest_crawl_data_impl(self, date: Optional[str] = None) -> Optional[NewsData]:
        """
        获取最新一次抓取的数据

        Args:
            date: 日期字符串，默认为今天

        Returns:
            最新抓取的新闻数据
        """
        try:
            conn = self._get_connection(date)
            cursor = conn.cursor()

            # 获取最新的抓取时间
            cursor.execute("""
                SELECT crawl_time FROM crawl_records
                ORDER BY crawl_time DESC
                LIMIT 1
            """)

            time_row = cursor.fetchone()
            if not time_row:
                return None

            latest_time = time_row[0]

            # 获取该时间的新闻数据（包含 id 用于查询排名历史）
            cursor.execute("""
                SELECT n.id, n.title, n.platform_id, p.name as platform_name,
                       n.rank, n.url, n.mobile_url,
                       n.first_crawl_time, n.last_crawl_time, n.crawl_count
                FROM news_items n
                LEFT JOIN platforms p ON n.platform_id = p.id
                WHERE n.last_crawl_time = ?
            """, (latest_time,))

            rows = cursor.fetchall()
            if not rows:
                return None

            # 收集所有 news_item_id
            news_ids = [row[0] for row in rows]

            # 批量查询排名历史（同时获取时间和排名）
            # 过滤逻辑：只保留 last_crawl_time 之前的脱榜记录（rank=0）
            # 这样可以避免显示新闻永久脱榜后的无意义记录
            rank_history_map: Dict[int, List[int]] = {}
            rank_timeline_map: Dict[int, List[Dict[str, Any]]] = {}
            if news_ids:
                placeholders = ",".join("?" * len(news_ids))
                cursor.execute(f"""
                    SELECT rh.news_item_id, rh.rank, rh.crawl_time
                    FROM rank_history rh
                    JOIN news_items ni ON rh.news_item_id = ni.id
                    WHERE rh.news_item_id IN ({placeholders})
                      AND NOT (rh.rank = 0 AND rh.crawl_time > ni.last_crawl_time)
                    ORDER BY rh.news_item_id, rh.crawl_time
                """, news_ids)
                for rh_row in cursor.fetchall():
                    news_id, rank, crawl_time = rh_row[0], rh_row[1], rh_row[2]

                    # 构建 ranks 列表（去重，排除脱榜记录 rank=0）
                    if news_id not in rank_history_map:
                        rank_history_map[news_id] = []
                    if rank != 0 and rank not in rank_history_map[news_id]:
                        rank_history_map[news_id].append(rank)

                    # 构建 rank_timeline 列表（完整时间线，包含脱榜）
                    if news_id not in rank_timeline_map:
                        rank_timeline_map[news_id] = []
                    # 提取时间部分（HH:MM）
                    time_part = crawl_time.split()[1][:5] if ' ' in crawl_time else crawl_time[:5]
                    rank_timeline_map[news_id].append({
                        "time": time_part,
                        "rank": rank if rank != 0 else None  # 0 转为 None 表示脱榜
                    })

            items: Dict[str, List[NewsItem]] = {}
            id_to_name: Dict[str, str] = {}
            crawl_date = self._format_date_folder(date)

            for row in rows:
                news_id = row[0]
                platform_id = row[2]
                platform_name = row[3] or platform_id
                id_to_name[platform_id] = platform_name

                if platform_id not in items:
                    items[platform_id] = []

                # 获取排名历史，如果没有则使用当前排名
                ranks = rank_history_map.get(news_id, [row[4]])
                rank_timeline = rank_timeline_map.get(news_id, [])

                items[platform_id].append(NewsItem(
                    title=row[1],
                    source_id=platform_id,
                    source_name=platform_name,
                    rank=row[4],
                    url=row[5] or "",
                    mobile_url=row[6] or "",
                    crawl_time=row[8],  # last_crawl_time
                    ranks=ranks,
                    first_time=row[7],  # first_crawl_time
                    last_time=row[8],   # last_crawl_time
                    count=row[9],       # crawl_count
                    rank_timeline=rank_timeline,
                ))

            # 获取失败的来源（针对最新一次抓取）
            cursor.execute("""
                SELECT css.platform_id
                FROM crawl_source_status css
                JOIN crawl_records cr ON css.crawl_record_id = cr.id
                WHERE cr.crawl_time = ? AND css.status = 'failed'
            """, (latest_time,))

            failed_ids = [row[0] for row in cursor.fetchall()]

            return NewsData(
                date=crawl_date,
                crawl_time=latest_time,
                items=items,
                id_to_name=id_to_name,
                failed_ids=failed_ids,
            )

        except Exception as e:
            print(f"[存储] 获取最新数据失败: {e}")
            return None

    def _detect_new_titles_impl(self, current_data: NewsData) -> Dict[str, Dict]:
        """
        检测新增的标题

        该方法比较当前抓取数据与历史数据，找出新增的标题。
        关键逻辑：只有在历史批次中从未出现过的标题才算新增。

        Args:
            current_data: 当前抓取的数据

        Returns:
            新增的标题数据 {source_id: {title: NewsItem}}
        """
        try:
            # 获取历史数据
            historical_data = self._get_today_all_data_impl(current_data.date)

            if not historical_data:
                # 没有历史数据，所有都是新的
                new_titles = {}
                for source_id, news_list in current_data.items.items():
                    new_titles[source_id] = {item.title: item for item in news_list}
                return new_titles

            # 获取当前批次时间
            current_time = current_data.crawl_time

            # 收集历史标题（first_time < current_time 的标题）
            # 这样可以正确处理同一标题因 URL 变化而产生多条记录的情况
            historical_titles: Dict[str, set] = {}
            for source_id, news_list in historical_data.items.items():
                historical_titles[source_id] = set()
                for item in news_list:
                    first_time = item.first_time or item.crawl_time
                    if first_time < current_time:
                        historical_titles[source_id].add(item.title)

            # 检查是否有历史数据
            has_historical_data = any(len(titles) > 0 for titles in historical_titles.values())
            if not has_historical_data:
                # 第一次抓取，没有"新增"概念
                return {}

            # 检测新增
            new_titles = {}
            for source_id, news_list in current_data.items.items():
                hist_set = historical_titles.get(source_id, set())
                for item in news_list:
                    if item.title not in hist_set:
                        if source_id not in new_titles:
                            new_titles[source_id] = {}
                        new_titles[source_id][item.title] = item

            return new_titles

        except Exception as e:
            print(f"[存储] 检测新标题失败: {e}")
            return {}

    def _is_first_crawl_today_impl(self, date: Optional[str] = None) -> bool:
        """
        检查是否是当天第一次抓取

        Args:
            date: 日期字符串，默认为今天

        Returns:
            是否是第一次抓取
        """
        try:
            conn = self._get_connection(date)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT COUNT(*) as count FROM crawl_records
            """)

            row = cursor.fetchone()
            count = row[0] if row else 0

            # 如果只有一条或没有记录，视为第一次抓取
            return count <= 1

        except Exception as e:
            print(f"[存储] 检查首次抓取失败: {e}")
            return True

    def _get_crawl_times_impl(self, date: Optional[str] = None) -> List[str]:
        """
        获取指定日期的所有抓取时间列表

        Args:
            date: 日期字符串，默认为今天

        Returns:
            抓取时间列表（按时间排序）
        """
        try:
            conn = self._get_connection(date)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT crawl_time FROM crawl_records
                ORDER BY crawl_time
            """)

            rows = cursor.fetchall()
            return [row[0] for row in rows]

        except Exception as e:
            print(f"[存储] 获取抓取时间列表失败: {e}")
            return []

    # ========================================
    # 时间段执行记录（调度系统）
    # ========================================

    def _has_period_executed_impl(self, date_str: str, period_key: str, action: str) -> bool:
        """
        检查指定时间段的某个 action 今天是否已执行

        Args:
            date_str: 日期字符串 YYYY-MM-DD
            period_key: 时间段 key
            action: 动作类型 (analyze / push)

        Returns:
            是否已执行
        """
        try:
            conn = self._get_connection(date_str)
            cursor = conn.cursor()

            # 先检查表是否存在
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='period_executions'
            """)
            if not cursor.fetchone():
                return False

            cursor.execute("""
                SELECT 1 FROM period_executions
                WHERE execution_date = ? AND period_key = ? AND action = ?
            """, (date_str, period_key, action))

            return cursor.fetchone() is not None

        except Exception as e:
            print(f"[存储] 检查时间段执行记录失败: {e}")
            return False

    def _record_period_execution_impl(self, date_str: str, period_key: str, action: str) -> bool:
        """
        记录时间段的 action 执行

        Args:
            date_str: 日期字符串 YYYY-MM-DD
            period_key: 时间段 key
            action: 动作类型 (analyze / push)

        Returns:
            是否记录成功
        """
        try:
            conn = self._get_connection(date_str)
            cursor = conn.cursor()

            # 确保表存在
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS period_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    execution_date TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    action TEXT NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(execution_date, period_key, action)
                )
            """)

            now_str = self._get_configured_time().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
                INSERT OR IGNORE INTO period_executions (execution_date, period_key, action, executed_at)
                VALUES (?, ?, ?, ?)
            """, (date_str, period_key, action, now_str))

            conn.commit()
            return True

        except Exception as e:
            print(f"[存储] 记录时间段执行失败: {e}")
            return False

    # ========================================
    # RSS 数据存储
    # ========================================

    def _save_rss_data_impl(self, data: RSSData, log_prefix: str = "[存储]") -> tuple[bool, int, int]:
        """
        保存 RSS 数据到 SQLite（以 URL 为唯一标识）

        Args:
            data: RSS 数据
            log_prefix: 日志前缀

        Returns:
            (success, new_count, updated_count)
        """
        try:
            conn = self._get_connection(data.date, db_type="rss")
            cursor = conn.cursor()

            now_str = self._get_configured_time().strftime("%Y-%m-%d %H:%M:%S")

            # 同步 RSS 源信息到 rss_feeds 表
            for feed_id, feed_name in data.id_to_name.items():
                cursor.execute("""
                    INSERT INTO rss_feeds (id, name, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        updated_at = excluded.updated_at
                """, (feed_id, feed_name, now_str))

            # 统计计数器
            new_count = 0
            updated_count = 0

            for feed_id, rss_list in data.items.items():
                for item in rss_list:
                    try:
                        # 检查是否已存在（通过 URL + feed_id）
                        if item.url:
                            cursor.execute("""
                                SELECT id, title FROM rss_items
                                WHERE url = ? AND feed_id = ?
                            """, (item.url, feed_id))
                            existing = cursor.fetchone()

                            if existing:
                                # 已存在，更新记录
                                existing_id = existing[0]
                                cursor.execute("""
                                    UPDATE rss_items SET
                                        title = ?,
                                        published_at = ?,
                                        summary = ?,
                                        author = ?,
                                        last_crawl_time = ?,
                                        crawl_count = crawl_count + 1,
                                        updated_at = ?
                                    WHERE id = ?
                                """, (item.title, item.published_at, item.summary,
                                      item.author, data.crawl_time, now_str, existing_id))
                                updated_count += 1
                            else:
                                # 不存在，插入新记录（使用 ON CONFLICT 兜底处理并发/竞争场景）
                                cursor.execute("""
                                    INSERT INTO rss_items
                                    (title, feed_id, url, published_at, summary, author,
                                     first_crawl_time, last_crawl_time, crawl_count,
                                     created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                                    ON CONFLICT(url, feed_id) DO UPDATE SET
                                        title = excluded.title,
                                        published_at = excluded.published_at,
                                        summary = excluded.summary,
                                        author = excluded.author,
                                        last_crawl_time = excluded.last_crawl_time,
                                        crawl_count = crawl_count + 1,
                                        updated_at = excluded.updated_at
                                """, (item.title, feed_id, item.url, item.published_at,
                                      item.summary, item.author, data.crawl_time,
                                      data.crawl_time, now_str, now_str))
                                new_count += 1
                        else:
                            # URL 为空，用 try-except 处理重复
                            try:
                                cursor.execute("""
                                    INSERT INTO rss_items
                                    (title, feed_id, url, published_at, summary, author,
                                     first_crawl_time, last_crawl_time, crawl_count,
                                     created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                                """, (item.title, feed_id, "", item.published_at,
                                      item.summary, item.author, data.crawl_time,
                                      data.crawl_time, now_str, now_str))
                                new_count += 1
                            except sqlite3.IntegrityError:
                                # 重复的空 URL 条目，忽略
                                pass

                    except sqlite3.Error as e:
                        print(f"{log_prefix} 保存 RSS 条目失败 [{item.title[:30]}...]: {e}")

            total_items = new_count + updated_count

            # 记录抓取信息
            cursor.execute("""
                INSERT OR REPLACE INTO rss_crawl_records
                (crawl_time, total_items, created_at)
                VALUES (?, ?, ?)
            """, (data.crawl_time, total_items, now_str))

            # 记录抓取状态
            cursor.execute("""
                SELECT id FROM rss_crawl_records WHERE crawl_time = ?
            """, (data.crawl_time,))
            record_row = cursor.fetchone()
            if record_row:
                crawl_record_id = record_row[0]

                # 记录成功的源
                for feed_id in data.items.keys():
                    cursor.execute("""
                        INSERT OR REPLACE INTO rss_crawl_status
                        (crawl_record_id, feed_id, status)
                        VALUES (?, ?, 'success')
                    """, (crawl_record_id, feed_id))

                # 记录失败的源
                for failed_id in data.failed_ids:
                    cursor.execute("""
                        INSERT OR IGNORE INTO rss_feeds (id, name, updated_at)
                        VALUES (?, ?, ?)
                    """, (failed_id, failed_id, now_str))

                    cursor.execute("""
                        INSERT OR REPLACE INTO rss_crawl_status
                        (crawl_record_id, feed_id, status)
                        VALUES (?, ?, 'failed')
                    """, (crawl_record_id, failed_id))

            conn.commit()

            return True, new_count, updated_count

        except Exception as e:
            print(f"{log_prefix} 保存 RSS 数据失败: {e}")
            return False, 0, 0

    def _get_rss_data_impl(self, date: Optional[str] = None) -> Optional[RSSData]:
        """
        获取指定日期的所有 RSS 数据

        Args:
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            RSSData 对象，如果没有数据返回 None
        """
        try:
            conn = self._get_connection(date, db_type="rss")
            cursor = conn.cursor()

            # 获取所有 RSS 数据
            cursor.execute("""
                SELECT i.id, i.title, i.feed_id, f.name as feed_name,
                       i.url, i.published_at, i.summary, i.author,
                       i.first_crawl_time, i.last_crawl_time, i.crawl_count
                FROM rss_items i
                LEFT JOIN rss_feeds f ON i.feed_id = f.id
                ORDER BY i.published_at DESC
            """)

            rows = cursor.fetchall()
            if not rows:
                return None

            items: Dict[str, List[RSSItem]] = {}
            id_to_name: Dict[str, str] = {}
            crawl_date = self._format_date_folder(date)

            for row in rows:
                feed_id = row[2]
                feed_name = row[3] or feed_id

                id_to_name[feed_id] = feed_name

                if feed_id not in items:
                    items[feed_id] = []

                items[feed_id].append(RSSItem(
                    title=row[1],
                    feed_id=feed_id,
                    feed_name=feed_name,
                    url=row[4] or "",
                    published_at=row[5] or "",
                    summary=row[6] or "",
                    author=row[7] or "",
                    crawl_time=row[9],
                    first_time=row[8],
                    last_time=row[9],
                    count=row[10],
                ))

            # 获取最新的抓取时间
            cursor.execute("""
                SELECT crawl_time FROM rss_crawl_records
                ORDER BY crawl_time DESC
                LIMIT 1
            """)
            time_row = cursor.fetchone()
            crawl_time = time_row[0] if time_row else self._format_time_filename()

            # 获取失败的源
            cursor.execute("""
                SELECT DISTINCT cs.feed_id
                FROM rss_crawl_status cs
                JOIN rss_crawl_records cr ON cs.crawl_record_id = cr.id
                WHERE cs.status = 'failed'
            """)
            failed_ids = [row[0] for row in cursor.fetchall()]

            return RSSData(
                date=crawl_date,
                crawl_time=crawl_time,
                items=items,
                id_to_name=id_to_name,
                failed_ids=failed_ids,
            )

        except Exception as e:
            print(f"[存储] 读取 RSS 数据失败: {e}")
            return None

    def _detect_new_rss_items_impl(self, current_data: RSSData) -> Dict[str, List[RSSItem]]:
        """
        检测新增的 RSS 条目（增量模式）

        该方法比较当前抓取数据与历史数据，找出新增的 RSS 条目。
        关键逻辑：只有在历史批次中从未出现过的 URL 才算新增。

        Args:
            current_data: 当前抓取的 RSS 数据

        Returns:
            新增的 RSS 条目 {feed_id: [RSSItem, ...]}
        """
        try:
            # 获取历史数据
            historical_data = self._get_rss_data_impl(current_data.date)

            if not historical_data:
                # 没有历史数据，所有都是新的
                return current_data.items.copy()

            # 获取当前批次时间
            current_time = current_data.crawl_time

            # 收集历史 URL（first_time < current_time 的条目）
            historical_urls: Dict[str, set] = {}
            for feed_id, rss_list in historical_data.items.items():
                historical_urls[feed_id] = set()
                for item in rss_list:
                    first_time = item.first_time or item.crawl_time
                    if first_time < current_time:
                        if item.url:
                            historical_urls[feed_id].add(item.url)

            # 检查是否有历史数据
            has_historical_data = any(len(urls) > 0 for urls in historical_urls.values())
            if not has_historical_data:
                # 第一次抓取，没有"新增"概念
                return {}

            # 检测新增
            new_items: Dict[str, List[RSSItem]] = {}
            for feed_id, rss_list in current_data.items.items():
                hist_set = historical_urls.get(feed_id, set())
                for item in rss_list:
                    # 通过 URL 判断是否新增
                    if item.url and item.url not in hist_set:
                        if feed_id not in new_items:
                            new_items[feed_id] = []
                        new_items[feed_id].append(item)

            return new_items

        except Exception as e:
            print(f"[存储] 检测新 RSS 条目失败: {e}")
            return {}

    def _get_latest_rss_data_impl(self, date: Optional[str] = None) -> Optional[RSSData]:
        """
        获取最新一次抓取的 RSS 数据（当前榜单模式）

        Args:
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            最新抓取的 RSS 数据，如果没有数据返回 None
        """
        try:
            conn = self._get_connection(date, db_type="rss")
            cursor = conn.cursor()

            # 获取最新的抓取时间
            cursor.execute("""
                SELECT crawl_time FROM rss_crawl_records
                ORDER BY crawl_time DESC
                LIMIT 1
            """)

            time_row = cursor.fetchone()
            if not time_row:
                return None

            latest_time = time_row[0]

            # 获取该时间的 RSS 数据
            cursor.execute("""
                SELECT i.id, i.title, i.feed_id, f.name as feed_name,
                       i.url, i.published_at, i.summary, i.author,
                       i.first_crawl_time, i.last_crawl_time, i.crawl_count
                FROM rss_items i
                LEFT JOIN rss_feeds f ON i.feed_id = f.id
                WHERE i.last_crawl_time = ?
                ORDER BY i.published_at DESC
            """, (latest_time,))

            rows = cursor.fetchall()
            if not rows:
                return None

            items: Dict[str, List[RSSItem]] = {}
            id_to_name: Dict[str, str] = {}
            crawl_date = self._format_date_folder(date)

            for row in rows:
                feed_id = row[2]
                feed_name = row[3] or feed_id

                id_to_name[feed_id] = feed_name

                if feed_id not in items:
                    items[feed_id] = []

                items[feed_id].append(RSSItem(
                    title=row[1],
                    feed_id=feed_id,
                    feed_name=feed_name,
                    url=row[4] or "",
                    published_at=row[5] or "",
                    summary=row[6] or "",
                    author=row[7] or "",
                    crawl_time=row[9],
                    first_time=row[8],
                    last_time=row[9],
                    count=row[10],
                ))

            # 获取失败的源（针对最新一次抓取）
            cursor.execute("""
                SELECT cs.feed_id
                FROM rss_crawl_status cs
                JOIN rss_crawl_records cr ON cs.crawl_record_id = cr.id
                WHERE cr.crawl_time = ? AND cs.status = 'failed'
            """, (latest_time,))

            failed_ids = [row[0] for row in cursor.fetchall()]

            return RSSData(
                date=crawl_date,
                crawl_time=latest_time,
                items=items,
                id_to_name=id_to_name,
                failed_ids=failed_ids,
            )

        except Exception as e:
            print(f"[存储] 获取最新 RSS 数据失败: {e}")
            return None
