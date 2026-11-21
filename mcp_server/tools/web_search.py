"""
实时联网搜索工具

提供按需实时调用搜索引擎（默认 DeepSeek Search）查询全网最新信息的能力。
运行时加载配置，导入时不产生任何网络请求。
"""

import contextlib
import inspect
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
import yaml

from ..utils.errors import ConfigurationError, InvalidParameterError, MCPError
from ..utils.validators import (
    _parse_string_to_bool,
    _parse_string_to_float,
    _parse_string_to_int,
)


def _read_dotenv_fallback(project_root: Path) -> Dict[str, str]:
    """轻量读取项目根目录 .env 文件（仅作环境变量未设置时的只读回退）"""
    env_map: Dict[str, str] = {}
    env_path = project_root / ".env"
    if not env_path.is_file():
        return env_map
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]
                if key:
                    env_map[key] = val
    except OSError:
        pass
    return env_map


def _get_field(item: Any, *keys: str, default: Any = "") -> Any:
    """兼容 dict 与 dataclass/对象属性读取"""
    for key in keys:
        if isinstance(item, dict):
            val = item.get(key)
        else:
            val = getattr(item, key, None)
        if val is not None:
            return val
    return default


def _normalize_search_item(
    item: Any,
    default_provider: str = "deepseek",
    need_content: bool = False,
) -> Dict[str, Any]:
    """将不同搜索 Provider 返回的条目统一为标准字典结构"""
    raw_score_val = _get_field(item, "raw_score", "rawScore", "rerank_score", default=0.0)
    score_val = _get_field(item, "score", default=None)
    try:
        raw_score = float(raw_score_val or 0.0)
    except (TypeError, ValueError):
        raw_score = 0.0

    if score_val is None:
        # DeepSeek 原始 rerank_score 范围为 0~3，统一归一化到 0~1
        if default_provider == "deepseek" or raw_score > 1.0:
            score = round(min(max(raw_score / 3.0, 0.0), 1.0), 4)
        else:
            score = round(max(raw_score, 0.0), 4)
    else:
        try:
            score = float(score_val)
        except (TypeError, ValueError):
            score = 0.0

    authority_val = _get_field(item, "authority", "site_authority", default=-1)
    try:
        authority = int(authority_val) if authority_val is not None else -1
    except (TypeError, ValueError):
        authority = -1

    result: Dict[str, Any] = {
        "title": str(_get_field(item, "title", default="") or "").strip(),
        "url": str(_get_field(item, "url", "link", default="") or "").strip(),
        "site_name": str(_get_field(item, "site_name", "siteName", "source", default="") or "").strip(),
        "published_at": str(_get_field(item, "published_at", "publishedAt", "publish_time", "date", default="") or "").strip(),
        "score": score,
        "raw_score": raw_score,
        "authority": authority,
        "snippet": str(_get_field(item, "snippet", "description", default="") or "").strip(),
        "summary": str(_get_field(item, "summary", "snippet", default="") or "").strip(),
    }

    if need_content:
        result["content"] = str(_get_field(item, "content", "markdown", default="") or "")

    return result


class WebSearchTools:
    """实时联网搜索工具类"""

    def __init__(self, project_root: Optional[str] = None):
        """
        初始化实时联网搜索工具

        Args:
            project_root: 项目根目录
        """
        if project_root:
            self.project_root = Path(project_root)
        else:
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent

    def _load_web_search_config(self, provider_override: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
        """
        运行时加载联网搜索配置（config/config.yaml + 环境变量 + .env 回退）

        注意：不调用会向 stdout 打印日志的 load_config()，避免污染 MCP stdio 通道。
        """
        from trendradar.core.loader import _load_ai_config, _load_web_search_config

        config_path = self.project_root / "config" / "config.yaml"
        config_data: Dict[str, Any] = {}
        if config_path.is_file():
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f) or {}

        ai_cfg = _load_ai_config(config_data)
        ws_cfg = _load_web_search_config(config_data, ai_config=ai_cfg)

        selected_provider = (
            provider_override.strip().lower()
            if provider_override and provider_override.strip()
            else str(ws_cfg.get("PROVIDER", "deepseek") or "deepseek").strip().lower()
        )
        ws_cfg["PROVIDER"] = selected_provider

        providers = dict(ws_cfg.get("PROVIDERS") or {})
        provider_cfg = dict(providers.get(selected_provider, {}))

        # 环境变量 / .env 只读回退，兼容 WEB_SEARCH_API_KEY / DEEPSEEK_API_KEY / AI_API_KEY
        dotenv_values = _read_dotenv_fallback(self.project_root)

        def _env_or_dotenv(name: str) -> str:
            return os.environ.get(name, "").strip() or dotenv_values.get(name, "").strip()

        api_key = str(provider_cfg.get("api_key", "") or "").strip()
        if not api_key:
            api_key = _env_or_dotenv("WEB_SEARCH_API_KEY")
        if not api_key and selected_provider == "deepseek":
            api_key = _env_or_dotenv("DEEPSEEK_API_KEY")
        if not api_key and selected_provider == "deepseek":
            ai_model = str(ai_cfg.get("MODEL", "") or "").lower()
            ai_key = str(ai_cfg.get("API_KEY", "") or "").strip() or _env_or_dotenv("AI_API_KEY")
            if ai_key and (not ai_model or "deepseek" in ai_model):
                api_key = ai_key

        if api_key:
            provider_cfg["api_key"] = api_key

        if selected_provider == "deepseek" and not provider_cfg.get("api_base"):
            provider_cfg["api_base"] = _env_or_dotenv("WEB_SEARCH_API_BASE") or "https://api.deepseek.com"
        elif not provider_cfg.get("api_base"):
            env_base = _env_or_dotenv("WEB_SEARCH_API_BASE")
            if env_base:
                provider_cfg["api_base"] = env_base

        providers[selected_provider] = provider_cfg
        ws_cfg["PROVIDERS"] = providers

        return ws_cfg, selected_provider

    def _create_provider(self, ws_cfg: Dict[str, Any], selected_provider: str):
        """使用 trendradar.crawler.search.providers 创建搜索引擎实例"""
        from trendradar.crawler.search.providers import create_search_provider_from_config

        sig = inspect.signature(create_search_provider_from_config)
        params = sig.parameters
        kwargs: Dict[str, Any] = {}
        if "provider_name" in params:
            kwargs["provider_name"] = selected_provider
        elif "provider" in params:
            kwargs["provider"] = selected_provider

        try:
            return create_search_provider_from_config(ws_cfg, **kwargs)
        except KeyError as exc:
            if "WEB_SEARCH" in str(exc):
                return create_search_provider_from_config({"WEB_SEARCH": ws_cfg}, **kwargs)
            raise

    def _call_provider_search(
        self,
        search_provider: Any,
        query: str,
        count: int,
        freshness_days: int,
        need_content: bool,
    ) -> List[Any]:
        """兼容不同 Provider.search 方法签名并提取结果列表"""
        search_fn = getattr(search_provider, "search", None)
        if not callable(search_fn):
            raise ConfigurationError("搜索引擎实例缺少 search 方法")

        sig = inspect.signature(search_fn)
        params = sig.parameters
        has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())

        kwargs: Dict[str, Any] = {}
        if "count" in params or has_var_kw:
            kwargs["count"] = count
        elif "limit" in params:
            kwargs["limit"] = count
        elif "max_results" in params:
            kwargs["max_results"] = count

        if "freshness_days" in params or has_var_kw:
            kwargs["freshness_days"] = freshness_days
        elif "freshness" in params:
            kwargs["freshness"] = freshness_days

        if "need_content" in params or has_var_kw:
            kwargs["need_content"] = need_content
        elif "include_content" in params:
            kwargs["include_content"] = need_content

        raw_result = search_fn(query, **kwargs)
        if raw_result is None:
            return []
        if isinstance(raw_result, list):
            return raw_result
        if isinstance(raw_result, dict):
            for key in ("items", "results", "data", "pages"):
                if isinstance(raw_result.get(key), list):
                    return raw_result[key]
            return []
        for attr in ("items", "results", "data", "pages"):
            val = getattr(raw_result, attr, None)
            if isinstance(val, list):
                return val
        return []

    def _fallback_deepseek_search(
        self,
        ws_cfg: Dict[str, Any],
        query: str,
        count: int,
        freshness_days: int,
        need_content: bool,
    ) -> List[Dict[str, Any]]:
        """当搜索 Provider 模块不可用时的 DeepSeek HTTP 回退实现"""
        ds_cfg = (ws_cfg.get("PROVIDERS") or {}).get("deepseek", {})
        api_key = str(ds_cfg.get("api_key", "") or "").strip()
        api_base = str(ds_cfg.get("api_base", "") or "https://api.deepseek.com").rstrip("/")
        timeout = int(ws_cfg.get("TIMEOUT", 20) or 20)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        effective_query = query
        if freshness_days > 0 and "after:" not in effective_query.lower():
            from datetime import datetime, timedelta
            after_date = (datetime.now() - timedelta(days=freshness_days)).strftime("%Y-%m-%d")
            suffix = f" after:{after_date}"
            if len(effective_query) + len(suffix) <= 128:
                effective_query = f"{effective_query}{suffix}"
        if len(effective_query) > 128:
            effective_query = effective_query[:128].strip()

        payload: Dict[str, Any] = {
            "query": effective_query,
            "count": count,
            "need_content": need_content,
        }
        localization = str(ds_cfg.get("localization", "") or "").strip()
        if localization:
            payload["localization"] = localization

        proxies = None
        if ws_cfg.get("USE_PROXY") and ws_cfg.get("PROXY_URL"):
            proxy_url = str(ws_cfg["PROXY_URL"]).strip()
            proxies = {"http": proxy_url, "https": proxy_url}

        resp = requests.post(
            f"{api_base}/v1/tools/search",
            headers=headers,
            json=payload,
            timeout=timeout,
            proxies=proxies,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"DeepSeek Search API 返回 HTTP {resp.status_code}: {resp.text[:200]}")

        body = resp.json()
        if isinstance(body, list):
            return body
        if isinstance(body, dict):
            for key in ("results", "items", "pages", "data"):
                val = body.get(key)
                if isinstance(val, list):
                    return val
                if isinstance(val, dict):
                    for sub_key in ("results", "items", "pages"):
                        if isinstance(val.get(sub_key), list):
                            return val[sub_key]
        return []

    def live_web_search(
        self,
        query: str,
        count: int = 10,
        freshness_days: int = 7,
        min_score: float = 0.0,
        min_authority: int = -1,
        need_content: bool = False,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        实时调用搜索引擎检索全网最新信息

        Args:
            query: 搜索关键词或问题（必需）
            count: 返回条数上限，范围 1~50，默认 10
            freshness_days: 仅检索最近 N 天发布的内容（0 表示不限时间），范围 0~365，默认 7
            min_score: 最低归一化质量分（0.0~1.0），默认 0.0（不过滤）
            min_authority: 最低来源权威度（-1~4，-1 表示不限制），默认 -1
            need_content: 是否附带网页正文 Markdown，默认 False
            provider: 指定搜索引擎名称（如 "deepseek"），留空使用配置默认值

        Returns:
            结构化搜索结果字典
        """
        try:
            # 1. 参数校验与安全裁剪
            if not query or not isinstance(query, str) or not query.strip():
                raise InvalidParameterError(
                    "搜索词 query 不能为空",
                    suggestion="请提供具体的搜索关键词或问题，例如 'DeepSeek 最新模型'",
                )
            query = query.strip()
            if len(query) > 500:
                raise InvalidParameterError(
                    "搜索词 query 长度不能超过 500 个字符",
                    suggestion="请精简搜索关键词后重试",
                )

            if isinstance(count, str):
                count = _parse_string_to_int(count, "count")
            count = min(max(int(count), 1), 50)

            if isinstance(freshness_days, str):
                freshness_days = _parse_string_to_int(freshness_days, "freshness_days")
            freshness_days = min(max(int(freshness_days), 0), 365)

            if isinstance(min_score, str):
                min_score = _parse_string_to_float(min_score, "min_score")
            min_score = min(max(float(min_score), 0.0), 1.0)

            if isinstance(min_authority, str):
                min_authority = _parse_string_to_int(min_authority, "min_authority")
            min_authority = min(max(int(min_authority), -1), 4)

            if isinstance(need_content, str):
                need_content = _parse_string_to_bool(need_content)
            need_content = bool(need_content)

            if provider is not None and not isinstance(provider, str):
                raise InvalidParameterError(
                    "provider 参数必须是字符串类型",
                    suggestion="例如 provider='deepseek'，或留空使用默认搜索引擎",
                )

            # 2. 运行时加载配置
            ws_cfg, selected_provider = self._load_web_search_config(provider_override=provider)
            provider_cfg = (ws_cfg.get("PROVIDERS") or {}).get(selected_provider, {})
            api_key = str(provider_cfg.get("api_key", "") or "").strip()

            if not api_key:
                return {
                    "success": False,
                    "error": {
                        "code": "API_KEY_MISSING",
                        "message": f"未配置搜索引擎 '{selected_provider}' 的 API Key",
                        "suggestion": (
                            "请在 .env 或环境变量中设置 WEB_SEARCH_API_KEY"
                            "（使用 DeepSeek 时也可设置 DEEPSEEK_API_KEY 或复用 AI_API_KEY），"
                            "或在 config/config.yaml 的 web_search.providers 中填写 api_key"
                        ),
                    },
                }

            # 3. 执行实时搜索（优先使用 trendradar.crawler.search.providers）
            # 当启用了质量/权威度过滤时，适当多拉候选再裁剪，避免有效条数不足
            fetch_count = count
            if min_score > 0.0 or min_authority >= 0:
                fetch_count = min(max(count * 2, 20), 50)

            try:
                search_provider = self._create_provider(ws_cfg, selected_provider)
                with contextlib.redirect_stdout(sys.stderr):
                    raw_items = self._call_provider_search(
                        search_provider=search_provider,
                        query=query,
                        count=fetch_count,
                        freshness_days=freshness_days,
                        need_content=need_content,
                    )
            except ImportError:
                if selected_provider == "deepseek":
                    raw_items = self._fallback_deepseek_search(
                        ws_cfg=ws_cfg,
                        query=query,
                        count=fetch_count,
                        freshness_days=freshness_days,
                        need_content=need_content,
                    )
                else:
                    raise ConfigurationError(
                        f"无法加载搜索引擎 '{selected_provider}'（未找到 trendradar.crawler.search.providers 模块）",
                        suggestion="请检查 TrendRadar 联网搜索模块是否完整安装，或使用默认 provider='deepseek'",
                    )

            # 4. 标准化并按 min_score / min_authority 过滤
            normalized_items: List[Dict[str, Any]] = []
            seen_urls = set()
            for raw in raw_items:
                item = _normalize_search_item(
                    raw,
                    default_provider=selected_provider,
                    need_content=need_content,
                )
                url = item["url"]
                if url and url in seen_urls:
                    continue
                if item["score"] < min_score:
                    continue
                if min_authority >= 0 and item["authority"] < min_authority:
                    continue
                if url:
                    seen_urls.add(url)
                normalized_items.append(item)

            # 按质量分、发布时间降序排序并截断至 count
            normalized_items.sort(
                key=lambda x: (x["score"], x["published_at"]),
                reverse=True,
            )
            final_items = normalized_items[:count]

            return {
                "success": True,
                "summary": {
                    "description": f"实时联网搜索结果（引擎: {selected_provider}）",
                    "query": query,
                    "provider": selected_provider,
                    "total": len(final_items),
                    "returned": len(final_items),
                    "raw_count": len(raw_items),
                    "freshness_days": freshness_days,
                    "min_score": min_score,
                    "min_authority": min_authority,
                    "need_content": need_content,
                },
                "data": final_items,
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict(),
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "SEARCH_ERROR",
                    "message": str(e),
                    "suggestion": "请检查网络连通性、API Key 配置或稍后重试",
                },
            }
