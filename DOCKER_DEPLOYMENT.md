# 🐳 TrendRadar Docker 部署完整教學

本教學將指導您如何從自己 fork 的倉庫建構並部署 TrendRadar 熱點監控助手到您的機器上。

## 📋 目錄

- [環境需求](#環境需求)
- [從原始碼建構部署（推薦）](#從原始碼建構部署推薦)
- [設定說明](#設定說明)
- [服務管理](#服務管理)
- [故障排查](#故障排查)
- [進階設定](#進階設定)

---

## 環境需求

在開始之前，請確保您的機器已安裝：

- **Docker**: 版本 20.10 或更高
- **Docker Compose**: 版本 2.0 或更高
- **Git**: 用於複製倉庫
- **作業系統**: Linux / macOS / Windows（含 WSL2）

### 安裝 Docker

如果您還沒有安裝 Docker，請參考以下指令：

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登入後生效
```

**CentOS/RHEL:**
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**macOS/Windows:**
- 下載並安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## 從原始碼建構部署（推薦）

這種方式適合需要自訂程式碼、完全控制建構過程的場景。

### 第一步：複製您的 Fork 倉庫

```bash
# 複製您 fork 的倉庫
git clone https://github.com/icedike/TrendRadar.git
cd TrendRadar
```

如果您還沒有 fork，可以先在 GitHub 上 fork [原專案](https://github.com/sansan0/TrendRadar)，然後複製您自己的 fork。

### 第二步：檢查專案結構

複製後的目錄結構：

```
TrendRadar/
├── main.py                    # 主程式
├── requirements.txt           # Python 依賴套件
├── config/                    # 設定目錄
│   ├── config.yaml           # 主設定檔
│   └── frequency_words.txt   # 關鍵字設定
├── docker/                    # Docker 相關檔案
│   ├── Dockerfile            # Docker 映像建構檔
│   ├── docker-compose.yml    # 使用官方映像的設定（可選）
│   ├── docker-compose-build.yml  # 本地建構設定（推薦）
│   ├── entrypoint.sh         # 容器啟動腳本
│   ├── manage.py             # 管理工具
│   └── .env                  # 環境變數設定範本
└── output/                    # 生成的報告輸出目錄
```

### 第三步：設定檔設定

#### 1. 編輯主設定檔

```bash
# 編輯設定檔
vim config/config.yaml
# 或使用其他編輯器：nano、gedit、code 等
```

**重要設定項目：**

```yaml
# 應用基礎設定
app:
  report_mode: daily          # 報告模式：daily/current/incremental

# 爬蟲設定
crawler:
  enable_crawler: true        # 是否啟用爬蟲
  source_type: "rss"          # 資料來源類型："rss" 或 "newsnow"

# 通知設定
notification:
  enable_notification: true   # 是否啟用通知
  webhooks:
    feishu_url: ""            # 飛書 Webhook URL
    dingtalk_url: ""          # 釘釘 Webhook URL
    wework_url: ""            # 企業微信 Webhook URL
    telegram_bot_token: ""    # Telegram Bot Token
    telegram_chat_id: ""      # Telegram Chat ID
    email_from: ""            # 寄件人信箱
    email_password: ""        # 信箱密碼或授權碼
    email_to: ""              # 收件人信箱
```

**⚠️ 必須設定至少一個通知管道才能接收熱點推送！**

#### 2. 設定 RSS 資料來源（重要）

這個 fork 版本預設使用 **RSS 作為消息來源**，而非原版的新聞聚合 API。

在 `config/config.yaml` 中找到 `rss_feeds` 區塊：

```yaml
# RSS 資料來源（當 source_type 設為 "rss" 時啟用）
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
    enabled: false  # 設為 false 則不會抓取
```

**欄位說明：**

| 欄位 | 說明 | 範例 |
|------|------|------|
| `id` | 內部識別碼（唯一，不可重複） | `"technews"` |
| `name` | 顯示名稱（會出現在報告中） | `"科技新報"` |
| `url` | RSS feed 的完整網址 | `"https://technews.tw/feed/"` |
| `enabled` | 是否啟用此來源 | `true` / `false` |

**如何新增您自己的 RSS 來源：**

```yaml
rss_feeds:
  # 保留原有的來源或刪除不需要的
  - id: "markreadfintech"
    name: "Mark 解讀金融科技"
    url: "https://www.markreadfintech.com/feed"
    enabled: true

  # 新增您的 RSS 來源
  - id: "technews"
    name: "科技新報"
    url: "https://technews.tw/feed/"
    enabled: true

  - id: "ithome"
    name: "iThome"
    url: "https://www.ithome.com.tw/rss"
    enabled: true

  - id: "inside"
    name: "Inside 硬塞的網路趨勢觀察"
    url: "https://www.inside.com.tw/feed"
    enabled: true
```

**尋找 RSS Feed URL 的方法：**

1. 大部分網站在網址後加 `/feed`、`/rss` 或 `/rss.xml`
2. 在網站頁面中尋找 RSS 圖示 📡 或「訂閱」連結
3. 使用瀏覽器擴充功能（如 RSS Feed Reader）自動偵測
4. 查看網站的 `<head>` 標籤中的 `<link type="application/rss+xml">`

**💡 實用技巧：**

- **暫時停用某個來源**：將 `enabled` 改為 `false` 即可，不需要刪除
- **測試新的 RSS**：修改後重啟容器即可生效
- **檢查 RSS 是否有效**：在瀏覽器中直接開啟 RSS URL，應該會看到 XML 格式的內容

**切換回原始資料來源（newsnow）：**

如果您想使用原版的新聞聚合 API 而非 RSS：

```yaml
crawler:
  source_type: "newsnow"  # 改回 "newsnow"
```

#### 3. 設定關鍵字

```bash
# 編輯關鍵字檔案
vim config/frequency_words.txt
```

每行一個關鍵字：
```
人工智慧
區塊鏈
雲端運算
大數據
機器學習
深度學習
# 新增您關心的其他關鍵字
```

**提示：** 如果此檔案為空，系統將推送所有熱點新聞（可能會因訊息大小限制而被截斷）。

#### 4. 設定環境變數（可選）

```bash
# 複製環境變數範本
cp docker/.env .env

# 編輯環境變數
vim .env
```

在 `.env` 中設定：

```bash
# 時區設定
TZ=Asia/Taipei

# 核心設定（v3.0.5+ 支援環境變數覆寫 config.yaml）
# 取消註解以下行來覆寫 config.yaml 中的對應設定
#ENABLE_CRAWLER=true
#ENABLE_NOTIFICATION=true
#REPORT_MODE=daily

# 推送時間窗口設定
#PUSH_WINDOW_ENABLED=true
#PUSH_WINDOW_START=09:00
#PUSH_WINDOW_END=18:00

# 通知管道（可在此設定，避免直接修改 config.yaml）
#FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook
#DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=your-token
#WEWORK_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key
#TELEGRAM_BOT_TOKEN=your-bot-token
#TELEGRAM_CHAT_ID=your-chat-id

# 郵件設定
#EMAIL_FROM=your-email@example.com
#EMAIL_PASSWORD=your-password
#EMAIL_TO=recipient@example.com

# 定時任務設定
# 每30分鐘執行一次（推薦）
CRON_SCHEDULE=*/30 * * * *
# 執行模式：cron（定時）/ once（單次）
RUN_MODE=cron
# 啟動時立即執行一次
IMMEDIATE_RUN=true
```

**設定優先順序：** 環境變數 > config.yaml

### 第四步：準備 Docker Compose 設定

```bash
# 使用本地建構版本的 docker-compose
cd docker
cp docker-compose-build.yml docker-compose.yml

# 確保 .env 檔案在 docker 目錄中（如果您在第三步中建立了）
# 如果 .env 在專案根目錄，可以移動或複製到 docker 目錄
```

**docker-compose.yml 內容（docker-compose-build.yml）：**

```yaml
services:
  trend-radar:
    build:
      context: ..              # 指向專案根目錄
      dockerfile: docker/Dockerfile
    container_name: trend-radar
    restart: unless-stopped

    volumes:
      - ../config:/app/config:ro    # 掛載設定檔（唯讀）
      - ../output:/app/output        # 掛載輸出目錄

    environment:
      - TZ=Asia/Taipei
      # 可以在此新增環境變數，或使用 .env 檔案
```

### 第五步：建構並啟動服務

```bash
# 確保在 docker 目錄中
cd docker

# 建構 Docker 映像（首次執行會花費幾分鐘）
docker-compose build

# 啟動服務（背景執行）
docker-compose up -d

# 查看即時日誌
docker-compose logs -f
```

**首次啟動：**
- 建構映像會下載 Python 基礎映像和安裝依賴套件，需要幾分鐘
- 如果設定了 `IMMEDIATE_RUN=true`，啟動後會立即執行一次爬蟲
- 之後會按照 `CRON_SCHEDULE` 定時執行

### 第六步：驗證部署

```bash
# 查看容器狀態
docker ps | grep trend-radar

# 查看執行日誌
docker logs -f trend-radar

# 檢查設定是否正確
docker exec -it trend-radar python manage.py config

# 查看輸出檔案
ls -la ../output/

# 手動執行一次爬蟲測試
docker exec -it trend-radar python manage.py run
```

如果一切正常，您應該：
- 看到容器狀態為 `Up`
- 日誌中顯示爬蟲執行過程
- `output` 目錄中生成了 HTML 和 TXT 報告
- 設定的通知管道收到推送訊息

---

## 設定說明

### 環境變數覆寫機制（v3.0.5+）

如果您在 NAS（群暉、威聯通等）或其他 Docker 環境中遇到**修改 config.yaml 後設定不生效**的問題，可以透過環境變數直接覆寫設定。

| 環境變數 | 對應設定 | 可選值 | 說明 |
|---------|---------|-------|------|
| `ENABLE_CRAWLER` | `crawler.enable_crawler` | `true` / `false` | 是否啟用爬蟲 |
| `ENABLE_NOTIFICATION` | `notification.enable_notification` | `true` / `false` | 是否啟用通知 |
| `REPORT_MODE` | `app.report_mode` | `daily` / `current` / `incremental` | 報告模式 |
| `PUSH_WINDOW_ENABLED` | `notification.push_window.enabled` | `true` / `false` | 是否啟用推送時間窗口 |
| `PUSH_WINDOW_START` | `notification.push_window.start_time` | 時間格式 `HH:MM` | 推送窗口開始時間 |
| `PUSH_WINDOW_END` | `notification.push_window.end_time` | 時間格式 `HH:MM` | 推送窗口結束時間 |

### 報告模式說明

- **daily**: 每日彙總模式，彙總當天所有熱點
- **current**: 當前榜單模式，只推送當前時刻的熱點
- **incremental**: 增量模式，只推送新出現的熱點（推薦）

### 定時任務設定

`CRON_SCHEDULE` 使用標準的 Cron 表達式：

```bash
# 格式: 分 時 日 月 週
# 範例：
*/5 * * * *      # 每5分鐘執行一次
*/30 * * * *     # 每30分鐘執行一次（推薦）
0 */1 * * *      # 每小時執行一次
0 9,12,18 * * *  # 每天 9:00、12:00、18:00 執行
0 9 * * *        # 每天 9:00 執行
```

**線上 Cron 生成器：** https://crontab.guru/

---

## 服務管理

### 基本管理指令

```bash
# 進入 docker 目錄（所有指令在此目錄執行）
cd docker

# 啟動服務
docker-compose up -d

# 停止服務
docker-compose stop

# 重啟服務
docker-compose restart

# 查看日誌
docker-compose logs -f

# 停止並刪除容器（保留映像和資料）
docker-compose down

# 刪除容器和映像
docker-compose down --rmi all
```

### 使用內建管理工具

TrendRadar 提供了方便的管理腳本：

```bash
# 查看執行狀態
docker exec -it trend-radar python manage.py status

# 手動執行一次爬蟲
docker exec -it trend-radar python manage.py run

# 查看即時日誌
docker exec -it trend-radar python manage.py logs

# 顯示當前設定
docker exec -it trend-radar python manage.py config

# 顯示輸出檔案清單
docker exec -it trend-radar python manage.py files

# 查看幫助資訊
docker exec -it trend-radar python manage.py help
```

### 修改程式碼後重新建構

如果您修改了程式碼（如 `main.py`），需要重新建構映像：

```bash
# 在 docker 目錄中
cd docker

# 重新建構映像
docker-compose build

# 停止舊容器
docker-compose down

# 啟動新容器
docker-compose up -d

# 查看日誌確認
docker-compose logs -f
```

**快捷指令（一次性完成）：**
```bash
docker-compose up -d --build
```

### 更新程式碼

從您的 fork 倉庫拉取最新程式碼：

```bash
# 在專案根目錄
git pull origin main

# 重新建構並啟動
cd docker
docker-compose up -d --build
```

---

## 故障排查

### 1. 容器無法啟動

```bash
# 查看容器狀態
docker ps -a | grep trend-radar

# 查看詳細日誌
docker logs trend-radar

# 檢查設定檔是否存在
ls -la config/
```

**常見原因：**
- 設定檔路徑不正確（檢查 docker-compose.yml 中的 volumes 設定）
- 設定檔格式錯誤（YAML 格式要嚴格縮排）
- Docker 權限問題（確保當前使用者在 docker 群組）

### 2. 設定修改不生效

**解決方案：**

1. 檢查設定檔是否正確掛載：
   ```bash
   docker exec -it trend-radar ls -la /app/config/
   docker exec -it trend-radar cat /app/config/config.yaml
   ```

2. 如果掛載正確但設定不生效，使用環境變數覆寫：
   - 修改 `docker/.env` 檔案
   - 或在 `docker-compose.yml` 中直接新增環境變數

3. 修改設定後**必須**重啟容器：
   ```bash
   docker-compose restart
   ```

4. 如果修改了程式碼，需要重新建構：
   ```bash
   docker-compose up -d --build
   ```

### 3. 沒有收到通知

**檢查清單：**

1. 確認至少設定了一個通知管道：
   ```bash
   docker exec -it trend-radar python manage.py config
   ```

2. 檢查 Webhook URL 是否正確（沒有多餘空格）

3. 查看日誌中是否有錯誤訊息：
   ```bash
   docker logs trend-radar | grep -i error
   docker logs trend-radar | grep -i webhook
   ```

4. 手動執行一次測試：
   ```bash
   docker exec -it trend-radar python manage.py run
   ```

5. 確認網路連線正常（容器能存取外網）：
   ```bash
   docker exec -it trend-radar ping -c 3 www.google.com
   ```

### 4. 建構映像失敗

**常見問題：**

1. **網路問題導致下載依賴套件失敗：**
   ```bash
   # 使用國內映像加速
   # 編輯 docker/Dockerfile，在 RUN pip install 指令中新增：
   RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

2. **Docker 磁碟空間不足：**
   ```bash
   # 清理未使用的映像和容器
   docker system prune -a
   ```

3. **查看詳細建構日誌：**
   ```bash
   docker-compose build --no-cache --progress=plain
   ```

### 5. 容器執行但無輸出

```bash
# 檢查定時任務是否正確
docker exec -it trend-radar python manage.py status

# 查看 output 目錄
ls -la output/

# 檢查環境變數
docker exec -it trend-radar env | grep -E "ENABLE|MODE|CRON"

# 查看 supercronic 日誌
docker logs trend-radar | grep supercronic

# 手動執行主程式
docker exec -it trend-radar python main.py
```

### 6. 查看詳細錯誤訊息

```bash
# 查看最近 100 行日誌
docker logs --tail 100 trend-radar

# 即時查看日誌
docker logs -f trend-radar

# 進入容器內部除錯
docker exec -it trend-radar /bin/bash

# 在容器內查看設定
cat /app/config/config.yaml
cat /app/config/frequency_words.txt

# 在容器內手動執行程式
python main.py
```

---

## 進階設定

### 自訂修改程式碼

這是從原始碼建構的最大優勢，您可以自由修改程式碼：

```bash
# 修改主程式
vim main.py

# 修改 Docker 設定
vim docker/Dockerfile
vim docker/entrypoint.sh

# 修改依賴套件
vim requirements.txt

# 重新建構並啟動
cd docker
docker-compose up -d --build
```

### 多架構建構

如果您需要建構支援多架構的映像：

```bash
# 啟用 buildx（Docker 多平台建構工具）
docker buildx create --use

# 建構多架構映像
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-dockerhub-username/trendradar:latest \
  -f docker/Dockerfile \
  --push \
  .
```

### 在 NAS 上部署

#### 群暉 NAS (Synology DSM)

1. **啟用 SSH 並連線到 NAS**
2. **安裝 Docker 和 Git：**
   - 在套件中心安裝 Container Manager
   - 使用 SSH 安裝 Git（根據您的 DSM 版本選擇一種方式）：
     - **DSM 7.x**：可嘗試
       ```bash
       sudo apt-get update
       sudo apt-get install git
       ```
     - **套件中心**：在「套件中心」搜尋並安裝「Git Server」或「Git」套件（如有提供）。
     - **SynoCommunity**：若未在套件中心找到，可參考 [SynoCommunity](https://synocommunity.com/) 安裝 Git 套件。
     - **進階用戶**：若已安裝 Entware，可使用 `opkg install git`。
     - 若以上方法皆不可用，可使用 File Station 手動上傳專案。

3. **部署步驟：**
   ```bash
   # 複製專案
   git clone https://github.com/icedike/TrendRadar.git
   cd TrendRadar

   # 設定檔
   vim config/config.yaml
   vim config/frequency_words.txt

   # 建構部署
   cd docker
   cp docker-compose-build.yml docker-compose.yml
   docker-compose build
   docker-compose up -d
   ```

4. **或使用 Container Manager GUI：**
   - 上傳專案檔案到 NAS
   - 在 Container Manager 中建立專案
   - 使用 `docker-compose.yml` 設定
   - 對應 config 和 output 目錄
   - 設定環境變數
   - 啟動專案

#### 威聯通 NAS (QNAP)

類似群暉的步驟，使用 Container Station 進行部署。

### 資料持久化

生成的報告儲存在 `output` 目錄：

```
output/
├── hot_news_YYYYMMDD_HHMMSS.html    # HTML 格式報告
├── hot_news_YYYYMMDD_HHMMSS.txt     # 純文字報告
└── push_history/                     # 推送歷史記錄
    └── pushed_YYYYMMDD.json
```

**備份建議：**
```bash
# 定期備份 config 和 output
tar -czf trendradar-backup-$(date +%Y%m%d).tar.gz config/ output/

# 恢復
tar -xzf trendradar-backup-YYYYMMDD.tar.gz
```

### 使用 Docker Hub（可選）

如果您想將自己建構的映像推送到 Docker Hub：

```bash
# 登入 Docker Hub
docker login

# 建構並打標籤
docker build -t your-username/trendradar:latest -f docker/Dockerfile .

# 推送映像
docker push your-username/trendradar:latest

# 在其他機器上使用
docker pull your-username/trendradar:latest
```

### 網路設定

如果您的伺服器需要透過代理伺服器存取網路：

**方法一：在 .env 中設定**
```bash
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
NO_PROXY=localhost,127.0.0.1
```

**方法二：在 docker-compose.yml 中設定**
```yaml
services:
  trend-radar:
    environment:
      - HTTP_PROXY=http://proxy.example.com:8080
      - HTTPS_PROXY=http://proxy.example.com:8080
```

---

## 常見問題 FAQ

### Q1: 為什麼要從原始碼建構而不是用官方映像？

**A:** 從原始碼建構的優勢：
- 完全控制程式碼，可以自訂修改功能
- 查看和理解完整的實作細節
- 及時修復 bug 而不用等待官方更新
- 學習專案的工作原理
- 建構自己的映像並推送到私有倉庫

### Q2: 建構太慢怎麼辦？

**A:** 最佳化建構速度：
1. 使用國內 pip 映像源（修改 Dockerfile）
2. 使用 Docker 建構快取（不要頻繁使用 `--no-cache`）
3. 設定 Docker 映像加速器

### Q3: 如何查看我的 fork 和原專案的差異？

**A:**
```bash
# 新增原專案為 upstream
git remote add upstream https://github.com/sansan0/TrendRadar.git

# 拉取原專案更新
git fetch upstream

# 查看差異
git diff upstream/main

# 合併原專案更新
git merge upstream/main
```

### Q4: 如何只執行一次？

**A:** 兩種方法：

**方法一：修改環境變數**
```bash
# 在 .env 中設定
RUN_MODE=once

# 重啟容器
docker-compose restart
```

**方法二：直接執行指令**
```bash
docker exec -it trend-radar python main.py
```

### Q5: 推送內容太多，如何減少？

**A:**
1. 使用 `incremental` 模式（只推送新熱點）
2. 在 `frequency_words.txt` 中只新增您最關心的關鍵字
3. 設定推送時間窗口：
   ```bash
   PUSH_WINDOW_ENABLED=true
   PUSH_WINDOW_START=09:00
   PUSH_WINDOW_END=18:00
   ```

### Q6: 如何更新到最新版本？

**A:**
```bash
# 拉取您 fork 倉庫的最新程式碼
git pull origin main

# 如果需要同步原專案的更新
git fetch upstream
git merge upstream/main

# 重新建構部署
cd docker
docker-compose up -d --build
```

### Q7: 容器佔用太多磁碟空間怎麼辦？

**A:**
```bash
# 清理未使用的映像
docker image prune -a

# 清理建構快取
docker builder prune

# 清理所有未使用的資源
docker system prune -a --volumes
```

### Q8: 如何在多台機器上部署？

**A:**
1. 將專案提交到您的 GitHub fork
2. 在其他機器上複製您的 fork
3. 重複本教學的建構步驟
4. 或者將建構好的映像推送到 Docker Hub，在其他機器上拉取使用

### Q9: 如何新增或修改 RSS 來源？

**A:**

**新增 RSS 來源：**

1. 編輯 `config/config.yaml` 檔案
2. 在 `rss_feeds` 區塊中新增項目：

```yaml
rss_feeds:
  # 現有的來源...

  # 新增您的 RSS
  - id: "your-feed-id"        # 唯一識別碼
    name: "您的網站名稱"      # 顯示名稱
    url: "https://example.com/feed"  # RSS URL
    enabled: true             # 是否啟用
```

3. 重啟容器使設定生效：
```bash
docker-compose restart
```

**尋找 RSS URL：**
- 大部分網站：`網址/feed` 或 `網址/rss`
- 範例：
  - `https://technews.tw/feed/`
  - `https://www.ithome.com.tw/rss`
  - `https://blog.example.com/rss.xml`

**測試 RSS 是否有效：**
```bash
# 在瀏覽器中開啟 RSS URL，應該會看到 XML 格式的內容
# 或使用 curl 測試
curl https://example.com/feed
```

**暫時停用某個來源：**
```yaml
- id: "some-feed"
  name: "Some Feed"
  url: "https://example.com/feed"
  enabled: false  # 改為 false 即可停用
```

**常見問題：**
- **RSS 抓取失敗**：檢查 RSS URL 是否正確，在瀏覽器中測試是否能開啟
- **沒有新聞**：確認 `source_type: "rss"` 已設定，且至少有一個 `enabled: true` 的來源
- **想用回原始資料來源**：將 `crawler.source_type` 改為 `"newsnow"`

---

## 取得幫助

如果遇到問題，您可以：

1. 查看專案 [GitHub Issues](https://github.com/sansan0/TrendRadar/issues)
2. 查看您的 fork 倉庫：https://github.com/icedike/TrendRadar
3. 閱讀完整的 [README.md](https://github.com/sansan0/TrendRadar)
4. 提交新的 Issue 描述您的問題

---

## 總結

按照本教學，您應該能夠：

✅ 從自己的 fork 倉庫複製專案
✅ 設定個人化的關鍵字和通知管道
✅ 使用 Docker Compose 建構並部署服務
✅ 自訂修改程式碼並重新建構
✅ 使用管理指令維護服務
✅ 解決常見的部署和設定問題

---

## 下一步

部署成功後，您可以：

1. **自訂監控平台**：在 `config.yaml` 中新增更多資料來源
2. **調整熱度演算法**：修改 `main.py` 中的熱度計算邏輯
3. **整合 AI 分析**：使用 MCP 功能進行智慧分析（參考 README-MCP-FAQ.md）
4. **設定 GitHub Pages**：自動生成精美的網頁報告
5. **設定多環境部署**：開發環境、測試環境、正式環境分離

祝您使用愉快！🎉

---

**相關連結：**
- 您的 Fork: https://github.com/icedike/TrendRadar
- 原專案: https://github.com/sansan0/TrendRadar
- Docker Hub 官方映像: https://hub.docker.com/r/wantcat/trendradar
- 線上展示: https://sansan0.github.io/TrendRadar
