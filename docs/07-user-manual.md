# TrendRadar 用户手册

## 快速开始

### 5分钟快速部署

#### 方式一：GitHub Actions（推荐，零服务器成本）

1. **Fork 项目**
   - 访问 [https://github.com/sansan0/TrendRadar](https://github.com/sansan0/TrendRadar)
   - 点击右上角 Fork 按钮

2. **配置 Secrets**
   - 进入 Fork 后的仓库
   - `Settings → Secrets and variables → Actions`
   - 添加 `AI_API_KEY`（DeepSeek API Key：[https://platform.deepseek.com/](https://platform.deepseek.com/)）
   - 添加通知渠道密钥（至少一个）

3. **配置关键词**
   - 编辑 `config/frequency_words.txt`
   - 添加你想关注的关键词

4. **启动运行**
   - 进入 `Actions` 标签页
   - 启用 workflows
   - 等待首次运行（每小时自动执行）

#### 方式二：Docker（适合个人服务器）

```bash
docker run -d \
  --name trendradar \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/output:/app/output \
  -e AI_API_KEY="your-api-key" \
  -e FEISHU_WEBHOOK_URL="your-webhook" \
  wantcat/trendradar:latest
```

## 核心功能使用

### 配置关键词

编辑 [`config/frequency_words.txt`](config/frequency_words.txt):

```text
# AI技术
ChatGPT|GPT-4|Claude
大模型|LLM
人工智能|机器学习

# 金融财经
股票|基金
A股|港股|美股

# 科技动态
华为|小米|苹果
芯片|半导体
```

**规则说明**:
- `#` 开头是分组名
- 同行用 `|` 分隔的关键词是 OR 关系
- `!` 开头是全局过滤词

### 选择报告模式

编辑 [`config/config.yaml`](config/config.yaml):

```yaml
report:
  mode: "current"  # 三选一
```

**三种模式**:

| 模式 | 推送时机 | 显示内容 | 适用场景 |
|------|----------|----------|----------|
| `daily` | 按时推送 | 当日所有匹配新闻 | 日报总结 |
| `current` | 按时推送 | 当前在榜匹配新闻 | 实时追踪 |
| `incremental` | 有新增才推送 | 新出现的匹配新闻 | 避免干扰 |

**示例**:
```yaml
# 每天汇总一次
mode: "daily"

# 只看当前最火的
mode: "current"

# 有新内容才提醒我
mode: "incremental"
```

### 配置通知渠道

#### 飞书

1. 创建飞书机器人，获取 webhook URL
2. 配置到 Secrets 或环境变量

```yaml
notification:
  channels:
    feishu:
      webhook_url: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
```

#### 钉钉

```yaml
notification:
  channels:
    dingtalk:
      webhook_url: "https://oapi.dingtalk.com/robot/send?access_token=xxx"
```

#### 企业微信

```yaml
notification:
  channels:
    wework:
      webhook_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
      msg_type: "markdown"  # 群机器人用 markdown，个人应用用 text
```

#### Telegram

1. 与 @BotFather 对话创建 Bot，获取 Token
2. 与机器人对话后，访问 `https://api.telegram.org/bot<token>/getUpdates` 获取 Chat ID

```yaml
notification:
  channels:
    telegram:
      bot_token: "123456:ABC-DEF1234"
      chat_id: "123456789"
```

#### 邮件

```yaml
notification:
  channels:
    email:
      from: "sender@example.com"
      password: "password-or-app-key"  # 建议使用应用专用密码
      to: "user1@example.com,user2@example.com"  # 多个收件人逗号分隔
```

### 控制推送内容

#### 调整区域顺序

编辑推送消息的显示顺序：

```yaml
display:
  region_order:
    - ai_analysis      # AI分析在最前
    - hotlist          # 热榜区域
    - new_items        # 新增热点
    - rss              # RSS订阅
```

#### 启用/禁用区域

```yaml
display:
  regions:
    hotlist: true          # 显示热榜区域
    new_items: true        # 显示新增区域
    rss: true              # 显示RSS区域
    standalone: false      # 关闭独立展示区
    ai_analysis: true      # 显示AI分析
```

#### 独立展示区

完整查看某个平台的热榜，不受关键词过滤：

```yaml
display:
  regions:
    standalone: true

  standalone:
    platforms: ["zhihu", "weibo"]  # 完整显示知乎和微博热榜
    rss_feeds: ["hacker-news"]     # 完整显示Hacker News
    max_items: 20                   # 每个源最多显示20条
```

### AI分析配置

#### 启用AI分析

```yaml
ai_analysis:
  enabled: true
  max_news_for_analysis: 50  # 控制成本的关键参数
```

**成本估算**（使用 DeepSeek）:
- GitHub Actions: ~0.1 元/天（20次推送）
- Docker: ~0.2 元/天（48次推送）

#### 降低成本

```yaml
ai_analysis:
  max_news_for_analysis: 30  # 减少分析数量
  include_rank_timeline: false  # 使用简化格式
```

### RSS订阅配置

#### 添加RSS源

```yaml
rss:
  feeds:
    - id: "36kr"
      name: "36氪"
      url: "https://36kr.com/feed"

    - id: "techcrunch"
      name: "TechCrunch"
      url: "https://techcrunch.com/feed/"
```

#### 新鲜度控制

避免旧文章重复推送：

```yaml
rss:
  freshness_filter:
    enabled: true
    max_age_days: 3  # 只推送3天内的文章

  feeds:
    - id: "slow-blog"
      name: "更新较慢的博客"
      url: "https://example.com/feed"
      max_age_days: 7  # 单独设置：7天内
```

## 使用场景

### 场景一：技术资讯追踪

**需求**: 追踪 AI、云计算等技术的最新动态

**配置**:

```text
# config/frequency_words.txt

# AI技术
ChatGPT|GPT-4|Claude|文心一言
大模型|LLM|AIGC
人工智能|机器学习|深度学习
Prompt|提示词

# 云计算
AWS|Azure|GCP
阿里云|腾讯云|华为云
Kubernetes|Docker|容器

# 开发工具
GitHub|GitLab
VS Code|JetBrains
```

```yaml
# config/config.yaml
report:
  mode: "current"  # 实时追踪

platforms:
  sources:
    - id: "zhihu"      # 知乎技术讨论
    - id: "bilibili"   # B站技术视频

rss:
  feeds:
    - id: "hacker-news"
      url: "https://hnrss.org/frontpage"
    - id: "ruanyifeng"
      url: "http://www.ruanyifeng.com/blog/atom.xml"
```

### 场景二：金融投资监控

**需求**: 监控股市动态和财经新闻

**配置**:

```text
# config/frequency_words.txt

# 股票市场
A股|港股|美股
上证指数|深证成指|创业板
科创板|北交所

# 金融产品
股票|基金|债券|ETF
期货|期权|衍生品

# 财经术语
牛市|熊市|涨停|跌停
IPO|上市|财报|分红
降息|加息|央行
```

```yaml
# config/config.yaml
report:
  mode: "incremental"  # 只推送新增的

platforms:
  sources:
    - id: "wallstreetcn-hot"  # 华尔街见闻
    - id: "cls-hot"           # 财联社
```

### 场景三：行业竞品追踪

**需求**: 追踪竞争对手动态

**配置**:

```text
# config/frequency_words.txt

# 竞品公司
华为|小米|OPPO|vivo
苹果|三星|Google

# 产品关键词
手机|平板|笔记本
芯片|处理器|摄像头
发布|上市|发售
```

```yaml
# config/config.yaml
report:
  mode: "daily"  # 每天汇总

display:
  region_order:
    - hotlist
    - ai_analysis  # AI总结竞品动态
```

### 场景四：多账号推送

**需求**: 推送到多个群/人

**配置**:

```yaml
notification:
  channels:
    # 推送到3个飞书群
    feishu:
      webhook_url: "url1;url2;url3"

    # 推送到2个Telegram账号
    telegram:
      bot_token: "token1;token2"
      chat_id: "id1;id2"

    # 推送到多个邮箱
    email:
      from: "sender@example.com"
      password: "password"
      to: "user1@example.com,user2@example.com,user3@example.com"
```

### 场景五：MCP + AI助手

**需求**: 使用 Claude/Cursor 等 AI 客户端查询新闻

**步骤**:

1. **配置 MCP 服务器**

```bash
# 本地运行
python -m mcp_server.server
```

2. **配置 Claude Desktop**

编辑 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trendradar": {
      "command": "python",
      "args": ["-m", "mcp_server.server"]
    }
  }
}
```

3. **使用 AI 助手查询**

在 Claude 中询问：
- "今天有什么关于 AI 的新闻？"
- "分析最近一周科技热点趋势"
- "对比知乎和微博的热点差异"

## 高级技巧

### 推送时间窗口

只在特定时间接收推送：

```yaml
notification:
  push_window:
    enabled: true
    start: "09:00"     # 早上9点开始
    end: "18:00"       # 下午6点结束
    once_per_day: true # 每天只推一次
```

**适用场景**:
- 只在工作时间接收
- 晚上固定时间汇总推送

### 多账号限制

每个渠道最多支持3个账号，如需更多：

```yaml
advanced:
  max_accounts_per_channel: 5  # 修改为5个
```

### 自定义AI提示词

编辑 [`config/ai_analysis_prompt.txt`](config/ai_analysis_prompt.txt):

```
你是一个科技领域的分析师。请分析以下热点新闻：

{news_data}

提供以下内容：
1. 技术趋势总结
2. 值得关注的产品/公司
3. 对开发者的影响

使用中文输出，格式清晰。
```

### 数据保留策略

自动清理旧数据：

```yaml
storage:
  local:
    retention_days: 7  # 只保留7天数据
```

或通过环境变量：
```bash
export STORAGE_RETENTION_DAYS=7
```

## 常见问题

### Q1: 如何获取 API Key？

**DeepSeek**（推荐，性价比高）:
1. 访问 [https://platform.deepseek.com/](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key

**OpenAI**:
1. 访问 [https://platform.openai.com/](https://platform.openai.com/)
2. API Keys → Create new secret key

**其他模型**:
参考 LiteLLM 文档: [https://docs.litellm.ai/docs/providers](https://docs.litellm.ai/docs/providers)

### Q2: 为什么没有收到推送？

**检查清单**:

1. ✅ 确认通知渠道已配置
2. ✅ 验证 webhook URL 是否正确
3. ✅ 检查是否有匹配关键词的新闻
4. ✅ 查看日志确认是否有错误

**排查步骤**:
```bash
# 查看最新日志
docker logs trendradar --tail 50

# 或 GitHub Actions → 选择最近运行 → 查看日志
```

### Q3: 如何降低 AI 成本？

1. **减少分析数量**
   ```yaml
   ai_analysis:
     max_news_for_analysis: 20  # 默认50
   ```

2. **使用简化格式**
   ```yaml
   ai_analysis:
     include_rank_timeline: false  # 默认true
   ```

3. **切换到更便宜的模型**
   ```yaml
   ai:
     model: "deepseek/deepseek-chat"  # 性价比高
   ```

4. **调整推送频率**
   - GitHub Actions: 修改 cron 为每2小时
   - Docker: 修改 crontab

### Q4: 关键词不生效？

**可能原因**:

1. **关键词配置错误**
   ```text
   # ❌ 错误：中文逗号
   ChatGPT，GPT-4

   # ✅ 正确：英文逗号或竖线
   ChatGPT|GPT-4
   ```

2. **没有匹配的新闻**
   - 检查关键词是否过于生僻
   - 尝试放宽关键词范围

3. **报告模式问题**
   ```yaml
   # incremental 模式：只有新增才推送
   # 改为 current 或 daily 试试
   report:
     mode: "current"
   ```

### Q5: 如何查看历史数据？

**方式一：HTML报告**

```bash
# 本地运行会自动打开浏览器
python -m trendradar

# 手动查看
ls output/html/latest/
```

**方式二：MCP服务器**

在 AI 助手中询问：
- "查询昨天（2025-01-20）的热点新闻"
- "显示最近7天的数据"

**方式三：直接查询数据库**

```bash
sqlite3 output/news/2025-01-21.db "SELECT * FROM news LIMIT 10;"
```

### Q6: Docker 容器自动停止？

**可能原因**:

1. **配置文件错误**
   ```bash
   # 检查配置
   docker logs trendradad

   # 验证YAML语法
   docker run --rm -v $(pwd)/config:/app/config wantcat/trendradad:latest python -c "import yaml; yaml.safe_load(open('/app/config/config.yaml'))"
   ```

2. **内存不足**
   ```bash
   # 检查资源使用
   docker stats trendradar

   # 限制内存
   docker update --memory="512m" trendradar
   ```

3. **自动重启**
   ```yaml
   # docker-compose.yml
   services:
     trendradar:
       restart: unless-stopped  # 自动重启
   ```

### Q7: GitHub Actions 执行失败？

**常见错误**:

1. **Secrets 未配置**
   - 检查所有必需的 Secrets 是否已添加
   - 确认名称拼写正确（大写）

2. **配置文件语法错误**
   ```bash
   # 本地验证
   python -c "import yaml; yaml.safe_load(open('config/config.yaml'))"
   ```

3. **依赖安装失败**
   - 检查 `requirements.txt` 是否完整
   - 尝试重新 Fork 仓库

## 最佳实践

### 1. 关键词配置

- ✅ 使用同义词（`ChatGPT|GPT-4|OpenAI`）
- ✅ 分组不宜过多（建议 <10 组）
- ✅ 定期清理无效关键词
- ❌ 避免过于宽泛的词（如"新闻"、"科技"）

### 2. 报告模式选择

- **实时追踪**: 使用 `current`
- **每日总结**: 使用 `daily`
- **避免打扰**: 使用 `incremental`

### 3. 成本控制

- 从小数据量开始（`max_news_for_analysis: 20`）
- 使用高性价比模型（DeepSeek）
- 合理设置推送频率

### 4. 数据安全

- 使用环境变量存储敏感信息
- GitHub Actions 使用 Secrets
- 定期备份配置文件

### 5. 性能优化

- 关闭不需要的平台
- 使用云存储减少 GitHub 仓库大小
- 定期清理旧数据

## 相关资源

- [项目概述](01-overview.md)
- [配置指南](03-configuration.md)
- [部署运维](06-deployment.md)
- [官方文档](https://github.com/sansan0/TrendRadar)
- [常见问题FAQ](https://github.com/sansan0/TrendRadar/issues)

## 获取帮助

如果遇到问题：

1. **查看文档**: 先检查相关文档是否有答案
2. **搜索 Issue**: [GitHub Issues](https://github.com/sansan0/TrendRadar/issues)
3. **提问**: 创建新 Issue，提供：
   - 配置文件（隐藏敏感信息）
   - 错误日志
   - 复现步骤
4. **社区**: 在 Discussions 中交流使用经验
