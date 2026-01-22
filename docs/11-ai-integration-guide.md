# TrendRadar AI 调用完整指南

## 📋 目录

1. [AI 调用概述](#ai-调用概述)
2. [AI 功能详解](#ai-功能详解)
3. [AI 模型配置](#ai-模型配置)
4. [代码调用分析](#代码调用分析)
5. [GLM 模型接入案例](#glm-模型接入案例)
6. [自托管模型配置](#自托管模型配置)
7. [故障排查](#故障排查)

---

## AI 调用概述

### 核心架构

TrendRadar 使用 **LiteLLM** 统一接口调用多种 AI 模型，实现：

```
┌─────────────────────────────────────────────┐
│         TrendRadar 主程序                   │
│  (__main__.py, context.py, dispatcher.py)   │
└─────────────────────────────────────────────┘
                    │
                    ├─→ AI 分析功能
                    │   └→ AIAnalyzer
                    │       └→ AIClient ──→ LiteLLM ──→ AI 模型
                    │
                    └─→ AI 翻译功能
                        └→ AITranslator
                            └→ AIClient ──→ LiteLLM ──→ AI 模型
```

### AI 功能一览

| 功能 | 模块 | 目的 | 触发条件 |
|------|------|------|---------|
| **AI 分析** | `ai/analyzer.py` | 对热点新闻进行深度情报分析 | `ai_analysis.enabled=true` |
| **AI 翻译** | `ai/translator.py` | 将推送内容翻译为其他语言 | 配置翻译语言 |

---

## AI 功能详解

### 功能 1：AI 分析（ai_analysis）

#### 功能描述
对热点新闻进行深度情报分析，提供：
- 核心热点态势提炼
- 舆论风向争议分析
- 异动与弱信号捕捉
- RSS 深度洞察
- 研判策略建议

#### 配置位置
**文件**: [config/config.yaml:389-420](../config/config.yaml)

**默认配置**:
```yaml
ai_analysis:
  enabled: false                      # 是否启用 AI 分析
  max_news_for_analysis: 50           # 参与分析的新闻数量上限
  include_rss: false                  # 是否包含 RSS 内容
  include_rank_timeline: true        # 是否传递完整排名时间线
```

#### 环境变量配置
```bash
# .env 文件配置
AI_ANALYSIS_ENABLED=true              # 启用 AI 分析
AI_API_KEY=your_api_key              # API 密钥
AI_MODEL=deepseek/deepseek-chat       # 模型名称
AI_API_BASE=                          # 可选：自定义 API 端点
```

#### 提示词文件
**文件**: [config/ai_analysis_prompt.txt](../config/ai_analysis_prompt.txt)

**内容结构**:
```
系统提示词：
- 定义 AI 角色（情报分析专家）
- 规定输出格式（JSON）
- 说明分析框架（5个核心板块）

用户提示词模板：
- 热榜统计数据
- RSS 订阅数据
- 关键词信息
- 平台信息
- 时间范围
```

#### 输出格式（JSON）
```json
{
  "核心热点态势": {
    "共性提炼": "...",
    "定性判断": "..."
  },
  "舆论风向争议": {
    "情绪光谱": "...",
    "认知断层": "..."
  },
  "异动与弱信号": {
    "跨平台共振": ["..."],
    "轨迹突变": ["..."]
  },
  "RSS深度洞察": {
    "专业领域盲区": ["..."]
  },
  "研判策略建议": {
    "决策层": "...",
    "执行层": "...",
    "观察层": "..."
  }
}
```

---

### 功能 2：AI 翻译（ai_translation）

#### 功能描述
将推送内容翻译为指定语言，支持：
- 单条文本翻译
- 批量文本翻译
- 保持新闻专业性和准确性

#### 配置位置
**文件**: [config/config.yaml:428-437](../config/config.yaml)

**默认配置**:
```yaml
ai_translation:
  language: "English"                 # 目标语言
  batch_size: 10                       # 批量翻译大小
```

#### 提示词文件
**文件**: [config/ai_translation_prompt.txt](../config/ai_translation_prompt.txt)

**内容**:
```
角色：专业翻译
要求：准确、专业、流畅
输出：翻译后的文本
```

---

## AI 模型配置

### 配置文件

**主配置文件**: [config/config.yaml:324-381](../config/config.yaml)

```yaml
ai:
  # LiteLLM 模型格式: provider/model_name
  model: "deepseek/deepseek-chat"
                                  # 其他示例:
                                  # - openai/gpt-4o
                                  # - anthropic/claude-3-5-sonnet
                                  # - gemini/gemini-2.5-flash
                                  # - ollama/llama3

  # API 密钥（建议使用环境变量）
  api_key: ""                        # 通过 AI_API_KEY 环境变量设置

  # 自定义 API 端点（可选）
  api_base: ""                       # 自定义 API 端点 URL

  # 超时设置
  timeout: 120                       # 请求超时（秒）

  # 生成参数
  temperature: 1.0                   # 采样温度（0.0-2.0）
  max_tokens: 5000                   # 最大生成 token 数

  # 重试配置
  num_retries: 1                     # 失败重试次数
  fallback_models: []                # 备用模型列表
                                # ["openai/gpt-4o-mini", "..."]
```

### 支持的模型提供商

项目通过 **LiteLLM** 支持 100+ AI 提供商：

| 提供商 | 模型标识 | 特点 |
|--------|---------|------|
| **DeepSeek** | `deepseek/deepseek-chat` | 默认模型，性价比高 |
| **OpenAI** | `openai/gpt-4o` | 最强大的模型 |
| **OpenAI** | `openai/gpt-4o-mini` | 快速便宜 |
| **Anthropic** | `anthropic/claude-3-5-sonnet` | 长文本处理强 |
| **Google** | `gemini/gemini-2.5-flash` | 速度快 |
| **Ollama** | `ollama/llama3` | 本地运行，免费 |
| **智谱 GLM** | `zhipu/glm-4` | 国产模型 |
| **阿里云** | `qwen/qwen-2.5` | 国产模型 |
| **Moonshot** | `moonshot/v1-8k` | Kimi |
| **百川** | `baichuan/Baichuan2` | 国产模型 |

**完整列表**: https://docs.litellm.ai/docs/providers

---

## 代码调用分析

### 1. AI 客户端（ai/client.py）

**文件**: [trendradar/ai/client.py](../trendradar/ai/client.py)

**核心类**:
```python
class AIClient:
    """AI 客户端，基于 LiteLLM"""

    def __init__(self, config):
        self.model = config.get("model") or os.environ.get("AI_MODEL", "")
        self.api_key = config.get("api_key") or os.environ.get("AI_API_KEY", "")
        self.api_base = config.get("api_base") or os.environ.get("AI_API_BASE", "")

    def chat(self, messages: list) -> str:
        """调用 AI 模型进行对话

        Args:
            messages: 消息列表，格式 [{"role": "user", "content": "..."}]

        Returns:
            str: AI 返回的文本内容
        """
        import litellm

        response = litellm.completion(
            model=self.model,
            messages=messages,
            api_key=self.api_key,
            api_base=self.api_base,
            timeout=self.timeout,
            temperature=self.temperature,
            max_tokens=self.max_tokens
        )

        return response["choices"][0]["message"]["content"]
```

---

### 2. AI 分析器（ai/analyzer.py）

**文件**: [trendradar/ai/analyzer.py](../trendradar/ai/analyzer.py)

**核心方法**:
```python
class AIAnalyzer:
    """AI 分析器"""

    def analyze(self, hotlist_stats, rss_stats, report_mode,
                report_type, display_regions):
        """执行 AI 分析

        Args:
            hotlist_stats: 热榜统计数据
            rss_stats: RSS 统计数据
            report_mode: 报告模式
            report_type: 报告类型
            display_regions: 显示的地区信息

        Returns:
            AIAnalysisResult: 分析结果对象
        """
        # 1. 加载提示词模板
        prompt_template = self._load_prompt_template()

        # 2. 准备新闻内容
        news_content = self._prepare_news_content(
            hotlist_stats, rss_stats,
            self.max_news_for_analysis
        )

        # 3. 构建用户消息
        user_message = prompt_template.format(
            language="简体中文",
            report_mode=report_mode,
            report_type=report_type,
            current_time=time.strftime("%Y-%m-%d %H:%M:%S"),
            news_count=len(news_content),
            rss_count=rss_stats.total_items if rss_stats else 0,
            keywords=self._extract_keywords(news_content),
            platforms=self._get_platform_names(news_content),
            news_content=self._format_news_dict(news_content),
            rss_content=self._format_rss_dict(rss_stats)
        )

        # 4. 调用 AI
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        response = self.ai_client.chat(messages)

        # 5. 解析 JSON 响应
        result = self._parse_response(response)

        return result
```

---

### 3. AI 翻译器（ai/translator.py）

**文件**: [trendradar/ai/translator.py](../trendar/ai/translator.py)

**核心方法**:
```python
class AITranslator:
    """AI 翻译器"""

    def translate(self, text: str, target_language: str = None) -> str:
        """翻译单条文本

        Args:
            text: 待翻译文本
            target_language: 目标语言（可选，默认使用配置）

        Returns:
            str: 翻译后的文本
        """
        language = target_language or self.config.get("language", "English")

        # 构建消息
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": f"请将以下内容翻译为{language}：\n\n{text}"}
        ]

        # 调用 AI
        response = self.ai_client.chat(messages)

        return response.strip()

    def translate_batch(self, texts: List[str], target_language: str = None) -> List[str]:
        """批量翻译（提高效率）

        Args:
            texts: 待翻译文本列表
            target_language: 目标语言

        Returns:
            List[str]: 翻译后的文本列表
        """
        # 分批处理（每 batch_size 条）
        results = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]

            # 构建批量请求
            content = "\n---\n".join([f"{idx+1}. {text}" for idx, text in enumerate(batch)])

            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": f"请将以下内容翻译为{language}，每行一个翻译结果：\n\n{content}"}
            ]

            response = self.ai_client.chat(messages)

            # 解析批量结果
            batch_results = self._parse_batch_response(response)
            results.extend(batch_results)

        return results
```

---

### 4. 主程序调用入口

#### AI 分析入口（__main__.py:247）

```python
# AI 分析功能调用
if ai_analysis_enabled:
    from trendradar.ai.analyzer import AIAnalyzer

    analyzer = AIAnalyzer(config, logger)
    ai_analysis_result = analyzer.analyze(
        hotlist_stats=statistics,
        rss_stats=rss_statistics,
        report_mode=report_mode,
        report_type=report_type,
        display_regions=platform_regions
    )
```

#### AI 翻译入口（context.py:451）

```python
# AI 翻译器初始化
if ai_translation_enabled:
    from trendradar.ai.translator import AITranslator

    translator = AITranslator(config, logger)
```

#### 通知分发中的翻译（dispatcher.py）

```python
# 在推送时调用 AI 翻译
if ai_translation_enabled:
    translated = translator.translate(original_text, "English")
```

---

## GLM 模型接入案例

### 案例 1：使用智谱 GLM-4

#### 步骤 1：注册智谱 AI 账号

1. 访问智谱 AI 开放平台：https://open.bigmodel.cn/
2. 注册账号并完成实名认证
3. 创建 API Key

#### 步骤 2：配置环境变量

编辑 `.env` 文件：

```bash
# 启用 AI 分析
AI_ANALYSIS_ENABLED=true

# 智谱 GLM-4 配置
AI_API_KEY=your_zhipu_api_key_here
AI_MODEL=zhipu/glm-4
```

**参数说明**：
- `AI_API_KEY`: 智谱 API Key（从平台获取）
- `AI_MODEL`: 模型标识 `zhipu/glm-4`

#### 步骤 3：验证配置

```bash
# 重启容器
cd /soft/TrendRadar/docker
docker compose restart

# 查看日志
docker compose logs -f trendradar

# 手动测试
docker exec -it trendradar python manage.py run
```

---

### 案例 2：使用阿里云 Qwen

#### 步骤 1：开通阿里云百炼服务

1. 访问阿里云百炼：https://bailian.console.aliyun.com/
2. 开通DashScope服务
3. 创建 API Key

#### 步骤 2：配置环境变量

```bash
# 启用 AI 分析
AI_ANALYSIS_ENABLED=true

# 阿里云 Qwen 配置
AI_API_KEY=your_alibaba_api_key_here
AI_MODEL=qwen/qwen-2.5
```

**可用模型**：
- `qwen/qwen-2.5` - 最新版本
- `qwen/qwen-turbo` - 快速版本
- `qwen/qwen-long` - 长文本版本

---

### 案例 3：使用 Moonshot Kimi

#### 步骤 1：注册 Moonshot

1. 访问 Moonshot：https://www.moonshot.cn/
2. 注册账号
3. 创建 API Key

#### 步骤 2：配置环境变量

```bash
# 启用 AI 分析
AI_ANALYSIS_ENABLED=true

# Moonshot Kimi 配置
AI_API_KEY=your_moonshot_api_key_here
AI_MODEL=moonshot/v1-8k
```

---

### 案例 4：使用自托管 GLM（Ollama）

#### 步骤 1：安装 Ollama

```bash
# Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 下载安装包：https://ollama.com/download
```

#### 步骤 2：拉取 GLM 模型

```bash
# 拉取 GLM-4 模型
ollama pull glm4

# 或拉取 ChatGLM3
ollama pull chatglm3
```

#### 步骤 3：启动 Ollama 服务

```bash
# 启动 Ollama 服务
ollama serve

# 验证服务运行
curl http://localhost:11434/api/tags
```

#### 步骤 4：配置 TrendRadar 使用本地模型

**方法 1：修改 docker-compose.yml**

```yaml
services:
  trendradar:
    image: wantcat/trendradar:latest
    # ... 其他配置

    # 添加 extra_hosts（让容器访问宿主机）
    extra_hosts:
      - "host.docker.internal:host-gateway"

    # 配置环境变量
    environment:
      - AI_MODEL=ollama/glm4
      - AI_API_BASE=http://host.docker.internal:11434
      - AI_API_KEY=ollama  # Ollam 不需要真实密钥
```

**方法 2：使用 host 网络模式**

```yaml
services:
  trendradar:
    image: wantcat/trendradar:latest
    network_mode: host  # 使用宿主机网络
    environment:
      - AI_MODEL=ollama/glm4
      - AI_API_BASE=http://localhost:11434
      - AI_API_KEY=ollama
```

#### 步骤 5：重启容器

```bash
docker compose down
docker compose up -d
```

---

## 自托管模型配置

### 使用 vLLM 部署 OpenAI 兼容 API

#### 步骤 1：安装 vLLM

```bash
# 安装 vLLM（需要 Python 3.8+）
pip install vllm

# 或使用 Docker
docker pull vllm/vllm-openai:latest
```

#### 步骤 2：启动 GLM 模型服务

```bash
# 使用 vLLM 启动 GLM-4
python -m vllm.entrypoints.openai.api_server \
  --model THUDM/glm-4-9b-chat \
  --port 8000 \
  --host 0.0.0.0
```

**参数说明**：
- `--model`: 模型路径（可以是 HuggingFace ID 或本地路径）
- `--port`: 服务端口（默认 8000）
- `--host`: 绑定地址（默认 0.0.0.0）

#### 步骤 3：配置 TrendRadar

```bash
# .env 文件
AI_API_KEY=empty  # vLLM 不需要密钥
AI_MODEL=glm/glm-4-9b-chat  # 使用模型名称
AI_API_BASE=http://your_server_ip:8000/v1  # API 端点
```

---

## 常见模型配置示例

### 示例 1：智谱 GLM-4（API）

```bash
# .env 配置
AI_ANALYSIS_ENABLED=true
AI_API_KEY=your_zhipu_api_key
AI_MODEL=zhipu/glm-4
AI_API_BASE=https://open.bigmodel.cn/api/paas/v4/
```

**测试命令**：
```bash
curl https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer your_zhipu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-4",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

---

### 示例 2：阿里云 Qwen 2.5（API）

```bash
# .env 配置
AI_ANALYSIS_ENABLED=true
AI_API_KEY=your_alibaba_api_key
AI_MODEL=qwen/qwen-2.5
AI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
```

**测试命令**：
```bash
curl https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer your_alibaba_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-2.5",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

---

### 示例 3：本地 GLM-4（Ollam）

```bash
# .env 配置
AI_ANALYSIS_ENABLED=true
AI_API_KEY=ollama
AI_MODEL=ollama/glm4
AI_API_BASE=http://localhost:11434
```

**测试命令**：
```bash
curl http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm4",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": false
  }'
```

---

## 完整配置流程

### 流程图

```
┌──────────────┐
│ 1. 选择模型  │
└──────────────┘
       │
       ├─→ 云端 API（智谱、阿里云等）
       │   1. 注册账号
│   2. 获取 API Key
│   3. 配置环境变量
│   4. 重启容器
│
       └─→ 本地模型（Ollama/vLLM）
           1. 安装 Ollama
           2. 拉取模型
           3. 启动服务
           4. 配置环境变量
           5. 重启容器
```

### 配置检查清单

- [ ] 确定使用的 AI 模型
- [ ] 获取 API Key（云端模型）或安装模型（本地模型）
- [ ] 配置 `.env` 文件
- [ ] 验证 API 端点（可选）
- [ ] 重启容器
- [ ] 查看日志验证
- [ ] 手动执行测试

---

## 故障排查

### 问题 1：AI 分析没有触发

**检查**：
```bash
# 1. 检查环境变量
docker exec -it trendradar python manage.py config

# 2. 查看日志
docker compose logs trendradar | grep -i ai

# 3. 检查配置文件
cat config/config.yaml | grep -A 10 "ai_analysis:"
```

**可能原因**：
- `AI_ANALYSIS_ENABLED=false`
- `AI_API_KEY` 未设置
- AI 模型配置错误

---

### 问题 2：API 调用失败

**检查**：
```bash
# 1. 验证 API Key
echo $AI_API_KEY

# 2. 测试 API 连接
curl -X POST $AI_API_BASE/chat/completions \
  -H "Authorization: Bearer $AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "$AI_MODEL", "messages": [{"role": "user", "content": "test"}]}'

# 3. 查看详细错误日志
docker compose logs trendradar | grep -i "error\|exception"
```

**常见错误**：
- API Key 无效
- API 端点错误
- 模型名称错误
- 网络连接问题
- 配额用尽

---

### 问题 3：响应时间过长

**解决**：

1. **降低 `max_tokens`**
   ```yaml
   ai:
     max_tokens: 2000  # 从 5000 降低
   ```

2. **减少分析新闻数量**
   ```yaml
   ai_analysis:
     max_news_for_analysis: 30  # 从 50 降低
   ```

3. **使用更快的模型**
   ```bash
   AI_MODEL=openai/gpt-4o-mini  # 比完整版快
   ```

---

### 问题 4：输出格式错误

**检查**：
```bash
# 查看 AI 原始响应
docker compose logs trendradar | grep -A 20 "AI 分析结果"

# 验证 JSON 格式
```

**修复**：

1. 确保 AI 模型支持 JSON 输出
2. 在提示词中强调输出 JSON 格式
3. 使用更稳定的模型（如 GPT-4）

---

## 成本优化

### 控制成本的方法

#### 1. 限制输入大小

```yaml
ai_analysis:
  max_news_for_analysis: 30  # 减少分析的新闻数
```

#### 2. 限制输出长度

```yaml
ai:
  max_tokens: 2000  # 减少 max_tokens
```

#### 3. 使用更便宜的模型

```bash
# 高性价比选择
AI_MODEL=deepseek/deepseek-chat  # ¥0.14/M tokens
AI_MODEL=zhipu/glm-4-flash     # ¥0.05/M tokens
AI_MODEL=moonshot/v1-8k        # ¥12/M tokens
```

#### 4. 减少调用频率

```yaml
# 降低定时任务频率
CRON_SCHEDULE=*/60 * * * *  # 从 */30 改为 */60
```

---

## 附录：完整配置示例

### 示例 1：使用智谱 GLM-4

```ini
# .env 文件
AI_ANALYSIS_ENABLED=true
AI_API_KEY=your_zhipu_api_key_here
AI_MODEL=zhipu/glm-4
AI_API_BASE=https://open.bigmodel.cn/api/paas/v4/
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000
```

### 示例 2：使用本地 Ollama

```ini
# .env 文件
AI_ANALYSIS_ENABLED=true
AI_API_KEY=ollama
AI_MODEL=ollama/glm4
AI_API_BASE=http://host.docker.internal:11434
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000
```

### 示例 3：使用阿里云 Qwen

```ini
# .env 文件
AI_ANALYSIS_ENABLED=true
AI_API_KEY=your_alibaba_api_key_here
AI_MODEL=qwen/qwen-2.5
AI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000
```

---

## 总结

### 关键要点

1. **统一接口**：通过 LiteLLM 支持 100+ 模型
2. **灵活配置**：支持云端 API 和本地模型
3. **成本控制**：通过参数调整优化成本
4. **易于切换**：更换模型只需修改环境变量

### 推荐配置

| 场景 | 推荐模型 | 性价比 |
|------|---------|--------|
| **生产环境** | `deepseek/deepseek-chat` | ⭐⭐⭐⭐⭐ |
| **快速测试** | `openai/gpt-4o-mini` | ⭐⭐⭐⭐ |
| **本地部署** | `ollama/glm4` | ⭐⭐⭐⭐⭐ |
| **国内使用** | `zhipu/glm-4-flash` | ⭐⭐⭐⭐⭐ |

---

**配置愉快！🚀**

如有问题，请查看：
- [LiteLLM 文档](https://docs.litellm.ai/)
- [智谱 AI 平台](https://open.bigmodel.cn/)
- [项目主 README](../README.md)
