# Extension System | 扩展系统

> 本文档提供中英双语说明 | This document provides bilingual documentation.

---

## Overview | 概述

The TrendRadar extension system provides a flexible, merge-safe way to add
custom functionality to the data processing pipeline without modifying core
code. Extensions are auto-discovered via Python entry points and configured via
isolated YAML files.

TrendRadar 扩展系统提供了一种灵活、合并安全的方式，在不修改核心代码的情况下向数
据处理流水线添加自定义功能。扩展通过 Python 入口点自动发现，并通过独立的 YAML 文
件进行配置。

**Key Benefits | 主要优势：**

| Feature         | Description                                 | 说明                                        |
| --------------- | ------------------------------------------- | ------------------------------------------- |
| Merge-safe      | Extensions live in `extensions/` directory  | 扩展位于 `extensions/` 目录，与上游代码分离 |
| Auto-discovery  | Plugins registered via entry points         | 插件通过入口点自动注册                      |
| Type-safe       | Abstract base classes with clear interfaces | 抽象基类提供清晰的接口                      |
| Isolated config | Each plugin has its own config file         | 每个插件有独立的配置文件                    |

---

## Architecture | 架构

```
trendradar/
├── extensions/                    # Extension framework
│   ├── __init__.py               # ExtensionManager (discovery, loading)
│   ├── base.py                   # Abstract interfaces (ExtensionPoint)
│   ├── report_dedupe/            # Deduplication plugin
│   │   ├── __init__.py           # Plugin class
│   │   ├── report_dedupe.py      # Core logic
│   │   └── ollama_client.py      # Ollama integration
│   └── html_ai_analysis/         # AI analysis plugin
│       └── __init__.py           # Plugin class
└── trendradar/
    └── __main__.py               # Calls extension_manager.apply_transforms()

config/
└── extensions/
    ├── report_dedupe.yaml        # Deduplication config
    └── html_ai_analysis.yaml     # AI analysis config
```

### Extension Points | 扩展点

| Interface                      | When Called                          | Use Case                                    |
| ------------------------------ | ------------------------------------ | ------------------------------------------- |
| `ReportDataTransform`          | After stats calculation, before HTML | Deduplication, filtering, enrichment        |
| `HTMLRenderHook.before_render` | Before HTML rendering                | Custom sections, data modification          |
| `HTMLRenderHook.after_render`  | After HTML rendering                 | CSS injection, link modification, analytics |
| `KeywordMatcher`               | During keyword matching              | Fuzzy matching, custom algorithms           |
| `NotificationEnhancer`         | Before notification send             | Formatting, logging, rate limiting          |

---

## Creating a Plugin | 创建插件

### Step 1: Create Plugin Directory | 步骤 1：创建插件目录

```bash
mkdir -p extensions/my_plugin
touch extensions/my_plugin/__init__.py
```

### Step 2: Implement Plugin Class | 步骤 2：实现插件类

```python
# extensions/my_plugin/__init__.py
from typing import Any, Dict
from extensions.base import ReportDataTransform

class MyPlugin(ReportDataTransform):
    """My custom extension plugin"""

    name = "my_plugin"
    version = "1.0.0"

    def __init__(self):
        self.enabled = False
        self.config = {}

    def apply_config(self, config: Dict[str, Any]) -> None:
        """Apply plugin configuration"""
        self.config = config or {}
        self.enabled = self.config.get("enabled", False)

    def transform(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        """Transform report data"""
        if not self.enabled:
            return report_data

        # Your transformation logic here
        report_data["custom_field"] = "value"

        return report_data

# Export for entry point discovery
plugin = MyPlugin
```

### Step 3: Register in pyproject.toml | 步骤 3：在 pyproject.toml 中注册

```toml
[project.entry-points."trendradar.extensions"]
my_plugin = "extensions.my_plugin:MyPlugin"
```

### Step 4: Create Config File | 步骤 4：创建配置文件

```yaml
# config/extensions/my_plugin.yaml
enabled: true
custom_option: "value"
```

---

## Configuration | 配置

### Config File Location | 配置文件位置

Plugin configs are stored in `config/extensions/{plugin_name}.yaml`.

插件配置文件存储在 `config/extensions/{插件名称}.yaml`。

### Config Format | 配置格式

```yaml
# 启用设置 / Enable settings
enabled: true

# 插件特定配置 / Plugin-specific configuration
custom_option: "value"
nested_option:
  key: "value"
```

### Loading Config | 加载配置

The `ExtensionManager.load_plugin_config(plugin_name)` method:

-   Looks for `config/extensions/{plugin_name}.yaml`
-   Returns parsed YAML as dict
-   Returns empty dict if file not found

---

## Abstract Base Classes | 抽象基类

### ExtensionPoint

Base class for all extension points.

所有扩展点的基类。

```python
from extensions.base import ExtensionPoint

class MyExtension(ExtensionPoint):
    @property
    def name(self) -> str:
        return "my_extension"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def enabled(self) -> bool:
        return self._enabled

    def apply_config(self, config: Dict) -> None:
        self.config = config
        self._enabled = config.get("enabled", True)
```

### ReportDataTransform

Transform report data after statistics calculation.

在统计数据计算后转换报告数据。

```python
from extensions.base import ReportDataTransform

class MyTransform(ReportDataTransform):
    name = "my_transform"
    version = "1.0.0"

    def transform(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Dict[str, Any]:
        # Transform report_data
        return report_data
```

### HTMLRenderHook

Hook into HTML rendering pipeline. Provides two hooks:

-   `before_render`: Modify report data before rendering
-   `after_render`: Post-process rendered HTML content

钩入 HTML 渲染流水线。提供两个钩子：

-   `before_render`：在渲染前修改报告数据
-   `after_render`：后处理已渲染的 HTML 内容

```python
from extensions.base import HTMLRenderHook

class MyHook(HTMLRenderHook):
    name = "my_hook"
    version = "1.0.0"

    def before_render(
        self,
        report_data: Dict[str, Any],
        config: Dict[str, Any],
        context: Any,
    ) -> Optional[Dict[str, Any]]:
        # Modify report_data before rendering
        return {"custom_data": "value"}

    def after_render(
        self,
        html_content: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        # Post-process rendered HTML (e.g., inject CSS, modify links)
        return html_content.replace("</style>", ".custom { } </style>")
```

### KeywordMatcher

Custom keyword matching logic.

自定义关键词匹配逻辑。

```python
from extensions.base import KeywordMatcher

class MyMatcher(KeywordMatcher):
    name = "my_matcher"
    version = "1.0.0"

    def match(
        self,
        title: str,
        word_groups: List[Dict],
        filter_words: List[str],
        global_filters: List[str],
        config: Dict[str, Any],
    ) -> bool:
        # Custom matching logic
        return True
```

### NotificationEnhancer

Enhance notifications before sending.

在发送前增强通知。

```python
from extensions.base import NotificationEnhancer

class MyEnhancer(NotificationEnhancer):
    name = "my_enhancer"
    version = "1.0.0"

    def enhance(
        self,
        content: str,
        channel: str,
        config: Dict[str, Any],
        context: Any,
    ) -> str:
        # Enhance content
        return f"[Enhanced] {content}"
```

---

## API Reference | API 参考

### ExtensionManager

```python
from extensions import get_extension_manager

em = get_extension_manager()

# Discover and load plugins
em._discover_plugins()

# Load plugin config
config = em.load_plugin_config("my_plugin")

# Apply transforms
report_data = em.apply_transforms(report_data, context)

# Apply HTML hooks (before_render)
report_data = em.apply_html_hooks(report_data, context)

# Apply HTML post-processing (after_render)
html_content = em.apply_html_post_processing(html_content, context)

# Apply keyword matching
matches = em.apply_keyword_match(title, groups, filters, global_filters)

# Apply notification enhancement
content = em.apply_notification_enhancement(content, channel, context)

# List all plugins
plugins = em.list_plugins()
# Returns: [{"name": "x", "version": "1.0", "enabled": True}, ...]

# Get specific plugin
plugin = em.get_plugin("my_plugin")
```

---

## Error Handling | 错误处理

Plugins that raise exceptions are skipped and execution continues with other
plugins. Errors are logged with `[Extension]` prefix.

引发异常的插件会被跳过，其他插件继续执行。错误以 `[Extension]` 前缀记录。

```python
try:
    if plugin.enabled:
        result = plugin.transform(data, config, context)
except Exception as e:
    print(f"[Extension] Error in {plugin.name}: {e}")
    # Continue with other plugins
```

---

## Best Practices | 最佳实践

1. **Use meaningful names**: Plugin names should be unique and descriptive
2. **Version your plugins**: Include version for compatibility tracking
3. **Handle missing config**: Don't assume config exists
4. **Log appropriately**: Use `[Extension]` prefix for logs
5. **Keep it focused**: One plugin = one responsibility
6. **Test independently**: Test plugin before integration

---

## Built-in Extensions | 内置扩展

TrendRadar includes the following built-in extensions. Each can be
enabled/disabled via its config file.

TrendRadar 包含以下内置扩展。每个扩展都可以通过其配置文件启用/禁用。

| Extension          | Description                           | Config File             | Status              |
| ------------------ | ------------------------------------- | ----------------------- | ------------------- |
| `report_dedupe`    | Merge duplicate news across platforms | `report_dedupe.yaml`    | Enabled by default  |
| `html_ai_analysis` | Add AI analysis to HTML reports       | `html_ai_analysis.yaml` | Disabled by default |

---

### report_dedupe - News Deduplication | 新闻去重

Merges similar news titles from different platforms, reducing duplicates and
presenting cleaner results with clickable multi-platform links.

合并来自不同平台的相似新闻标题，减少重复并提供可点击的多平台链接。

<details>
<summary><strong>View configuration & details | 查看配置和详情</strong></summary>

**Quick Config | 快速配置：**

```yaml
# config/extensions/report_dedupe.yaml
enabled: true
strategy: "ollama"
similarity:
  threshold: 0.85
```

**Example Result | 示例结果：**

```
Before: 44 titles → After: 41 titles (3 merged)
[抖音 / 财联社 / 澎湃新闻] 韩国检方要求判处尹锡悦死刑
```

📖 **[Full Documentation | 完整文档](extensions/report-dedupe.md)**

</details>

---

### html_ai_analysis - AI Analysis in HTML | HTML AI 分析

Adds AI-powered analysis section to HTML reports, displayed below the header
with insights about trending topics.

在 HTML 报告标题下方添加 AI 驱动的分析区块，提供热点话题洞察。

<details>
<summary><strong>View configuration & details | 查看配置和详情</strong></summary>

**Prerequisites | 前提条件：**

-   `ai_analysis.enabled: true` in main config
-   Valid AI API key

**Quick Config | 快速配置：**

```yaml
# config/extensions/html_ai_analysis.yaml
enabled: true
section_title: "AI 智能分析"
```

**Note:** AI analyzes titles only, not full article content.

📖 **[Full Documentation | 完整文档](extensions/html-ai-analysis.md)**

</details>

---

## Related Files | 相关文件

| File                           | Description              | 说明        |
| ------------------------------ | ------------------------ | ----------- |
| `extensions/base.py`           | Abstract base classes    | 抽象基类    |
| `extensions/__init__.py`       | ExtensionManager         | 扩展管理器  |
| `extensions/report_dedupe/`    | Deduplication plugin     | 去重插件    |
| `extensions/html_ai_analysis/` | AI analysis plugin       | AI 分析插件 |
| `config/extensions/`           | Plugin configs           | 插件配置    |
| `pyproject.toml`               | Entry point registration | 入口点注册  |
