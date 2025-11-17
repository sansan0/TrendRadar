# 🐳 TrendRadar Docker 部署完整教程

本教程将指导您如何使用 Docker 在自己的机器上部署 TrendRadar 热点监控助手。

## 📋 目录

- [环境要求](#环境要求)
- [快速开始（30秒部署）](#快速开始30秒部署)
- [推荐部署方式（docker-compose）](#推荐部署方式docker-compose)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [故障排查](#故障排查)
- [高级配置](#高级配置)

---

## 环境要求

在开始之前，请确保您的机器已安装：

- **Docker**: 版本 20.10 或更高
- **Docker Compose**: 版本 2.0 或更高（可选，推荐）
- **操作系统**: Linux / macOS / Windows（含 WSL2）

### 安装 Docker

如果您还没有安装 Docker，请参考以下命令：

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录后生效
```

**CentOS/RHEL:**
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**macOS/Windows:**
- 下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## 快速开始（30秒部署）

如果您只是想快速体验 TrendRadar，可以使用一键命令：

### 第一步：准备配置文件

```bash
# 创建配置目录
mkdir -p config output

# 下载配置文件模板
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/
```

### 第二步：编辑配置文件

```bash
# 编辑主配置文件
vim config/config.yaml
# 或使用其他编辑器：nano、gedit 等
```

在 `config.yaml` 中设置您的通知渠道（至少配置一个）：
- 飞书 Webhook URL
- 钉钉 Webhook URL
- 企业微信 Webhook URL
- Telegram Bot Token 和 Chat ID
- 邮件配置

### 第三步：启动容器

**Linux/macOS:**
```bash
docker run -d --name trend-radar \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/output:/app/output \
  -e TZ=Asia/Shanghai \
  -e RUN_MODE=cron \
  -e CRON_SCHEDULE="*/30 * * * *" \
  -e IMMEDIATE_RUN=true \
  wantcat/trendradar:latest
```

**Windows (PowerShell):**
```powershell
docker run -d --name trend-radar `
  -v ${PWD}/config:/app/config:ro `
  -v ${PWD}/output:/app/output `
  -e TZ=Asia/Shanghai `
  -e RUN_MODE=cron `
  -e CRON_SCHEDULE="*/30 * * * *" `
  -e IMMEDIATE_RUN=true `
  wantcat/trendradar:latest
```

**查看运行日志：**
```bash
docker logs -f trend-radar
```

---

## 推荐部署方式（docker-compose）

使用 docker-compose 可以更方便地管理配置和服务。

### 第一步：创建项目目录结构

```bash
# 创建项目目录
mkdir -p trendradar
cd trendradar

# 创建子目录
mkdir -p config output

# 下载配置文件
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/config.yaml -P config/
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/config/frequency_words.txt -P config/

# 下载 docker-compose 配置
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/.env -O .env
wget https://raw.githubusercontent.com/sansan0/TrendRadar/master/docker/docker-compose.yml
```

完成后的目录结构：
```
trendradar/
├── config/
│   ├── config.yaml            # 主配置文件
│   └── frequency_words.txt    # 关键词配置
├── output/                     # 生成的报告输出目录
├── .env                        # 环境变量配置
└── docker-compose.yml          # Docker Compose 配置
```

### 第二步：配置文件说明

#### 1. config/config.yaml - 主配置文件

这是应用的核心配置文件，包含：

```yaml
# 应用基础配置
app:
  report_mode: daily          # 报告模式：daily/current/incremental

# 爬虫配置
crawler:
  enable_crawler: true        # 是否启用爬虫

# 通知配置
notification:
  enable_notification: true   # 是否启用通知
  channels:
    feishu:
      webhook_url: ""         # 飞书 Webhook URL
    dingtalk:
      webhook_url: ""         # 钉钉 Webhook URL
    wework:
      webhook_url: ""         # 企业微信 Webhook URL
    telegram:
      bot_token: ""           # Telegram Bot Token
      chat_id: ""             # Telegram Chat ID
    email:
      from: ""                # 发件人邮箱
      password: ""            # 邮箱密码或授权码
      to: ""                  # 收件人邮箱
```

**重要提示：** 至少配置一个通知渠道才能接收热点推送！

#### 2. config/frequency_words.txt - 关键词配置

在这个文件中添加您关心的热点关键词，每行一个：

```
人工智能
区块链
云计算
大数据
# 可以添加更多关键词
```

如果此文件为空，系统将推送所有热点新闻（受限于消息推送大小限制）。

#### 3. .env - 环境变量配置

这个文件用于配置运行参数和 Webhook URLs：

```bash
# 时区设置
TZ=Asia/Shanghai

# 核心配置（v3.0.5+ 支持环境变量覆盖）
# 取消注释以下行来覆盖 config.yaml 中的对应配置
#ENABLE_CRAWLER=true
#ENABLE_NOTIFICATION=true
#REPORT_MODE=daily

# 推送时间窗口配置
#PUSH_WINDOW_ENABLED=true
#PUSH_WINDOW_START=09:00
#PUSH_WINDOW_END=18:00

# 通知渠道 Webhook URLs（可在此配置，避免直接修改 config.yaml）
#FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook
#DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=your-token
#WEWORK_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key
#TELEGRAM_BOT_TOKEN=your-bot-token
#TELEGRAM_CHAT_ID=your-chat-id

# 邮件配置
#EMAIL_FROM=your-email@example.com
#EMAIL_PASSWORD=your-password
#EMAIL_TO=recipient@example.com

# 定时任务配置
CRON_SCHEDULE=*/30 * * * *    # 每30分钟执行一次
RUN_MODE=cron                  # 运行模式：cron（定时）/ once（单次）
IMMEDIATE_RUN=true             # 启动时立即执行一次
```

**配置优先级：** 环境变量 > config.yaml

### 第三步：启动服务

```bash
# 拉取最新镜像
docker-compose pull

# 启动服务（后台运行）
docker-compose up -d

# 查看运行日志
docker-compose logs -f
```

### 第四步：验证部署

```bash
# 查看容器状态
docker ps | grep trend-radar

# 查看实时日志
docker logs -f trend-radar

# 检查配置是否正确
docker exec -it trend-radar python manage.py config

# 手动执行一次爬虫测试
docker exec -it trend-radar python manage.py run
```

---

## 配置说明

### 环境变量覆盖机制（v3.0.5+）

如果您在 NAS（群晖、威联通等）或其他 Docker 环境中遇到**修改 config.yaml 后配置不生效**的问题，可以通过环境变量直接覆盖配置。

| 环境变量 | 对应配置 | 可选值 | 说明 |
|---------|---------|-------|------|
| `ENABLE_CRAWLER` | `crawler.enable_crawler` | `true` / `false` | 是否启用爬虫 |
| `ENABLE_NOTIFICATION` | `notification.enable_notification` | `true` / `false` | 是否启用通知 |
| `REPORT_MODE` | `app.report_mode` | `daily` / `current` / `incremental` | 报告模式 |
| `PUSH_WINDOW_ENABLED` | `notification.push_window.enabled` | `true` / `false` | 是否启用推送时间窗口 |
| `PUSH_WINDOW_START` | `notification.push_window.start_time` | 时间格式 `HH:MM` | 推送窗口开始时间 |
| `PUSH_WINDOW_END` | `notification.push_window.end_time` | 时间格式 `HH:MM` | 推送窗口结束时间 |

### 报告模式说明

- **daily**: 每日汇总模式，汇总当天所有热点
- **current**: 当前榜单模式，只推送当前时刻的热点
- **incremental**: 增量模式，只推送新出现的热点

### 定时任务配置

`CRON_SCHEDULE` 使用标准的 Cron 表达式：

```bash
# 格式: 分 时 日 月 周
# 示例：
*/5 * * * *      # 每5分钟执行一次
*/30 * * * *     # 每30分钟执行一次（推荐）
0 */1 * * *      # 每小时执行一次
0 9,12,18 * * *  # 每天 9:00、12:00、18:00 执行
0 9 * * *        # 每天 9:00 执行
```

---

## 服务管理

### 基本管理命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 停止并删除容器
docker-compose down
```

### 使用内置管理工具

TrendRadar 提供了方便的管理工具：

```bash
# 查看运行状态
docker exec -it trend-radar python manage.py status

# 手动执行一次爬虫
docker exec -it trend-radar python manage.py run

# 查看实时日志
docker exec -it trend-radar python manage.py logs

# 显示当前配置
docker exec -it trend-radar python manage.py config

# 显示输出文件列表
docker exec -it trend-radar python manage.py files

# 查看帮助信息
docker exec -it trend-radar python manage.py help
```

### 更新镜像

```bash
# 方法一：使用 docker-compose
docker-compose pull
docker-compose up -d

# 方法二：手动更新
docker pull wantcat/trendradar:latest
docker-compose down
docker-compose up -d
```

---

## 故障排查

### 1. 容器无法启动

```bash
# 查看容器状态
docker ps -a | grep trend-radar

# 查看详细日志
docker logs trend-radar

# 检查配置文件是否存在
ls -la config/
```

**常见原因：**
- 配置文件路径不正确
- 配置文件格式错误
- 端口冲突

### 2. 配置修改不生效

**解决方案：**
1. 检查配置文件是否正确挂载：
   ```bash
   docker exec -it trend-radar ls -la /app/config/
   ```

2. 如果是 NAS 环境，使用环境变量覆盖（在 .env 或 NAS 管理界面中设置）

3. 修改配置后重启容器：
   ```bash
   docker-compose restart
   ```

### 3. 没有收到通知

**检查清单：**
1. 确认至少配置了一个通知渠道
2. 检查 Webhook URL 是否正确
3. 查看日志中是否有错误信息：
   ```bash
   docker logs trend-radar | grep -i error
   ```
4. 手动执行一次测试：
   ```bash
   docker exec -it trend-radar python manage.py run
   ```

### 4. 查看详细错误信息

```bash
# 查看最近 100 行日志
docker logs --tail 100 trend-radar

# 实时查看日志
docker logs -f trend-radar

# 进入容器内部调试
docker exec -it trend-radar /bin/bash

# 在容器内查看配置
cat /app/config/config.yaml
cat /app/config/frequency_words.txt
```

### 5. 容器运行但无输出

```bash
# 检查定时任务是否正确
docker exec -it trend-radar python manage.py status

# 查看 output 目录
ls -la output/

# 检查环境变量
docker exec -it trend-radar env | grep -E "ENABLE|MODE|CRON"
```

---

## 高级配置

### 多架构支持

TrendRadar 官方镜像支持以下架构：
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/aarch64)

Docker 会自动选择适合您系统的架构。

### 自定义构建

如果您需要修改代码或构建自己的镜像：

```bash
# 克隆项目
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# 修改代码
vim main.py

# 使用构建版 docker-compose
cd docker
cp docker-compose-build.yml docker-compose.yml

# 构建并启动
docker-compose build
docker-compose up -d
```

### 在 NAS 上部署

#### 群晖 NAS (Synology DSM)

1. 打开 **Container Manager**（或 Docker 应用）
2. 在左侧选择 **项目**
3. 点击 **新增** -> **从 docker-compose.yml 创建**
4. 上传 `docker-compose.yml` 文件
5. 在 **环境变量** 标签页添加配置
6. 在 **卷** 标签页映射 config 和 output 目录
7. 启动项目

#### 威联通 NAS (QNAP)

1. 打开 **Container Station**
2. 选择 **创建应用程序**
3. 选择 **使用 docker-compose.yml**
4. 上传 `docker-compose.yml` 文件
5. 配置卷映射和环境变量
6. 创建并启动

### 数据持久化

生成的报告保存在 `./output` 目录：

```
output/
├── hot_news_YYYYMMDD_HHMMSS.html    # HTML 格式报告
├── hot_news_YYYYMMDD_HHMMSS.txt     # 纯文本报告
└── push_history/                     # 推送历史记录
```

即使容器删除，output 目录中的数据也会保留。

### 网络配置

如果您的服务器在防火墙后或需要通过代理访问网络：

在 `.env` 中添加：

```bash
# HTTP 代理
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
NO_PROXY=localhost,127.0.0.1
```

---

## 常见问题 FAQ

### Q1: 启动容器后立即退出？

**A:** 检查配置文件是否存在：
```bash
docker exec -it trend-radar ls -la /app/config/
```

如果看到 "No such file or directory"，说明配置文件未正确挂载。

### Q2: 如何更改执行频率？

**A:** 修改 `.env` 文件中的 `CRON_SCHEDULE`：
```bash
# 每小时执行
CRON_SCHEDULE=0 * * * *

# 每天 9:00 执行
CRON_SCHEDULE=0 9 * * *
```

然后重启容器：
```bash
docker-compose restart
```

### Q3: 可以同时使用多个通知渠道吗？

**A:** 可以！在 `config.yaml` 或 `.env` 中配置多个通知渠道，系统会同时推送到所有配置的渠道。

### Q4: 如何只运行一次？

**A:** 修改 `.env`：
```bash
RUN_MODE=once
```

或直接使用命令：
```bash
docker exec -it trend-radar python main.py
```

### Q5: 推送内容太多，如何减少？

**A:**
1. 使用 `current` 或 `incremental` 模式
2. 在 `frequency_words.txt` 中只添加您最关心的关键词
3. 配置推送时间窗口，只在特定时间推送

### Q6: 如何备份配置？

**A:**
```bash
# 备份配置
tar -czf trendradar-backup.tar.gz config/ .env

# 恢复配置
tar -xzf trendradar-backup.tar.gz
```

---

## 获取帮助

如果遇到问题，您可以：

1. 查看项目 [GitHub Issues](https://github.com/sansan0/TrendRadar/issues)
2. 阅读完整的 [README.md](https://github.com/sansan0/TrendRadar)
3. 提交新的 Issue 描述您的问题

---

## 总结

按照本教程，您应该能够：

✅ 在自己的机器上成功部署 TrendRadar
✅ 配置个性化的热点关键词
✅ 接收到定时推送的热点新闻
✅ 使用管理命令维护服务
✅ 解决常见的部署问题

祝您使用愉快！🎉

---

**相关链接：**
- 项目主页: https://github.com/sansan0/TrendRadar
- Docker Hub: https://hub.docker.com/r/wantcat/trendradar
- 在线演示: https://sansan0.github.io/TrendRadar
