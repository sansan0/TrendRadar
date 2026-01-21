from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from app.core.database import Base

class NewsItem(Base):
    __tablename__ = "news_items"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Original Source Data (from SQLite)
    original_id = Column(Integer, index=True) # ID in the SQLite file (not globally unique across files)
    platform = Column(String(50), index=True)
    title = Column(String(191), nullable=False) # Limit for utf8mb4 index
    summary = Column(Text, nullable=True) # Can hold larger text
    url = Column(Text, nullable=True)
    publish_time = Column(DateTime, nullable=True, index=True)

    # Sync Metadata
    source_db_date = Column(String(10), index=True) # 'YYYY-MM-DD'
    synced_at = Column(DateTime, default=datetime.utcnow)

    # Indexes
    # Fulltext index for MySQL 5.7+ with ngram parser for Chinese support
    # Note: SQLAlchemy doesn't support FULLTEXT + ngram syntax directly in Index() easily for all dialects,
    # but we can add it via __table_args__
    __table_args__ = (
        Index('idx_title_ft', 'title', mysql_prefix='FULLTEXT', mysql_with_parser='ngram'),
        UniqueConstraint('platform', 'title', 'source_db_date', name='uq_news_item'),
    )


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, index=True, nullable=False) # FK reference to NewsItem.id
    analysis_text = Column(MEDIUMTEXT, nullable=False)
    model_used = Column(String(50), default="unknown")
    created_at = Column(DateTime, default=datetime.utcnow)


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20)) # SUCCESS, FAILED, RUNNING
    new_items_count = Column(Integer, default=0)
    error_msg = Column(Text, nullable=True)
