#!/usr/bin/env python3
# coding=utf-8
"""
迁移脚本：将 per-date SQLite 数据库迁移到 Rolling Window 架构

用法：
    python scripts/migrate_to_rolling_window.py [--data-dir output] [--hot-days 7] [--dry-run]

功能：
    1. 扫描 output/news/ 和 output/rss/ 目录下的 YYYY-MM-DD.db 文件
    2. 根据日期分类为热数据（recent）和冷数据（old）
    3. 合并到 current.db（热数据）和 archive.db（冷数据）
    4. 为所有记录设置 crawl_date 字段
    5. 支持断点续传和进度报告
"""

import argparse
import os
import re
import sqlite3
import sys
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple, Optional, Dict

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def parse_date_from_filename(filename: str) -> Optional[str]:
    """
    从文件名解析日期

    Args:
        filename: 文件名（如 2026-01-16.db）

    Returns:
        日期字符串（YYYY-MM-DD）或 None
    """
    # Remove .db suffix
    name = filename.replace('.db', '')

    # Match YYYY-MM-DD format
    match = re.match(r'^(\d{4}-\d{2}-\d{2})$', name)
    if match:
        return match.group(1)

    return None


def get_hot_date_cutoff(hot_days: int) -> str:
    """
    获取热数据的截止日期

    Args:
        hot_days: 热数据保留天数

    Returns:
        截止日期字符串（YYYY-MM-DD）
    """
    cutoff = datetime.now() - timedelta(days=hot_days)
    return cutoff.strftime("%Y-%m-%d")


def scan_db_files(data_dir: Path, db_type: str) -> List[Tuple[Path, str]]:
    """
    扫描指定目录下的 per-date 数据库文件

    Args:
        data_dir: 数据目录
        db_type: 数据库类型（news 或 rss）

    Returns:
        [(文件路径, 日期字符串), ...]
    """
    db_dir = data_dir / db_type
    if not db_dir.exists():
        return []

    files = []
    for db_file in db_dir.glob("*.db"):
        # Skip current.db and archive.db
        if db_file.name in ["current.db", "archive.db"]:
            continue

        date = parse_date_from_filename(db_file.name)
        if date:
            files.append((db_file, date))

    # Sort by date
    files.sort(key=lambda x: x[1])
    return files


def init_target_db(db_path: Path, db_type: str) -> sqlite3.Connection:
    """
    初始化目标数据库

    Args:
        db_path: 数据库路径
        db_type: 数据库类型（news 或 rss）

    Returns:
        数据库连接
    """
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # Load schema
    if db_type == "rss":
        schema_path = project_root / "trendradar" / "storage" / "rss_schema.sql"
    else:
        schema_path = project_root / "trendradar" / "storage" / "schema.sql"

    if schema_path.exists():
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        conn.commit()

    return conn


def migrate_news_db(
    source_path: Path,
    source_date: str,
    target_conn: sqlite3.Connection,
    dry_run: bool = False,
) -> int:
    """
    迁移新闻数据库

    Args:
        source_path: 源数据库路径
        source_date: 源数据库日期
        target_conn: 目标数据库连接
        dry_run: 是否只模拟运行

    Returns:
        迁移的记录数
    """
    source_conn = sqlite3.connect(str(source_path))
    source_conn.row_factory = sqlite3.Row
    source_cursor = source_conn.cursor()
    target_cursor = target_conn.cursor()

    migrated_count = 0

    try:
        # 1. Migrate platforms
        source_cursor.execute("SELECT id, name, is_active, updated_at FROM platforms")
        for row in source_cursor.fetchall():
            if not dry_run:
                target_cursor.execute("""
                    INSERT INTO platforms (id, name, is_active, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        updated_at = excluded.updated_at
                """, (row[0], row[1], row[2], row[3]))

        # 2. Migrate news_items
        source_cursor.execute("""
            SELECT id, title, platform_id, rank, url, mobile_url,
                   first_crawl_time, last_crawl_time, crawl_count,
                   created_at, updated_at
            FROM news_items
        """)

        news_id_map: Dict[int, int] = {}  # old_id -> new_id

        for row in source_cursor.fetchall():
            old_id = row[0]
            title, platform_id, rank, url, mobile_url = row[1], row[2], row[3], row[4], row[5]
            first_crawl_time, last_crawl_time, crawl_count = row[6], row[7], row[8]
            created_at, updated_at = row[9], row[10]

            if not dry_run:
                # Check if record already exists (for non-empty URLs)
                existing_id = None
                if url:
                    target_cursor.execute(
                        "SELECT id, first_crawl_time, last_crawl_time, crawl_count, crawl_date "
                        "FROM news_items WHERE url = ? AND platform_id = ?",
                        (url, platform_id)
                    )
                    existing = target_cursor.fetchone()
                    if existing:
                        existing_id = existing[0]
                        # Merge: keep earliest first_crawl_time, latest last_crawl_time
                        merged_first = min(existing[1], first_crawl_time) if existing[1] else first_crawl_time
                        merged_last = max(existing[2], last_crawl_time) if existing[2] else last_crawl_time
                        merged_count = (existing[3] or 0) + crawl_count
                        # Use crawl_date from record with latest last_crawl_time
                        merged_crawl_date = source_date if last_crawl_time >= (existing[2] or '') else existing[4]

                        target_cursor.execute("""
                            UPDATE news_items SET
                                title = ?, rank = ?, mobile_url = ?,
                                crawl_date = ?, first_crawl_time = ?,
                                last_crawl_time = ?, crawl_count = ?, updated_at = ?
                            WHERE id = ?
                        """, (title, rank, mobile_url, merged_crawl_date,
                              merged_first, merged_last, merged_count, updated_at, existing_id))

                if existing_id:
                    new_id = existing_id
                else:
                    # Insert new record
                    target_cursor.execute("""
                        INSERT INTO news_items
                        (title, platform_id, rank, url, mobile_url, crawl_date,
                         first_crawl_time, last_crawl_time, crawl_count,
                         created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (title, platform_id, rank, url, mobile_url, source_date,
                          first_crawl_time, last_crawl_time, crawl_count,
                          created_at, updated_at))
                    new_id = target_cursor.lastrowid

                news_id_map[old_id] = new_id
            migrated_count += 1

        # 3. Migrate rank_history
        if not dry_run and news_id_map:
            source_cursor.execute("""
                SELECT news_item_id, rank, crawl_time, created_at
                FROM rank_history
            """)
            for row in source_cursor.fetchall():
                old_news_id = row[0]
                if old_news_id in news_id_map:
                    new_news_id = news_id_map[old_news_id]
                    target_cursor.execute("""
                        INSERT INTO rank_history
                        (news_item_id, rank, crawl_time, created_at)
                        VALUES (?, ?, ?, ?)
                    """, (new_news_id, row[1], row[2], row[3]))

        # 4. Migrate title_changes
        if not dry_run and news_id_map:
            source_cursor.execute("""
                SELECT news_item_id, old_title, new_title, changed_at
                FROM title_changes
            """)
            for row in source_cursor.fetchall():
                old_news_id = row[0]
                if old_news_id in news_id_map:
                    new_news_id = news_id_map[old_news_id]
                    target_cursor.execute("""
                        INSERT INTO title_changes
                        (news_item_id, old_title, new_title, changed_at)
                        VALUES (?, ?, ?, ?)
                    """, (new_news_id, row[1], row[2], row[3]))

        # 5. Migrate crawl_records and crawl_source_status
        if not dry_run:
            source_cursor.execute("""
                SELECT crawl_time, total_items, created_at
                FROM crawl_records
            """)
            for row in source_cursor.fetchall():
                target_cursor.execute("""
                    INSERT OR IGNORE INTO crawl_records
                    (crawl_time, total_items, created_at)
                    VALUES (?, ?, ?)
                """, (row[0], row[1], row[2]))

        if not dry_run:
            target_conn.commit()

    except Exception as e:
        print(f"  Error migrating {source_path.name}: {e}")
        if not dry_run:
            target_conn.rollback()
        raise
    finally:
        source_conn.close()

    return migrated_count


def migrate_rss_db(
    source_path: Path,
    source_date: str,
    target_conn: sqlite3.Connection,
    dry_run: bool = False,
) -> int:
    """
    迁移 RSS 数据库

    Args:
        source_path: 源数据库路径
        source_date: 源数据库日期
        target_conn: 目标数据库连接
        dry_run: 是否只模拟运行

    Returns:
        迁移的记录数
    """
    source_conn = sqlite3.connect(str(source_path))
    source_conn.row_factory = sqlite3.Row
    source_cursor = source_conn.cursor()
    target_cursor = target_conn.cursor()

    migrated_count = 0

    try:
        # 1. Migrate rss_feeds
        source_cursor.execute("""
            SELECT id, name, feed_url, is_active, last_fetch_time,
                   last_fetch_status, item_count, created_at, updated_at
            FROM rss_feeds
        """)
        for row in source_cursor.fetchall():
            if not dry_run:
                target_cursor.execute("""
                    INSERT INTO rss_feeds
                    (id, name, feed_url, is_active, last_fetch_time,
                     last_fetch_status, item_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        updated_at = excluded.updated_at
                """, row)

        # 2. Migrate rss_items
        source_cursor.execute("""
            SELECT title, feed_id, url, published_at, summary, author,
                   first_crawl_time, last_crawl_time, crawl_count,
                   created_at, updated_at
            FROM rss_items
        """)

        for row in source_cursor.fetchall():
            title, feed_id, url, published_at, summary, author = row[0], row[1], row[2], row[3], row[4], row[5]
            first_crawl_time, last_crawl_time, crawl_count = row[6], row[7], row[8]
            created_at, updated_at = row[9], row[10]

            if not dry_run:
                # Check if record already exists
                existing = None
                if url:
                    target_cursor.execute(
                        "SELECT id, first_crawl_time, last_crawl_time, crawl_count, crawl_date "
                        "FROM rss_items WHERE url = ? AND feed_id = ?",
                        (url, feed_id)
                    )
                    existing = target_cursor.fetchone()

                if existing:
                    # Merge: keep earliest first_crawl_time, latest last_crawl_time
                    merged_first = min(existing[1], first_crawl_time) if existing[1] else first_crawl_time
                    merged_last = max(existing[2], last_crawl_time) if existing[2] else last_crawl_time
                    merged_count = (existing[3] or 0) + crawl_count
                    merged_crawl_date = source_date if last_crawl_time >= (existing[2] or '') else existing[4]

                    target_cursor.execute("""
                        UPDATE rss_items SET
                            title = ?, summary = ?, author = ?,
                            crawl_date = ?, first_crawl_time = ?,
                            last_crawl_time = ?, crawl_count = ?, updated_at = ?
                        WHERE id = ?
                    """, (title, summary, author, merged_crawl_date,
                          merged_first, merged_last, merged_count, updated_at, existing[0]))
                else:
                    # Insert new record
                    target_cursor.execute("""
                        INSERT INTO rss_items
                        (title, feed_id, url, published_at, summary, author,
                         crawl_date, first_crawl_time, last_crawl_time, crawl_count,
                         created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (title, feed_id, url, published_at, summary, author,
                          source_date, first_crawl_time, last_crawl_time, crawl_count,
                          created_at, updated_at))
            migrated_count += 1

        # 3. Migrate crawl records
        if not dry_run:
            source_cursor.execute("""
                SELECT crawl_time, total_items, created_at
                FROM rss_crawl_records
            """)
            for row in source_cursor.fetchall():
                target_cursor.execute("""
                    INSERT OR IGNORE INTO rss_crawl_records
                    (crawl_time, total_items, created_at)
                    VALUES (?, ?, ?)
                """, (row[0], row[1], row[2]))

        if not dry_run:
            target_conn.commit()

    except Exception as e:
        print(f"  Error migrating {source_path.name}: {e}")
        if not dry_run:
            target_conn.rollback()
        raise
    finally:
        source_conn.close()

    return migrated_count


def update_db_metadata(conn: sqlite3.Connection, db_name: str, date_range: Tuple[str, str]) -> None:
    """
    更新数据库元数据

    Args:
        conn: 数据库连接
        db_name: 数据库名称（current 或 archive）
        date_range: (start_date, end_date)
    """
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for key, value in [
        ("db_type", db_name),
        ("date_range_start", date_range[0]),
        ("date_range_end", date_range[1]),
        ("migrated_at", now_str),
    ]:
        cursor.execute("""
            INSERT INTO db_metadata (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (key, value, now_str))

    conn.commit()


def run_vacuum(db_path: Path) -> None:
    """运行 VACUUM 优化数据库"""
    conn = sqlite3.connect(str(db_path))
    conn.execute("VACUUM")
    conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate per-date SQLite databases to Rolling Window architecture"
    )
    parser.add_argument(
        "--data-dir",
        default="output",
        help="Data directory (default: output)"
    )
    parser.add_argument(
        "--hot-days",
        type=int,
        default=7,
        help="Number of days to keep in current.db (default: 7)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration without making changes"
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create backup of original files before migration"
    )
    parser.add_argument(
        "--delete-originals",
        action="store_true",
        help="Delete original per-date files after successful migration"
    )

    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    hot_days = args.hot_days
    dry_run = args.dry_run
    cutoff_date = get_hot_date_cutoff(hot_days)

    print("=" * 60)
    print("Rolling Window Migration Tool")
    print("=" * 60)
    print(f"Data directory: {data_dir}")
    print(f"Hot days: {hot_days}")
    print(f"Cutoff date: {cutoff_date} (older dates -> archive.db)")
    print(f"Dry run: {dry_run}")
    print()

    for db_type in ["news", "rss"]:
        print(f"\n{'=' * 40}")
        print(f"Migrating {db_type.upper()} databases")
        print("=" * 40)

        # Scan files
        files = scan_db_files(data_dir, db_type)
        if not files:
            print(f"  No per-date {db_type} databases found, skipping.")
            continue

        print(f"  Found {len(files)} database files to migrate")

        # Classify files
        hot_files = [(f, d) for f, d in files if d >= cutoff_date]
        cold_files = [(f, d) for f, d in files if d < cutoff_date]

        print(f"  Hot files (-> current.db): {len(hot_files)}")
        print(f"  Cold files (-> archive.db): {len(cold_files)}")

        # Create backup if requested
        if args.backup and not dry_run:
            backup_dir = data_dir / db_type / "backup_before_migration"
            backup_dir.mkdir(exist_ok=True)
            for f, d in files:
                shutil.copy2(f, backup_dir / f.name)
            print(f"  Backup created in {backup_dir}")

        # Initialize target databases
        current_path = data_dir / db_type / "current.db"
        archive_path = data_dir / db_type / "archive.db"

        current_conn = None
        archive_conn = None

        if not dry_run:
            if hot_files:
                current_conn = init_target_db(current_path, db_type)
            if cold_files:
                archive_conn = init_target_db(archive_path, db_type)

        # Migrate hot files
        total_hot = 0
        hot_dates = []
        for source_path, source_date in hot_files:
            print(f"  Migrating {source_path.name} -> current.db...", end=" ")
            if db_type == "news":
                count = migrate_news_db(source_path, source_date, current_conn, dry_run)
            else:
                count = migrate_rss_db(source_path, source_date, current_conn, dry_run)
            total_hot += count
            hot_dates.append(source_date)
            print(f"{count} records")

        # Migrate cold files
        total_cold = 0
        cold_dates = []
        for source_path, source_date in cold_files:
            print(f"  Migrating {source_path.name} -> archive.db...", end=" ")
            if db_type == "news":
                count = migrate_news_db(source_path, source_date, archive_conn, dry_run)
            else:
                count = migrate_rss_db(source_path, source_date, archive_conn, dry_run)
            total_cold += count
            cold_dates.append(source_date)
            print(f"{count} records")

        # Update metadata and close connections
        if not dry_run:
            if current_conn and hot_dates:
                update_db_metadata(current_conn, "current", (min(hot_dates), max(hot_dates)))
                current_conn.close()
                print(f"  Running VACUUM on current.db...")
                run_vacuum(current_path)

            if archive_conn and cold_dates:
                update_db_metadata(archive_conn, "archive", (min(cold_dates), max(cold_dates)))
                archive_conn.close()
                print(f"  Running VACUUM on archive.db...")
                run_vacuum(archive_path)

        # Delete originals if requested
        if args.delete_originals and not dry_run:
            for source_path, _ in files:
                source_path.unlink()
            print(f"  Deleted {len(files)} original files")

        print(f"\n  {db_type.upper()} Summary:")
        print(f"    current.db: {total_hot} records from {len(hot_files)} files")
        print(f"    archive.db: {total_cold} records from {len(cold_files)} files")

    print("\n" + "=" * 60)
    print("Migration complete!" + (" (DRY RUN)" if dry_run else ""))
    print("=" * 60)

    if not dry_run:
        print("\nNext steps:")
        print("1. Verify the new databases work correctly")
        print("2. Update config.yaml to use rolling_window backend")
        print("3. Delete original per-date files if not already deleted:")
        print("   python scripts/migrate_to_rolling_window.py --delete-originals")


if __name__ == "__main__":
    main()
