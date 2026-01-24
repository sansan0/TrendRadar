# TrendRadar 开发指南

## 开发环境搭建

### 环境要求

- **Python**: >= 3.10
- **操作系统**: Windows / macOS / Linux
- **Git**: 用于版本控制

### 1. 克隆项目

```bash
git clone https://github.com/sansan0/TrendRadar.git
cd TrendRadar
```

### 2. 创建虚拟环境

**Windows**:
```cmd
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux**:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. 安装依赖

```bash
# 安装核心依赖
pip install -r requirements.txt

# 或使用pip（推荐）
pip install -e .

# 安装开发依赖（可选）
pip install pytest black flake8 mypy
```

### 4. 配置文件

复制并编辑配置文件：

```bash
# 创建配置目录
mkdir -p config

# 复制示例配置（如果有）
cp config/config.yaml.example config/config.yaml

# 编辑配置
vim config/config.yaml
```

### 5. 验证安装

```bash
# 运行主程序
python -m trendradar

# 测试MCP服务器
python -m mcp_server.server
```

## 项目结构

```
TrendRadar/
├── trendradar/              # 主程序包
│   ├── __init__.py
│   ├── __main__.py          # 程序入口
│   ├── context.py           # 应用上下文
│   │
│   ├── ai/                  # AI分析模块
│   │   ├── __init__.py
│   │   ├── analyzer.py      # AI分析器
│   │   ├── client.py        # LiteLLM客户端
│   │   ├── translator.py    # 翻译器
│   │   └── formatter.py     # 输出格式化
│   │
│   ├── core/                # 核心逻辑
│   │   ├── __init__.py
│   │   ├── config.py        # 配置解析
│   │   ├── data.py          # 数据结构
│   │   ├── analyzer.py      # 关键词分析
│   │   ├── loader.py        # 数据加载
│   │   └── frequency.py     # 频率统计
│   │
│   ├── crawler/             # 数据爬虫
│   │   ├── __init__.py
│   │   ├── fetcher.py       # 热榜爬虫
│   │   └── rss/             # RSS订阅
│   │       ├── __init__.py
│   │       ├── fetcher.py
│   │       └── parser.py
│   │
│   ├── notification/        # 通知推送
│   │   ├── __init__.py
│   │   ├── dispatcher.py    # 分发器
│   │   ├── push_manager.py  # 推送管理
│   │   ├── formatters.py    # 格式化
│   │   ├── senders.py       # 发送器
│   │   ├── batch.py         # 批处理
│   │   ├── splitter.py      # 消息分割
│   │   └── renderer.py      # 渲染器
│   │
│   ├── report/              # 报告生成
│   │   ├── __init__.py
│   │   ├── generator.py     # 生成器
│   │   ├── html.py          # HTML报告
│   │   ├── rss_html.py      # RSS报告
│   │   ├── formatter.py     # 格式化
│   │   └── helpers.py       # 辅助函数
│   │
│   ├── storage/             # 存储管理
│   │   ├── __init__.py
│   │   ├── base.py          # 抽象基类
│   │   ├── local.py         # 本地存储
│   │   ├── remote.py        # 云存储
│   │   ├── manager.py       # 管理器
│   │   └── sqlite_mixin.py  # SQLite混入
│   │
│   └── utils/               # 工具函数
│       ├── __init__.py
│       ├── time.py          # 时间处理
│       └── url.py           # URL处理
│
├── mcp_server/              # MCP服务器
│   ├── __init__.py
│   ├── server.py            # FastMCP服务器
│   │
│   ├── tools/               # MCP工具集
│   │   ├── __init__.py
│   │   ├── data_query.py
│   │   ├── analytics.py
│   │   ├── search_tools.py
│   │   ├── config_mgmt.py
│   │   ├── system.py
│   │   └── storage_sync.py
│   │
│   ├── services/            # 服务层
│   │   ├── __init__.py
│   │   ├── data_service.py
│   │   ├── cache_service.py
│   │   └── parser_service.py
│   │
│   └── utils/               # 工具函数
│       ├── __init__.py
│       ├── date_parser.py
│       ├── validators.py
│       └── errors.py
│
├── config/                  # 配置文件
│   ├── config.yaml
│   ├── frequency_words.txt
│   ├── ai_analysis_prompt.txt
│   └── ai_translation_prompt.txt
│
├── output/                  # 输出目录
│   ├── news/                # SQLite数据库
│   └── html/                # HTML报告
│
├── docker/                  # Docker配置
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── entrypoint.sh
│
├── tests/                   # 测试（如果有）
├── pyproject.toml           # 项目配置
├── requirements.txt         # 依赖列表
└── README.md                # 项目说明
```

## 核心概念

### 1. 应用上下文 (AppContext)

`AppContext` 是全局单例，负责：
- 配置管理
- 资源生命周期
- 组件工厂

**使用示例**:

```python
from trendradar.context import AppContext
from trendradar.core import load_config

# 加载配置
config = load_config()

# 创建上下文
ctx = AppContext(config)

# 使用上下文
storage = ctx.get_storage_manager()
current_time = ctx.get_time()
```

### 2. 存储后端 (StorageBackend)

抽象存储接口，支持本地和云存储。

**接口定义** ([trendradar/storage/base.py](trendradar/storage/base.py)):

```python
from abc import ABC, abstractmethod
from trendradar.core.data import NewsData

class StorageBackend(ABC):
    @abstractmethod
    def save_news_data(self, data: NewsData) -> bool:
        """保存新闻数据"""
        pass

    @abstractmethod
    def load_news_data(self, date: str) -> Optional[NewsData]:
        """加载新闻数据"""
        pass
```

**使用示例**:

```python
from trendradar.storage.manager import StorageManager

# 创建管理器（自动选择后端）
manager = StorageManager(config)

# 保存数据
success = manager.save_news_data(news_data)

# 加载数据
data = manager.load_news_data("2025-01-21")
```

### 3. 通知发送器 (NotificationSender)

通知渠道的抽象基类。

**接口定义** ([trendradar/notification/senders.py](trendradar/notification/senders.py)):

```python
from abc import ABC, abstractmethod

class NotificationSender(ABC):
    def __init__(self, config: Dict):
        self.config = config

    @abstractmethod
    def send(self, message: str) -> bool:
        """发送消息"""
        pass
```

**实现示例**:

```python
class CustomSender(NotificationSender):
    def send(self, message: str) -> bool:
        # 实现发送逻辑
        url = self.config.get('webhook_url')
        response = requests.post(url, json={'content': message})
        return response.status_code == 200
```

## 扩展开发

### 添加新的热榜平台

**步骤**:

1. **确认平台API**
   - 平台是否有公开API
   - API格式和数据结构

2. **修改爬虫配置** ([trendradar/crawler/fetcher.py](trendradar/crawler/fetcher.py))

```python
# 在 DataFetcher.crawl_websites() 中添加平台
PLATFORMS = {
    # ... 现有平台
    'new-platform': {
        'name': '新平台',
        'api': 'https://api.example.com/hot',
        'parser': parse_new_platform  # 解析函数
    }
}
```

3. **实现解析函数**

```python
def parse_new_platform(data: Dict) -> List[Tuple[str, int, str]]:
    """
    解析新平台数据

    Returns:
        [(title, rank, url), ...]
    """
    results = []
    for item in data.get('data', []):
        title = item.get('title')
        rank = item.get('index', 0)
        url = item.get('url', '')
        results.append((title, rank, url))
    return results
```

4. **更新配置文件** ([config/config.yaml](config/config.yaml))

```yaml
platforms:
  sources:
    - id: "new-platform"
      name: "新平台"
```

### 添加新的通知渠道

**步骤**:

1. **创建发送器类** ([trendradar/notification/senders.py](trendradar/notification/senders.py))

```python
from trendradar.notification.senders import NotificationSender

class CustomChannelSender(NotificationSender):
    """自定义渠道发送器"""

    def __init__(self, config: Dict, index: int = 0):
        super().__init__(config)
        self.index = index
        self.webhook_url = self._get_webhook_url()

    def _get_webhook_url(self) -> str:
        """获取webhook URL（支持多账号）"""
        urls = parse_multi_account_config(
            self.config.get('webhook_url', '')
        )
        return urls[self.index] if self.index < len(urls) else ''

    def send(self, message: str) -> bool:
        """发送消息"""
        try:
            response = requests.post(
                self.webhook_url,
                json={'message': message},
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            print(f"发送失败: {e}")
            return False
```

2. **注册到分发器** ([trendradar/notification/dispatcher.py](trendradar/notification/dispatcher.py))

```python
class NotificationDispatcher:
    def _init_senders(self):
        # ... 现有渠道

        # 添加新渠道
        custom_config = self.config.get('custom_channel', {})
        if custom_config.get('webhook_url'):
            self.senders['custom_channel'] = [
                CustomChannelSender(custom_config, i)
                for i in range(max_accounts)
            ]
```

3. **更新配置文件**

```yaml
notification:
  channels:
    custom_channel:
      webhook_url: "url1;url2"  # 多账号支持
```

### 添加新的MCP工具

**步骤**:

1. **创建工具类** ([mcp_server/tools/](mcp_server/tools/))

```python
from mcp_server.tools.base import BaseTool

class CustomTools(BaseTool):
    """自定义工具集"""

    def __init__(self, project_root: Optional[str] = None):
        super().__init__(project_root)

    def custom_operation(self, param: str) -> Dict:
        """
        自定义操作

        Args:
            param: 参数说明

        Returns:
            操作结果
        """
        try:
            # 实现逻辑
            result = {"status": "success", "data": param}
            return self._success(result)
        except Exception as e:
            return self._error(str(e))
```

2. **注册到服务器** ([mcp_server/server.py](mcp_server/server.py))

```python
from mcp_server.tools.custom_tools import CustomTools

# 在 _get_tools() 中添加
def _get_tools(project_root: Optional[str] = None):
    if not _tools_instances:
        # ... 现有工具
        _tools_instances['custom'] = CustomTools(project_root)
    return _tools_instances

# 注册工具
@mcp.tool()
async def custom_tool(param: str) -> str:
    """自定义工具说明"""
    tools = _get_tools()
    result = await asyncio.to_thread(
        tools['custom'].custom_operation,
        param
    )
    return json.dumps(result, ensure_ascii=False)
```

## 代码规范

### 1. 命名规范

- **类名**: 大驼峰 (`NewsAnalyzer`)
- **函数名**: 小写下划线 (`crawl_websites`)
- **常量**: 大写下划线 (`MAX_RETRIES`)
- **私有成员**: 单下划线前缀 (`_internal_method`)

### 2. 类型注解

```python
from typing import Dict, List, Optional, Tuple

def process_data(
    data: Dict[str, str],
    limit: Optional[int] = None
) -> List[Tuple[str, int]]:
    """处理数据"""
    if limit is None:
        limit = 10
    # ...
```

### 3. 文档字符串

```python
def count_frequency(
    data_source: Dict,
    word_groups: List[Dict],
    filter_words: List[str],
    id_to_name: Dict,
    title_info: Dict,
    new_titles: Dict,
    mode: str
) -> Tuple[List[Dict], int]:
    """
    统计关键词频率

    Args:
        data_source: 数据源字典
        word_groups: 关键词分组列表
        filter_words: 过滤词列表
        id_to_name: 平台ID到名称的映射
        title_info: 标题元信息
        new_titles: 新增标题
        mode: 报告模式 (daily/current/incremental)

    Returns:
        (stats, total_titles)
        stats: [{
            "word": "关键词",
            "count": 5,
            "platforms": ["知乎", "微博"],
            "titles": [...]
        }]
        total_titles: 总标题数

    Raises:
        ValueError: 参数无效时
    """
```

### 4. 错误处理

```python
def risky_operation():
    try:
        # 可能出错的操作
        result = do_something()
        return result
    except SpecificError as e:
        # 处理特定错误
        logger.error(f"Specific error: {e}")
        return None
    except Exception as e:
        # 处理其他错误
        logger.error(f"Unexpected error: {e}")
        raise
    finally:
        # 清理资源
        cleanup()
```

## 测试

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_analyzer.py

# 带覆盖率报告
pytest --cov=trendradar
```

### 编写测试示例

```python
import pytest
from trendradar.core.analyzer import count_frequency

def test_count_frequency():
    """测试关键词频率统计"""
    # 准备测试数据
    data_source = {
        'zhihu': {
            '测试标题1': {...},
            '测试标题2': {...}
        }
    }
    word_groups = [{'word': '测试', 'keywords': ['测试']}]
    filter_words = []
    id_to_name = {'zhihu': '知乎'}

    # 执行测试
    stats, total = count_frequency(
        data_source,
        word_groups,
        filter_words,
        id_to_name,
        {},
        {},
        'current'
    )

    # 断言
    assert total == 2
    assert len(stats) == 1
    assert stats[0]['word'] == '测试'
```

## 调试

### 启用调试模式

```yaml
# config/config.yaml
advanced:
  debug: true
```

### 使用日志

```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# 使用日志
logger.debug("调试信息")
logger.info("普通信息")
logger.warning("警告信息")
logger.error("错误信息")
```

### 断点调试

```python
# 使用pdb
import pdb; pdb.set_trace()

# 或使用breakpoint() (Python 3.7+)
breakpoint()
```

## 性能优化

### 1. 并发处理

```python
import asyncio
import aiohttp

async def fetch_multiple_urls(urls: List[str]):
    """并发抓取多个URL"""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results
```

### 2. 缓存机制

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_operation(param: str) -> str:
    """昂贵的操作（带缓存）"""
    # 复杂计算
    return result
```

### 3. 批量操作

```python
def batch_insert(items: List[Dict], batch_size: int = 100):
    """批量插入"""
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        database.insert_many(batch)
```

## 发布流程

### 1. 更新版本号

```toml
# pyproject.toml
[project]
name = "trendradar"
version = "5.4.0"  # 更新版本
```

### 2. 构建包

```bash
pip install build
python -m build
```

### 3. 发布到PyPI

```bash
pip install twine
twine upload dist/*
```

### 4. 创建Git标签

```bash
git tag v5.4.0
git push origin v5.4.0
```

## 常见问题

### Q: 如何添加新的依赖？

```bash
# 添加到 requirements.txt
echo "new-package>=1.0.0" >> requirements.txt

# 或添加到 pyproject.toml
# [project]
# dependencies = [
#     ...
#     "new-package>=1.0.0",
# ]
```

### Q: 如何处理配置迁移？

创建迁移脚本：

```python
def migrate_config(old_config: Dict) -> Dict:
    """配置迁移"""
    new_config = old_config.copy()

    # 添加新配置项
    if 'new_feature' not in new_config:
        new_config['new_feature'] = {
            'enabled': False,
            'param': 'default'
        }

    return new_config
```

### Q: 如何处理API兼容性？

使用版本检查：

```python
def check_api_version(version: str) -> bool:
    """检查API版本兼容性"""
    min_version = "1.0.0"
    return version >= min_version
```

## 相关资源

- [项目概述](01-overview.md)
- [架构设计](02-architecture.md)
- [配置指南](03-configuration.md)
- [API文档](05-api-reference.md)
