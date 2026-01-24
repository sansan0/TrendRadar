# TrendRadar Docker 部署详细指南

> 本文档提供从零开始使用 Docker 部署 TrendRadar 的完整步骤，包含每个命令的详细说明和预期输出。

## 目录

1. [部署前准备](#1-部署前准备)
2. [5分钟快速部署](#2-5分钟快速部署)
3. [详细配置步骤](#3-详细配置步骤)
4. [启动和管理](#4-启动和管理)
5. [高级配置](#5-高级配置)
6. [常用管理命令](#6-常用管理命令)
7. [故障排查](#7-故障排查)
8. [生产环境部署](#8-生产环境部署)

---

## 1. 部署前准备

### 1.1 系统要求

#### 最低配置
- **操作系统**: Linux (Ubuntu 20.04+, Debian 11+, CentOS 8+) / macOS 11+ / Windows 10/11
- **CPU**: 1 核心以上
- **内存**: 512MB 以上可用内存
- **磁盘**: 500MB 以上可用空间
- **网络**: 稳定的互联网连接

#### 推荐配置
- **CPU**: 2 核心以上
- **内存**: 1GB 以上可用内存
- **磁盘**: 2GB 以上可用空间

### 1.2 安装 Docker

#### Linux (Ubuntu/Debian)

```bash
# 更新软件包索引
sudo apt-get update

# 安装必要的依赖
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 验证安装
docker --version
docker compose version
```

**预期输出**:
```
Docker version 24.0.7, build afdd53b
Docker Compose version v2.23.0
```

#### Linux (CentOS/RHEL)

```bash
# 安装必要的依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
```

#### macOS

1. 下载 Docker Desktop for Mac: https://www.docker.com/products/docker-desktop/
2. 安装 .dmg 文件
3. 启动 Docker Desktop
4. 验证安装（打开 Terminal）:
```bash
docker --version
docker compose version
```

#### Windows

1. 下载 Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/
2. 运行安装程序
3. 启用 WSL 2 功能（Windows 会自动提示）
4. 重启计算机
5. 启动 Docker Desktop
6. 验证安装（打开 PowerShell 或 Command Prompt）:
```cmd
docker --version
docker compose version
```

### 1.3 准备账号和密钥

#### 必需配置

**AI API Key**（如果启用 AI 分析）:
- DeepSeek: https://platform.deepseek.com/ （推荐，性价比高）
- OpenAI: https://platform.openai.com/
- 其他提供商: 参考 [LiteLLM 文档](https://docs.litellm.ai/docs/providers)

**通知渠道**（至少配置一个）:
- 飞书: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
- Telegram: 与 @BotFather 对话创建 Bot
- 邮箱: 准备邮箱地址和应用密码
- 其他: 参考本文档第 3.4 节

#### 可选配置

**云存储**（如果使用远程存储）:
- Cloudflare R2: https://dash.cloudflare.com/
- 阿里云 OSS: https://oss.console.aliyun.com/
- 腾讯云 COS: https://console.cloud.tencent.com/cos5

---

## 2. 5分钟快速部署

### 2.1 拉取镜像

```bash
# 拉取最新镜像
docker pull wantcat/trendradar:latest
```

**预期输出**:
```
latest: Pulling from wantcat/trendradar
xxxxxxxx: Pull complete
xxxxxxxx: Pull complete
Digest: sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Status: Downloaded newer image for wantcat/trendradar:latest
docker.io/wantcat/trendradar:latest
```

### 2.2 创建工作目录

```bash
# 创建项目目录
mkdir -p ~/trendradar
cd ~/trendradar

# 创建子目录
mkdir -p config output
```

### 2.3 获取配置文件

```bash
# 从镜像复制配置文件
docker run --rm \
  -v $(pwd)/config:/app/config \
  wantcat/trendradar:latest \
  sh -c "cp /app/config/* /app/config/ 2>/dev/null || true"

# 查看复制的文件
ls -la config/
```

**预期输出**:
```
total 24
drwxr-xr-x 2 user user 4096 Jan 21 10:00 .
drwxr-xr-x 4 user user 4096 Jan 21 10:00 ..
-rw-r--r-- 1 user user 8234 Jan 21 10:00 config.yaml
-rw-r--r-- 1 user user 1234 Jan 21 10:00 frequency_words.txt
```

### 2.4 最小化配置

编辑 `.env` 文件：

```bash
# 创建 .env 文件
cat > .env << 'EOF'
# 必需配置
AI_API_KEY=your-deepseek-api-key-here
AI_ANALYSIS_ENABLED=true

# 通知渠道（选择一个）
FEISHU_WEBHOOK_URL=your-feishu-webhook-url

# 运行配置
CRON_SCHEDULE=*/30 * * * *
RUN_MODE=cron
IMMEDIATE_RUN=true
EOF
```

**替换以下内容**:
- `your-deepseek-api-key-here`: 你的 DeepSeek API Key
- `your-feishu-webhook-url`: 你的飞书机器人 webhook URL

### 2.5 编辑关键词文件

```bash
# 编辑关键词文件
vim config/frequency_words.txt
```

**添加你想关注的关键词**，例如：
```text
# AI技术
ChatGPT|GPT-4|Claude
大模型|LLM|AIGC

# 金融
股票|基金
A股|港股
```

### 2.6 启动容器

```bash
# 下载 docker-compose.yml（如果项目中没有）
cat > docker-compose.yml << 'EOF'
services:
  trendradar:
    image: wantcat/trendradar:latest
    container_name: trendradar
    restart: unless-stopped
    volumes:
      - ./config:/app/config:ro
      - ./output:/app/output
    environment:
      - TZ=Asia/Shanghai
      - AI_API_KEY=${AI_API_KEY}
      - AI_ANALYSIS_ENABLED=${AI_ANALYSIS_ENABLED:-true}
      - FEISHU_WEBHOOK_URL=${FEISHU_WEBHOOK_URL:-}
      - CRON_SCHEDULE=${CRON_SCHEDULE:-*/30 * * * *}
      - RUN_MODE=${RUN_MODE:-cron}
      - IMMEDIATE_RUN=${IMMEDIATE_RUN:-true}
EOF

# 启动容器
docker compose up -d
```

**预期输出**:
```
[+] Running 2/2
 ✔ Network trendradar_default  Created                                                                                                              0.0s
 ✔ Container trendradar       Started                                                                                                              0.5s
```

### 2.7 验证运行

```bash
# 查看容器状态
docker ps | grep trendradar
```

**预期输出**:
```
CONTAINER ID   IMAGE                        COMMAND             CREATED         STATUS         PORTS     NAMES
xxxxxxxxxxxx   wantcat/trendradar:latest   "/entrypoint.sh"    5 seconds ago   Up 4 seconds             trendradar
```

```bash
# 查看启动日志
docker logs trendradad
```

**预期输出**（部分）:
```
✅ 配置文件检查通过
⏰ 启动supercronic: */30 * * * *
▶️ 立即执行一次
TrendRadar v5.3.0 配置加载完成
...
✅ 执行完成
```

**恭喜！如果看到以上输出，说明 TrendRadar 已成功运行！**

---

## 3. 详细配置步骤

### 3.1 获取配置文件

#### 方法一：从镜像复制（推荐）

```bash
# 复制配置文件
docker run --rm \
  -v $(pwd)/config:/app/config \
  wantcat/trendradar:latest \
  sh -c "cp -r /app/config/* /app/config/"

# 验证文件
ls -la config/
```

**预期输出**:
```
-rw-r--r-- 1 user user 8234 Jan 21 10:00 config.yaml
-rw-r--r-- 1 user user 1234 Jan 21 10:00 frequency_words.txt
-rw-r--r-- 1 user user 4567 Jan 21 10:00 ai_analysis_prompt.txt
-rw-r--r-- 1 user user  789 Jan 21 10:00 ai_translation_prompt.txt
```

#### 方法二：从项目复制

如果已克隆项目仓库：
```bash
# 复制配置文件
cp -r TrendRadar/config/* ~/trendradar/config/
```

### 3.2 编辑 .env 文件

创建完整的 `.env` 文件：

```bash
# 使用项目提供的模板
cp TrendRadar/docker/.env ~/trendradar/.env

# 或者手动创建
vim ~/trendradar/.env
```

#### 配置项说明

**Web 服务器配置** (2项)

```env
# 是否自动启动 Web 服务器托管 output 目录
ENABLE_WEBSERVER=false

# Web 服务器端口（默认 8080）
WEBSERVER_PORT=8080
```

**通知渠道配置**

1. **飞书** (推荐，国内用户)
```env
# 飞书机器人 webhook URL
# 获取方式：飞书群 → 群设置 → 群机器人 → 自定义机器人 → Webhook URL
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxx

# 多账号配置（用 ; 分隔）
FEISHU_WEBHOOK_URL=url1;url2;url3
```

2. **钉钉**
```env
# 钉钉机器人 webhook URL
# 获取方式：钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxxxxxxxxxx
```

3. **企业微信**
```env
# 企业微信机器人 webhook URL
# 获取方式：企业微信群 → 群机器人 → 添加机器人
WEWORK_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxxxxxxxxxxx

# 消息类型：markdown（群机器人）或 text（个人应用）
WEWORK_MSG_TYPE=markdown
```

4. **Telegram**
```env
# Telegram Bot Token
# 获取方式：与 @BotFather 对话 → /newbot → 获取 Token
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Telegram Chat ID
# 获取方式：与机器人对话后访问 https://api.telegram.org/bot<token>/getUpdates
TELEGRAM_CHAT_ID=123456789

# 多账号配置（数量必须一致）
TELEGRAM_BOT_TOKEN=token1;token2
TELEGRAM_CHAT_ID=id1;id2
```

5. **邮件**
```env
# 发件人邮箱
EMAIL_FROM=sender@example.com

# 邮箱密码或应用专用密码（建议使用应用密码）
EMAIL_PASSWORD=your-password-or-app-key

# 收件人邮箱（多个用逗号分隔）
EMAIL_TO=user1@example.com,user2@example.com,user3@example.com

# SMTP 服务器（可选，留空自动识别）
EMAIL_SMTP_SERVER=

# SMTP 端口（可选，留空自动识别）
EMAIL_SMTP_PORT=
```

**常见邮箱配置**:
```
QQ邮箱: smtp.qq.com:587
Gmail: smtp.gmail.com:587
163邮箱: smtp.163.com:465
Outlook: smtp.office365.com:587
```

6. **ntfy**
```env
# ntfy 服务器地址（可改为自托管）
NTFY_SERVER_URL=https://ntfy.sh

# ntfy 主题名称
NTFY_TOPIC=your-topic-name

# 访问令牌（可选，用于私有主题）
NTFY_TOKEN=
```

7. **Bark** (iOS 用户)
```env
# Bark 推送 URL
# 格式：https://api.day.app/your-device-key
BARK_URL=https://api.day.app/xxxxxxxxxxxxxxxxx
```

8. **Slack**
```env
# Slack Incoming Webhook URL
# 获取方式：Slack → Apps → Incoming Webhooks → Add to Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

9. **通用 Webhook**
```env
# 通用 Webhook URL
# 支持 Discord、Matrix、IFTTT 等
GENERIC_WEBHOOK_URL=https://your-webhook-url

# JSON 模板（可选，支持 {title} 和 {content} 占位符）
# 留空使用默认格式：{"title": "{title}", "content": "{content}"}
GENERIC_WEBHOOK_TEMPLATE={"content": "{content}"}
```

**AI 配置** (5项)

```env
# 是否启用 AI 分析
AI_ANALYSIS_ENABLED=true

# AI API Key（必填）
# DeepSeek: https://platform.deepseek.com/
# OpenAI: https://platform.openai.com/
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 模型名称（LiteLLM 格式: provider/model_name）
# 示例:
# - deepseek/deepseek-chat（推荐，性价比高）
# - openai/gpt-4o
# - gemini/gemini-2.5-flash
AI_MODEL=deepseek/deepseek-chat

# 自定义 API 端点（可选）
# 大多数情况留空，仅在自建代理或兼容接口时填写
AI_API_BASE=
```

**远程存储配置** (5项) - 可选

```env
# S3 兼容协议端点
# Cloudflare R2: https://<account_id>.r2.cloudflarestorage.com
# 阿里云 OSS: https://oss-cn-hangzhou.aliyuncs.com
# 腾讯云 COS: https://cos.ap-guangzhou.myqcloud.com
S3_ENDPOINT_URL=

# 存储桶名称
S3_BUCKET_NAME=

# 访问密钥 ID
S3_ACCESS_KEY_ID=

# 访问密钥
S3_SECRET_ACCESS_KEY=

# 区域（可选）
S3_REGION=
```

**运行配置** (3项)

```env
# 定时任务表达式（cron 格式）
# 格式：分 时 日 月 周
# 示例：
# - */30 * * * *  → 每30分钟执行一次（默认）
# - 0 */2 * * *   → 每2小时执行一次
# - 0 9 * * *     → 每天早上9点执行
# - 0 9,18 * * *  → 每天9点和18点执行
CRON_SCHEDULE=*/30 * * * *

# 运行模式
# - cron: 定时执行（默认）
# - once: 单次执行后退出
RUN_MODE=cron

# 启动时立即执行一次
IMMEDIATE_RUN=true
```

### 3.3 配置关键词文件

#### 文件格式说明

编辑 `config/frequency_words.txt`：

```text
# 分组1名称
关键词1|关键词2|关键词3
关键词4

# 分组2名称
关键词5
关键词6

# 全局过滤词（匹配后排除该新闻）
!过滤词1
!过滤词2
```

**规则说明**:
- `#` 开头表示分组名或注释
- 同行多个关键词用 `|` 分隔（OR 关系）
- 每行一个关键词
- `!` 开头是全局过滤词

#### 配置示例

```text
# AI技术
ChatGPT|GPT-4|Claude|文心一言
大模型|LLM|AIGC
人工智能|机器学习|深度学习
Prompt|提示词

# 金融财经
股票|基金|债券|ETF
期货|期权|衍生品
A股|港股|美股
上证指数|深证成指

# 科技公司
华为|小米|OPPO|vivo
苹果|三星|Google
微软|Meta|Amazon

# 编程开发
Python|JavaScript|Java
GitHub|GitLab
Docker|Kubernetes
```

**常见错误**:
```
❌ 错误：使用中文逗号
ChatGPT，GPT-4，Claude

✅ 正确：使用英文逗号或竖线
ChatGPT|GPT-4|Claude
ChatGPT,GPT-4,Claude
```

### 3.4 选择通知渠道

根据你的需求选择合适的通知渠道：

#### 国内用户推荐

1. **飞书**（最推荐）
   - 支持富文本消息
   - 推送稳定
   - 配置简单

2. **钉钉**
   - 企业使用广泛
   - 安全性高

3. **企业微信**
   - 与微信集成
   - 适合团队使用

#### 国际用户推荐

1. **Telegram**（最推荐）
   - 推送即时
   - 支持机器人交互
   - 免费无限制

2. **邮件**
   - 通用性强
   - 可存档
   - 支持附件

3. **Slack**
   - 团队协作
   - 丰富的应用生态

#### 获取 Webhook 步骤

**飞书**:
1. 打开飞书群
2. 点击群设置 → 群机器人
3. 添加自定义机器人
4. 复制 Webhook URL

**Telegram**:
1. 在 Telegram 中搜索 @BotFather
2. 发送 `/newbot` 创建机器人
3. 按提示设置机器人名称
4. 获取 Token
5. 与机器人对话
6. 访问 `https://api.telegram.org/bot<token>/getUpdates` 获取 Chat ID

**钉钉**:
1. 打开钉钉群
2. 点击群设置 → 智能群助手
3. 添加机器人 → 自定义
4. 复制 Webhook URL

---

## 4. 启动和管理

### 4.1 启动容器

#### 使用 docker-compose

```bash
# 确保在工作目录
cd ~/trendradar

# 后台启动
docker compose up -d
```

**预期输出**:
```
[+] Running 2/2
 ✔ Network trendradad_default  Created                                                                                                              0.0s
 ✔ Container trendradad       Started                                                                                                              0.5s
```

#### 查看启动日志

```bash
# 查看完整启动日志
docker logs trendradad

# 实时查看日志
docker logs -f trendradad

# 查看最近 50 行
docker logs --tail 50 trendradad
```

**正常启动日志示例**:
```
✅ 配置文件检查通过
⏰ 启动supercronic: */30 * * * *
▶️ 立即执行一次
TrendRadar v5.3.0 配置加载完成
监控平台数量: 11
时区: Asia/Shanghai
通知功能已启用，将发送通知
开始爬取数据...
数据已保存到存储后端: local
[推送] 准备发送：热榜 25 条
推送完成
✅ 执行完成
```

### 4.2 查看运行状态

#### 容器状态

```bash
# 查看容器状态
docker ps | grep trendradad
```

**预期输出**:
```
CONTAINER ID   IMAGE                        COMMAND             CREATED         STATUS         PORTS     NAMES
xxxxxxxxxxxx   wantcat/trendradar:latest   "/entrypoint.sh"    5 minutes ago   Up 5 minutes             trendradar
```

#### 使用内置管理工具

```bash
# 查看详细状态
docker exec -it trendradar python manage.py status
```

**预期输出**:
```
📊 容器状态:
  🔍 PID 1 进程: /usr/local/bin/supercronic /tmp/crontab
  ✅ supercronic 正确运行为 PID 1

  ⚙️ 运行配置:
    CRON_SCHEDULE: */30 * * * *
    ⏰ 执行频率: 每30分钟执行一次
    RUN_MODE: cron
    IMMEDIATE_RUN: true

  📁 配置文件:
    ✅ config.yaml
    ✅ frequency_words.txt

  📊 状态总结:
    ✅ supercronic 正确运行为 PID 1
    ✅ 定时任务应该正常工作
    ⏰ 当前调度: 每30分钟执行一次
```

#### 查看环境变量

```bash
# 查看所有环境变量
docker exec trendradad env | grep -E "(AI_|FEISHU_|TELEGRAM_|CRON_)"

# 或使用管理工具
docker exec -it trendradar python manage.py config
```

### 4.3 查看日志

#### 方法一：docker logs

```bash
# 实时查看日志
docker logs -f trendradad

# 查看最近 100 行
docker logs --tail 100 trendradad

# 带时间戳查看
docker logs -t trendradad
```

#### 方法二：使用管理工具

```bash
# 进入容器查看实时日志
docker exec -it trendradar python manage.py logs
```

**按 Ctrl+C 退出日志查看**

#### 日志分析

**正常日志特征**:
```
[2025-01-21 10:30:00] TrendRadar v5.3.0 配置加载完成
[2025-01-21 10:30:05] 开始爬取数据...
[2025-01-21 10:30:25] 数据已保存
[2025-01-21 10:30:30] [推送] 准备发送：热榜 25 条
[2025-01-21 10:30:35] 推送完成
```

**错误日志示例**:
```
[ERROR] [2025-01-21 10:30:00] AI分析失败: APIError: 401 Unauthorized
[ERROR] [2025-01-21 10:30:05] 飞书推送失败: ConnectionError
```

### 4.4 手动执行测试

#### 立即执行一次

```bash
# 使用管理工具
docker exec -it trendradar python manage.py run
```

**预期输出**:
```
🔄 手动执行爬虫...
TrendRadar v5.3.0 配置加载完成
开始爬取数据...
...
✅ 执行完成
```

#### 单次执行模式（测试用）

```bash
# 停止当前容器
docker compose down

# 修改 .env 文件
# RUN_MODE=once

# 启动容器（执行一次后自动退出）
docker compose up
```

#### 测试通知推送

执行后检查是否收到通知，如果未收到，查看日志：

```bash
docker logs --tail 50 trendradad | grep -E "(推送|发送|ERROR|Failed)"
```

---

## 5. 高级配置

### 5.1 自定义定时任务

#### Cron 表达式详解

格式：`分 时 日 月 周`

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期几 (0-7, 0和7都表示周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

#### 常用定时配置

```env
# 每30分钟执行一次（默认）
CRON_SCHEDULE=*/30 * * * *

# 每1小时执行一次
CRON_SCHEDULE=0 * * * *

# 每2小时执行一次
CRON_SCHEDULE=0 */2 * * *

# 每天早上9点执行
CRON_SCHEDULE=0 9 * * *

# 每天9点和18点执行
CRON_SCHEDULE=0 9,18 * * *

# 每周一早上9点执行
CRON_SCHEDULE=0 9 * * 1

# 每月1号早上9点执行
CRON_SCHEDULE=0 9 1 * *

# 工作日（周一到周五）每小时执行
CRON_SCHEDULE=0 * * * 1-5
```

#### 修改定时任务

```bash
# 编辑 .env 文件
vim .env

# 修改 CRON_SCHEDULE
CRON_SCHEDULE=0 */2 * * *

# 重启容器应用配置
docker compose restart
```

#### 时区注意事项

- 容器默认时区：`Asia/Shanghai`（北京时间 UTC+8）
- Cron 表达式使用容器时区
- 修改时区：
```env
TZ=Asia/Shanghai  # 或其他时区
```

### 5.2 Web 服务器启用

#### 启用 Web 服务器

编辑 `.env` 文件：

```env
ENABLE_WEBSERVER=true
WEBSERVER_PORT=8080
```

重启容器：

```bash
docker compose restart
```

#### 访问 HTML 报告

```bash
# 查看服务器状态
docker exec -it trendradar python manage.py webserver_status
```

**预期输出**:
```
🌐 Web 服务器状态:
  ✅ 运行中 (PID: 123)
  📁 服务目录: /app/output
  🌐 访问地址: http://localhost:8080
  📄 首页: http://localhost:8080/index.html
```

在浏览器中访问：
- `http://localhost:8080` - 报告首页
- `http://localhost:8080/html/latest/current.html` - 最新报告

#### 修改端口

编辑 `.env` 和 `docker-compose.yml`：

```env
WEBSERVER_PORT=9090
```

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:${WEBSERVER_PORT:-9090}:${WEBSERVER_PORT:-9090}"
```

重启容器：

```bash
docker compose up -d --force-recreate
```

#### 防火墙设置

如果需要从外部访问，开放端口：

```bash
# Linux (ufw)
sudo ufw allow 8080/tcp

# Linux (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

**安全建议**:
- 仅在可信网络访问
- 使用反向代理（Nginx）加 HTTPS
- 限制访问 IP

### 5.3 云存储配置

#### Cloudflare R2 配置

1. **创建 R2 Bucket**
   - 登录 Cloudflare Dashboard
   - 进入 R2 Object Storage
   - Create Bucket

2. **获取 API Token**
   - Manage R2 API Tokens
   - Create API Token
   - 保存 Access Key ID 和 Secret Access Key

3. **配置 .env**

```env
S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
S3_BUCKET_NAME=trendradar
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

4. **验证配置**

```bash
# 重启容器
docker compose restart

# 查看日志
docker logs -f trendradad
```

#### 阿里云 OSS 配置

```env
S3_ENDPOINT_URL=https://oss-cn-hangzhou.aliyuncs.com
S3_BUCKET_NAME=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

#### 腾讯云 COS 配置

```env
S3_ENDPOINT_URL=https://cos.ap-guangzhou.myqcloud.com
S3_BUCKET_NAME=your-bucket-name-1234567890
S3_ACCESS_KEY_ID=your-secret-id
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=ap-guangzhou
```

### 5.4 数据持久化

#### Volume 配置说明

`docker-compose.yml` 中的 volume 配置：

```yaml
volumes:
  - ./config:/app/config:ro      # 配置文件（只读）
  - ./output:/app/output          # 输出数据（读写）
```

**说明**:
- `./config`: 主机配置目录映射到容器
- `:ro`: 只读模式，防止容器修改配置
- `./output`: 主机输出目录，数据持久化

#### 备份策略

##### 自动备份脚本

```bash
# 创建备份脚本
cat > ~/trendradar/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/trendradar/backups
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置
tar -czf $BACKUP_DIR/config_$DATE.tar.gz config/

# 备份数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz output/

# 删除7天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x ~/trendradar/backup.sh
```

##### 添加到 crontab

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨2点备份
0 2 * * * ~/trendradar/backup.sh >> ~/trendradar/backup.log 2>&1
```

#### 数据迁移

```bash
# 备份旧数据
tar -czf trendradar_backup_$(date +%Y%m%d).tar.gz output/ config/

# 迁移到新服务器
scp trendradar_backup_*.tar.gz user@new-server:~/trendradar/

# 在新服务器解压
cd ~/trendradar
tar -xzf trendradar_backup_*.tar.gz
```

---

## 6. 常用管理命令

### 6.1 容器管理

#### 启动/停止/重启

```bash
# 启动
docker compose up -d

# 停止
docker compose stop

# 重启
docker compose restart

# 强制重新创建
docker compose up -d --force-recreate
```

#### 查看容器状态

```bash
# 查看运行状态
docker ps

# 查看详细信息
docker inspect trendradar

# 查看资源使用
docker stats trendradad
```

#### 进入容器 Shell

```bash
# 进入容器
docker exec -it trendradar bash

# 在容器中执行命令
docker exec trendradar ls -la /app/output

# 使用管理工具
docker exec -it trendradar python manage.py status
```

#### 删除容器

```bash
# 停止并删除容器
docker compose down

# 删除容器和 volume（危险！会删除数据）
docker compose down -v
```

### 6.2 日志管理

#### 查看不同级别日志

```bash
# 查看所有日志
docker logs trendradad

# 查看错误日志
docker logs trendradad 2>&1 | grep ERROR

# 查看推送日志
docker logs trendradad 2>&1 | grep 推送

# 查看AI日志
docker logs trendradad 2>&1 | grep "\[AI\]"
```

#### 日志轮转配置

创建日志轮转配置：

```bash
sudo vim /etc/logrotate.d/trendradar
```

```
/var/lib/docker/containers/*trendradad*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

#### 日志持久化

```bash
# 导出日志到文件
docker logs trendradad > trendradar_$(date +%Y%m%d).log 2>&1

# 实时保存日志
docker logs -f trendradar | tee trendradar.log
```

### 6.3 配置修改和重载

#### 修改 .env 文件

```bash
# 编辑配置
vim .env

# 验证语法（可选）
docker run --rm \
  -v $(pwd)/.env:/.env \
  wantcat/trendradar:latest \
  sh -c "env | grep -E '^[A-Z]'"
```

#### 重启应用配置

```bash
# 方法一：重启容器（推荐）
docker compose restart

# 方法二：完全重建
docker compose down
docker compose up -d

# 查看重启后的日志
docker logs -f trendradad
```

#### 热更新配置（部分配置）

某些配置修改后无需重启：

- 修改 `config/frequency_words.txt`: 下次执行自动生效
- 修改 `config/config.yaml`: 需要重启容器
- 修改 `.env` 中的环境变量: 需要重启容器

### 6.4 备份和恢复

#### 数据目录备份

```bash
# 完整备份
tar -czf backup_complete_$(date +%Y%m%d_%H%M%S).tar.gz config/ output/

# 仅备份数据
tar -czf backup_data_$(date +%Y%m%d_%H%M%S).tar.gz output/

# 仅备份配置
tar -czf backup_config_$(date +%Y%m%d_%H%M%S).tar.gz config/
```

#### 配置文件备份

```bash
# 备份 .env 文件
cp .env .env.backup.$(date +%Y%m%d)

# 备份关键词文件
cp config/frequency_words.txt config/frequency_words.txt.backup
```

#### 恢复步骤

```bash
# 停止容器
docker compose down

# 解压备份
tar -xzf backup_complete_20250121.tar.gz

# 重启容器
docker compose up -d

# 验证恢复
docker exec -it trendradar python manage.py status
```

---

## 7. 故障排查

### 7.1 常见问题

#### 问题1：容器无法启动

**症状**:
```bash
$ docker compose up -d
ERROR: for trendradar  Cannot start service trendradad: ...
```

**检查清单**:

1. **检查配置文件是否存在**
```bash
ls -la config/
```

**预期输出**:
```
-rw-r--r-- 1 user user 8234 config.yaml
-rw-r--r-- 1 user user 1234 frequency_words.txt
```

2. **检查 .env 文件语法**
```bash
# 验证环境变量
docker run --rm \
  -v $(pwd)/.env:/.env \
  alpine env | sort
```

3. **查看详细错误**
```bash
# 查看容器日志
docker logs trendradad

# 查看容器状态
docker ps -a | grep trendradar
```

4. **常见原因和解决方案**

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `config.yaml not found` | 配置文件缺失 | 从镜像复制配置文件 |
| `permission denied` | 权限问题 | `chmod 644 config/*` |
| `port already in use` | 端口冲突 | 修改 `WEBSERVER_PORT` |
| `invalid .env file` | 环境变量格式错误 | 检查引号、空格等 |

#### 问题2：没有收到推送

**症状**: 程序运行正常但没有收到通知

**配置检查**:

1. **检查通知渠道是否配置**
```bash
docker exec trendradar env | grep -E "WEBHOOK_URL|BOT_TOKEN"
```

**预期输出**（应该有值）:
```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/...
```

2. **检查日志中的推送信息**
```bash
docker logs trendradad | grep -E "推送|发送|ERROR"
```

**正常日志**:
```
[推送] 准备发送：热榜 25 条
推送完成
```

**错误日志**:
```
[ERROR] 飞书推送失败: ConnectionError
```

3. **Webhook 验证**

飞书：
```bash
curl -X POST "your-webhook-url" \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

Telegram：
```bash
curl -X POST "https://api.telegram.org/bot<token>/sendMessage" \
  -d "chat_id=<chat_id>" \
  -d "text=测试消息"
```

4. **检查是否有匹配的新闻**
```bash
docker logs trendradad | grep "匹配的新闻"
```

如果没有匹配的新闻，检查：
- 关键词配置是否正确
- 是否有新的热榜数据

#### 问题3：AI 分析失败

**症状**: AI 分析报错或无输出

**检查清单**:

1. **验证 API Key**
```bash
docker exec trendradar env | grep AI_API_KEY
```

2. **检查 AI 配置**
```bash
docker exec -it trendradar python manage.py config | grep AI
```

**预期输出**:
```
AI_ANALYSIS_ENABLED: true
AI_MODEL: deepseek/deepseek-chat
AI_API_KEY: sk-abc***  # 已脱敏
```

3. **测试 API 连接**
```bash
# 在容器内测试
docker exec -it trendradar bash

python << 'EOF'
import os
from litellm import completion

api_key = os.environ.get("AI_API_KEY")
model = os.environ.get("AI_MODEL", "deepseek/deepseek-chat")

try:
    response = completion(
        model=model,
        messages=[{"role": "user", "content": "Hello"}],
        api_key=api_key
    )
    print("✅ AI API 连接成功")
    print(f"响应: {response}")
except Exception as e:
    print(f"❌ AI API 连接失败: {e}")
EOF
```

4. **降低成本**

如果 API 配额不足：
```env
# .env 文件
AI_ANALYSIS_ENABLED=false  # 临时关闭

# 或减少分析数量
# 在 config/config.yaml 中修改
ai_analysis:
  max_news_for_analysis: 20  # 默认50
```

#### 问题4：定时任务不执行

**症状**: 容器运行但定时任务不执行

**检查步骤**:

1. **验证 supercronic 状态**
```bash
docker exec -it trendradar python manage.py status
```

**正常输出**:
```
✅ supercronic 正确运行为 PID 1
⏰ 启动supercronic: */30 * * * *
```

**异常输出**:
```
❌ PID 1 不是 supercronic
```

2. **检查 crontab 格式**
```bash
docker exec trendradar cat /tmp/crontab
```

**预期输出**:
```
*/30 * * * * cd /app && /usr/local/bin/python -m trendradar
```

3. **验证 cron 表达式**

使用 [crontab.guru](https://crontab.guru/) 验证表达式

4. **手动触发测试**
```bash
docker exec -it trendradar python manage.py run
```

如果手动执行成功，说明程序正常，问题在定时配置。

5. **重启容器**
```bash
docker compose restart
```

#### 问题5：数据丢失

**症状**: 之前的数据不见了

**检查步骤**:

1. **检查 volume 挂载**
```bash
docker inspect trendradar | grep -A 10 Mounts
```

**预期输出**:
```
"Mounts": [
  {
    "Type": "bind",
    "Source": "/home/user/trendradar/output",
    "Destination": "/app/output",
    ...
  }
]
```

2. **查看主机数据目录**
```bash
ls -la ~/trendradar/output/
```

3. **检查容器内数据**
```bash
docker exec trendradar ls -la /app/output/
```

4. **数据恢复**

如果主机目录有数据：
```bash
# 停止容器
docker compose down

# 备份当前数据
mv output output.bak

# 从备份恢复
tar -xzf backup_complete_20250121.tar.gz

# 重启容器
docker compose up -d
```

5. **预防措施**

- 定期备份（见第 5.4 节）
- 使用云存储
- 配置数据保留策略

### 7.2 日志分析

#### 正常日志示例

```
[2025-01-21 10:30:00] ✅ 配置文件检查通过
[2025-01-21 10:30:00] TrendRadar v5.3.0 配置加载完成
[2025-01-21 10:30:00] 监控平台数量: 11
[2025-01-21 10:30:00] 时区: Asia/Shanghai
[2025-01-21 10:30:05] 开始爬取数据，请求间隔 2000 毫秒
[2025-01-21 10:30:25] 数据已保存到存储后端: local
[2025-01-21 10:30:25] [推送] 准备发送：热榜 25 条
[2025-01-21 10:30:30] 推送完成
[2025-01-21 10:30:30] ✅ 执行完成
```

#### 错误日志识别

| 错误类型 | 日志特征 | 可能原因 |
|---------|---------|---------|
| 网络错误 | `ConnectionError`, `Timeout` | 网络连接问题 |
| API 错误 | `401 Unauthorized`, `APIError` | API Key 无效或额度不足 |
| 配置错误 | `config.yaml not found` | 配置文件缺失或路径错误 |
| 权限错误 | `Permission denied` | 文件权限问题 |
| 解析错误 | `YAML parse error` | 配置文件语法错误 |

#### 性能瓶颈分析

```bash
# 查看容器资源使用
docker stats trendradad --no-stream
```

**正常资源使用**:
```
CONTAINER   CPU %   MEM USAGE / LIMIT
trendradar  5.50%   128MiB / 512MiB
```

**异常情况**:
- CPU > 50%: 可能是 AI 分析耗时过长
- 内存 > 512MB: 可能是内存泄漏
- 无网络 I/O: 可能是网络问题

### 7.3 性能优化

#### 资源限制配置

编辑 `docker-compose.yml`:

```yaml
services:
  trendradar:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

#### 定时任务频率调整

根据需求调整执行频率：

```env
# 低频模式（节省资源）
CRON_SCHEDULE=0 */2 * * *

# 高频模式（实时监控）
CRON_SCHEDULE=*/15 * * * *
```

#### 数据清理策略

```yaml
# config/config.yaml
storage:
  local:
    retention_days: 7  # 只保留7天数据
```

或通过环境变量：
```bash
docker run -e STORAGE_RETENTION_DAYS=7 ...
```

### 7.4 容器调试

#### 进入容器调试

```bash
# 进入容器
docker exec -it trendradar bash

# 在容器内执行调试命令
ls -la /app/config
cat /app/config/config.yaml
python -m trendradar  # 手动执行
```

#### 查看 PID 1 进程

```bash
# 查看 PID 1 进程
docker exec trendradar ps aux | head -2

# 查看 PID 1 命令行
docker exec trendradar cat /proc/1/cmdline | tr '\0' ' '
```

**正常输出**:
```
/usr/local/bin/supercronic /tmp/crontab
```

#### 网络连接测试

```bash
# 测试 DNS
docker exec trendradar nslookup google.com

# 测试外部连接
docker exec trendradar curl -I https://www.google.com

# 测试 API 连接
docker exec trendradar curl -I https://api.deepseek.com
```

#### 完整调试模式

```bash
# 启用调试模式
# 编辑 config/config.yaml
advanced:
  debug: true

# 重启容器
docker compose restart

# 查看详细日志
docker logs -f trendradar
```

---

## 8. 生产环境部署

### 8.1 安全加固

#### 敏感信息保护

1. **使用环境变量**
```env
# ❌ 不要在 .env 中提交敏感信息
AI_API_KEY=sk-xxx

# ✅ 使用 Docker Secrets (Swarm)
echo "sk-xxx" | docker secret create ai_api_key -
```

2. **文件权限**
```bash
# 限制配置文件权限
chmod 600 .env
chmod 644 config/*

# 确保文件所有者正确
chown -R user:group ~/trendradar
```

3. **不要提交到版本控制**
```bash
# .gitignore
.env
.env.*
output/
config/*.yaml
```

#### 网络隔离

```yaml
# docker-compose.yml
services:
  trendradar:
    # ... 其他配置
    networks:
      - trendradar-net

networks:
  trendradar-net:
    driver: bridge
    internal: false  # 设为 true 可完全隔离外网
```

#### 访问控制

1. **限制 Web 服务器访问**
```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:8080:8080"  # 仅本地访问
```

2. **使用反向代理**

Nginx 配置示例：
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /trendradar/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 8.2 监控和告警

#### 健康检查配置

```yaml
# docker-compose.yml
services:
  trendradar:
    # ... 其他配置
    healthcheck:
      test: ["CMD", "python", "manage.py", "status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

#### 日志监控

使用 Prometheus + Grafana：

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

#### 推送失败告警

创建告警脚本：

```bash
cat > ~/trendradar/alert.sh << 'EOF'
#!/bin/bash

# 检查最近一次执行是否成功
if docker logs --tail 50 trendradad | grep -q "ERROR"; then
    # 发送告警
    curl -X POST "$ALERT_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"text":"TrendRadar 推送失败"}'
fi
EOF

chmod +x ~/trendradar/alert.sh

# 添加到 crontab
# */5 * * * * ~/trendradar/alert.sh
```

### 8.3 备份策略

#### 自动备份脚本

```bash
cat > ~/trendradar/auto-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR=/backup/trendradar
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置
tar -czf $BACKUP_DIR/config_$DATE.tar.gz ~/trendradar/config/

# 备份数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz ~/trendradar/output/

# 上传到云存储（可选）
# aws s3 cp $BACKUP_DIR/config_$DATE.tar.gz s3://your-bucket/backups/

# 清理旧备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
EOF

chmod +x ~/trendradar/auto-backup.sh
```

#### 定时备份

```bash
# 添加到 crontab
crontab -e

# 每天凌晨3点备份
0 3 * * * ~/trendradar/auto-backup.sh >> ~/trendradad/backup.log 2>&1
```

#### 异地备份

使用 rclone 同步到云存储：

```bash
# 安装 rclone
curl https://rclone.org/install.sh | sudo bash

# 配置云存储
rclone config

# 同步备份
rclone sync ~/trendradar/backups remote:backups/trendradar
```

### 8.4 升级和维护

#### 镜像升级步骤

```bash
# 1. 备份当前配置和数据
~/trendradar/backup.sh

# 2. 拉取新镜像
docker pull wantcat/trendradar:latest

# 3. 停止容器
docker compose down

# 4. 查看当前配置（如有需要）
docker images | grep trendradar

# 5. 启动新版本
docker compose up -d

# 6. 验证运行
docker logs -f trendradar

# 7. 如果有问题，回滚
docker compose down
docker pull wantcat/trendradar:previous-version
docker compose up -d
```

#### 配置迁移

主要配置变更点：

- `v5.x` → `v6.0`: 环境变量名称变更
- 检查 `docker/.env` 模板
- 更新 `.env` 文件
- 测试配置

#### 数据库升级

```bash
# SQLite 数据库位于 output/news/ 和 output/rss/

# 备份数据库
cp output/news/*.db ~/backup/

# 检查数据库完整性
docker exec trendradar sqlite3 /app/output/news/2025-01-21.db "PRAGMA integrity_check;"

# 如果需要，重建数据库
# （一般不需要，SQLite 自动处理）
```

---

## 附录

### A. 完整 .env 文件示例

```env
# ============================================
# Web 服务器配置
# ============================================
ENABLE_WEBSERVER=false
WEBSERVER_PORT=8080

# ============================================
# 通知渠道配置
# ============================================
FEISHU_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DINGTALK_WEBHOOK_URL=
WEWORK_WEBHOOK_URL=
WEWORK_MSG_TYPE=
EMAIL_FROM=
EMAIL_PASSWORD=
EMAIL_TO=user1@example.com,user2@example.com
EMAIL_SMTP_SERVER=
EMAIL_SMTP_PORT=
NTFY_SERVER_URL=https://ntfy.sh
NTFY_TOPIC=
NTFY_TOKEN=
BARK_URL=
SLACK_WEBHOOK_URL=
GENERIC_WEBHOOK_URL=
GENERIC_WEBHOOK_TEMPLATE=

# ============================================
# AI 配置
# ============================================
AI_ANALYSIS_ENABLED=true
AI_API_KEY=sk-your-api-key-here
AI_MODEL=deepseek/deepseek-chat
AI_API_BASE=

# ============================================
# 远程存储配置
# ============================================
S3_ENDPOINT_URL=
S3_BUCKET_NAME=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=

# ============================================
# 运行配置
# ============================================
CRON_SCHEDULE=*/30 * * * *
RUN_MODE=cron
IMMEDIATE_RUN=true
```

### B. 常用命令速查表

```bash
# ========== 容器管理 ==========
docker compose up -d              # 启动容器
docker compose down               # 停止容器
docker compose restart            # 重启容器
docker ps                         # 查看运行状态
docker logs trendradar            # 查看日志
docker logs -f trendradar         # 实时日志

# ========== 进入容器 ==========
docker exec -it trendradar bash   # 进入容器
docker exec trendradar ls -la     # 执行命令

# ========== 管理工具 ==========
docker exec -it trendradar python manage.py status    # 查看状态
docker exec -it trendradar python manage.py run       # 手动执行
docker exec -it trendradar python manage.py config    # 查看配置
docker exec -it trendradar python manage.py files     # 查看文件

# ========== 备份恢复 ==========
tar -czf backup.tar.gz config/ output/                # 备份
tar -xzf backup.tar.gz                                # 恢复

# ========== 日志查询 ==========
docker logs trendradad | grep ERROR                   # 查看错误
docker logs trendradad | grep 推送                    # 查看推送
docker logs --tail 100 trendradad                     # 最近100行
```

### C. 相关资源

- **项目主页**: [https://github.com/sansan0/TrendRadar](https://github.com/sansan0/TrendRadar)
- **Docker Hub**: [https://hub.docker.com/r/wantcat/trendradar](https://hub.docker.com/r/wantcat/trendradar)
- **DeepSeek**: [https://platform.deepseek.com/](https://platform.deepseek.com/)
- **LiteLLM 文档**: [https://docs.litellm.ai/](https://docs.litellm.ai/)
- **Docker 文档**: [https://docs.docker.com/](https://docs.docker.com/)

### D. 获取帮助

如果遇到本文档未覆盖的问题：

1. 查看 [项目 README](../README.md)
2. 搜索 [GitHub Issues](https://github.com/sansan0/TrendRadar/issues)
3. 提交新的 Issue

---

**文档版本**: v1.0
**最后更新**: 2025-01-21
**适用版本**: TrendRadar v5.3.0+
