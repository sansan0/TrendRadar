# TrendRadar VPS 快速入门（5分钟部署）

> 🚀 最快的热点新闻监控工具，3条命令即可部署到你的 VPS

## ⚡ 快速开始

### 第1步：准备服务器

确保你的 VPS 已安装 Docker：

```bash
# 检查 Docker 是否已安装
docker --version

# 如果未安装，执行一键安装
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 第2步：克隆并配置

```bash
# 克隆项目
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar

# 添加你关心的关键词（每行一个）
nano config/frequency_words.txt
```

在 `frequency_words.txt` 中添加关键词，例如：
```
AI
科技
程序员
创业
投资
```

### 第3步：配置通知（至少选一种）

编辑配置文件：

```bash
nano config/config.yaml
```

#### 选项A：Telegram（最简单）

1. 与 [@BotFather](https://t.me/BotFather) 创建机器人，获取 Token
2. 与 [@userinfobot](https://t.me/userinfobot) 获取你的 Chat ID
3. 填入配置：

```yaml
notification:
  enable_notification: true
  webhooks:
    telegram_bot_token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    telegram_chat_id: "123456789"
```

#### 选项B：企业微信/飞书

在群聊中创建机器人，获取 Webhook URL，填入配置：

```yaml
notification:
  enable_notification: true
  webhooks:
    wework_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx"
    # 或
    feishu_url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
```

#### 选项C：钉钉（需要设置关键词）

**步骤**：
1. 钉钉群 → 右上角 `···` → 智能群助手 → 添加机器人 → 自定义
2. 机器人名称：TrendRadar
3. **安全设置**：勾选"自定义关键词"，输入 `热点` ⚠️ 必须设置
4. 复制 Webhook URL
5. 填入配置：

```yaml
notification:
  enable_notification: true
  webhooks:
    dingtalk_url: "https://oapi.dingtalk.com/robot/send?access_token=你的token"
```

> 💡 详细配置说明：[钉钉配置完整指南](DINGTALK_GUIDE.md)

#### 选项D：邮件通知

```yaml
notification:
  enable_notification: true
  webhooks:
    email_from: "your-email@gmail.com"
    email_password: "your-app-password"  # 授权码
    email_to: "recipient@example.com"
    email_smtp_server: "smtp.gmail.com"
    email_smtp_port: "587"
```

### 第4步：一键部署

```bash
# 赋予执行权限
chmod +x deploy-vps.sh

# 执行部署
./deploy-vps.sh
```

## ✅ 验证部署

```bash
# 查看容器状态
docker ps | grep trend-radar

# 查看日志（应该看到爬取和推送信息）
docker logs -f trend-radar
```

如果看到类似输出，说明部署成功：
```
📅 生成的crontab内容:
*/30 * * * * cd /app && /usr/local/bin/python main.py
▶️ 立即执行一次
⏰ 启动supercronic: */30 * * * *
```

## 🎯 常见场景配置

### 场景1：高频监控（每5分钟）

```bash
# 使用环境变量
echo "CRON_SCHEDULE=*/5 * * * *" > .env
docker restart trend-radar
```

### 场景2：每天晚上8点推送一次

启用推送时间窗口：

```yaml
notification:
  push_window:
    enabled: true
    time_range:
      start: "20:00"
      end: "22:00"
    once_per_day: true
```

### 场景3：只推送新增内容（避免重复）

```yaml
report:
  mode: "incremental"  # 改为增量模式
```

## 🛠️ 日常管理

```bash
# 查看实时日志
docker logs -f trend-radar

# 重启服务
docker restart trend-radar

# 停止服务
docker stop trend-radar

# 启动服务
docker start trend-radar

# 更新到最新版本
docker pull wantcat/trendradar:latest && docker restart trend-radar
```

## 📱 手机端查看

### Telegram
- 直接在 Telegram 接收消息通知

### ntfy（推荐）
1. 在 `config.yaml` 中配置：
```yaml
ntfy_server_url: "https://ntfy.sh"
ntfy_topic: "my-trendradar-abc123"  # 自定义唯一主题
```

2. 手机安装 ntfy 应用（iOS/Android）
3. 订阅相同的主题名称 `my-trendradar-abc123`

## ❓ 常见问题

**Q: 没有收到通知？**
- 检查 `enable_notification: true`
- 验证 Webhook/Token 是否正确
- 确认 `frequency_words.txt` 有内容
- 查看日志：`docker logs trend-radar`

**Q: 如何修改执行频率？**
```bash
# 编辑 .env 文件
echo "CRON_SCHEDULE=0 * * * *" > .env  # 每小时
docker restart trend-radar
```

**Q: 如何添加/修改关键词？**
```bash
nano config/frequency_words.txt
# 修改后无需重启，下次执行时会自动加载
```

**Q: 如何查看抓取的数据？**
```bash
# 查看输出目录
ls -la output/

# 打开 HTML 文件查看
cd output
python3 -m http.server 8080
# 然后在浏览器访问: http://你的服务器IP:8080
```

## 🔧 高级配置

详细配置说明请查看：
- [完整部署指南](DEPLOY_VPS.md)
- [环境变量配置](.env.example)
- [项目主文档](readme.md)

## 📊 效果示例

部署成功后，你将收到如下格式的推送：

```
📰 TrendRadar 热点监控 (2024-11-17)
━━━━━━━━━━━━━━━━━━━

📌 今日头条
🔥 [1] AI 大模型最新突破
🔥 [3] 科技公司裁员潮

📌 知乎热榜
🔥 [2] 程序员如何提升技术
🔥 [5] 创业者应该注意什么

━━━━━━━━━━━━━━━━━━━
⚙️ 本次共监控 12 个平台
⏰ 下次推送: 30分钟后
```

## 🎉 完成！

现在你已经成功部署了 TrendRadar，它将：
- ✅ 每30分钟自动抓取热点新闻
- ✅ 筛选出与你关键词匹配的内容
- ✅ 推送到你配置的通知渠道
- ✅ 7x24小时自动运行

享受你的智能热点助手吧！

---

**需要帮助？**
- 📖 [详细文档](DEPLOY_VPS.md)
- 🐛 [提交问题](https://github.com/sansan0/TrendRadar/issues)
- ⭐ [给项目点赞](https://github.com/sansan0/TrendRadar)
