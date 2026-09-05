import importlib.util
import sqlite3
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parent.parent / "trendradar" / "storage" / "sqlite_mixin.py"
spec = importlib.util.spec_from_file_location("trendradar_sqlite_mixin_test", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)
SQLiteStorageMixin = module.SQLiteStorageMixin


class _DummyStorage(SQLiteStorageMixin):
    def __init__(self, db_path: Path):
        self.db_path = db_path

    def _get_connection(self, date=None, db_type="news"):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _get_configured_time(self):
        return datetime(2026, 5, 17, 12, 0, 0)

    def _format_date_folder(self, date=None):
        return "2026-05-17"

    def _format_time_filename(self):
        return "12-00"


class RssGuidMigrationTest(unittest.TestCase):
    def test_init_tables_migrates_legacy_rss_db_with_missing_guid_column(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "legacy.db"
            conn = sqlite3.connect(db_path)
            conn.executescript(
                """
                CREATE TABLE rss_feeds (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL
                );
                CREATE TABLE rss_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    feed_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    published_at TEXT,
                    summary TEXT,
                    author TEXT,
                    first_crawl_time TEXT NOT NULL,
                    last_crawl_time TEXT NOT NULL,
                    crawl_count INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO rss_items (
                    title, feed_id, url, published_at, summary, author,
                    first_crawl_time, last_crawl_time, crawl_count
                ) VALUES (
                    'test', 'feed-1', 'https://example.com/a', '2026-05-17T00:00:00',
                    'summary', 'author', '12:00', '12:00', 1
                );
                """
            )
            conn.commit()
            conn.close()

            storage = _DummyStorage(db_path)
            with storage._get_connection(db_type="rss") as conn2:
                storage._init_tables(conn2, db_type="rss")
                columns = [row[1] for row in conn2.execute("PRAGMA table_info(rss_items)").fetchall()]
                self.assertIn("guid", columns)
                guid = conn2.execute("SELECT guid FROM rss_items WHERE id = 1").fetchone()[0]
                self.assertEqual(guid, "https://example.com/a")


if __name__ == "__main__":
    unittest.main()
