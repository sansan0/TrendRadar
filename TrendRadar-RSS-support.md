
# TrendRadar RSS 改造說明（Fork 版）

## 1. 目標與設計思路

### 1.1 需求背景

原版 TrendRadar 的資料來源是透過 `newsnow` 的聚合 API，把「今日頭條、百度熱搜、微博、抖音、知乎、B 站、華爾街見聞、財聯社等多個平台」的熱榜抓進來，再做統計與報表推送。

目前我們的需求：

- **完全不想用這些平台的熱榜**
- 希望 **只用自己維護的一組 RSS feeds** 當新聞來源
- 盡量沿用 TrendRadar 原本的：
  - 報表模式（`daily / current / incremental`）
  - 頻率詞 / 關鍵字過濾（`frequency_words.txt`）
  - 推送機制（飛書、Telegram、Email…）
  - MCP AI 分析功能（`mcp_server`）

### 1.2 設計原則

1. **最小侵入改造**：  
   - 不動到分析邏輯、報表生成、推送邏輯  
   - 僅替換「資料來源層」（crawler）為 RSS 版本

2. **可切換資料來源**：  
   - 保留原生 `newsnow` 來源（以防未來想混用）  
   - 新增 `rss` 來源模式，fork 版本預設用 RSS

3. **RSS 清單可由非工程人員維護**：  
   - 在 `config/config.yaml` 新增 `rss_feeds` 區塊  
   - 讓非工程同事只要改 YAML 就可以調整來源

---

## 2. 需要修改與新增的檔案總覽

1. **`config/config.yaml`**  
   - 新增 RSS 設定段落  
   - 新增 crawler 的來源類型選項

2. **`requirements.txt`**  
   - 新增 RSS 解析套件，例如：`feedparser`（或其他工程師習慣的 RSS parser）

3. **`main.py`**（核心改造）  
   - 新增 `RSSFetcher` 類別（或同名函式）  
   - 在現有 crawler 執行流程中插入「依 config 切換 newsnow / RSS」

4. （可選）`docs/TrendRadar-RSS-改造說明.md`  
   - 保存本文件，方便後續維護與交接

---

## 3. 配置檔設計：如何維護 RSS 來源

原始 `config/config.yaml` 中，`crawler` 與 `platforms` 結構大致如下（只保留重點）：

```yaml
app:
  version_check_url: "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version"
  show_version_update: true

crawler:
  request_interval: 1000            # 請求間隔(毫秒)
  enable_crawler: true              # 是否啟用爬取新聞功能
  use_proxy: false
  default_proxy: "http://127.0.0.1:10086"

report:
  mode: "daily"                     # "daily"|"incremental"|"current"
  rank_threshold: 5

platforms:
  - id: "toutiao"
    name: "今日頭條"
  - id: "baidu"
    name: "百度熱搜"
  - id: "wallstreetcn-hot"
    name: "華爾街見聞"
  # ... 其餘略
```

### 3.1 新增 crawler 資料來源類型

在 `crawler` 區塊增加一個欄位，控制 crawler 用哪種來源：

```yaml
crawler:
  request_interval: 1000
  enable_crawler: true
  use_proxy: false
  default_proxy: "http://127.0.0.1:10086"
  source_type: "rss"     # 新增：可選 "newsnow" | "rss"
```

- fork 版本預設值建議設為 `"rss"`
- 若未來想保留混合模式，可以再擴充成 `"mixed"`，此版本先不處理

### 3.2 新增 RSS feed 清單

在 config 的頂層新增一段 `rss_feeds` 設定：

```yaml
rss_feeds:
  - id: "markreadfintech"
    name: "Mark 解讀金融科技"
    url: "https://www.markreadfintech.com/feed"
    enabled: true

  - id: "blockworks"
    name: "Blockworks"
    url: "https://blockworks.co/feed"
    enabled: true

  - id: "theblock"
    name: "The Block"
    url: "https://www.theblock.co/rss.xml"
    enabled: false     # 設為 false 則忽略
```

設計重點：

- `id`：內部使用的平台識別碼（類似原本 platforms.id）
- `name`：報表展示用文字
- `url`：RSS 來源網址
- `enabled`：允許透過布林值控制是否納入統計

> 對非工程人員來說，只要會新增 / 刪減這一段 YAML，就可以調整 RSS 來源。

---

## 4. 新增 RSSFetcher 類別

> 說明：原作者在 README 裡提到「所有配置集中在 config.yaml，main.py 我依舊沒拆分」。為了日後同步上游版本方便，建議 **RSSFetcher 也寫在 main.py** 中，不另外拆檔。

### 4.1 套件依賴

在 `requirements.txt` 新增一行（版本工程師可自行選擇）：

```txt
feedparser>=6.0.11
```

或若團隊已有既用的 RSS 解析庫，可替換成內部標準。

### 4.2 RSSFetcher 介面設計

請在 `main.py` 中新增類似下列的類別（具體欄位命名請依 `DataFetcher` 的實際使用對齊）：

```python
import feedparser
from datetime import datetime

class RSSFetcher:
    def __init__(self, rss_feeds, logger=None, limit_per_feed=50):
        # :param rss_feeds: 來自 config.yaml 的 rss_feeds list
        # :param logger: 可選的 logger 實例
        # :param limit_per_feed: 每個 feed 最多抓多少篇
        self.rss_feeds = [f for f in rss_feeds if f.get("enabled", True)]
        self.logger = logger
        self.limit_per_feed = limit_per_feed

    def crawl_feeds(self):
        # 回傳值需要與原本 DataFetcher.crawl_xxx 的結果結構一致：
        # - results: dict[platform_id -> dict[title -> item_info]]
        # - id_to_name: dict[platform_id -> platform_name]
        # - failed_ids: list[platform_id]
        results = {}
        id_to_name = {}
        failed_ids = []

        for feed in self.rss_feeds:
            pid = feed["id"]
            name = feed.get("name", pid)
            url = feed["url"]
            id_to_name[pid] = name

            try:
                parsed = feedparser.parse(url)
                platform_dict = {}

                for rank, entry in enumerate(parsed.entries[: self.limit_per_feed], start=1):
                    title = (entry.title or "").strip()
                    if not title:
                        continue

                    # 建議用標題當 key，與原本邏輯保持一致
                    # item_info 的欄位請依後續處理實際需求調整
                    platform_dict[title] = {
                        "ranks": [rank],  # 這裡用 RSS 順序當作排名
                        "link": getattr(entry, "link", ""),
                        "published": self._parse_published(entry),
                    }

                results[pid] = platform_dict

            except Exception:
                failed_ids.append(pid)
                if self.logger:
                    self.logger.exception(f"RSS fetch failed for {pid}: {url}")

        return results, id_to_name, failed_ids

    @staticmethod
    def _parse_published(entry):
        # 簡單處理，工程師可依需求完整化
        if hasattr(entry, "published"):
            return entry.published
        if hasattr(entry, "updated"):
            return entry.updated
        return ""
```

> ⚠️ **重要提醒：**  
> `results` 的具體結構要跟現有的 `DataFetcher` 回傳值保持一致。  
> 建議工程師在修改時先印出（或 log）原本的 `results` 結構，對照調整 `RSSFetcher` 的 `item_info` 欄位。

---

## 5. 在 main.py 中整合 RSSFetcher

### 5.1 找到原本 crawler 的入口

在 `main.py` 中搜尋以下關鍵字之一（實際名稱請以 repo 為準）：

- `enable_crawler`
- `crawler[`
- `config["crawler"]`
- `platforms`
- `DataFetcher` / `crawl` / `crawler`

那一段程式邏輯通常會：

1. 讀取 `config/config.yaml`  
2. 檢查 `crawler.enable_crawler`  
3. 實例化某個資料抓取類別（此處假設為 `DataFetcher`）  
4. 拿到 `results, id_to_name, failed_ids`  
5. 交給後面的分析 / 報表 pipeline

### 5.2 加入來源切換條件

在原本建立 `DataFetcher` 的地方，加上依 `crawler.source_type` 切換的邏輯，大致像：

```python
def run_crawler(config, logger=None):
    # 這個函式名稱只是示意，請以 main.py 實際程式為準。
    if not config["crawler"].get("enable_crawler", True):
        if logger:
            logger.info("Crawler disabled by config.")
        return

    source_type = config["crawler"].get("source_type", "newsnow")

    if source_type == "rss":
        # 使用 RSS 資料來源
        rss_feeds = config.get("rss_feeds", [])
        fetcher = RSSFetcher(rss_feeds, logger=logger)
        results, id_to_name, failed_ids = fetcher.crawl_feeds()
    else:
        # 保留原本的 newsnow 邏輯
        fetcher = DataFetcher(
            use_proxy=config["crawler"].get("use_proxy", False),
            default_proxy=config["crawler"].get("default_proxy"),
            request_interval=config["crawler"].get("request_interval", 1000),
            logger=logger,
        )
        results, id_to_name, failed_ids = fetcher.crawl_websites(
            platforms=config["platforms"]
        )

    # 後續流程（分析、報表、推送）保持不變，舉例：
    # process_results(results, id_to_name, failed_ids, config, logger)
```

> 註：  
> - `DataFetcher` / `crawl_websites` / `process_results` 等函式名稱只是示意，請依實際 code 對齊。  
> - 核心重點是：**只要 RSS 版本回傳的 `results / id_to_name / failed_ids` 結構一樣，後面所有程式都不需要改。**

---

## 6. Docker 與環境變數調整（選擇性）

若專案有透過 Docker 部署，且已使用環境變數覆寫部分 config（如 `ENABLE_CRAWLER`、`REPORT_MODE` 等），可以考慮：

1. 在程式中增加一個環境變數映射，例如：

   ```python
   import os

   source_type = os.getenv("CRAWLER_SOURCE_TYPE") or config["crawler"].get("source_type", "newsnow")
   ```

2. 在 `docker/.env` 中增加說明：

   ```env
   # 使用 RSS 作為資料來源（newsnow | rss）
   # CRAWLER_SOURCE_TYPE=rss
   ```

這一段不是必要條件，但會讓部署更彈性。

---

## 7. 測試建議流程

1. **本地測試**
   - 在本地建立最小化的 `config/config.yaml` 與 `rss_feeds` 設定（只放 1–2 個 RSS）
   - 執行：`python main.py` 或專案提供的管理腳本（例如 `python manage.py run`，依 repo 實際為準）
   - 檢查 `output/YYYY年MM月DD日/` 目錄是否產生：
     - `txt/xxxx.txt`
     - `html/xxxx.html` 與 `当日统计.html`

2. **確認報表內容**
   - 用瀏覽器開 `index.html` + 對應 `output` 目錄  
   - 確認頁面中顯示的平台名稱已變成 `rss_feeds` 中設定的 `name`（例如「Mark 解讀金融科技」）

3. **確認推送與 MCP（如有啟用）**
   - 若原本已設定飛書 / Telegram / Email 通知，檢查收到的訊息是否引用 RSS 來源  
   - 若有啟用 `mcp_server`，用支援 MCP 的客戶端（例如 Claude Desktop / Cherry Studio）做一次查詢，確認資料來源與報表一致  

---

## 8. 未來可能的擴充方向（非本次必做）

這次改造先滿足「**只吃 RSS**」的需求，未來若有需要，可在同一套設計上擴充：

1. **支援混合模式 (`source_type = "mixed"`)**  
   - 同時從 newsnow + RSS 抓資料，統一進入同一個 `results` 結構  
   - 可以透過 `config.yaml` 控制權重（例如 RSS 平台比重較高）

2. **RSS 權重與分類**  
   - 在 `rss_feeds` 裡新增欄位，例如 `weight`, `category`  
   - 讓某些來源在排序時權重更高（例如專門的 crypto 媒體）

3. **RSS 解析錯誤的告警機制**  
   - 對 `failed_ids` 做推送通知，提醒哪個 RSS feed 掛掉了

---

### 結論

工程師主要工作項目整理：

1. 在 `config/config.yaml` 加上：
   - `crawler.source_type`
   - `rss_feeds` 區塊

2. 新增 `RSSFetcher` 類別，回傳結構對齊原本 `DataFetcher`

3. 在 `main.py` 的 crawler 流程裡，用 `source_type` 切換 DataFetcher / RSSFetcher

4. （選擇性）新增 `CRAWLER_SOURCE_TYPE` 環境變數支援

完成以上步驟後，就能以 **RSS 為唯一資料來源**，沿用 TrendRadar 原本的統計、報表、推送與 MCP AI 分析能力。
