# 钉钉机器人配置指南

TrendRadar 支持通过钉钉自定义机器人接收热点新闻推送。本指南将详细介绍如何配置钉钉机器人。

---

## 📋 目录

- [创建钉钉机器人](#创建钉钉机器人)
- [配置 TrendRadar](#配置-trendradar)
- [安全设置](#安全设置)
- [消息格式](#消息格式)
- [频率限制](#频率限制)
- [常见问题](#常见问题)

---

## 🤖 创建钉钉机器人

### 步骤1：打开群设置

1. 打开钉钉，进入要接收通知的群聊
2. 点击右上角 `···` 图标
3. 选择 **智能群助手**

### 步骤2：添加机器人

1. 点击 **添加机器人**
2. 选择 **自定义** 类型的机器人
3. 点击 **添加**

### 步骤3：配置机器人信息

1. **机器人名称**：`TrendRadar` 或其他自定义名称
2. **机器人头像**：可选择默认或上传自定义图片
3. **功能描述**：例如 "热点新闻推送助手"

### 步骤4：配置安全设置（重要）

钉钉要求至少选择一种安全设置，推荐使用**自定义关键词**：

#### 方式1：自定义关键词（推荐）

1. 勾选 **自定义关键词**
2. 输入关键词：`TrendRadar` 或 `热点`
3. 说明：消息内容必须包含设置的关键词才能发送成功

**注意**：TrendRadar 的消息中包含 "热点" 关键词，因此推荐使用此关键词。

#### 方式2：加签（高级）

1. 勾选 **加签**
2. 复制生成的**密钥**（SEC开头的字符串）
3. 说明：需要在代码中使用密钥计算签名

**当前版本暂不支持加签，请使用关键词方式。**

#### 方式3：IP地址（不推荐）

1. 勾选 **IP地址（段）**
2. 填写服务器的公网 IP 地址
3. 说明：仅允许指定 IP 发送消息

**注意**：如果使用 Docker 或 VPS，IP 可能会变化，不推荐使用。

### 步骤5：获取 Webhook 地址

1. 完成配置后，会显示 **Webhook 地址**
2. 复制完整的 Webhook URL（包含 access_token）

示例格式：
```
https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

3. 点击 **完成**

---

## ⚙️ 配置 TrendRadar

### 方式1：修改 config.yaml（推荐）

编辑 `config/config.yaml` 文件：

```yaml
notification:
  enable_notification: true  # 启用通知
  webhooks:
    dingtalk_url: "https://oapi.dingtalk.com/robot/send?access_token=你的access_token"
```

### 方式2：使用环境变量

编辑 `.env` 文件或在 Docker 中设置：

```bash
ENABLE_NOTIFICATION=true
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=你的access_token
```

使用 docker-compose：

```yaml
environment:
  - ENABLE_NOTIFICATION=true
  - DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
```

---

## 🔒 安全设置

### 关键词验证

如果你在创建机器人时设置了关键词（如 "TrendRadar"），请确保：

1. **消息内容包含关键词**：TrendRadar 的消息默认包含 "热点" 等关键词
2. **关键词区分大小写**：确保设置的关键词与消息中的关键词大小写一致

### 常见安全设置错误

如果收到 `310000` 错误码，说明安全设置校验失败：

| 错误提示 | 原因 | 解决方法 |
|---------|------|----------|
| keywords not in content | 消息中不包含设置的关键词 | 修改关键词为 "热点" 或 "TrendRadar" |
| sign not match | 签名验证失败 | 检查密钥和签名算法（当前版本不支持） |
| ip not in whitelist | IP 不在白名单中 | 将服务器 IP 添加到白名单或改用关键词验证 |

---

## 📨 消息格式

TrendRadar 发送的钉钉消息采用 **Markdown 格式**，包含以下内容：

### 消息结构

```
**总新闻数：** 15
**时间：** 2024-11-17 15:30:00
**类型：** 热点分析报告

---

📊 **热点词汇统计**

🔥 [1/5] **AI** : **12** 条

  1. [今日头条] OpenAI 发布新版本 GPT-5 🔥[1] - 2小时前
  2. [知乎热榜] AI 如何改变我们的生活 🔥[3] - 3小时前
  ...

---

🆕 **本次新增热点新闻** (共 3 条)

📌 **今日头条**
  1. 🆕 最新科技动态：AI 芯片取得突破 - 1小时前

---

> 更新时间：2024-11-17 15:30:00
```

### 消息特性

- ✅ 支持 **Markdown 格式**（加粗、列表、链接）
- ✅ **自动分批**：单条消息最大 20KB，超过自动分批发送
- ✅ **智能去重**：使用 msgUuid 避免重复推送
- ✅ **链接跳转**：点击新闻标题可直接跳转到原文
- ✅ **排名标识**：🔥 表示热门排名
- ✅ **新增标记**：🆕 标识新增的热点新闻

---

## ⏱️ 频率限制

钉钉对自定义机器人有以下限制：

### 官方限制

- **每分钟最多发送 20 条消息**
- 超限后**限流 10 分钟**

### TrendRadar 的应对策略

1. **自动分批**：大消息自动分成多批发送
2. **间隔控制**：批次间自动间隔 3-4 秒
3. **智能提醒**：批次超过 15 个时发出警告
4. **幂等保障**：使用 msgUuid 避免重试时重复发送

### 建议配置

如果经常触发限流，建议：

1. **降低执行频率**：
   ```yaml
   # 从每 30 分钟改为每小时
   CRON_SCHEDULE: "0 * * * *"
   ```

2. **减少监控关键词**：
   ```bash
   # 编辑 config/frequency_words.txt
   # 只保留最关心的 5-10 个关键词
   ```

3. **使用增量模式**：
   ```yaml
   report:
     mode: "incremental"  # 仅推送新增内容
   ```

4. **启用推送窗口**：
   ```yaml
   notification:
     push_window:
       enabled: true
       time_range:
         start: "20:00"
         end: "22:00"
       once_per_day: true
   ```

---

## ❓ 常见问题

### 1. 机器人不发送消息

**可能原因**：
- ✓ Webhook URL 配置错误
- ✓ 未启用通知功能
- ✓ 关键词不匹配（安全设置）
- ✓ 机器人被停用

**解决方法**：
```bash
# 查看日志
docker logs trend-radar | grep "钉钉"

# 检查配置
cat config/config.yaml | grep dingtalk
```

### 2. 收到 400101 错误：access_token 不存在

**原因**：Webhook URL 中的 access_token 无效或拼写错误

**解决方法**：
1. 重新复制 Webhook URL
2. 确保完整复制（包含 `?access_token=` 部分）
3. 检查是否有多余的空格或换行符

### 3. 收到 410100 错误：发送速度太快而限流

**原因**：1 分钟内发送超过 20 条消息

**解决方法**：
1. 减少监控关键词数量
2. 增加执行间隔（如改为每小时执行）
3. 使用增量模式减少消息数量
4. 等待 10 分钟后限流自动解除

### 4. 收到 310000 错误：安全设置校验失败

**原因**：消息内容不包含设置的关键词

**解决方法**：
1. 将关键词设置为 **"热点"** 或 **"TrendRadar"**
2. 检查关键词大小写是否匹配
3. 如果使用加签，确保签名算法正确（当前版本不支持）

### 5. 消息格式显示不正常

**原因**：钉钉 Markdown 支持有限

**说明**：
- ✅ 支持：加粗 `**text**`、链接 `[text](url)`、列表 `1. item`
- ❌ 不支持：复杂表格、多级列表、特殊字体颜色

### 6. 如何测试钉钉配置是否正确

**方法1：使用 curl 测试**

```bash
curl -X POST 'https://oapi.dingtalk.com/robot/send?access_token=你的token' \
  -H 'Content-Type: application/json' \
  -d '{
    "msgtype": "markdown",
    "markdown": {
      "title": "测试消息",
      "text": "#### TrendRadar 测试\n这是一条测试热点消息"
    }
  }'
```

**期望输出**：
```json
{"errcode":0,"errmsg":"ok"}
```

**方法2：手动执行一次**

```bash
# Docker 环境
docker exec trend-radar python main.py

# 本地环境
python main.py
```

### 7. 如何查看详细的错误信息

```bash
# 查看最近的日志
docker logs --tail 100 trend-radar

# 实时查看日志
docker logs -f trend-radar

# 搜索钉钉相关日志
docker logs trend-radar 2>&1 | grep -A 5 "钉钉"
```

---

## 📚 参考资料

- [钉钉开放平台 - 自定义机器人](https://open.dingtalk.com/document/robots/custom-robot-access)
- [钉钉机器人消息类型](https://open.dingtalk.com/document/robots/custom-robot-access#section-5h1-8qh-4g8)
- [TrendRadar 项目主页](https://github.com/sansan0/TrendRadar)

---

## 💡 最佳实践

### 1. 关键词设置

推荐使用 **"热点"** 作为安全关键词：
- ✅ TrendRadar 消息中必定包含此关键词
- ✅ 简单易记，不易出错
- ✅ 适合中文场景

### 2. 推送时间

建议设置推送时间窗口，避免非工作时间打扰：

```yaml
notification:
  push_window:
    enabled: true
    time_range:
      start: "09:00"  # 早上 9 点开始
      end: "21:00"    # 晚上 9 点结束
    once_per_day: true  # 每天只推送一次
```

### 3. 消息内容优化

如果消息批次过多（超过 15 批），建议：

1. **精简关键词**：只监控最关心的 5-10 个关键词
2. **提高排名阈值**：
   ```yaml
   report:
     rank_threshold: 3  # 只显示前 3 名的新闻
   ```
3. **使用增量模式**：只推送新增内容

### 4. 多群推送

如果需要向多个群推送，可以：

**方法1：创建多个机器人**（推荐）

不同的群使用不同的 Webhook URL，在配置文件中轮流切换。

**方法2：使用脚本批量发送**

暂不支持，需要自行修改代码。

---

## 🎉 配置完成

完成以上配置后，TrendRadar 将自动向你的钉钉群推送热点新闻！

如有问题，请查看 [常见问题](#常见问题) 或提交 [GitHub Issue](https://github.com/sansan0/TrendRadar/issues)。
