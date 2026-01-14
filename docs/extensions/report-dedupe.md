# Report Dedupe Extension | 新闻去重扩展

> Merges similar news titles from different platforms, reducing duplicates and
> presenting cleaner results.
>
> 合并来自不同平台的相似新闻标题，减少重复并呈现更清晰的结果。

---

## Overview | 概述

The `report_dedupe` extension identifies and merges duplicate or similar news
titles that appear across multiple platforms. For example, when the same
breaking news appears on Douyin, Weibo, and Zhihu, this extension combines them
into a single entry with clickable links to all sources.

`report_dedupe` 扩展识别并合并出现在多个平台上的重复或相似新闻标题。例如，当同一
突发新闻出现在抖音、微博和知乎上时，此扩展将它们合并为一个条目，并提供指向所有来
源的可点击链接。

---

## Features | 功能

-   **Jaccard Similarity Matching** - Tokenizes titles and calculates similarity
    score
-   **Ollama AI Integration** - Optional AI judgment for borderline similarity
    cases
-   **Multi-platform URL Merging** - Combines URLs from all sources with
    clickable links
-   **HTML Post-processing** - Injects clickable platform links via
    `after_render` hook
-   **Configurable Thresholds** - Adjust similarity threshold and merge behavior

---

## Configuration | 配置

**File:** `config/extensions/report_dedupe.yaml`

```yaml
# Enable/disable the extension
enabled: true

# Deduplication strategy
# - ollama: Use Ollama AI for borderline cases (recommended)
# - heuristic: Use only Jaccard similarity
# - auto: Use AI if available, fallback to heuristic
strategy: "ollama"

# Similarity settings
similarity:
  threshold: 0.85           # Jaccard similarity threshold (0.0-1.0)
  max_ai_checks: 50         # Maximum AI API calls per run

# Ollama configuration (only used when strategy includes AI)
ollama:
  base_url: "http://localhost:11434"
  model: "qwen2.5:14b-instruct"

# Merge behavior
merge:
  source_separator: " / "   # Separator between platform names
  count_strategy: "sum"     # How to combine counts: "sum" or "max"
  max_items_per_group: 10   # Maximum items to merge into one group
```

---

## How It Works | 工作原理

### 1. Title Tokenization

Titles are tokenized for comparison:

-   Chinese characters are split individually
-   English/alphanumeric words are kept together
-   Punctuation and brackets are normalized

```
Title: "【热搜】美国CPI数据公布"
Tokens: ["美", "国", "cpi", "数", "据", "公", "布"]
```

### 2. Similarity Calculation

Jaccard similarity is calculated between token sets:

```
Similarity = |A ∩ B| / |A ∪ B|
```

If similarity >= threshold (default 0.85), titles are considered duplicates.

### 3. AI Judgment (Optional)

For borderline cases (similarity between 0.5-0.85), the extension can optionally
use Ollama AI:

```
Title A: "韩国检方要求判处尹锡悦死刑"
Title B: "韩国检方要求法院判处尹锡悦死刑"

Jaccard: 0.867 → Merged (above threshold)
```

### 4. URL Merging

When titles are merged, all source URLs are preserved:

```python
merged["urls"] = [
    {"url": "https://douyin.com/...", "source": "抖音"},
    {"url": "https://weibo.com/...", "source": "微博"},
    {"url": "https://zhihu.com/...", "source": "知乎"},
]
```

### 5. HTML Post-processing

The `after_render` hook injects clickable links:

```html
<!-- Before -->
<span class="source-name">抖音 / 微博 / 知乎</span>

<!-- After -->
<span class="source-name">
  <a href="..." class="source-link">抖音</a> /
  <a href="..." class="source-link">微博</a> /
  <a href="..." class="source-link">知乎</a>
</span>
```

---

## Example Output | 输出示例

**Before deduplication:**

```
Total: 44 titles

1. [抖音] 韩国检方要求判处尹锡悦死刑
2. [财联社] 韩国检方要求法院判处尹锡悦死刑
3. [澎湃新闻] 韩国检方要求法院判处尹锡悦死刑
4. [百度] 美国批准向中国出口英伟达H200芯片
5. [微博] 美国批准向中国出口英伟达H200芯片
...
```

**After deduplication:**

```
Total: 41 titles (3 duplicates merged)

1. [抖音 / 财联社 / 澎湃新闻] 韩国检方要求判处尹锡悦死刑
   ↳ Click any source to open original article
2. [百度 / 微博] 美国批准向中国出口英伟达H200芯片
...
```

---

## Interfaces Implemented | 实现的接口

| Interface             | Method           | Purpose                            |
| --------------------- | ---------------- | ---------------------------------- |
| `ReportDataTransform` | `transform()`    | Merge similar titles, collect URLs |
| `HTMLRenderHook`      | `after_render()` | Inject clickable platform links    |

---

## Files | 文件

| File                                        | Description                                |
| ------------------------------------------- | ------------------------------------------ |
| `extensions/report_dedupe/__init__.py`      | Plugin class with transform and HTML hooks |
| `extensions/report_dedupe/report_dedupe.py` | Core deduplication logic                   |
| `extensions/report_dedupe/ollama_client.py` | Ollama AI client for similarity judgment   |
| `config/extensions/report_dedupe.yaml`      | Configuration file                         |

---

## Troubleshooting | 故障排除

### Extension not merging titles

1. Check if extension is enabled: `enabled: true`
2. Verify threshold is not too high (default 0.85)
3. Check logs for `[report_dedupe]` messages

### Ollama AI not working

1. Ensure Ollama is running: `curl http://localhost:11434/api/tags`
2. Verify model is installed: `ollama list`
3. Check `base_url` in config matches Ollama address

### Links not clickable

1. Verify HTML post-processing is working
2. Check browser console for JavaScript errors
3. Ensure `.source-link` CSS is injected

---

## See Also | 另请参阅

-   [Extension System Overview](../extensions.md)
-   [HTMLRenderHook Interface](../extensions.md#htmlrenderhook)
