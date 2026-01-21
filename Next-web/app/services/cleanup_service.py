import os
import time
import logging
from datetime import datetime, timedelta
from app.core.config import config
from app.core.database import AsyncSessionLocal
from app.models.news import NewsItem, SyncLog
from sqlalchemy import delete

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CleanupService:
    def __init__(self):
        self.enable_cleanup = config.ENABLE_AUTO_CLEANUP
        self.audio_dir = config.AUDIO_DIR

    async def run_cleanup(self):
        """Cleanup old audio files and database records"""
        if not self.enable_cleanup:
            logger.info("Auto cleanup is DISABLED. Skipping.")
            return

        logger.info("Starting cleanup process...")

        await self._cleanup_audio_files()
        await self._cleanup_db_records()

        logger.info("Cleanup process finished.")

    async def _cleanup_audio_files(self, days=7):
        """Delete audio files older than `days`"""
        if not os.path.exists(self.audio_dir):
            return

        now = time.time()
        cutoff = days * 86400
        count = 0

        for filename in os.listdir(self.audio_dir):
            filepath = os.path.join(self.audio_dir, filename)
            if os.path.isfile(filepath):
                file_age = now - os.path.getmtime(filepath)
                if file_age > cutoff:
                    try:
                        os.remove(filepath)
                        count += 1
                    except Exception as e:
                        logger.error(f"Failed to delete {filepath}: {e}")

        if count > 0:
            logger.info(f"Cleaned up {count} old audio files.")

    async def _cleanup_db_records(self, days=30):
        """Delete sync logs older than `days`"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        async with AsyncSessionLocal() as session:
            try:
                # Cleanup Sync Logs
                stmt = delete(SyncLog).where(SyncLog.start_time < cutoff_date)
                result = await session.execute(stmt)
                if result.rowcount > 0:
                    logger.info(f"Cleaned up {result.rowcount} old sync logs.")

                await session.commit()
            except Exception as e:
                logger.error(f"Database cleanup failed: {e}")

cleanup_service = CleanupService()
