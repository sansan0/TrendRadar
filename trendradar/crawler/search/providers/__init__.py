# coding=utf-8
"""
联网搜索引擎插件注册中心与工厂方法

提供搜索引擎注册、查询与按配置实例化的统一入口，
默认内置 DeepSeek 搜索引擎，并支持后续扩展其他搜索服务。
"""

from typing import Any, Dict, List, Optional, Type

from trendradar.crawler.search.base import BaseSearchProvider, SearchProviderError
from trendradar.crawler.search.providers.deepseek import DeepSeekSearchProvider

_PROVIDER_REGISTRY: Dict[str, Type[BaseSearchProvider]] = {
    "deepseek": DeepSeekSearchProvider,
}


def register_provider(name: str, cls: Type[BaseSearchProvider]) -> None:
    """
    注册新的联网搜索引擎插件

    Args:
        name: 引擎名称（不区分大小写）
        cls: 继承自 BaseSearchProvider 的插件类
    """
    key = (name or "").strip().lower()
    if not key:
        raise ValueError("搜索引擎名称不能为空")
    if not isinstance(cls, type) or not issubclass(cls, BaseSearchProvider):
        raise TypeError("搜索引擎插件类必须继承自 BaseSearchProvider")
    _PROVIDER_REGISTRY[key] = cls


def list_providers() -> List[str]:
    """返回当前已注册的所有搜索引擎名称列表"""
    return sorted(_PROVIDER_REGISTRY.keys())


def create_provider(
    name: str,
    provider_config: Optional[Dict[str, Any]] = None,
    **kwargs: Any,
) -> BaseSearchProvider:
    """
    按引擎名称创建搜索引擎实例

    Args:
        name: 引擎名称（如 "deepseek"）
        provider_config: 该引擎的专属配置字典
        **kwargs: 透传给引擎构造函数的通用参数（timeout、max_retries、use_proxy、proxy_url 等）

    Returns:
        BaseSearchProvider 实例
    """
    key = (name or "").strip().lower()
    provider_cls = _PROVIDER_REGISTRY.get(key)
    if provider_cls is None:
        available = ", ".join(list_providers()) or "无"
        raise SearchProviderError(
            f"不支持的搜索引擎 '{name}'，当前可用的搜索引擎有：{available}",
            status_code=None,
            retryable=False,
        )
    return provider_cls(provider_config=provider_config or {}, **kwargs)


def _cfg_get(cfg: Dict[str, Any], upper_key: str, default: Any = None) -> Any:
    """兼容读取大写（loader 规范化后）与小写（原始 YAML）配置键"""
    if upper_key in cfg:
        return cfg[upper_key]
    lower_key = upper_key.lower()
    if lower_key in cfg:
        return cfg[lower_key]
    return default


def create_search_provider_from_config(
    web_search_config: Dict[str, Any],
    provider_name: Optional[str] = None,
) -> BaseSearchProvider:
    """
    从完整的 web_search 配置字典创建搜索引擎实例

    Args:
        web_search_config: config["WEB_SEARCH"] 或原始 web_search 配置字典
        provider_name: 指定要创建的引擎名称（为空时使用配置中的默认 provider）

    Returns:
        BaseSearchProvider 实例
    """
    cfg = web_search_config or {}
    resolved_name = (
        (provider_name or "").strip().lower()
        or str(_cfg_get(cfg, "PROVIDER", "deepseek") or "deepseek").strip().lower()
    )

    providers_map = _cfg_get(cfg, "PROVIDERS", {}) or {}
    provider_cfg: Dict[str, Any] = {}
    if isinstance(providers_map, dict):
        if resolved_name in providers_map and isinstance(providers_map[resolved_name], dict):
            provider_cfg = dict(providers_map[resolved_name])
        else:
            for k, v in providers_map.items():
                if str(k).strip().lower() == resolved_name and isinstance(v, dict):
                    provider_cfg = dict(v)
                    break

    timeout = int(_cfg_get(cfg, "TIMEOUT", 20) or 20)
    max_retries = int(_cfg_get(cfg, "MAX_RETRIES", 2) if _cfg_get(cfg, "MAX_RETRIES", 2) is not None else 2)
    use_proxy = bool(_cfg_get(cfg, "USE_PROXY", False))
    proxy_url = str(_cfg_get(cfg, "PROXY_URL", "") or "")

    return create_provider(
        resolved_name,
        provider_config=provider_cfg,
        timeout=timeout,
        max_retries=max_retries,
        use_proxy=use_proxy,
        proxy_url=proxy_url,
    )


__all__ = [
    "DeepSeekSearchProvider",
    "register_provider",
    "list_providers",
    "create_provider",
    "create_search_provider_from_config",
]
