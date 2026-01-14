# HTML AI Analysis Extension | HTML AI 分析扩展

> Adds AI-powered analysis section to HTML reports, providing insights about
> trending topics.
>
> 在 HTML 报告中添加 AI 驱动的分析部分，提供热点话题洞察。

---

## Overview | 概述

The `html_ai_analysis` extension runs AI analysis on your news data and injects
the results into HTML reports. The analysis appears as a styled section below
the header, providing summaries, keyword analysis, sentiment insights, and
recommendations.

`html_ai_analysis` 扩展对您的新闻数据运行 AI 分析，并将结果注入到 HTML 报告中。
分析以样式化的区块显示在标题下方，提供摘要、关键词分析、情感洞察和建议。

---

## Features | 功能

-   **AI-powered Analysis** - Uses configured AI provider (DeepSeek, OpenAI,
    Gemini, etc.)
-   **Structured Output** - Summary, keyword analysis, sentiment, cross-platform
    trends
-   **Customizable Styling** - Configure colors, title, and appearance
-   **Position Control** - Injected after header, before main content
-   **Shared Config** - Uses same AI settings as notification analysis

---

## Prerequisites | 前提条件

1. **Main AI Analysis Enabled**

    ```yaml
    # config/config.yaml
    ai_analysis:
      enabled: true
      provider: "deepseek"  # or openai, gemini, custom
      api_key: "your-api-key"  # or use AI_API_KEY env var
    ```

2. **Extension Enabled**
    ```yaml
    # config/extensions/html_ai_analysis.yaml
    enabled: true
    ```

---

## Configuration | 配置

**File:** `config/extensions/html_ai_analysis.yaml`

```yaml
# Enable/disable the extension
enabled: false  # Set to true to enable

# Section title displayed in HTML
section_title: "AI 智能分析"

# Context passed to AI (for prompt customization)
report_mode: "daily"
report_type: "HTML 报告"

# Styling options
accent_color: "#6366f1"      # Border and title color (indigo)
background_color: "#f8fafc"  # Section background color (slate-50)
```

---

## What AI Analyzes | AI 分析内容

The AI receives **title-level information only**, not full article content:

```
Format: [来源] 标题 | 排名:最高-最低 | 时间:首次~末次 | 出现:N次

Example data sent to AI:
### 热榜新闻
**东亚** (5条)
- [抖音] 韩国检方要求判处尹锡悦死刑 | 排名:1-3 | 时间:08:00~12:30 | 出现:5次
- [微博] 日本防卫相见美印太司令 | 排名:7 | 时间:09:15~10:00 | 出现:3次

**美国** (10条)
- [财联社] 美国12月CPI同比增长2.7% | 排名:1-2 | 时间:21:30~22:00 | 出现:8次
...
```

The AI does NOT have access to:

-   Full article content/body
-   Images or multimedia
-   User comments
-   Click/engagement metrics

---

## Output Structure | 输出结构

The AI returns structured analysis with these sections:

| Section            | Description                       | 说明           |
| ------------------ | --------------------------------- | -------------- |
| `summary`          | Brief overview of trending topics | 热点趋势概述   |
| `keyword_analysis` | Analysis of top keywords          | 关键词热度分析 |
| `sentiment`        | Overall sentiment trends          | 情感倾向分析   |
| `cross_platform`   | Topics appearing across platforms | 跨平台关联     |
| `impact`           | Potential impact assessment       | 潜在影响评估   |
| `signals`          | Notable signals to watch          | 值得关注的信号 |
| `conclusion`       | Summary and recommendations       | 总结与建议     |

---

## Example Output | 输出示例

```html
┌─────────────────────────────────────────────────────────────┐
│ 🤖 AI 智能分析                                              │
├─────────────────────────────────────────────────────────────┤
│ Analyzed 40 of 40 news items (Hotlist: 40)                  │
├─────────────────────────────────────────────────────────────┤
│ Summary                                                      │
│ 美国12月核心CPI公布及美方放宽英伟达H200对华出口，引发金融与  │
│ 高性能芯片热议。韩国政局持续动荡，检方对尹锡悦提出死刑诉求。  │
├─────────────────────────────────────────────────────────────┤
│ Keyword Analysis                                             │
│ Top trending: 美国 (10条), 韩国 (6条), AI (5条), 芯片 (4条)   │
├─────────────────────────────────────────────────────────────┤
│ Signals to Watch                                             │
│ 中美科技博弈仍在持续，关注后续芯片出口政策变化。              │
└─────────────────────────────────────────────────────────────┘
```

---

## How It Works | 工作原理

### 1. Transform Phase

During `transform()`, the extension:

1. Checks if main AI analysis is enabled
2. Creates an `AIAnalyzer` instance with app config
3. Runs analysis on stats data
4. Stores result in `self._ai_result`

### 2. After Render Phase

During `after_render()`, the extension:

1. Checks if analysis result exists
2. Builds HTML section from result
3. Injects CSS if not present
4. Inserts HTML after header, before content

```python
# Insertion point
</div>  <!-- end of header -->
<div class="ai-analysis">...</div>  <!-- AI analysis injected here -->
<div class="content">  <!-- main content starts -->
```

---

## Interfaces Implemented | 实现的接口

| Interface             | Method           | Purpose                       |
| --------------------- | ---------------- | ----------------------------- |
| `ReportDataTransform` | `transform()`    | Run AI analysis, store result |
| `HTMLRenderHook`      | `after_render()` | Inject analysis HTML and CSS  |

---

## Styling | 样式

The extension injects these CSS classes:

```css
.ai-analysis {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #6366f1;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
}

.ai-title {
    color: #6366f1;
    font-size: 1.5rem;
}

.ai-title::before {
    content: "🤖";
}
```

Customize via config:

```yaml
accent_color: "#10b981"      # Change to green
background_color: "#f0fdf4"  # Light green background
```

---

## Files | 文件

| File                                      | Description        |
| ----------------------------------------- | ------------------ |
| `extensions/html_ai_analysis/__init__.py` | Plugin class       |
| `config/extensions/html_ai_analysis.yaml` | Configuration file |

---

## Troubleshooting | 故障排除

### "AI_ANALYSIS is disabled" warning

Enable main AI analysis in `config/config.yaml`:

```yaml
ai_analysis:
  enabled: true
```

### "未配置 AI API Key" error

Set API key via:

-   Config: `ai_analysis.api_key: "your-key"`
-   Environment: `export AI_API_KEY="your-key"`

### Analysis not appearing in HTML

1. Check extension is enabled
2. Verify AI analysis completed successfully in logs
3. Look for `[html_ai_analysis] Injecting AI analysis into HTML` log

### Styling issues

1. Check if `.ai-analysis` CSS is in the HTML
2. Verify no conflicting CSS rules
3. Try different `accent_color` values

---

## Cost Considerations | 成本考虑

AI analysis incurs API costs. Estimated costs (reference only):

| Scenario                | Estimated Cost |
| ----------------------- | -------------- |
| GitHub Actions (hourly) | ~0.1 CNY/day   |
| Docker (every 30 min)   | ~0.2 CNY/day   |

Control costs via:

```yaml
ai_analysis:
  max_news_for_analysis: 50  # Limit analyzed items
```

---

## See Also | 另请参阅

-   [Extension System Overview](../extensions.md)
-   [AI Analysis Configuration](../../config/config.yaml) - Main AI settings
-   [ReportDataTransform Interface](../extensions.md#reportdatatransform)
