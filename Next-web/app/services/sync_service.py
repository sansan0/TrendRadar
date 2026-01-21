import os
import glob
import asyncio
import aiosqlite
import logging
from datetime import datetime
from sqlalchemy import select, func, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from app.core.config import config
from app.core.database import AsyncSessionLocal
from app.models.news import NewsItem, SyncLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SyncService:
    def __init__(self):
        self.output_dir = config.OUTPUT_DIR

    async def run_sync(self):
        """同步逻辑主入口"""
        logger.info("Starting sync process...")
        log_entry = SyncLog(start_time=datetime.utcnow(), status="RUNNING")

        async with AsyncSessionLocal() as session:
            session.add(log_entry)
            await session.commit()
            await session.refresh(log_entry)

        try:
            total_inserted = 0

            # 查找所有 SQLite 文件
            db_files = sorted(glob.glob(os.path.join(self.output_dir, "*.db")))
            logger.info(f"Found {len(db_files)} database files in {self.output_dir}")

            for db_file in db_files:
                inserted_count = await self._process_db_file(db_file)
                total_inserted += inserted_count

            # 成功后更新日志
            async with AsyncSessionLocal() as session:
                stmt = select(SyncLog).where(SyncLog.id == log_entry.id)
                result = await session.execute(stmt)
                current_log = result.scalar_one()

                current_log.end_time = datetime.utcnow()
                current_log.status = "SUCCESS"
                current_log.new_items_count = total_inserted
                await session.commit()

            logger.info(f"Sync completed successfully. Total new items: {total_inserted}")

        except Exception as e:
            logger.error(f"Sync failed: {e}")
            # 失败后更新日志
            async with AsyncSessionLocal() as session:
                stmt = select(SyncLog).where(SyncLog.id == log_entry.id)
                result = await session.execute(stmt)
                current_log = result.scalar_one()

                current_log.end_time = datetime.utcnow()
                current_log.status = "FAILED"
                current_log.error_msg = str(e)
                await session.commit()

    async def _process_db_file(self, db_path: str) -> int:
        """处理单个 SQLite 文件并同步到 MySQL"""
        filename = os.path.basename(db_path)
        source_date = filename.replace(".db", "") # 假设文件名格式为 YYYY-MM-DD.db

        logger.info(f"Processing {filename}...")

        inserted_count = 0

        try:
            async with aiosqlite.connect(db_path) as db:
                db.row_factory = aiosqlite.Row
                # 检查表是否存在（根据爬虫版本可能是 'news' 或 'news_items'）
                # 根据之前的探索，最近的 DB 中是 'news_items'
                try:
                    cursor = await db.execute("SELECT * FROM news_items")
                except aiosqlite.OperationalError:
                     # 如果 news_items 不存在则回退到 'news'（如果需要支持旧版）
                     # 但当前爬虫使用的是 news_items
                     logger.warning(f"Table 'news_items' not found in {filename}, skipping.")
                     return 0

                rows = await cursor.fetchall()

                if not rows:
                    return 0

                # 准备批量插入的数据
                data_to_insert = []
                for row in rows:
                    # 将 SQLite 列映射到 MySQL 模型
                    # SQLite: id, title, platform_id, rank, url, ...

                    # 注意：如果 Schema 随时间变化，需安全处理缺失列
                    item_data = {
                        "original_id": row['id'],
                        "platform": row['platform_id'],
                        "title": row['title'],
                        "url": row['url'],
                        "source_db_date": source_date,
                        "synced_at": datetime.utcnow()
                    }

                    # 仅添加标题不为空的数据
                    if item_data["title"]:
                         data_to_insert.append(item_data)

                if data_to_insert:
                     inserted_count = await self._batch_insert_mysql(data_to_insert)

        except Exception as e:
            logger.error(f"Error processing {db_path}: {e}")
            raise e

        return inserted_count

    async def _batch_insert_mysql(self, data: list) -> int:
        """批量插入 MySQL，使用 INSERT IGNORE 行为"""
        if not data:
            return 0

        async with AsyncSessionLocal() as session:
            # 使用 SQLAlchemy Core 进行批量操作
            # 我们通过 `mysql_insert` 使用 MySQL 的 INSERT IGNORE 逻辑
            # SQLAlchemy 的 `prefix_with('IGNORE')` 会渲染为 INSERT IGNORE

            stmt = mysql_insert(NewsItem).values(data)
            stmt = stmt.prefix_with('IGNORE') # 标准的 INSERT IGNORE 写法

            result = await session.execute(stmt)
            await session.commit()

            return result.rowcount

sync_service = SyncService()
