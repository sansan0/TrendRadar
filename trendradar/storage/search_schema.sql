-- TrendRadar 联网搜索数据库表结构
-- 用于存储联网搜索主题、检索结果与改写缓存

-- ============================================
-- 搜索主题表
-- 存储每个搜索任务/主题的基本信息与执行状态
-- ============================================
CREATE TABLE IF NOT EXISTS search_topics (
    id TEXT PRIMARY KEY,                      -- 主题稳定 ID（如 "topic_a1b2c3d4"）
    name TEXT NOT NULL,                       -- 主题展示名称（如 "低空经济政策"）
    query_text TEXT DEFAULT '',               -- 原始查询说明
    provider TEXT DEFAULT 'deepseek',         -- 使用的搜索引擎
    is_active INTEGER DEFAULT 1,              -- 是否启用
    last_fetch_time TEXT,                     -- 最后搜索时间
    last_fetch_status TEXT,                   -- 最后搜索状态（success/failed）
    item_count INTEGER DEFAULT 0,             -- 当日结果条数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 搜索结果条目表
-- 以 URL + topic_id 为唯一标识，支持去重存储
-- ============================================
CREATE TABLE IF NOT EXISTS search_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                      -- 网页/新闻标题
    topic_id TEXT NOT NULL,                   -- 所属搜索主题 ID
    url TEXT NOT NULL,                        -- 原文链接
    query TEXT DEFAULT '',                    -- 命中的具体搜索词
    provider TEXT DEFAULT 'deepseek',         -- 搜索引擎名称
    snippet TEXT DEFAULT '',                  -- 短摘要（用于列表/卡片展示）
    summary TEXT DEFAULT '',                  -- 长摘要（用于 AI 分析）
    content TEXT DEFAULT '',                  -- 完整正文 Markdown（可选）
    site_name TEXT DEFAULT '',                -- 来源站点名称
    site_icon TEXT DEFAULT '',                -- 来源站点图标 URL
    published_at TEXT DEFAULT '',             -- 发布时间（ISO / RFC3339）
    score REAL DEFAULT 0.0,                   -- 归一化质量评分（0.0 ~ 1.0）
    raw_score REAL DEFAULT 0.0,               -- 引擎原始评分（如 DeepSeek 0~3）
    authority INTEGER DEFAULT -1,             -- 来源权威度（-1=未知, 0~4）
    first_crawl_time TEXT NOT NULL,           -- 首次搜索抓取时间
    last_crawl_time TEXT NOT NULL,            -- 最后搜索抓取时间
    crawl_count INTEGER DEFAULT 1,            -- 出现次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES search_topics(id)
);

-- ============================================
-- 搜索抓取记录表
-- ============================================
CREATE TABLE IF NOT EXISTS search_crawl_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crawl_time TEXT NOT NULL UNIQUE,          -- 抓取时间（HH:MM）
    total_items INTEGER DEFAULT 0,            -- 总条目数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 搜索抓取状态表
-- ============================================
CREATE TABLE IF NOT EXISTS search_crawl_status (
    crawl_record_id INTEGER NOT NULL,
    topic_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
    error_message TEXT DEFAULT '',
    PRIMARY KEY (crawl_record_id, topic_id),
    FOREIGN KEY (crawl_record_id) REFERENCES search_crawl_records(id),
    FOREIGN KEY (topic_id) REFERENCES search_topics(id)
);

-- ============================================
-- 智能提示词改写缓存表（smart 模式按日缓存，避免重复消耗 AI 额度）
-- ============================================
CREATE TABLE IF NOT EXISTS search_query_cache (
    prompt_hash TEXT PRIMARY KEY,             -- 原文提示词哈希
    original_text TEXT NOT NULL,              -- 原始提示词
    rewritten_queries TEXT NOT NULL,          -- 改写后的搜索词列表（JSON 数组）
    ori_question TEXT DEFAULT '',             -- 提炼后的原始意图
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引定义
-- ============================================
CREATE INDEX IF NOT EXISTS idx_search_topic ON search_items(topic_id);
CREATE INDEX IF NOT EXISTS idx_search_published ON search_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_crawl_time ON search_items(last_crawl_time);
CREATE INDEX IF NOT EXISTS idx_search_score ON search_items(score DESC);
CREATE INDEX IF NOT EXISTS idx_search_title ON search_items(title);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_url_topic ON search_items(url, topic_id);
CREATE INDEX IF NOT EXISTS idx_search_crawl_status_record ON search_crawl_status(crawl_record_id);
