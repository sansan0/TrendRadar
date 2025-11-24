# AI分析器配置指南

## 概述

AI分析器已成功集成到TrendRadar项目中，现在需要配置GitHub Secrets以启用实际的AI分析功能。

## 当前状态

✅ **已完成的工作：**
- AI分析器模块开发完成
- 配置文件结构设计完成
- GitHub Actions工作流集成完成
- 配置验证逻辑修复完成
- 测试验证通过

⚠️ **待完成的工作：**
- 配置GitHub Secrets中的AI API密钥

## GitHub Secrets配置步骤

### 1. 获取AI API密钥

您需要从以下平台获取API密钥：
- **SiliconFlow**: 访问 https://siliconflow.cn 注册并获取API密钥

### 2. 在GitHub仓库中配置Secrets

1. 进入您的GitHub仓库页面
2. 点击 "Settings" 标签
3. 在左侧菜单中点击 "Secrets and variables" → "Actions"
4. 点击 "New repository secret" 按钮
5. 添加以下4个Secrets：

| Secret名称 | 描述 | 示例值 |
|------------|------|--------|
| `AI_API_ENDPOINT` | AI API端点URL | `https://api.siliconflow.cn/v1/chat/completions` |
| `AI_API_MODEL` | 使用的AI模型 | `Pro/deepseek-ai/DeepSeek-R1` |
| `AI_API_TOKEN` | API认证令牌 | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `AI_ENABLE_ANALYSIS` | 是否启用AI分析 | `true` |

### 3. 验证配置

配置完成后，GitHub Actions工作流将自动：
- 读取Secrets中的AI配置
- 验证配置文件完整性
- 启用AI分析功能

## 配置文件说明

### ai_config.yaml 结构

```yaml
ai:
  enable_ai_analysis: true
  api:
    endpoint: "https://api.siliconflow.cn/v1/chat/completions"
    model: "Pro/deepseek-ai/DeepSeek-R1"
    timeout: 30
    max_retries: 3
  auth:
    authorization_token: ""  # 从GitHub Secrets获取
  analysis:
    max_news_count: 10
    max_analysis_length: 2000
    temperature: 0.7
  output:
    format: "markdown"
    include_original: true
  error_handling:
    fallback_to_original: true
    log_errors: true
```

## 故障排除

### 常见问题

1. **"缺少必要配置项: api.endpoint"**
   - ✅ 已修复：配置验证逻辑已更新

2. **"AI API token未配置"**
   - 这是正常现象，需要配置GitHub Secrets中的`AI_API_TOKEN`

3. **GitHub Actions运行失败**
   - 确保所有4个Secrets都已正确配置
   - 检查API密钥是否有效

### 测试验证

运行以下命令验证配置：

```bash
python test_ai_integration.py
```

## 下一步

配置GitHub Secrets后，AI分析器将能够：
- 自动分析新闻内容
- 生成智能摘要和洞察
- 提升推送内容质量
- 提供更专业的趋势分析

## 技术支持

如有问题，请检查：
1. API密钥是否正确
2. GitHub Secrets配置是否完整
3. 网络连接是否正常
4. API服务是否可用