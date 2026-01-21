-- TrendRadar RSS 数据库表结构
-- 用于存储 RSS/Atom 订阅源数据

-- ============================================
-- RSS 源配置表
-- 存储订阅源的基本信息
-- ============================================
CREATE TABLE IF NOT EXISTS rss_feeds (
    id TEXT PRIMARY KEY,                      -- 源 ID（如 "hacker-news"）
    name TEXT NOT NULL,                       -- 显示名称（如 "Hacker News"）
    feed_url TEXT DEFAULT '',                 -- RSS/Atom URL（可选，配置文件中已有）
    is_active INTEGER DEFAULT 1,              -- 是否启用
    last_fetch_time TEXT,                     -- 最后抓取时间
    last_fetch_status TEXT,                   -- 最后抓取状态（success/failed）
    item_count INTEGER DEFAULT 0,             -- 当日条目数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- RSS 条目表
-- 以 URL + feed_id 为唯一标识，支持去重存储
-- ============================================
CREATE TABLE IF NOT EXISTS rss_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                      -- 标题
    feed_id TEXT NOT NULL,                    -- 所属 RSS 源
    url TEXT NOT NULL,                        -- 文章链接
    published_at TEXT,                        -- RSS 发布时间（ISO 格式）
    summary TEXT,                             -- 摘要/描述
    author TEXT,                              -- 作者
    first_crawl_time TEXT NOT NULL,           -- 首次抓取时间
    last_crawl_time TEXT NOT NULL,            -- 最后抓取时间
    crawl_count INTEGER DEFAULT 1,            -- 抓取次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES rss_feeds(id)
);

-- ============================================
-- 抓取记录表
-- 记录每次抓取的时间和数量
-- ============================================
CREATE TABLE IF NOT EXISTS rss_crawl_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_time TEXT NOT NULL UNIQUE,          -- 抓取时间（HH:MM）
    total_items INTEGER DEFAULT 0,            -- 总条目数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 抓取来源状态表
-- 记录每次抓取各 RSS 源的成功/失败状态
-- ============================================
CREATE TABLE IF NOT EXISTS rss_crawl_status (
    crawl_record_id INTEGER NOT NULL,
    feed_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
    error_message TEXT,                       -- 失败时的错误信息
    PRIMARY KEY (crawl_record_id, feed_id),
    FOREIGN KEY (crawl_record_id) REFERENCES rss_crawl_records(id),
    FOREIGN KEY (feed_id) REFERENCES rss_feeds(id)
);

-- ============================================
-- 推送记录表
-- 用于 push_window once_per_day 功能
-- ============================================
CREATE TABLE IF NOT EXISTS rss_push_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,                -- 日期（YYYY-MM-DD）
    pushed INTEGER DEFAULT 0,                 -- 是否已推送
    push_time TEXT,                           -- 推送时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引定义
-- ============================================

-- RSS 源索引
CREATE INDEX IF NOT EXISTS idx_rss_feed ON rss_items(feed_id);

-- 发布时间索引（用于按时间排序）
CREATE INDEX IF NOT EXISTS idx_rss_published ON rss_items(published_at DESC);

-- 抓取时间索引（用于查询最新数据）
CREATE INDEX IF NOT EXISTS idx_rss_crawl_time ON rss_items(last_crawl_time);

-- 标题索引（用于标题搜索）
CREATE INDEX IF NOT EXISTS idx_rss_title ON rss_items(title);

-- URL + feed_id 唯一索引（实现去重）
CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_url_feed
    ON rss_items(url, feed_id);

-- 抓取状态索引
CREATE INDEX IF NOT EXISTS idx_rss_crawl_status_record ON rss_crawl_status(crawl_record_id);
