# 🐳 TrendRadar Docker 部署完整教程

本教程将指导您如何从自己 fork 的仓库构建并部署 TrendRadar 热点监控助手到您的机器上。

## 📋 目录

- [环境要求](#环境要求)
- [从源码构建部署（推荐）](#从源码构建部署推荐)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [故障排查](#故障排查)
- [高级配置](#高级配置)

---

## 环境要求

在开始之前，请确保您的机器已安装：

- **Docker**: 版本 20.10 或更高
- **Docker Compose**: 版本 2.0 或更高
- **Git**: 用于克隆仓库
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

## 从源码构建部署（推荐）

这种方式适合需要自定义代码、完全控制构建过程的场景。

### 第一步：克隆您的 Fork 仓库

```bash
# 克隆您 fork 的仓库
git clone https://github.com/icedike/TrendRadar.git
cd TrendRadar
```

如果您还没有 fork，可以先在 GitHub 上 fork [原项目](https://github.com/sansan0/TrendRadar)，然后克隆您自己的 fork。

### 第二步：检查项目结构

克隆后的目录结构：

```
TrendRadar/
├── main.py                    # 主程序
├── requirements.txt           # Python 依赖
├── config/                    # 配置目录
│   ├── config.yaml           # 主配置文件
│   └── frequency_words.txt   # 关键词配置
├── docker/                    # Docker 相关文件
│   ├── Dockerfile            # Docker 镜像构建文件
│   ├── docker-compose.yml    # 使用官方镜像的配置（可选）
│   ├── docker-compose-build.yml  # 本地构建配置（推荐）
│   ├── entrypoint.sh         # 容器启动脚本
│   ├── manage.py             # 管理工具
│   └── .env                  # 环境变量配置模板
└── output/                    # 生成的报告输出目录
```

### 第三步：配置文件设置

#### 1. 编辑主配置文件

```bash
# 编辑配置文件
vim config/config.yaml
# 或使用其他编辑器：nano、gedit、code 等
```

**必须配置至少一个通知渠道：**

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

#### 2. 配置关键词

```bash
# 编辑关键词文件
vim config/frequency_words.txt
```

每行一个关键词：
```
人工智能
区块链
云计算
大数据
机器学习
深度学习
# 添加您关心的其他关键词
```

**提示：** 如果此文件为空，系统将推送所有热点新闻（可能会因消息大小限制而被截断）。

#### 3. 设置环境变量（可选）

```bash
# 复制环境变量模板
cp docker/.env .env

# 编辑环境变量
vim .env
```

在 `.env` 中配置：

```bash
# 时区设置
TZ=Asia/Shanghai

# 核心配置（v3.0.5+ 支持环境变量覆盖 config.yaml）
# 取消注释以下行来覆盖 config.yaml 中的对应配置
#ENABLE_CRAWLER=true
#ENABLE_NOTIFICATION=true
#REPORT_MODE=daily

# 推送时间窗口配置
#PUSH_WINDOW_ENABLED=true
#PUSH_WINDOW_START=09:00
#PUSH_WINDOW_END=18:00

# 通知渠道（可在此配置，避免直接修改 config.yaml）
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
CRON_SCHEDULE=*/30 * * * *    # 每30分钟执行一次（推荐）
RUN_MODE=cron                  # 运行模式：cron（定时）/ once（单次）
IMMEDIATE_RUN=true             # 启动时立即执行一次
```

**配置优先级：** 环境变量 > config.yaml

### 第四步：准备 Docker Compose 配置

```bash
# 使用本地构建版本的 docker-compose
cd docker
cp docker-compose-build.yml docker-compose.yml

# 确保 .env 文件在 docker 目录中（如果您在第三步中创建了）
# 如果 .env 在项目根目录，可以移动或复制到 docker 目录
```

**docker-compose.yml 内容（docker-compose-build.yml）：**

```yaml
services:
  trend-radar:
    build:
      context: ..              # 指向项目根目录
      dockerfile: docker/Dockerfile
    container_name: trend-radar
    restart: unless-stopped

    volumes:
      - ../config:/app/config:ro    # 挂载配置文件（只读）
      - ../output:/app/output        # 挂载输出目录

    environment:
      - TZ=Asia/Shanghai
      # 可以在此添加环境变量，或使用 .env 文件
```

### 第五步：构建并启动服务

```bash
# 确保在 docker 目录中
cd docker

# 构建 Docker 镜像（首次运行会花费几分钟）
docker-compose build

# 启动服务（后台运行）
docker-compose up -d

# 查看实时日志
docker-compose logs -f
```

**首次启动：**
- 构建镜像会下载 Python 基础镜像和安装依赖，需要几分钟
- 如果设置了 `IMMEDIATE_RUN=true`，启动后会立即执行一次爬虫
- 之后会按照 `CRON_SCHEDULE` 定时执行

### 第六步：验证部署

```bash
# 查看容器状态
docker ps | grep trend-radar

# 查看运行日志
docker logs -f trend-radar

# 检查配置是否正确
docker exec -it trend-radar python manage.py config

# 查看输出文件
ls -la ../output/

# 手动执行一次爬虫测试
docker exec -it trend-radar python manage.py run
```

如果一切正常，您应该：
- 看到容器状态为 `Up`
- 日志中显示爬虫执行过程
- `output` 目录中生成了 HTML 和 TXT 报告
- 配置的通知渠道收到推送消息

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
- **incremental**: 增量模式，只推送新出现的热点（推荐）

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

**在线 Cron 生成器：** https://crontab.guru/

---

## 服务管理

### 基本管理命令

```bash
# 进入 docker 目录（所有命令在此目录执行）
cd docker

# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 停止并删除容器（保留镜像和数据）
docker-compose down

# 删除容器和镜像
docker-compose down --rmi all
```

### 使用内置管理工具

TrendRadar 提供了方便的管理脚本：

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

### 修改代码后重新构建

如果您修改了代码（如 `main.py`），需要重新构建镜像：

```bash
# 在 docker 目录中
cd docker

# 重新构建镜像
docker-compose build

# 停止旧容器
docker-compose down

# 启动新容器
docker-compose up -d

# 查看日志确认
docker-compose logs -f
```

**快捷命令（一次性完成）：**
```bash
docker-compose up -d --build
```

### 更新代码

从您的 fork 仓库拉取最新代码：

```bash
# 在项目根目录
git pull origin main

# 重新构建并启动
cd docker
docker-compose up -d --build
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
- 配置文件路径不正确（检查 docker-compose.yml 中的 volumes 配置）
- 配置文件格式错误（YAML 格式要严格缩进）
- Docker 权限问题（确保当前用户在 docker 组）

### 2. 配置修改不生效

**解决方案：**

1. 检查配置文件是否正确挂载：
   ```bash
   docker exec -it trend-radar ls -la /app/config/
   docker exec -it trend-radar cat /app/config/config.yaml
   ```

2. 如果挂载正确但配置不生效，使用环境变量覆盖：
   - 修改 `docker/.env` 文件
   - 或在 `docker-compose.yml` 中直接添加环境变量

3. 修改配置后**必须**重启容器：
   ```bash
   docker-compose restart
   ```

4. 如果修改了代码，需要重新构建：
   ```bash
   docker-compose up -d --build
   ```

### 3. 没有收到通知

**检查清单：**

1. 确认至少配置了一个通知渠道：
   ```bash
   docker exec -it trend-radar python manage.py config
   ```

2. 检查 Webhook URL 是否正确（没有多余空格）

3. 查看日志中是否有错误信息：
   ```bash
   docker logs trend-radar | grep -i error
   docker logs trend-radar | grep -i webhook
   ```

4. 手动执行一次测试：
   ```bash
   docker exec -it trend-radar python manage.py run
   ```

5. 确认网络连接正常（容器能访问外网）：
   ```bash
   docker exec -it trend-radar ping -c 3 www.baidu.com
   ```

### 4. 构建镜像失败

**常见问题：**

1. **网络问题导致下载依赖失败：**
   ```bash
   # 使用国内镜像加速
   # 编辑 docker/Dockerfile，在 RUN pip install 命令中添加：
   RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

2. **Docker 磁盘空间不足：**
   ```bash
   # 清理未使用的镜像和容器
   docker system prune -a
   ```

3. **查看详细构建日志：**
   ```bash
   docker-compose build --no-cache --progress=plain
   ```

### 5. 容器运行但无输出

```bash
# 检查定时任务是否正确
docker exec -it trend-radar python manage.py status

# 查看 output 目录
ls -la output/

# 检查环境变量
docker exec -it trend-radar env | grep -E "ENABLE|MODE|CRON"

# 查看 supercronic 日志
docker logs trend-radar | grep supercronic

# 手动执行主程序
docker exec -it trend-radar python main.py
```

### 6. 查看详细错误信息

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

# 在容器内手动运行程序
python main.py
```

---

## 高级配置

### 自定义修改代码

这是从源码构建的最大优势，您可以自由修改代码：

```bash
# 修改主程序
vim main.py

# 修改 Docker 配置
vim docker/Dockerfile
vim docker/entrypoint.sh

# 修改依赖
vim requirements.txt

# 重新构建并启动
cd docker
docker-compose up -d --build
```

### 多架构构建

如果您需要构建支持多架构的镜像：

```bash
# 启用 buildx（Docker 多平台构建工具）
docker buildx create --use

# 构建多架构镜像
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-dockerhub-username/trendradar:latest \
  -f docker/Dockerfile \
  --push \
  .
```

### 在 NAS 上部署

#### 群晖 NAS (Synology DSM)

1. **启用 SSH 并连接到 NAS**
2. **安装 Docker 和 Git：**
   - 在套件中心安装 Container Manager
   - 使用 SSH 安装 Git：`opkg install git`（如果不可用，使用 File Station 上传项目）

3. **部署步骤：**
   ```bash
   # 克隆项目
   git clone https://github.com/icedike/TrendRadar.git
   cd TrendRadar

   # 配置文件
   vim config/config.yaml
   vim config/frequency_words.txt

   # 构建部署
   cd docker
   cp docker-compose-build.yml docker-compose.yml
   docker-compose build
   docker-compose up -d
   ```

4. **或使用 Container Manager GUI：**
   - 上传项目文件到 NAS
   - 在 Container Manager 中创建项目
   - 使用 `docker-compose.yml` 配置
   - 映射 config 和 output 目录
   - 设置环境变量
   - 启动项目

#### 威联通 NAS (QNAP)

类似群晖的步骤，使用 Container Station 进行部署。

### 数据持久化

生成的报告保存在 `output` 目录：

```
output/
├── hot_news_YYYYMMDD_HHMMSS.html    # HTML 格式报告
├── hot_news_YYYYMMDD_HHMMSS.txt     # 纯文本报告
└── push_history/                     # 推送历史记录
    └── pushed_YYYYMMDD.json
```

**备份建议：**
```bash
# 定期备份 config 和 output
tar -czf trendradar-backup-$(date +%Y%m%d).tar.gz config/ output/

# 恢复
tar -xzf trendradar-backup-YYYYMMDD.tar.gz
```

### 使用 Docker Hub（可选）

如果您想将自己构建的镜像推送到 Docker Hub：

```bash
# 登录 Docker Hub
docker login

# 构建并打标签
docker build -t your-username/trendradar:latest -f docker/Dockerfile .

# 推送镜像
docker push your-username/trendradar:latest

# 在其他机器上使用
docker pull your-username/trendradar:latest
```

### 网络配置

如果您的服务器需要通过代理访问网络：

**方法一：在 .env 中配置**
```bash
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
NO_PROXY=localhost,127.0.0.1
```

**方法二：在 docker-compose.yml 中配置**
```yaml
services:
  trend-radar:
    environment:
      - HTTP_PROXY=http://proxy.example.com:8080
      - HTTPS_PROXY=http://proxy.example.com:8080
```

---

## 常见问题 FAQ

### Q1: 为什么要从源码构建而不是用官方镜像？

**A:** 从源码构建的优势：
- 完全控制代码，可以自定义修改功能
- 查看和理解完整的实现细节
- 及时修复 bug 而不用等待官方更新
- 学习项目的工作原理
- 构建自己的镜像并推送到私有仓库

### Q2: 构建太慢怎么办？

**A:** 优化构建速度：
1. 使用国内 pip 镜像源（修改 Dockerfile）
2. 使用 Docker 构建缓存（不要频繁使用 `--no-cache`）
3. 配置 Docker 镜像加速器

### Q3: 如何查看我的 fork 和原项目的差异？

**A:**
```bash
# 添加原项目为 upstream
git remote add upstream https://github.com/sansan0/TrendRadar.git

# 拉取原项目更新
git fetch upstream

# 查看差异
git diff upstream/main

# 合并原项目更新
git merge upstream/main
```

### Q4: 如何只运行一次？

**A:** 两种方法：

**方法一：修改环境变量**
```bash
# 在 .env 中设置
RUN_MODE=once

# 重启容器
docker-compose restart
```

**方法二：直接执行命令**
```bash
docker exec -it trend-radar python main.py
```

### Q5: 推送内容太多，如何减少？

**A:**
1. 使用 `incremental` 模式（只推送新热点）
2. 在 `frequency_words.txt` 中只添加您最关心的关键词
3. 配置推送时间窗口：
   ```bash
   PUSH_WINDOW_ENABLED=true
   PUSH_WINDOW_START=09:00
   PUSH_WINDOW_END=18:00
   ```

### Q6: 如何更新到最新版本？

**A:**
```bash
# 拉取您 fork 仓库的最新代码
git pull origin main

# 如果需要同步原项目的更新
git fetch upstream
git merge upstream/main

# 重新构建部署
cd docker
docker-compose up -d --build
```

### Q7: 容器占用太多磁盘空间怎么办？

**A:**
```bash
# 清理未使用的镜像
docker image prune -a

# 清理构建缓存
docker builder prune

# 清理所有未使用的资源
docker system prune -a --volumes
```

### Q8: 如何在多台机器上部署？

**A:**
1. 将项目提交到您的 GitHub fork
2. 在其他机器上克隆您的 fork
3. 重复本教程的构建步骤
4. 或者将构建好的镜像推送到 Docker Hub，在其他机器上拉取使用

---

## 获取帮助

如果遇到问题，您可以：

1. 查看项目 [GitHub Issues](https://github.com/sansan0/TrendRadar/issues)
2. 查看您的 fork 仓库：https://github.com/icedike/TrendRadar
3. 阅读完整的 [README.md](https://github.com/sansan0/TrendRadar)
4. 提交新的 Issue 描述您的问题

---

## 总结

按照本教程，您应该能够：

✅ 从自己的 fork 仓库克隆项目
✅ 配置个性化的关键词和通知渠道
✅ 使用 Docker Compose 构建并部署服务
✅ 自定义修改代码并重新构建
✅ 使用管理命令维护服务
✅ 解决常见的部署和配置问题

---

## 下一步

部署成功后，您可以：

1. **自定义监控平台**：在 `config.yaml` 中添加更多数据源
2. **调整热度算法**：修改 `main.py` 中的热度计算逻辑
3. **集成 AI 分析**：使用 MCP 功能进行智能分析（参考 README-MCP-FAQ.md）
4. **配置 GitHub Pages**：自动生成精美的网页报告
5. **设置多环境部署**：开发环境、测试环境、生产环境分离

祝您使用愉快！🎉

---

**相关链接：**
- 您的 Fork: https://github.com/icedike/TrendRadar
- 原项目: https://github.com/sansan0/TrendRadar
- Docker Hub 官方镜像: https://hub.docker.com/r/wantcat/trendradar
- 在线演示: https://sansan0.github.io/TrendRadar
