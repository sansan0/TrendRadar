# coding=utf-8
"""
DeepSeek 官方联网搜索与网页正文抓取插件

对接 DeepSeek 官方工具接口：
- 搜索：POST {api_base}/v1/tools/search
- 正文抓取：POST {api_base}/v1/tools/fetch
"""

import email.utils
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

from trendradar.crawler.search.base import (
    BaseSearchProvider,
    FetchedPage,
    SearchProviderError,
)
from trendradar.storage.base import SearchItem

# 匹配常见搜索操作符 token（用于超长截断时优先保留操作符）
_OPERATOR_TOKEN_RE = re.compile(
    r"^(?:-?site:|after:|before:|filetype:|inurl:|intitle:)\S+$",
    re.IGNORECASE,
)

# 可重试的 HTTP 状态码
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# DeepSeek Fetch 接口允许的最大 URL 长度
_MAX_FETCH_URL_LENGTH = 8192


def _clean_site_domain(raw_site: str) -> str:
    """规范化排除站点域名，去除前缀与路径"""
    site = (raw_site or "").strip()
    if not site:
        return ""
    lower = site.lower()
    if lower.startswith("-site:"):
        site = site[6:].strip()
    elif lower.startswith("site:"):
        site = site[5:].strip()
    if "://" in site:
        parsed = urlparse(site)
        site = parsed.hostname or ""
    else:
        site = site.split("/", 1)[0].split("?", 1)[0].strip()
    return site.lower().strip(".")


def _extract_site_name(url: str) -> str:
    """从 URL 提取域名作为来源站点名称兜底（去掉 www. 前缀）"""
    if not url:
        return ""
    try:
        host = (urlparse(url).hostname or "").strip()
        if host.lower().startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def _parse_retry_after(header_value: Optional[str]) -> Optional[float]:
    """解析 HTTP Retry-After 响应头（支持秒数或 HTTP-date 格式）"""
    if not header_value:
        return None
    raw = header_value.strip()
    if not raw:
        return None
    try:
        seconds = float(raw)
        return max(0.0, min(seconds, 120.0))
    except ValueError:
        pass
    try:
        dt = email.utils.parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = (dt - datetime.now(timezone.utc)).total_seconds()
        return max(0.0, min(delta, 120.0))
    except Exception:
        return None


def _extract_error_detail(response: requests.Response) -> str:
    """从错误响应中提取可读的错误详情"""
    try:
        payload = response.json()
        if isinstance(payload, dict):
            err = payload.get("error")
            if isinstance(err, dict):
                msg = err.get("message") or err.get("detail")
                if msg:
                    return str(msg).strip()
            for key in ("message", "detail", "msg"):
                if payload.get(key):
                    return str(payload[key]).strip()
    except Exception:
        pass
    text = (response.text or "").strip()
    if text:
        return text[:160]
    return ""


class DeepSeekSearchProvider(BaseSearchProvider):
    """DeepSeek 官方联网搜索与网页正文抓取插件"""

    name: str = "deepseek"
    max_query_length: int = 128
    supports_fetch: bool = True
    supports_date_operator: bool = True

    def __init__(
        self,
        provider_config: Dict[str, Any],
        timeout: int = 20,
        max_retries: int = 2,
        use_proxy: bool = False,
        proxy_url: str = "",
    ):
        super().__init__(
            provider_config=provider_config,
            timeout=timeout,
            max_retries=max_retries,
            use_proxy=use_proxy,
            proxy_url=proxy_url,
        )
        self.api_key: str = str(self.provider_config.get("api_key", "") or "").strip()
        raw_base = str(self.provider_config.get("api_base", "") or "").strip()
        self.api_base: str = (raw_base or "https://api.deepseek.com").rstrip("/")
        self.localization: str = str(self.provider_config.get("localization", "") or "").strip()
        self.session: requests.Session = self._create_session()

    def _create_session(self) -> requests.Session:
        """创建 HTTP 会话并按需配置代理"""
        session = requests.Session()
        session.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "TrendRadar-WebSearch/1.0",
            }
        )
        if self.use_proxy and self.proxy_url:
            session.proxies = {
                "http": self.proxy_url,
                "https": self.proxy_url,
            }
        return session

    def validate_config(self) -> Tuple[bool, str]:
        """校验 DeepSeek 搜索配置"""
        if not self.api_key:
            return (
                False,
                "未配置 DeepSeek 联网搜索密钥，请在 config.yaml 的 web_search.providers.deepseek.api_key "
                "或环境变量 WEB_SEARCH_API_KEY / DEEPSEEK_API_KEY 中填写",
            )
        if not self.api_base.lower().startswith(("http://", "https://")):
            return (
                False,
                f"DeepSeek 搜索接口地址格式不正确：{self.api_base}，应以 http:// 或 https:// 开头",
            )
        return True, ""

    def _prepare_query(
        self,
        query: str,
        freshness_days: int = 0,
        exclude_sites: Optional[List[str]] = None,
        reference_date: Optional[datetime] = None,
    ) -> str:
        """
        组装符合 DeepSeek 长度限制（1~128 字符）的最终搜索词

        规则：
        1. 若 freshness_days > 0 且未显式写 after:，自动附加 after:YYYY-MM-DD
        2. 若总长度超出 128 字符，优先截断正文并保留操作符，打印提示日志
        3. 若 exclude_sites 非空且未出现在 query 中，按剩余长度尽量附加 -site:域名
        """
        base_query = " ".join((query or "").split()).strip()
        if not base_query:
            raise SearchProviderError("搜索词不能为空，请检查搜索任务配置", status_code=400, retryable=False)

        date_op = ""
        if freshness_days > 0 and "after:" not in base_query.lower():
            ref_dt = reference_date if reference_date is not None else datetime.now()
            cutoff = (ref_dt - timedelta(days=freshness_days)).strftime("%Y-%m-%d")
            date_op = f"after:{cutoff}"

        candidate = f"{base_query} {date_op}".strip() if date_op else base_query

        if len(candidate) <= self.max_query_length:
            assembled = candidate
        else:
            # 超出长度上限：拆分正文与操作符，优先截断正文以保留筛选条件
            tokens = base_query.split()
            existing_ops = [tok for tok in tokens if _OPERATOR_TOKEN_RE.match(tok)]
            text_tokens = [tok for tok in tokens if not _OPERATOR_TOKEN_RE.match(tok)]
            main_text = " ".join(text_tokens)

            all_ops = list(existing_ops)
            if date_op:
                all_ops.append(date_op)
            ops_str = " ".join(all_ops).strip()

            if main_text and ops_str:
                available = self.max_query_length - len(ops_str) - 1
                if available >= 1:
                    trimmed_text = main_text[:available].strip()
                    assembled = f"{trimmed_text} {ops_str}".strip() if trimmed_text else ops_str[: self.max_query_length].strip()
                else:
                    # 操作符本身已过长，退化为直接截断
                    assembled = f"{main_text} {ops_str}".strip()[: self.max_query_length].strip()
            elif main_text:
                assembled = main_text[: self.max_query_length].strip()
            else:
                assembled = ops_str[: self.max_query_length].strip()

            print(
                f"[联网搜索] 搜索词超过 {self.max_query_length} 字限制，"
                f"已自动精简正文并保留筛选条件：{assembled}"
            )

        # 按剩余长度尽量附加排除站点（未附上的站点仍会由本地筛选漏斗兜底过滤）
        if exclude_sites:
            for raw_site in exclude_sites:
                domain = _clean_site_domain(raw_site)
                if not domain:
                    continue
                site_op = f"-site:{domain}"
                if site_op.lower() in assembled.lower():
                    continue
                if len(assembled) + 1 + len(site_op) <= self.max_query_length:
                    assembled = f"{assembled} {site_op}"

        assembled = assembled.strip()[: self.max_query_length].strip()
        if not assembled:
            raise SearchProviderError("处理后的搜索词为空，请检查搜索任务配置", status_code=400, retryable=False)

        return assembled

    def _prepare_ori_question(self, ori_question: Optional[str]) -> str:
        """规范化并按需截断 ori_question 至 1~128 字符"""
        if not ori_question:
            return ""
        cleaned = " ".join(str(ori_question).split()).strip()
        if len(cleaned) > self.max_query_length:
            cleaned = cleaned[: self.max_query_length].strip()
        return cleaned

    def _post_json(self, endpoint: str, payload: Dict[str, Any], action_label: str) -> Dict[str, Any]:
        """
        向 DeepSeek 接口发起 POST JSON 请求，内置指数退避重试与通俗错误提示
        """
        url = f"{self.api_base}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        total_attempts = self.max_retries + 1

        for attempt in range(total_attempts):
            try:
                response = self.session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )
            except requests.Timeout:
                if attempt < self.max_retries:
                    wait_sec = float(2**attempt)
                    print(
                        f"[联网搜索] DeepSeek {action_label}超时（{self.timeout}秒），"
                        f"等待 {wait_sec:.1f} 秒后进行第 {attempt + 1}/{self.max_retries} 次重试..."
                    )
                    time.sleep(wait_sec)
                    continue
                raise SearchProviderError(
                    f"DeepSeek {action_label}请求超时（超过 {self.timeout} 秒），请检查网络连接或适当调大超时时间",
                    status_code=None,
                    retryable=True,
                )
            except requests.ConnectionError as e:
                if attempt < self.max_retries:
                    wait_sec = float(2**attempt)
                    print(
                        f"[联网搜索] 连接 DeepSeek 服务失败，"
                        f"等待 {wait_sec:.1f} 秒后进行第 {attempt + 1}/{self.max_retries} 次重试..."
                    )
                    time.sleep(wait_sec)
                    continue
                raise SearchProviderError(
                    f"无法连接到 DeepSeek 服务（{e}），请检查网络或代理设置",
                    status_code=None,
                    retryable=True,
                )
            except requests.RequestException as e:
                raise SearchProviderError(
                    f"DeepSeek {action_label}网络请求异常：{e}",
                    status_code=None,
                    retryable=False,
                )

            status = response.status_code

            if status == 200:
                try:
                    data = response.json()
                except ValueError as e:
                    raise SearchProviderError(
                        f"DeepSeek 返回的数据格式无法解析：{e}",
                        status_code=status,
                        retryable=False,
                    )
                if not isinstance(data, dict):
                    raise SearchProviderError(
                        "DeepSeek 返回的数据结构异常，请稍后重试",
                        status_code=status,
                        retryable=False,
                    )
                return data

            # 可重试状态码：429 / 500 / 502 / 503 / 504
            if status in _RETRYABLE_STATUS_CODES:
                if attempt < self.max_retries:
                    retry_after = _parse_retry_after(response.headers.get("Retry-After"))
                    wait_sec = retry_after if retry_after is not None else float(2**attempt)
                    reason = "请求过于频繁（限流）" if status == 429 else f"服务暂时不可用（HTTP {status}）"
                    print(
                        f"[联网搜索] DeepSeek {action_label}{reason}，"
                        f"等待 {wait_sec:.1f} 秒后进行第 {attempt + 1}/{self.max_retries} 次重试..."
                    )
                    time.sleep(wait_sec)
                    continue

                if status == 429:
                    raise SearchProviderError(
                        "DeepSeek 搜索请求过于频繁，多次重试后仍被限流，请稍后再试或适当增大请求间隔",
                        status_code=429,
                        retryable=True,
                    )
                raise SearchProviderError(
                    f"DeepSeek 服务暂时异常（HTTP {status}），多次重试后仍失败，请稍后再试",
                    status_code=status,
                    retryable=True,
                )

            # 不可重试的客户端错误，直接给出清晰中文说明
            detail = _extract_error_detail(response)
            detail_suffix = f"（详情：{detail}）" if detail else ""

            if status == 400:
                raise SearchProviderError(
                    f"DeepSeek {action_label}查询格式或参数有误（HTTP 400）{detail_suffix}",
                    status_code=400,
                    retryable=False,
                )
            if status == 401:
                raise SearchProviderError(
                    "DeepSeek API 密钥无效或已过期（HTTP 401），请检查密钥配置",
                    status_code=401,
                    retryable=False,
                )
            if status == 402:
                raise SearchProviderError(
                    "DeepSeek 账户余额不足（HTTP 402），请先充值后再使用联网搜索",
                    status_code=402,
                    retryable=False,
                )
            if status == 403:
                raise SearchProviderError(
                    f"DeepSeek 拒绝了本次访问（HTTP 403），请检查账号权限或网络环境{detail_suffix}",
                    status_code=403,
                    retryable=False,
                )
            if status == 404:
                raise SearchProviderError(
                    f"DeepSeek 接口地址不存在（HTTP 404），请检查 api_base 配置：{self.api_base}",
                    status_code=404,
                    retryable=False,
                )

            raise SearchProviderError(
                f"DeepSeek {action_label}请求失败（HTTP {status}）{detail_suffix}",
                status_code=status,
                retryable=False,
            )

        raise SearchProviderError(
            f"DeepSeek {action_label}多次重试后仍失败",
            status_code=None,
            retryable=True,
        )

    def search(
        self,
        query: str,
        count: int = 10,
        *,
        topic_id: str = "",
        topic_name: str = "",
        ori_question: Optional[str] = None,
        freshness_days: int = 0,
        need_content: bool = False,
        exclude_sites: Optional[List[str]] = None,
        reference_date: Optional[datetime] = None,
    ) -> List[SearchItem]:
        """调用 DeepSeek 搜索接口并返回标准 SearchItem 列表"""
        valid, err_msg = self.validate_config()
        if not valid:
            raise SearchProviderError(err_msg, status_code=None, retryable=False)

        prepared_query = self._prepare_query(
            query=query,
            freshness_days=freshness_days,
            exclude_sites=exclude_sites,
            reference_date=reference_date,
        )

        payload: Dict[str, Any] = {
            "query": prepared_query,
            "count": max(1, min(50, int(count))),
            "need_content": bool(need_content),
        }

        prepared_ori = self._prepare_ori_question(ori_question)
        if prepared_ori:
            payload["ori_question"] = prepared_ori

        if self.localization:
            payload["localization"] = self.localization

        data = self._post_json("/v1/tools/search", payload, action_label="搜索")
        raw_results = data.get("results") or []
        if not isinstance(raw_results, list):
            return []

        items: List[SearchItem] = []
        for entry in raw_results:
            if not isinstance(entry, dict):
                continue

            url = str(entry.get("url") or "").strip()
            title = str(entry.get("title") or "").strip()
            if not title and not url:
                continue
            if not title:
                title = url

            raw_score_val = entry.get("rerank_score")
            try:
                raw_score = float(raw_score_val or 0.0)
            except (TypeError, ValueError):
                raw_score = 0.0
            score = round(min(1.0, max(0.0, raw_score / 3.0)), 4)

            authority_val = entry.get("authority")
            if authority_val is not None:
                try:
                    authority = int(authority_val)
                except (TypeError, ValueError):
                    authority = -1
            else:
                authority = -1

            site_name = str(entry.get("site_name") or "").strip()
            if not site_name:
                site_name = _extract_site_name(url)

            items.append(
                SearchItem(
                    title=title,
                    topic_id=topic_id,
                    topic_name=topic_name,
                    url=url,
                    query=prepared_query,
                    provider=self.name,
                    snippet=str(entry.get("snippet") or "").strip(),
                    summary=str(entry.get("summary") or "").strip(),
                    content=str(entry.get("content") or "").strip(),
                    site_name=site_name,
                    site_icon=str(entry.get("site_icon") or "").strip(),
                    published_at=str(entry.get("date") or "").strip(),
                    score=score,
                    raw_score=raw_score,
                    authority=authority,
                )
            )

        return items

    def fetch(self, url: str) -> FetchedPage:
        """调用 DeepSeek 网页正文抓取接口"""
        valid, err_msg = self.validate_config()
        if not valid:
            raise SearchProviderError(err_msg, status_code=None, retryable=False)

        cleaned_url = (url or "").strip()
        if (
            not cleaned_url
            or not cleaned_url.lower().startswith(("http://", "https://"))
            or len(cleaned_url) > _MAX_FETCH_URL_LENGTH
        ):
            raise SearchProviderError(
                f"网页链接无效：必须以 http:// 或 https:// 开头，且长度不超过 {_MAX_FETCH_URL_LENGTH} 个字符",
                status_code=400,
                retryable=False,
            )

        data = self._post_json("/v1/tools/fetch", {"url": cleaned_url}, action_label="抓取网页正文")
        return FetchedPage(
            url=cleaned_url,
            title=str(data.get("title") or "").strip(),
            content=str(data.get("content") or ""),
            provider=self.name,
        )
