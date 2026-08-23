# coding=utf-8
"""
数据获取器模块

负责从 NewsNow API 抓取新闻数据，支持：
- 单个平台数据获取
- 批量平台数据爬取
- 自动重试机制
- 代理支持
"""

import json
import random
import time
from typing import Dict, List, Tuple, Optional, Union
from urllib.parse import urlparse

import requests


class DataFetcher:
    """数据获取器"""

    # 默认 API 地址（newsnow 项目: https://github.com/ourongxing/newsnow）
    DEFAULT_API_URL = "https://newsnow.busiyi.world/api/s"

    # 默认请求头
    DEFAULT_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    }

    def __init__(
        self,
        proxy_url: Optional[str] = None,
        api_url: Optional[str] = None,
    ):
        """
        初始化数据获取器

        Args:
            proxy_url: 代理服务器 URL（可选）
            api_url: API 基础 URL（可选，默认使用 DEFAULT_API_URL）
        """
        self.proxy_url = proxy_url
        self.api_url = api_url or self.DEFAULT_API_URL

    @staticmethod
    def _check_domain_safety(
        items: List[Dict],
        expected_domain: str,
    ) -> Optional[str]:
        """
        校验返回数据中的链接是否为 HTTPS 且域名匹配预期（支持子域名）

        同时校验 url 与 mobileUrl 两个字段，使用标准库解析主机名，
        避免 userinfo（如 https://baidu.com@evil.com）绕过校验。

        Args:
            items: API 返回的数据项列表
            expected_domain: 预期域名（如 "baidu.com"）

        Returns:
            None 表示安全，否则返回第一个异常描述
        """
        expected = expected_domain.lower().strip()
        if not expected:
            return None

        for item in items:
            for field in ("url", "mobileUrl"):
                url = item.get(field, "")
                if not url:
                    continue
                parsed = urlparse(url)
                if parsed.scheme != "https":
                    return f"{url} (非 HTTPS 或格式异常)"
                hostname = (parsed.hostname or "").lower()
                if hostname != expected and not hostname.endswith("." + expected):
                    return f"{hostname} (来自 {url})"
        return None

    def fetch_data(
        self,
        id_info: Union[str, Tuple[str, str]],
        max_retries: int = 2,
        min_retry_wait: int = 3,
        max_retry_wait: int = 5,
    ) -> Tuple[Optional[str], str, str]:
        """
        获取指定ID数据，支持重试

        Args:
            id_info: 平台ID 或 (平台ID, 别名) 元组
            max_retries: 最大重试次数
            min_retry_wait: 最小重试等待时间（秒）
            max_retry_wait: 最大重试等待时间（秒）

        Returns:
            (响应文本, 平台ID, 别名) 元组，失败时响应文本为 None
        """
        if isinstance(id_info, tuple):
            id_value, alias = id_info
        else:
            id_value = id_info
            alias = id_value

        url = f"{self.api_url}?id={id_value}&latest"

        proxies = None
        if self.proxy_url:
            proxies = {"http": self.proxy_url, "https": self.proxy_url}

        retries = 0
        while retries <= max_retries:
            try:
                response = requests.get(
                    url,
                    proxies=proxies,
                    headers=self.DEFAULT_HEADERS,
                    timeout=10,
                )
                response.raise_for_status()

                data_text = response.text
                data_json = json.loads(data_text)

                status = data_json.get("status", "未知")
                if status not in ["success", "cache"]:
                    raise ValueError(f"响应状态异常: {status}")

                status_info = "最新数据" if status == "success" else "缓存数据"
                print(f"获取 {id_value} 成功（{status_info}）")
                return data_text, id_value, alias

            except Exception as e:
                retries += 1
                if retries <= max_retries:
                    base_wait = random.uniform(min_retry_wait, max_retry_wait)
                    additional_wait = (retries - 1) * random.uniform(1, 2)
                    wait_time = base_wait + additional_wait
                    print(f"请求 {id_value} 失败: {e}. {wait_time:.2f}秒后重试...")
                    time.sleep(wait_time)
                else:
                    print(f"请求 {id_value} 失败: {e}")
                    return None, id_value, alias

        return None, id_value, alias

    def crawl_websites(
        self,
        ids_list: List[Union[str, Tuple[str, str]]],
        request_interval: int = 100,
        domain_rules: Optional[Dict[str, str]] = None,
    ) -> Tuple[Dict, Dict, List]:
        """
        爬取多个网站数据

        Args:
            ids_list: 平台ID列表，每个元素可以是字符串或 (平台ID, 别名) 元组
            request_interval: 请求间隔（毫秒）
            domain_rules: 域名安全校验规则，格式 {平台ID: 预期域名}（可选）

        Returns:
            (结果字典, ID到名称的映射, 失败ID列表) 元组
        """
        results = {}
        id_to_name = {}
        failed_ids = []
        domain_rules = domain_rules or {}

        for i, id_info in enumerate(ids_list):
            if isinstance(id_info, tuple):
                id_value, name = id_info
            else:
                id_value = id_info
                name = id_value

            id_to_name[id_value] = name
            response, _, _ = self.fetch_data(id_info)

            if response:
                try:
                    data = json.loads(response)
                    items = data.get("items", [])

                    # 域名安全校验
                    expected_domain = domain_rules.get(id_value, "")
                    if expected_domain:
                        bad_reason = self._check_domain_safety(items, expected_domain)
                        if bad_reason:
                            print(f"⚠️ 安全警告: {name}({id_value}) 返回数据未通过域名安全校验！")
                            print(f"   预期域名: https://*.{expected_domain}")
                            print(f"   异常来源: {bad_reason}")
                            print(f"   当前 API 地址: {self.api_url}")
                            print(f"   该平台数据已丢弃，请检查 API 来源是否可信")
                            failed_ids.append(id_value)
                            continue

                    results[id_value] = {}

                    for index, item in enumerate(items, 1):
                        title = item.get("title")
                        # 跳过无效标题（None、float、空字符串）
                        if title is None or isinstance(title, float) or not str(title).strip():
                            continue
                        title = str(title).strip()
                        url = item.get("url", "")
                        mobile_url = item.get("mobileUrl", "")

                        # 抓取摘要/描述（extra.hover，部分平台如知乎/百度提供正文描述）
                        extra = item.get("extra")
                        hover = ""
                        if isinstance(extra, dict):
                            hover = (extra.get("hover") or "").strip()

                        if title in results[id_value]:
                            results[id_value][title]["ranks"].append(index)
                            # 已有记录若缺少 hover 则补充
                            if hover and not results[id_value][title].get("hover"):
                                results[id_value][title]["hover"] = hover
                        else:
                            results[id_value][title] = {
                                "ranks": [index],
                                "url": url,
                                "mobileUrl": mobile_url,
                                "hover": hover,
                            }
                except json.JSONDecodeError:
                    print(f"解析 {id_value} 响应失败")
                    failed_ids.append(id_value)
                except Exception as e:
                    print(f"处理 {id_value} 数据出错: {e}")
                    failed_ids.append(id_value)
            else:
                failed_ids.append(id_value)

            # 请求间隔（除了最后一个）
            if i < len(ids_list) - 1:
                actual_interval = request_interval + random.randint(-10, 20)
                actual_interval = max(50, actual_interval)
                time.sleep(actual_interval / 1000)

        print(f"成功: {list(results.keys())}, 失败: {failed_ids}")
        return results, id_to_name, failed_ids
