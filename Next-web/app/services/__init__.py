from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.sync_service import sync_service
from app.services.cleanup_service import cleanup_service

scheduler = AsyncIOScheduler()

def start_scheduler():
    # Sync every 5 minutes
    scheduler.add_job(sync_service.run_sync, 'interval', minutes=5, id='sync_job')

    # Cleanup daily at 3 AM
    scheduler.add_job(cleanup_service.run_cleanup, 'cron', hour=3, minute=0, id='cleanup_job')

    scheduler.start()
