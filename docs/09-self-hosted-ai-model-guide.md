# TrendRadar 自建模型配置详细指南

> 本文档详细介绍如何为 TrendRadar 配置自建的 AI 模型服务，包括兼容 OpenAI 协议的各种模型部署方案。

## 目录

1. [配置文件位置](#1-配置文件位置)
2. [自建模型部署方案](#2-自建模型部署方案)
3. [配置步骤](#3-配置步骤)
4. [验证配置](#4-验证配置)
5. [常见问题](#5-常见问题)

---

## 1. 配置文件位置

### 1.1 主配置文件

**文件路径**: [`config/config.yaml`](../config/config.yaml)

AI 配置段位置：第 324-381 行

```yaml
# ===============================================================
# 8. AI 模型配置（共享）
#
# ai_analysis 和 ai_translation 共用此模型配置
# 基于 LiteLLM 统一接口，支持 100+ AI 提供商
# ===============================================================
ai:
  # LiteLLM 模型格式: provider/model_name
  model: "deepseek/deepseek-chat"

  api_key: ""                       # API Key（建议使用环境变量 AI_API_KEY）

  api_base: ""                      # 自定义 API 端点（可选）
                                    # 示例: https://api.example.com/v1

  timeout: 120                      # 请求超时（秒）

  # AI 参数配置
  temperature: 1.0                  # 采样温度 (0.0-2.0)
  max_tokens: 5000                  # 最大生成 token 数

  # 高级选项
  num_retries: 1                    # 失败重试次数
  fallback_models: []               # 备用模型列表
```

### 1.2 环境变量配置

**Docker 部署**: [`docker/.env`](../docker/.env) 第 60-72 行

```env
# AI 配置（ai_analysis 和 ai_translation 共享模型配置）
AI_ANALYSIS_ENABLED=true           # 是否启用 AI 分析
AI_API_KEY=                        # API Key
AI_MODEL=deepseek/deepseek-chat    # 模型名称
AI_API_BASE=                       # 自定义 API 端点（可选）
```

**本地部署**: 通过系统环境变量

```bash
export AI_API_KEY="your-api-key"
export AI_MODEL="your-model-name"
export AI_API_BASE="https://your-endpoint/v1"
```

### 1.3 AI 客户端实现

**文件路径**: [`trendradar/ai/client.py`](../trendradar/ai/client.py) 第 15-115 行

**关键配置加载代码**（第 18-40 行）:

```python
def __init__(self, config: Dict[str, Any]):
    self.model = config.get("MODEL", "deepseek/deepseek-chat")
    self.api_key = config.get("API_KEY") or os.environ.get("AI_API_KEY", "")
    self.api_base = config.get("API_BASE", "")
    self.temperature = config.get("TEMPERATURE", 1.0)
    self.max_tokens = config.get("MAX_TOKENS", 5000)
    self.timeout = config.get("TIMEOUT", 120)
    self.num_retries = config.get("NUM_RETRIES", 2)
    self.fallback_models = config.get("FALLBACK_MODELS", [])
```

### 1.4 配置优先级

**文件路径**: [`trendradar/core/loader.py`](../trendradar/core/loader.py) 第 219-240 行

```python
# 配置优先级（从高到低）：
# 1. 环境变量
# 2. config.yaml
# 3. 代码默认值

return {
    "MODEL": _get_env_str("AI_MODEL") or ai_config.get("model", "deepseek/deepseek-chat"),
    "API_KEY": _get_env_str("AI_API_KEY") or ai_config.get("api_key", ""),
    "API_BASE": _get_env_str("AI_API_BASE") or ai_config.get("api_base", ""),
    # ...
}
```

---

## 2. 自建模型部署方案

### 2.1 支持的部署方式

TrendRadar 基于 [LiteLLM](https://docs.litellm.ai/)，支持以下自建模型方案：

#### 方案一：Ollama（本地部署，推荐）

**优势**:
- 完全本地运行，无需 API Key
- 支持多种开源模型
- 部署简单，一键启动

**支持的模型**:
- Llama 3 系列
- Mistral
- Qwen (通义千问)
- DeepSeek-Coder
- 其他 [Ollama 支持的模型](https://ollama.com/library)

#### 方案二：vLLM（高性能本地部署）

**优势**:
- 高性能推理
- 支持大模型量化
- 适合 GPU 服务器

**支持的模型**:
- Llama 系列
- Qwen 系列
- Yi 系列
- 其他 HuggingFace 模型

#### 方案三：LM Studio（桌面应用）

**优势**:
- 图形界面，操作简单
- 支持下载和管理模型
- 提供 OpenAI 兼容 API

#### 方案四：LocalAI（兼容 OpenAI API）

**优势**:
- 完全兼容 OpenAI API
- 支持多种模型后端
- 提供 Docker 部署

#### 方案五：自建 API 服务

基于以下框架自建：
- [text-generation-webui](https://github.com/oobabooga/text-generation-webui)
- [FastChat](https://github.com/lm-sys/FastChat)
- [xAI](https://github.com/xorbitsai/infinity)

---

## 3. 配置步骤

### 3.1 使用 Ollama（推荐新手）

#### 步骤 1：安装 Ollama

**macOS / Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**:
1. 下载安装程序: https://ollama.com/download
2. 运行安装程序
3. 启动 Ollama

#### 步骤 2：下载模型

```bash
# 下载 Llama 3.1 (8B 参数，推荐)
ollama pull llama3.1

# 下载 Qwen2.5 (中文效果好)
ollama pull qwen2.5

# 下载 Mistral
ollama pull mistral

# 下载 DeepSeek-Coder (编程能力强)
ollama pull deepseek-coder
```

#### 步骤 3：启动 Ollama 服务

Ollama 安装后会自动启动服务，默认端口：`11434`

验证服务：
```bash
curl http://localhost:11434/api/tags
```

**预期输出**:
```json
{
  "models": [
    {
      "name": "llama3.1:latest",
      "modified_at": "2025-01-21T10:00:00Z"
    }
  ]
}
```

#### 步骤 4：配置 TrendRadar

**方式一：修改 config.yaml**

编辑 [`config/config.yaml`](../config/config.yaml):

```yaml
ai:
  model: "ollama/llama3.1"           # 格式：ollama/模型名
  api_base: "http://localhost:11434"  # Ollama 服务地址
  api_key: "ollama"                  # Ollama 不需要真实 Key，但不能为空

  temperature: 0.7
  max_tokens: 2000                    # 本地模型建议限制 token 数
  timeout: 300                        # 本地推理较慢，增加超时时间
```

**方式二：使用环境变量**

编辑 [`docker/.env`](../docker/.env):

```env
AI_ANALYSIS_ENABLED=true
AI_API_KEY=ollama
AI_MODEL=ollama/llama3.1
AI_API_BASE=http://host.docker.internal:11434
```

**重要**: Docker 容器访问宿主机服务时：
- macOS/Windows: 使用 `http://host.docker.internal:11434`
- Linux: 使用 `http://172.17.0.1:11434`（Docker 桥接网络 IP）

#### 步骤 5：重启容器

```bash
# Docker 部署
docker compose restart

# 查看日志验证
docker logs -f trendradad
```

#### 步骤 6：验证配置

```bash
# 手动执行一次测试
docker exec -it trendradar python manage.py run
```

### 3.2 使用 vLLM（高性能）

#### 步骤 1：安装 vLLM

```bash
# 需要 Python 3.10+
pip install vllm
```

或使用 Docker：
```bash
docker pull vllm/vllm-openai:latest
```

#### 步骤 2：启动 vLLM 服务

**本地安装**:
```bash
# 启动 Llama 3.1 8B 模型
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000
```

**Docker 部署**:
```bash
docker run --rm \
  --gpus all \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-3.1-8B-Instruct
```

#### 步骤 3：配置 TrendRadar

编辑 [`config/config.yaml`](../config/config.yaml):

```yaml
ai:
  model: "openai/llama-3.1-8b"      # vLLM 兼容 OpenAI 格式
  api_base: "http://localhost:8000/v1"
  api_key: "vllm"

  temperature: 0.7
  max_tokens: 2000
  timeout: 300
```

### 3.3 使用 LM Studio

#### 步骤 1：下载和安装 LM Studio

1. 访问 https://lmstudio.ai/
2. 下载对应操作系统的安装包
3. 安装并启动 LM Studio

#### 步骤 2：下载模型

在 LM Studio 中：
1. 搜索模型（如 Llama 3, Qwen2.5）
2. 下载模型文件

#### 步骤 3：启动 API 服务器

在 LM Studio 中：
1. 选择已下载的模型
2. 点击 "Start Server"
3. 记下端口号（默认 `1234`）

#### 步骤 4：配置 TrendRadar

编辑 [`config/config.yaml`](../config/config.yaml):

```yaml
ai:
  model: "openai/your-model-name"
  api_base: "http://localhost:1234/v1"
  api_key: "lm-studio"

  temperature: 0.7
  max_tokens: 2000
  timeout: 300
```

### 3.4 使用自建 OpenAI 兼容 API

如果你的自建服务提供 OpenAI 兼容的 API（如 text-generation-webui, FastChat 等）：

#### 配置方法

编辑 [`config/config.yaml`](../config/config.yaml):

```yaml
ai:
  # 关键：使用 "openai/" 前缀 + 实际模型名称
  model: "openai/my-custom-model"

  # 你的 API 服务地址
  api_base: "https://your-domain.com/v1"

  # 你的 API Key
  api_key: "your-api-key-here"

  temperature: 0.7
  max_tokens: 2000
  timeout: 300
```

**原理说明**:
- `openai/` 前缀告诉 LiteLLM 使用 OpenAI 协议
- `api_base` 指定你的服务地址
- LiteLLM 会自动将请求转换为标准 OpenAI 格式

### 3.5 Docker 部署的特别注意事项

#### 访问宿主机服务

**问题**: Docker 容器内无法直接访问 `localhost:11434`

**解决方案**:

1. **macOS / Windows** (推荐):
```env
AI_API_BASE=http://host.docker.internal:11434
```

2. **Linux**:
```env
# 使用 Docker 桥接网络网关 IP
AI_API_BASE=http://172.17.0.1:11434

# 或使用 host 网络模式（修改 docker-compose.yml）
# services:
#   trendradar:
#     network_mode: host
```

3. **使用 Docker Compose 服务名**:

如果 Ollama 也在 Docker 中运行：

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

  trendradar:
    # ... 其他配置
    environment:
      - AI_API_BASE=http://ollama:11434
    depends_on:
      - ollama
```

#### 完整 Docker Compose 示例

```yaml
services:
  # Ollama 服务
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0

  # TrendRadar 服务
  trendradar:
    image: wantcat/trendradar:latest
    container_name: trendradar
    restart: unless-stopped
    volumes:
      - ./config:/app/config:ro
      - ./output:/app/output
    environment:
      - TZ=Asia/Shanghai
      - AI_API_KEY=ollama
      - AI_MODEL=ollama/llama3.1
      - AI_API_BASE=http://ollama:11434
      - AI_ANALYSIS_ENABLED=true
    depends_on:
      - ollama

volumes:
  ollama_data:
```

启动服务：
```bash
# 下载模型
docker exec -it ollama ollama pull llama3.1

# 重启 TrendRadar
docker compose restart trendradad
```

---

## 4. 验证配置

### 4.1 验证 API 连接

#### 方法一：使用 Python 脚本

创建测试脚本 `test_ai.py`:

```python
import os
from litellm import completion

# 配置（与 TrendRadar 保持一致）
api_key = "your-api-key"  # 或 os.environ.get("AI_API_KEY")
model = "ollama/llama3.1"  # 你的模型
api_base = "http://localhost:11434"  # 你的 API 地址

try:
    response = completion(
        model=model,
        messages=[{"role": "user", "content": "你好，请介绍一下你自己"}],
        api_key=api_key,
        api_base=api_base,
        timeout=120
    )

    print("✅ API 连接成功")
    print(f"模型响应: {response.choices[0].message.content}")

except Exception as e:
    print(f"❌ API 连接失败: {e}")
```

运行测试：
```bash
python test_ai.py
```

#### 方法二：使用 curl

**Ollama**:
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1",
  "prompt": "为什么天空是蓝色的？"
}'
```

**OpenAI 兼容 API**:
```bash
curl http://localhost:8000/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "llama-3.1-8b",
  "messages": [{"role": "user", "content": "你好"}],
  "temperature": 0.7
}'
```

#### 方法三：使用 Docker 容器测试

```bash
# 进入容器
docker exec -it trendradad bash

# 测试 API
python << 'EOF'
import os
from litellm import completion

api_key = os.environ.get("AI_API_KEY")
model = os.environ.get("AI_MODEL")
api_base = os.environ.get("AI_API_BASE")

print(f"API Key: {api_key[:10]}***")
print(f"Model: {model}")
print(f"API Base: {api_base}")

try:
    response = completion(
        model=model,
        messages=[{"role": "user", "content": "测试连接"}],
        api_key=api_key,
        api_base=api_base
    )
    print("✅ API 测试成功")
except Exception as e:
    print(f"❌ API 测试失败: {e}")
EOF
```

### 4.2 验证 TrendRadar 集成

#### 步骤 1：查看加载的配置

```bash
docker exec -it trendradad python manage.py config | grep AI
```

**预期输出**:
```
AI_ANALYSIS_ENABLED: true
AI_MODEL: ollama/llama3.1
AI_API_BASE: http://ollama:11434
AI_API_KEY: ollama***
```

#### 步骤 2：手动执行 AI 分析

```bash
docker exec -it trendradar python manage.py run
```

查看日志中的 AI 部分：
```bash
docker logs trendradad | grep "\[AI\]"
```

**正常输出示例**:
```
[AI] 正在进行 AI 分析...
[AI] 分析完成
```

**错误输出示例**:
```
[AI] 分析失败: APIError: Connection error
```

#### 步骤 3：查看分析结果

如果启用 AI 分析，检查推送消息中是否包含 AI 分析内容。

或者查看 HTML 报告：
```bash
# 查看 latest 目录
ls output/html/latest/

# 在浏览器中打开报告
open output/html/latest/current.html  # macOS
xdg-open output/html/latest/current.html  # Linux
```

### 4.3 性能测试

测试本地模型的响应速度和资源使用：

```bash
# 监控容器资源
docker stats trendradad

# 查看执行时间
time docker exec trendradad python manage.py run
```

**本地模型建议**:
- CPU 4 核以上
- 内存 8GB 以上
- 使用量化模型（q4_0, q5_0）

---

## 5. 常见问题

### 问题1：连接超时

**症状**:
```
[AI] 分析失败: APIError: timeout
```

**原因**: 本地模型推理速度慢，超过默认超时时间

**解决方案**:

1. 增加超时时间
```yaml
ai:
  timeout: 300  # 增加到 5 分钟
```

2. 减少分析数量
```yaml
ai_analysis:
  max_news_for_analysis: 20  # 从默认 50 减少到 20
```

3. 使用更小的模型
```env
# 使用 7B 模型而不是 70B
AI_MODEL=ollama/llama3.1:8b
```

### 问题2：连接被拒绝

**症状**:
```
[AI] 分析失败: APIError: Connection refused
```

**原因**: API 地址配置错误或服务未启动

**检查步骤**:

1. 确认模型服务正在运行
```bash
# Ollama
curl http://localhost:11434/api/tags

# vLLM
curl http://localhost:8000/health
```

2. 验证 `api_base` 配置
```bash
docker exec trendradad env | grep AI_API_BASE
```

3. Docker 网络问题
```bash
# 测试容器到宿主机的连接
docker exec trendradad curl http://host.docker.internal:11434
```

### 问题3：模型不支持

**症状**:
```
[AI] 分析失败: Model not supported: xxx
```

**原因**: 模型名称格式不正确

**解决方案**:

使用正确的模型格式：
- Ollama: `ollama/model-name`
- vLLM (OpenAI 兼容): `openai/model-name`
- 其他: 参考 [LiteLLM 文档](https://docs.litellm.ai/docs/providers)

### 问题4：内存不足

**症状**:
```
[AI] 分析失败: Out of memory
```

**解决方案**:

1. 减小模型尺寸
```bash
# 使用更小的模型
ollama pull llama3.1:8b  # 而不是 70b
```

2. 限制 token 数
```yaml
ai:
  max_tokens: 1000  # 减少生成的 token 数
```

3. 增加系统内存或使用 GPU

### 问题5：输出质量差

**症状**: AI 分析内容质量不如预期

**解决方案**:

1. 调整温度参数
```yaml
ai:
  temperature: 0.7  # 降低到 0.3-0.5 提高确定性
```

2. 使用更好的模型
```bash
# 使用更强的模型
ollama pull llama3.1:70b
```

3. 自定义提示词

编辑 [`config/ai_analysis_prompt.txt`](../config/ai_analysis_prompt.txt)，优化提示词。

---

## 附录

### A. 完整配置示例

#### 使用 Ollama (Docker Compose)

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0

  trendradar:
    image: wantcat/trendradar:latest
    container_name: trendradar
    restart: unless-stopped
    volumes:
      - ./config:/app/config:ro
      - ./output:/app/output
    environment:
      - TZ=Asia/Shanghai
      - AI_API_KEY=ollama
      - AI_MODEL=ollama/llama3.1
      - AI_API_BASE=http://ollama:11434
      - AI_ANALYSIS_ENABLED=true
      - AI_TIMEOUT=300
    depends_on:
      - ollama

volumes:
  ollama_data:
```

#### 使用 vLLM (GPU 服务器)

```yaml
# docker-compose.yml
services:
  vllm:
    image: vllm/vllm-openai:latest
    container_name: vllm
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    command: >
      --model meta-llama/Llama-3.1-8B-Instruct
      --host 0.0.0.0
      --port 8000

  trendradar:
    image: wantcat/trendradar:latest
    container_name: trendradar
    restart: unless-stopped
    volumes:
      - ./config:/app/config:ro
      - ./output:/app/output
    environment:
      - TZ=Asia/Shanghai
      - AI_API_KEY=vllm
      - AI_MODEL=openai/llama-3.1-8b
      - AI_API_BASE=http://vllm:8000/v1
      - AI_ANALYSIS_ENABLED=true
    depends_on:
      - vllm
```

### B. 推荐模型配置

#### 轻量级（适合 CPU）

```yaml
ai:
  model: "ollama/llama3.1:8b"
  api_base: "http://localhost:11434"
  temperature: 0.7
  max_tokens: 1000
  timeout: 180
```

#### 平衡型（推荐）

```yaml
ai:
  model: "ollama/qwen2.5:14b"
  api_base: "http://localhost:11434"
  temperature: 0.7
  max_tokens: 2000
  timeout: 240
```

#### 高性能（需要 GPU）

```yaml
ai:
  model: "openai/llama-3.1-70b"
  api_base: "http://gpu-server:8000/v1"
  temperature: 0.7
  max_tokens: 4000
  timeout: 120
```

### C. 相关资源

- **Ollama**: https://ollama.com/
- **vLLM**: https://docs.vllm.ai/
- **LM Studio**: https://lmstudio.ai/
- **LiteLLM 文档**: https://docs.litellm.ai/
- **HuggingFace 模型**: https://huggingface.co/models
- **TrendRadar 项目**: https://github.com/sansan0/TrendRadar

---

**文档版本**: v1.0
**最后更新**: 2025-01-21
**适用版本**: TrendRadar v5.3.0+
