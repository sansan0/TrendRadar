# Bark 推送问题排查指南

## 🔍 快速检查清单

### ✅ 步骤 1: 检查 GitHub Secrets 配置

1. 进入你的 GitHub 仓库
2. 点击 **Settings** > **Secrets and variables** > **Actions**
3. 确认已添加以下 Secret：

   **必需配置：**
   - **Name**: `BARK_DEVICE_KEY` （⚠️ 名称必须完全一致，区分大小写）
   - **Value**: `X9Nj52vwrTJz9qEXVgt5h` （你的设备密钥）

   **可选配置（可留空，使用默认值）：**
   - **Name**: `BARK_SERVER_URL`
   - **Value**: 留空（默认使用 `https://api.day.app`）

   - **Name**: `BARK_GROUP`
   - **Value**: 留空（默认使用 `TrendRadar`）

   - **Name**: `BARK_SOUND`
   - **Value**: 留空（默认使用 `bell`）

   - **Name**: `BARK_ICON`
   - **Value**: 留空（不使用图标）

4. **重要提示**：
   - Secret 的 Name（名称）必须**严格一致**，不能有任何拼写错误
   - 保存后看不到 Value 是正常的（安全机制）
   - 如果之前配置过但名称不对，需要删除后重新添加

---

### ✅ 步骤 2: 检查 GitHub Actions 日志

1. 进入你的 GitHub 仓库
2. 点击 **Actions** 标签
3. 点击最新的工作流运行记录
4. 展开 **Run crawler** 步骤，查看日志

**查找以下关键信息：**

#### ✅ 如果配置正确，应该看到：
```
通知渠道配置来源: Bark(环境变量)
Bark消息分为 X 批次发送 [当日汇总]
发送Bark第 1/X 批次，大小：XXX 字节 [当日汇总]
Bark第 1/X 批次发送成功 [当日汇总]
```

#### ❌ 如果配置有问题，可能看到：
```
未配置任何通知渠道
```
或
```
通知渠道配置来源: ...（没有 Bark）
```

#### ⚠️ 其他可能的问题：
- `推送窗口控制：当前时间 XX:XX 不在推送时间窗口内，跳过推送`
  - **解决**：检查 `config/config.yaml` 中的 `push_window.enabled` 设置

- `跳过当日汇总通知：未匹配到有效的新闻内容`
  - **解决**：检查 `config/frequency_words.txt` 是否配置了关键词

- `通知功能已禁用（ENABLE_NOTIFICATION=False）`
  - **解决**：检查 `config/config.yaml` 中 `enable_notification: true`

---

### ✅ 步骤 3: 检查配置文件

检查 `config/config.yaml` 文件：

```yaml
notification:
  enable_notification: true  # 必须是 true
  
  push_window:
    enabled: false  # 如果设为 true，会限制推送时间
    # ... 其他设置
```

---

### ✅ 步骤 4: 检查推送条件

推送需要满足以下条件：

1. ✅ **通知功能已启用**：`enable_notification: true`
2. ✅ **已配置通知渠道**：至少配置了 BARK_DEVICE_KEY
3. ✅ **有匹配的新闻内容**：
   - `config/frequency_words.txt` 中配置了关键词
   - 或者文件为空（会推送所有新闻，但受消息大小限制）
4. ✅ **推送窗口控制**（如果启用）：
   - 当前时间在设定的时间范围内
   - 如果设置了 `once_per_day: true`，当天只能推送一次

---

### ✅ 步骤 5: 手动触发测试

1. 在 GitHub Actions 页面
2. 点击左侧的 **Run workflow** 按钮
3. 选择分支（通常是 `main` 或 `master`）
4. 点击 **Run workflow**
5. 等待运行完成，查看日志

---

### ✅ 步骤 6: 验证 Bark 应用

1. 确认 iOS 设备上的 **Bark 应用已安装并运行**
2. 打开 Bark 应用，确认设备密钥是否正确
3. 使用以下命令测试推送（在本地或服务器上）：

```bash
curl -X POST https://api.day.app/X9Nj52vwrTJz9qEXVgt5h \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试","body":"这是一条测试消息"}'
```

如果收到推送，说明 Bark 配置正常。

---

## 🐛 常见问题

### 问题 1: 没有收到任何推送

**可能原因：**
- GitHub Secrets 未配置或名称错误
- 通知功能被禁用
- 没有匹配的新闻内容

**解决方法：**
1. 检查 GitHub Secrets 配置（步骤 1）
2. 检查 GitHub Actions 日志（步骤 2）
3. 确认 `frequency_words.txt` 有内容或为空

---

### 问题 2: 看到 "未配置任何通知渠道"

**可能原因：**
- GitHub Secrets 中的名称拼写错误
- 环境变量未正确传递到工作流

**解决方法：**
1. 检查 Secret 名称是否完全一致：`BARK_DEVICE_KEY`（区分大小写）
2. 确认 `.github/workflows/crawler.yml` 中已添加环境变量（已确认正确）

---

### 问题 3: 看到 "推送窗口控制：跳过推送"

**可能原因：**
- 启用了推送时间窗口控制
- 当前时间不在设定的时间范围内

**解决方法：**
1. 检查 `config/config.yaml` 中的 `push_window.enabled`
2. 如果不需要时间限制，设置为 `false`
3. 或者调整时间范围

---

### 问题 4: 看到 "跳过通知：未匹配到有效的新闻内容"

**可能原因：**
- `frequency_words.txt` 中配置了关键词，但没有匹配的新闻
- 推送模式设置不当

**解决方法：**
1. 检查 `config/frequency_words.txt` 内容
2. 可以暂时清空文件测试（会推送所有新闻）
3. 检查推送模式设置（daily/current/incremental）

---

## 📝 调试命令

### 本地测试推送

```bash
# 使用测试脚本
python3 test_bark.py

# 或直接使用 curl
curl -X POST https://api.day.app/X9Nj52vwrTJz9qEXVgt5h \
  -H 'Content-Type: application/json' \
  -d '{"title":"📊 测试","body":"测试内容","group":"TrendRadar","sound":"bell"}'
```

### 检查工作流配置

```bash
# 检查工作流文件
cat .github/workflows/crawler.yml | grep BARK
```

---

## 📞 需要帮助？

如果按照以上步骤检查后仍然无法解决问题，请：

1. 提供 GitHub Actions 的完整日志
2. 提供 `config/config.yaml` 的相关配置（隐藏敏感信息）
3. 说明具体的错误信息或现象

---

## ✅ 验证清单

在提交问题前，请确认：

- [ ] GitHub Secrets 中已添加 `BARK_DEVICE_KEY`
- [ ] Secret 名称完全正确（区分大小写）
- [ ] `config/config.yaml` 中 `enable_notification: true`
- [ ] `push_window.enabled: false`（如果不需要时间限制）
- [ ] `frequency_words.txt` 有内容或为空
- [ ] GitHub Actions 日志中能看到 Bark 相关输出
- [ ] Bark 应用在 iOS 设备上正常运行
- [ ] 使用 curl 测试推送能成功

