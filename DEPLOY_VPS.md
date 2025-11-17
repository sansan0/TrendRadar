# TrendRadar VPS 部署指南

本指南将帮助你在拥有 Docker 的 VPS 服务器上快速部署 TrendRadar。

## 📋 前置要求

- VPS 服务器（Linux 系统，推荐 Ubuntu 20.04+）
- 已安装 Docker 和 Docker Compose
- 服务器可以访问互联网

## 🚀 快速部署（3步完成）

### 第1步：安装 Docker（如果尚未安装）

```bash
# 一键安装 Docker
curl -fsSL https://get.docker.com | sh

# 将当前用户添加到 docker 组（避免每次都要 sudo）
sudo usermod -aG docker $USER

# 重新登录或执行以下命令使权限生效
newgrp docker

# 验证安装
docker --version
docker ps
```

### 第2步：克隆项目并配置

```bash
# 克隆项目到服务器
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# 编辑配置文件
nano config/config.yaml
```

**必须配置的内容**：
1. 在 `config/frequency_words.txt` 中添加你关心的关键词（每行一个）
2. 在 `config/config.yaml` 中配置通知方式（至少配置一种）

### 第3步：一键部署

```bash
# 赋予执行权限
chmod +x deploy-vps.sh

# 执行部署脚本
./deploy-vps.sh
```

部署脚本会自动：
- ✅ 检查 Docker 环境
- ✅ 验证配置文件
- ✅ 拉取最新镜像
- ✅ 创建并启动容器
- ✅ 设置自动重启

## 📝 配置说明

### 方式1：使用 config.yaml 配置（推荐）

编辑 `config/config.yaml` 文件：

```yaml
notification:
  enable_notification: true
  webhooks:
    # 飞书机器人
    feishu_url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"

    # Telegram 机器人
    telegram_bot_token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    telegram_chat_id: "123456789"

    # 企业微信机器人
    wework_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx"

    # 钉钉机器人
    dingtalk_url: "https://oapi.dingtalk.com/robot/send?access_token=xxxxx"

    # 邮件通知
    email_from: "your-email@gmail.com"
    email_password: "your-app-password"
    email_to: "recipient@example.com"
    email_smtp_server: "smtp.gmail.com"
    email_smtp_port: "587"

    # ntfy 推送
    ntfy_server_url: "https://ntfy.sh"
    ntfy_topic: "your-unique-topic-name"
    ntfy_token: ""
```

### 方式2：使用环境变量配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
nano .env
```

填入你的配置：

```bash
# 启用通知
ENABLE_NOTIFICATION=true

# 配置 Telegram（示例）
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# 设置定时任务为每小时执行
CRON_SCHEDULE=0 * * * *
```

然后使用 docker-compose 启动：

```bash
cd docker
docker compose up -d
```

## 🎯 定时任务配置

使用环境变量 `CRON_SCHEDULE` 设置执行频率：

| 频率 | Cron 表达式 | 说明 |
|------|-------------|------|
| 每5分钟 | `*/5 * * * *` | 高频监控，适合重要事件追踪 |
| 每15分钟 | `*/15 * * * *` | 平衡监控频率和资源占用 |
| 每30分钟 | `*/30 * * * *` | 默认配置 |
| 每小时 | `0 * * * *` | 低频监控 |
| 每天9点 | `0 9 * * *` | 每日定时推送 |
| 每天9点、18点 | `0 9,18 * * *` | 早晚两次推送 |
| 工作日9点 | `0 9 * * 1-5` | 仅工作日推送 |

修改定时任务后重启容器：

```bash
docker restart trend-radar
```

## 📱 通知渠道配置指南

### Telegram Bot

1. 与 [@BotFather](https://t.me/BotFather) 对话创建机器人
2. 获取 Bot Token
3. 与 [@userinfobot](https://t.me/userinfobot) 对话获取你的 Chat ID
4. 填入配置文件

### 飞书机器人

1. 打开飞书群聊
2. 点击右上角 "..." → 设置 → 群机器人
3. 添加自定义机器人
4. 复制 Webhook URL

### 企业微信机器人

1. 打开企业微信群聊
2. 右键群聊 → 添加群机器人
3. 添加机器人并复制 Webhook URL

### 钉钉机器人

1. 打开钉钉群聊
2. 群设置 → 智能群助手 → 添加机器人
3. 选择自定义机器人
4. 复制 Webhook URL

### 邮件通知

**QQ 邮箱示例**：

```yaml
email_from: "yourname@qq.com"
email_password: "abcdefghijklmnop"  # 授权码，不是登录密码
email_to: "recipient@example.com"
email_smtp_server: "smtp.qq.com"
email_smtp_port: "587"
```

获取授权码：QQ 邮箱 → 设置 → 账户 → POP3/IMAP/SMTP → 开启服务并生成授权码

**Gmail 示例**：

```yaml
email_from: "yourname@gmail.com"
email_password: "your-app-password"  # 应用专用密码
email_to: "recipient@example.com"
email_smtp_server: "smtp.gmail.com"
email_smtp_port: "587"
```

获取应用专用密码：Google 账户 → 安全性 → 两步验证 → 应用专用密码

### ntfy 推送

**使用公共服务**：

```yaml
ntfy_server_url: "https://ntfy.sh"
ntfy_topic: "my-trendradar-2024"  # 自定义主题名称，建议使用随机字符串
```

然后在手机上：
1. 安装 ntfy 应用（iOS/Android）
2. 订阅相同的主题名称

**使用自托管服务**：

```yaml
ntfy_server_url: "https://ntfy.yourdomain.com"
ntfy_topic: "trendradar"
ntfy_token: "your-access-token"  # 如果设置了访问控制
```

## 🛠️ 常用命令

```bash
# 查看容器状态
docker ps | grep trend-radar

# 查看实时日志
docker logs -f trend-radar

# 查看最近100行日志
docker logs --tail 100 trend-radar

# 重启容器
docker restart trend-radar

# 停止容器
docker stop trend-radar

# 启动容器
docker start trend-radar

# 删除容器
docker rm -f trend-radar

# 进入容器
docker exec -it trend-radar bash

# 更新到最新版本
docker pull wantcat/trendradar:latest
docker stop trend-radar
docker rm trend-radar
./deploy-vps.sh
```

## 🔍 故障排查

### 问题1：容器启动失败

```bash
# 查看详细日志
docker logs trend-radar

# 检查配置文件是否存在
ls -la config/

# 检查配置文件格式
cat config/config.yaml
```

### 问题2：没有收到通知

1. 检查 `config.yaml` 中的 `enable_notification` 是否为 `true`
2. 验证 Webhook URL 或 API Token 是否正确
3. 检查 `frequency_words.txt` 是否有内容
4. 查看日志确认是否匹配到关键词：`docker logs trend-radar`

### 问题3：定时任务不执行

```bash
# 查看 cron 日志
docker logs trend-radar | grep "supercronic"

# 验证 cron 表达式是否正确
docker exec trend-radar cat /tmp/crontab

# 手动执行一次
docker exec trend-radar python main.py
```

### 问题4：权限问题

```bash
# 检查 output 目录权限
ls -la output/

# 如果有权限问题，修复：
sudo chown -R $USER:$USER output/
```

## 📊 推送时间窗口配置

如果你希望只在特定时间段接收推送（例如晚上8-10点），可以启用推送时间窗口：

```yaml
notification:
  push_window:
    enabled: true           # 启用时间窗口
    time_range:
      start: "20:00"       # 开始时间（北京时间）
      end: "22:00"         # 结束时间（北京时间）
    once_per_day: true     # 每天只推送一次
    push_record_retention_days: 7  # 推送记录保留7天
```

或使用环境变量：

```bash
PUSH_WINDOW_ENABLED=true
PUSH_WINDOW_START=20:00
PUSH_WINDOW_END=22:00
PUSH_WINDOW_ONCE_PER_DAY=true
```

## 🔒 安全建议

1. **保护 Webhook URL**：不要将 Webhook URL 提交到公开的 Git 仓库
2. **使用环境变量**：敏感信息使用 `.env` 文件或环境变量，不要写在 `config.yaml` 中
3. **定期更新**：定期拉取最新镜像更新容器
4. **备份配置**：定期备份 `config/` 目录

```bash
# 备份配置
tar -czf trendradar-backup-$(date +%Y%m%d).tar.gz config/

# 恢复配置
tar -xzf trendradar-backup-20241117.tar.gz
```

## 📈 性能优化

### 降低资源占用

1. 增加执行间隔：将 `CRON_SCHEDULE` 改为 `0 */2 * * *`（每2小时）
2. 限制监控平台：在 `config.yaml` 中注释掉不需要的平台
3. 使用增量模式：设置 `REPORT_MODE=incremental`

### 提高响应速度

1. 减少执行间隔：`CRON_SCHEDULE=*/5 * * * *`（每5分钟）
2. 启用代理加速：在 `config.yaml` 中配置 `use_proxy`

## 🌐 多服务器部署

如果你有多台服务器，可以：

1. 在不同服务器监控不同平台
2. 设置不同的关键词监控
3. 推送到不同的通知渠道

```bash
# 服务器A：监控科技类新闻
frequency_words.txt: AI, 科技, 程序员...

# 服务器B：监控财经类新闻
frequency_words.txt: 股市, 经济, 投资...
```

## 📚 相关文档

- [项目主页](https://github.com/sansan0/TrendRadar)
- [MCP 客户端配置](README-Cherry-Studio.md)
- [常见问题 FAQ](README-MCP-FAQ.md)
- [Docker Hub](https://hub.docker.com/r/wantcat/trendradar)

## 🆘 获取帮助

遇到问题？

1. 查看 [常见问题](README-MCP-FAQ.md)
2. 在 [GitHub Issues](https://github.com/sansan0/TrendRadar/issues) 提问
3. 提供日志信息：`docker logs trend-radar > logs.txt`

## 💡 最佳实践

1. **初次部署**：先使用默认配置测试，确认能收到通知后再调整
2. **关键词设置**：从少量关键词开始，避免信息过载
3. **定时调整**：根据实际需求调整执行频率
4. **日志查看**：定期查看日志，了解运行状态
5. **版本更新**：关注项目更新，及时升级到最新版本

---

**部署完成后，你将能够：**

- ✅ 自动监控12+个平台的热点新闻
- ✅ 接收与你关心的关键词相关的推送
- ✅ 通过多种渠道获取通知
- ✅ 享受稳定的7x24小时自动化服务

祝你使用愉快！🎉
