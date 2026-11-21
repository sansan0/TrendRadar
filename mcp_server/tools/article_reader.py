"""
文章内容读取工具

支持 DeepSeek Fetch API 与 Jina AI Reader API 双引擎，将 URL 转换为 LLM 友好的 Markdown 格式。
支持单篇和批量读取，支持自动优先 DeepSeek Fetch 并在失败时回退 Jina Reader，内置速率限制。
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
import yaml

from ..utils.errors import MCPError, InvalidParameterError


# Jina Reader 配置
JINA_READER_BASE = "https://r.jina.ai"
DEEPSEEK_API_BASE_DEFAULT = "https://api.deepseek.com"
DEFAULT_TIMEOUT = 30  # 秒
MAX_BATCH_SIZE = 5  # 单次批量最大篇数
BATCH_INTERVAL = 5.0  # Jina 批量请求间隔（秒）
VALID_PROVIDERS = ("auto", "deepseek", "jina")


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


class ArticleReaderTools:
    """文章内容读取工具类"""

    def __init__(self, project_root: str = None, jina_api_key: str = None):
        """
        初始化文章读取工具

        Args:
            project_root: 项目根目录
            jina_api_key: Jina API Key（可选，有 Key 可提升速率限制）
        """
        if project_root:
            self.project_root = Path(project_root)
        else:
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent
        self.jina_api_key = jina_api_key
        self._last_request_time = 0.0

    def _build_headers(self) -> Dict[str, str]:
        """构建 Jina Reader 请求头"""
        headers = {
            "Accept": "text/markdown",
            "X-Return-Format": "markdown",
            "X-No-Cache": "true",
        }
        if self.jina_api_key:
            headers["Authorization"] = f"Bearer {self.jina_api_key}"
        return headers

    def _throttle(self):
        """Jina Reader 速率控制：确保请求间隔 5 秒"""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < BATCH_INTERVAL:
            time.sleep(BATCH_INTERVAL - elapsed)
        self._last_request_time = time.time()

    def _get_deepseek_config(self) -> Tuple[str, str, Optional[Dict[str, str]]]:
        """
        从项目配置、环境变量和 .env 中解析 DeepSeek API Key、api_base 及代理配置

        Returns:
            (api_key, api_base, proxies)
        """
        config_data: Dict[str, Any] = {}
        config_path = self.project_root / "config" / "config.yaml"
        if config_path.is_file():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config_data = yaml.safe_load(f) or {}
            except Exception:
                config_data = {}

        dotenv_values = _read_dotenv_fallback(self.project_root)

        def _env_or_dotenv(name: str) -> str:
            return os.environ.get(name, "").strip() or dotenv_values.get(name, "").strip()

        api_key = ""
        api_base = ""
        proxies: Optional[Dict[str, str]] = None

        try:
            from trendradar.core.loader import _load_ai_config, _load_web_search_config

            ai_cfg = _load_ai_config(config_data)
            ws_cfg = _load_web_search_config(config_data, ai_config=ai_cfg)
            ds_cfg = (ws_cfg.get("PROVIDERS") or {}).get("deepseek", {})
            api_key = str(ds_cfg.get("api_key", "") or "").strip()
            api_base = str(ds_cfg.get("api_base", "") or "").strip()
            if ws_cfg.get("USE_PROXY") and ws_cfg.get("PROXY_URL"):
                proxy_url = str(ws_cfg["PROXY_URL"]).strip()
                proxies = {"http": proxy_url, "https": proxy_url}
        except Exception:
            ws = config_data.get("web_search", {}) or {}
            ds_cfg = ((ws.get("providers") or {}).get("deepseek") or {})
            api_key = str(ds_cfg.get("api_key", "") or "").strip()
            api_base = str(ds_cfg.get("api_base", "") or "").strip()

        if not api_key:
            api_key = (
                _env_or_dotenv("WEB_SEARCH_API_KEY")
                or _env_or_dotenv("DEEPSEEK_API_KEY")
            )
        if not api_key:
            ai_section = config_data.get("ai", {}) or {}
            ai_model = str(_env_or_dotenv("AI_MODEL") or ai_section.get("model", "") or "").lower()
            ai_key = _env_or_dotenv("AI_API_KEY") or str(ai_section.get("api_key", "") or "").strip()
            if ai_key and (not ai_model or "deepseek" in ai_model):
                api_key = ai_key

        if not api_base:
            api_base = _env_or_dotenv("WEB_SEARCH_API_BASE") or DEEPSEEK_API_BASE_DEFAULT

        return api_key, api_base.rstrip("/"), proxies

    def _read_via_deepseek(self, url: str, timeout: int) -> Dict:
        """
        通过 DeepSeek Fetch API 读取网页内容（Markdown 格式）

        Args:
            url: 文章链接
            timeout: 请求超时时间（秒）

        Returns:
            文章内容字典
        """
        api_key, api_base, proxies = self._get_deepseek_config()
        if not api_key:
            return {
                "success": False,
                "error": {
                    "code": "API_KEY_MISSING",
                    "message": "未配置 DeepSeek API Key，无法使用 DeepSeek Fetch 抓取网页",
                    "url": url,
                    "provider": "deepseek",
                    "suggestion": (
                        "请在 .env 或环境变量中设置 WEB_SEARCH_API_KEY / DEEPSEEK_API_KEY / AI_API_KEY，"
                        "或在 config/config.yaml 的 web_search.providers.deepseek.api_key 中填写；"
                        "也可改用 provider='jina' 使用免费的 Jina Reader"
                    ),
                },
            }

        try:
            response = requests.post(
                f"{api_base}/v1/tools/fetch",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={"url": url},
                timeout=timeout,
                proxies=proxies,
            )

            if response.status_code == 200:
                title = ""
                content = ""
                resolved_url = url
                try:
                    payload = response.json()
                    if isinstance(payload, dict):
                        body = payload
                        for nested_key in ("data", "result"):
                            if isinstance(payload.get(nested_key), dict):
                                body = payload[nested_key]
                                break
                        resolved_url = str(body.get("url") or payload.get("url") or url)
                        title = str(body.get("title") or payload.get("title") or "")
                        content = (
                            body.get("content")
                            or body.get("markdown")
                            or body.get("text")
                            or payload.get("content")
                            or payload.get("markdown")
                            or ""
                        )
                    elif isinstance(payload, str):
                        content = payload
                except ValueError:
                    content = response.text

                if not isinstance(content, str):
                    content = str(content) if content is not None else ""

                if not content.strip():
                    return {
                        "success": False,
                        "error": {
                            "code": "EMPTY_CONTENT",
                            "message": "DeepSeek Fetch 返回的网页正文为空",
                            "url": url,
                            "provider": "deepseek",
                            "suggestion": "该页面可能需要登录或受反爬保护，可尝试 provider='jina'",
                        },
                    }

                return {
                    "success": True,
                    "data": {
                        "url": resolved_url,
                        "title": title,
                        "content": content,
                        "format": "markdown",
                        "provider": "deepseek",
                        "content_length": len(content),
                    },
                }
            elif response.status_code == 402:
                return {
                    "success": False,
                    "error": {
                        "code": "INSUFFICIENT_BALANCE",
                        "message": "DeepSeek 账户余额不足 (HTTP 402)，无法使用 DeepSeek Fetch",
                        "url": url,
                        "provider": "deepseek",
                        "suggestion": "请先充值 DeepSeek 账户余额，或改用 provider='jina' 使用免费的 Jina Reader",
                    },
                }
            elif response.status_code in (401, 403):
                return {
                    "success": False,
                    "error": {
                        "code": "AUTH_FAILED",
                        "message": f"DeepSeek Fetch 鉴权失败 (HTTP {response.status_code})",
                        "url": url,
                        "provider": "deepseek",
                        "suggestion": "请检查 DeepSeek API Key 是否有效或余额是否充足，也可改用 provider='jina'",
                    },
                }
            elif response.status_code == 429:
                return {
                    "success": False,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "DeepSeek Fetch 触发速率限制，请稍后重试",
                        "url": url,
                        "provider": "deepseek",
                        "suggestion": "请稍后重试，或使用 provider='jina'",
                    },
                }
            else:
                return {
                    "success": False,
                    "error": {
                        "code": "FETCH_FAILED",
                        "message": f"DeepSeek Fetch 返回 HTTP {response.status_code}: {response.reason}",
                        "url": url,
                        "provider": "deepseek",
                    },
                }

        except requests.Timeout:
            return {
                "success": False,
                "error": {
                    "code": "TIMEOUT",
                    "message": f"DeepSeek Fetch 请求超时（{timeout}秒）",
                    "url": url,
                    "provider": "deepseek",
                    "suggestion": "可尝试增加 timeout 参数，或改用 provider='jina'",
                },
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "REQUEST_ERROR",
                    "message": f"DeepSeek Fetch 请求失败: {e}",
                    "url": url,
                    "provider": "deepseek",
                },
            }

    def _read_via_jina(self, url: str, timeout: int) -> Dict:
        """
        通过 Jina Reader 读取单篇文章内容（Markdown 格式）

        Args:
            url: 文章链接
            timeout: 请求超时时间（秒）

        Returns:
            文章内容字典
        """
        try:
            self._throttle()

            response = requests.get(
                f"{JINA_READER_BASE}/{url}",
                headers=self._build_headers(),
                timeout=timeout
            )

            if response.status_code == 200:
                return {
                    "success": True,
                    "data": {
                        "url": url,
                        "content": response.text,
                        "format": "markdown",
                        "provider": "jina",
                        "content_length": len(response.text)
                    }
                }
            elif response.status_code == 429:
                return {
                    "success": False,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Jina Reader 速率限制，请稍后重试",
                        "provider": "jina",
                        "suggestion": "免费限制: 100 RPM / 2 并发，可配置 API Key 提升限额，或使用 provider='deepseek'"
                    }
                }
            else:
                return {
                    "success": False,
                    "error": {
                        "code": "FETCH_FAILED",
                        "message": f"HTTP {response.status_code}: {response.reason}",
                        "url": url,
                        "provider": "jina",
                    }
                }

        except requests.Timeout:
            return {
                "success": False,
                "error": {
                    "code": "TIMEOUT",
                    "message": f"请求超时（{timeout}秒）",
                    "url": url,
                    "provider": "jina",
                    "suggestion": "可尝试增加 timeout 参数"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "REQUEST_ERROR",
                    "message": str(e),
                    "url": url,
                    "provider": "jina",
                }
            }

    @staticmethod
    def _validate_provider(provider: Optional[str]) -> str:
        """校验抓取引擎参数"""
        normalized = (provider or "auto").strip().lower()
        if normalized not in VALID_PROVIDERS:
            raise InvalidParameterError(
                f"不支持的抓取引擎: {provider}",
                suggestion=f"可选值: {', '.join(VALID_PROVIDERS)}（auto=自动优先 DeepSeek，失败回退 Jina）",
            )
        return normalized

    def read_article(
        self,
        url: str,
        timeout: int = DEFAULT_TIMEOUT,
        provider: str = "auto",
    ) -> Dict:
        """
        读取单篇文章内容（Markdown 格式）

        Args:
            url: 文章链接
            timeout: 请求超时时间（秒），默认 30
            provider: 抓取引擎，可选 "auto"（默认）、"deepseek"、"jina"
                - "auto": 已配置 DeepSeek Key 时优先 DeepSeek Fetch，失败自动回退 Jina Reader；
                          未配置 Key 时直接使用 Jina Reader
                - "deepseek": 强制使用 DeepSeek Fetch
                - "jina": 强制使用 Jina Reader

        Returns:
            文章内容字典
        """
        try:
            if not url or not url.startswith(("http://", "https://")):
                raise InvalidParameterError(
                    f"无效的 URL: {url}",
                    suggestion="URL 必须以 http:// 或 https:// 开头"
                )

            selected_provider = self._validate_provider(provider)

            if selected_provider == "deepseek":
                return self._read_via_deepseek(url=url, timeout=timeout)

            if selected_provider == "jina":
                return self._read_via_jina(url=url, timeout=timeout)

            # provider == "auto": 有 DeepSeek Key 优先 DeepSeek，失败回退 Jina
            api_key, _, _ = self._get_deepseek_config()
            if api_key:
                ds_result = self._read_via_deepseek(url=url, timeout=timeout)
                if ds_result.get("success"):
                    return ds_result

                jina_result = self._read_via_jina(url=url, timeout=timeout)
                if jina_result.get("success"):
                    jina_result["data"]["fallback_from"] = "deepseek"
                    return jina_result

                # 两者均失败时补充 DeepSeek 失败信息
                ds_err = (ds_result.get("error") or {}).get("message", "")
                if ds_err and isinstance(jina_result.get("error"), dict):
                    jina_result["error"]["deepseek_error"] = ds_err
                return jina_result

            return self._read_via_jina(url=url, timeout=timeout)

        except MCPError as e:
            return {"success": False, "error": e.to_dict()}
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "REQUEST_ERROR",
                    "message": str(e),
                    "url": url
                }
            }

    def read_articles_batch(
        self,
        urls: List[str],
        timeout: int = DEFAULT_TIMEOUT,
        provider: str = "auto",
    ) -> Dict:
        """
        批量读取多篇文章内容（最多 5 篇）

        Args:
            urls: 文章链接列表
            timeout: 每篇的请求超时时间（秒）
            provider: 抓取引擎，可选 "auto"（默认）、"deepseek"、"jina"

        Returns:
            批量读取结果
        """
        try:
            if not urls:
                raise InvalidParameterError(
                    "URL 列表不能为空",
                    suggestion="请提供至少一个 URL"
                )

            selected_provider = self._validate_provider(provider)

            # 限制最多 5 篇
            actual_urls = urls[:MAX_BATCH_SIZE]
            skipped = len(urls) - len(actual_urls)

            results = []
            succeeded = 0
            failed = 0

            for i, url in enumerate(actual_urls):
                result = self.read_article(
                    url=url,
                    timeout=timeout,
                    provider=selected_provider,
                )

                results.append({
                    "index": i + 1,
                    "url": url,
                    "success": result["success"],
                    "data": result.get("data"),
                    "error": result.get("error")
                })

                if result["success"]:
                    succeeded += 1
                else:
                    failed += 1

            return {
                "success": True,
                "summary": {
                    "description": "批量文章读取结果",
                    "provider": selected_provider,
                    "requested": len(urls),
                    "processed": len(actual_urls),
                    "succeeded": succeeded,
                    "failed": failed,
                    "skipped": skipped,
                    "interval_seconds": BATCH_INTERVAL,
                },
                "articles": results,
                "note": f"已跳过 {skipped} 篇（单次上限 {MAX_BATCH_SIZE} 篇）" if skipped > 0 else None
            }

        except MCPError as e:
            return {"success": False, "error": e.to_dict()}
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "BATCH_ERROR",
                    "message": str(e)
                }
            }
