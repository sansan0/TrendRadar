# TrendRadar 部署运维文档

## 部署方式对比

| 部署方式 | 优势 | 劣势 | 适用场景 |
|----------|------|------|----------|
| **GitHub Actions** | 零服务器成本、一键部署 | 执行时间不稳定 | 个人使用、轻度需求 |
| **Docker** | 稳定可控、精准定时 | 需要服务器 | 高频推送、企业用户 |
| **本地运行** | 完全控制 | 需要保持运行 | 开发测试 |

## GitHub Actions 部署

### 快速开始

#### 1. Fork 项目

访问 [https://github.com/sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) 并 Fork。

#### 2. 配置 Secrets

在 Fork 后的仓库中，进入 `Settings → Secrets and variables → Actions`，添加以下 Secrets：

**必需配置**:
- `AI_API_KEY`: AI模型API密钥

**通知渠道（至少配置一个）**:
- `FEISHU_WEBHOOK_URL`: 飞书webhook
- `DINGTALK_WEBHOOK_URL`: 钉钉webhook
- `WEWORK_WEBHOOK_URL`: 企业微信webhook
- `TELEGRAM_BOT_TOKEN`: Telegram Bot Token
- `TELEGRAM_CHAT_ID`: Telegram Chat ID
- `EMAIL_FROM`: 发件人邮箱
- `EMAIL_PASSWORD`: 邮箱密码
- `EMAIL_TO`: 收件人邮箱

#### 3. 修改配置文件（可选）

编辑 [`config/config.yaml`](config/config.yaml)：
- 修改时区（默认 `Asia/Shanghai`）
- 选择监控平台（默认全部）
- 配置关键词（[`config/frequency_words.txt`](config/frequency_words.txt)）

#### 4. 启用 Actions

进入 `Actions` 标签页，启用 IaC workflows：
- `crawler.yml` - 主爬虫流程
- `clean-crawler.yml` - 清理爬虫

默认每小时执行一次。

### 自定义执行时间

编辑 [`.github/workflows/crawler.yml`](.github/workflows/crawler.yml):

```yaml
on:
  schedule:
    # cron表达式：分 时 日 月 周
    # 每小时执行：0 * * * *
    # 每30分钟执行：*/30 * * * *
    - cron: '0 * * * *'
```

**注意**:
- GitHub Actions 使用 UTC 时间
- 北京时间 = UTC + 8
- 例如：北京时间 09:00 = UTC 01:00

### 存储配置

#### 使用本地存储（默认）

数据保存在 `output/` 目录，随仓库一起。

#### 使用云存储（推荐）

1. **配置云存储**

在 [`config/config.yaml`](config/config.yaml) 中配置：

```yaml
storage:
  backend: "remote"
  remote:
    endpoint_url: "https://<account_id>.r2.cloudflarestorage.com"
    bucket_name: "trendradar"
    access_key_id: "${S3_ACCESS_KEY_ID}"      # 使用环境变量
    secret_access_key: "${S3_SECRET_ACCESS_KEY}"
```

2. **添加 Secrets**

在 GitHub Secrets 中添加：
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

3. **拉取数据（用于MCP服务器）**

在本地运行时：
```bash
# 设置环境变量
export S3_ACCESS_KEY_ID="your-key"
export S3_SECRET_ACCESS_KEY="your-secret"

# 拉取最近7天数据
python -m trendradar --pull-only
```

### 监控和日志

#### 查看运行日志

1. 进入仓库的 `Actions` 标签页
2. 选择最近的工作流运行
3. 点击任务查看详细日志

#### 常见问题

**Q: 工作流运行失败？**
- 检查 Secrets 是否正确配置
- 查看日志中的错误信息
- 确认配置文件语法正确

**Q: 没有收到推送？**
- 确认通知渠道已配置
- 检查webhook URL是否有效
- 查看是否有匹配的新闻

**Q: 执行时间不准确？**
- GitHub Actions 执行时间有延迟（可能延迟几分钟）
- 如需精准定时，建议使用 Docker 部署

## Docker 部署

### 快速开始

#### 1. 拉取镜像

```bash
docker pull wantcat/trendradar:latest
```

#### 2. 准备配置文件

```bash
# 创建配置目录
mkdir -p trendradar/config
mkdir -p trendradar/output

# 复制配置文件
docker run --rm wantcat/trendradar:latest cat /app/config/config.yaml > trendradar/config/config.yaml
docker run --rm wantcat/trendradar:latest cat /app/config/frequency_words.txt > trendradar/config/frequency_words.txt
```

#### 3. 编辑配置

```bash
vim trendradar/config/config.yaml
```

#### 4. 运行容器

```bash
docker run -d \
  --name trendradar \
  -v $(pwd)/trendradar/config:/app/config \
  -v $(pwd)/trendradar/output:/app/output \
  -e AI_API_KEY="your-api-key" \
  -e TZ="Asia/Shanghai" \
  wantcat/trendradar:latest
```

### Docker Compose 部署

#### 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  trendradar:
    image: wantcat/trendradar:latest
    container_name: trendradar
    restart: unless-stopped

    volumes:
      - ./config:/app/config
      - ./output:/app/output

    environment:
      - TZ=Asia/Shanghai
      - AI_API_KEY=${AI_API_KEY}
      - FEISHU_WEBHOOK_URL=${FEISHU_WEBHOOK_URL}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}

    # 定时任务（使用crond）
    command: crond -f
```

#### 创建 .env 文件

```env
AI_API_KEY=your-api-key
FEISHU_WEBHOOK_URL=your-webhook-url
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

#### 启动服务

```bash
docker-compose up -d
```

### 自定义定时

编辑容器内的 crontab：

```bash
docker exec -it trendradar crontab -e
```

示例：
```
# 每30分钟执行一次
*/30 * * * * cd /app && python -m trendradar >> /var/log/trendradar.log 2>&1
```

### 查看日志

```bash
# 实时日志
docker logs -f trendradar

# 最近100行
docker logs --tail 100 trendradar

# 持久化日志
docker run -d \
  -v $(pwd)/logs:/var/log \
  wantcat/trendradar:latest
```

### 更新镜像

```bash
docker pull wantcat/trendradar:latest
docker-compose down
docker-compose up -d
```

## 本地部署

### 环境准备

```bash
# Python 3.10+
python --version

# 克隆项目
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 配置文件

```bash
# 编辑配置
vim config/config.yaml
vim config/frequency_words.txt
```

### 运行

```bash
# 单次运行
python -m trendradar

# 设置定时任务（Linux/Mac）
crontab -e

# 每30分钟执行
*/30 * * * * cd /path/to/TrendRadar && /path/to/venv/bin/python -m trendradar >> /var/log/trendradar.log 2>&1
```

### Windows 定时任务

使用任务计划程序：

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器：每30分钟
4. 操作：启动程序
   - 程序：`python`
   - 参数：`-m trendradar`
   - 起始于：`H:\zskj\AI\TrendRadar\TrendRadar`

## MCP 服务器部署

### 本地运行

```bash
# 启动MCP服务器
python -m mcp_server.server

# 或使用项目命令
trendradar-mcp
```

### 配置 MCP 客户端

#### Claude Desktop 配置

编辑 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trendradar": {
      "command": "python",
      "args": [
        "-m", "mcp_server.server",
        "--project-root", "H:/zskj/AI/TrendRadar/TrendRadar"
      ]
    }
  }
}
```

#### Cline (VSCode) 配置

在 VSCode 设置中添加 MCP 服务器配置。

### Docker 运行 MCP 服务器

```bash
docker run -d \
  --name trendradar-mcp \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/output:/app/output \
  -e AI_API_KEY="your-api-key" \
  wantcat/trendradar:latest \
  python -m mcp_server.server
```

## 云存储配置

### Cloudflare R2

1. **创建 R2 Bucket**

登录 Cloudflare Dashboard，创建 R2 存储桶。

2. **获取 API Token**

创建 API Token，获取 Access Key ID 和 Secret Access Key。

3. **配置项目**

```yaml
storage:
  backend: "remote"
  remote:
    endpoint_url: "https://<account_id>.r2.cloudflarestorage.com"
    bucket_name: "trendradar"
    access_key_id: ""  # 填入 Access Key ID
    secret_access_key: ""  # 填入 Secret Access Key
```

### 阿里云 OSS

```yaml
storage:
  remote:
    endpoint_url: "https://oss-cn-hangzhou.aliyuncs.com"
    bucket_name: "trendradar"
    access_key_id: ""
    secret_access_key: ""
```

### 腾讯云 COS

```yaml
storage:
  remote:
    endpoint_url: "https://cos.ap-guangzhou.myqcloud.com"
    bucket_name: "trendradar-1234567890"
    access_key_id: ""
    secret_access_key: ""
    region: "ap-guangzhou"
```

## 监控和告警

### 健康检查

```bash
# 检查容器状态
docker ps

# 检查日志
docker logs trendradar --tail 50

# 检查输出文件
ls -lh output/news/
ls -lh output/html/
```

### 日志管理

#### 日志级别

```yaml
# config/config.yaml
advanced:
  debug: true  # 生产环境设为 false
```

#### 日志轮转

使用 logrotate：

```bash
# /etc/logrotate.d/trendradar
/var/log/trendradar.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

### 性能监控

#### 系统资源

```bash
# CPU/内存使用
docker stats trendradar

# 磁盘使用
du -sh output/
```

#### 数据库大小

```bash
# SQLite数据库大小
ls -lh output/news/*.db

# 清理旧数据
python -m trendradar --cleanup-days=7
```

## 故障排查

### 常见问题

#### 1. 数据库锁定

**症状**: `database is locked`

**解决方案**:
```bash
# 停止所有运行实例
docker-compose down

# 等待几秒后重启
docker-compose up -d
```

#### 2. 推送失败

**症状**: 未收到通知推送

**排查步骤**:
1. 检查配置文件中的通知渠道是否启用
2. 验证 webhook URL 是否正确
3. 查看日志中的错误信息
4. 测试 webhook 是否有效

```bash
# 测试飞书webhook
curl -X POST "https://open.feishu.cn/open-apis/bot/v2/hook/xxx" \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

#### 3. AI分析失败

**症状**: AI分析报错或无输出

**排查步骤**:
1. 检查 API Key 是否正确
2. 确认 API 额度是否充足
3. 查看日志中的详细错误
4. 尝试降低 `max_news_for_analysis`

#### 4. 爬虫失败

**症状**: 所有平台抓取失败

**排查步骤**:
1. 检查网络连接
2. 确认 newsnow API 是否可用
3. 查看是否需要代理

```yaml
# config/config.yaml
advanced:
  crawler:
    use_proxy: true
    default_proxy: "http://127.0.0.1:10801"
```

#### 5. 时区问题

**症状**: 时间显示不正确

**解决方案**:
```yaml
# config/config.yaml
app:
  timezone: "Asia/Shanghai"  # 确认时区正确
```

### 日志分析

#### 查看详细错误

```yaml
advanced:
  debug: true
```

#### 日志示例

正常日志：
```
[2025-01-21 10:30:00] TrendRadar v5.3.0 配置加载完成
[2025-01-21 10:30:00] 监控平台数量: 11
[2025-01-21 10:30:00] 时区: Asia/Shanghai
[2025-01-21 10:30:05] 开始爬取数据
[2025-01-21 10:30:25] 数据已保存到存储后端
[2025-01-21 10:30:30] [推送] 准备发送：热榜 25 条
[2025-01-21 10:30:35] 推送完成
```

错误日志：
```
[ERROR] [2025-01-21 10:30:00] AI分析失败: APIError: 401 Unauthorized
[ERROR] [2025-01-21 10:30:05] 飞书推送失败: ConnectionError
```

## 备份和恢复

### 数据备份

#### 手动备份

```bash
# 备份配置
tar -czf config-backup-$(date +%Y%m%d).tar.gz config/

# 备份数据库
tar -czf data-backup-$(date +%Y%m%d).tar.gz output/
```

#### 自动备份

```bash
# 每天备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/trendradar"

tar -czf $BACKUP_DIR/config-$DATE.tar.gz config/
tar -czf $BACKUP_DIR/data-$DATE.tar.gz output/

# 删除7天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 数据恢复

```bash
# 解压配置
tar -xzf config-backup-20250121.tar.gz

# 解压数据
tar -xzf data-backup-20250121.tar.gz
```

## 升级指南

### GitHub Actions

自动使用最新版本，无需操作。

### Docker

```bash
# 备份数据
docker cp trendradar:/app/output ./backup

# 拉取新镜像
docker pull wantcat/trendradar:latest

# 重启容器
docker-compose down
docker-compose up -d
```

### 本地部署

```bash
# 拉取最新代码
git pull origin master

# 更新依赖
pip install -r requirements.txt --upgrade

# 重启服务
python -m trendradar
```

## 安全建议

### 1. 保护敏感信息

- ✅ 使用环境变量存储 API Key
- ✅ 使用 GitHub Secrets（GitHub Actions）
- ✅ 不要在配置文件中硬编码密钥
- ❌ 不要将 config.yaml 提交到公开仓库（添加到 .gitignore）

### 2. 访问控制

- 为 webhook URL 设置访问限制
- 使用强密码保护邮箱
- 定期更换 API Key

### 3. 网络安全

- 使用 HTTPS 端点
- 验证 SSL 证书
- 限制爬虫请求频率

## 相关资源

- [配置指南](03-configuration.md)
- [用户手册](07-user-manual.md)
- [开发指南](04-development.md)
