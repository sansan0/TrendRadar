# coding=utf-8
"""
联网搜索智能查询改写模块（smart 模式）

当用户输入较长的自然语言需求时，借助 AI 将其提炼为 1~3 条精准的搜索引擎短词，
并按天写入 SQLite 缓存，避免当天重复调用 AI 消耗额度。
"""

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

# 延迟导入 AIClient，避免在 direct 模式下提前加载 LiteLLM；同时保留模块级符号方便测试替换
AIClient: Any = None

# 明显的搜索操作符特征（短句中包含这些操作符时说明用户已手动写好搜索语法，无需改写）
_SEARCH_OPERATOR_RE = re.compile(
    r"(?:^|\s)(?:-?site:|after:|before:|filetype:|inurl:|intitle:)\S+",
    re.IGNORECASE,
)

# 自然语言提示特征词
_NATURAL_LANGUAGE_HINTS = (
    "帮我",
    "请",
    "查找",
    "搜索",
    "关注",
    "告诉我",
    "总结",
    "相关",
    "什么",
    "哪些",
    "想知道",
    "了解一下",
    "有没有",
    "追踪",
    "整理",
    "？",
    "?",
    "。",
    "how to",
    "find me",
    "search for",
    "tell me",
    "what are",
    "what is",
    "please ",
    "look up",
    "summarize",
)

_REWRITE_SYSTEM_PROMPT = """你是一名专业的搜索引擎查询词优化助手。
你的任务是将用户的一段自然语言搜索需求，提炼为 1~3 条简洁、精准、适合现代搜索引擎的查询语句。

要求：
1. 每条查询语句尽量控制在 100 个字符以内，用空格分隔核心关键词，去掉口语化客套词（如“帮我”“请”“查找”等）。
2. 如果用户原文里已经带有 site:、-site:、after: 等搜索操作符，请在相关查询语句中尽量保留。
3. 同时提炼一句简明扼要的 ori_question（不超过 100 字），准确概括用户的核心搜索意图。
4. 严格只输出 JSON 对象，不要包含任何额外说明文字，格式如下：
{"ori_question": "精炼后的核心问题", "queries": ["精准搜索词1", "精准搜索词2"]}"""


class SearchQueryRewriter:
    """智能搜索词改写器（用于 web_search.query_mode == "smart"）"""

    def __init__(
        self,
        ai_config: Optional[Dict[str, Any]] = None,
        storage_manager: Any = None,
    ):
        """
        初始化查询改写器

        Args:
            ai_config: AI 模型配置字典（config["AI"]）
            storage_manager: 存储管理器实例（提供 get_search_query_cache / save_search_query_cache）
        """
        self.ai_config: Dict[str, Any] = dict(ai_config or {})
        self.storage_manager: Any = storage_manager
        self._client: Optional[AIClient] = None

    @staticmethod
    def should_rewrite(query: str, max_query_length: int = 128) -> bool:
        """
        判断一条搜索输入是否需要调用 AI 进行改写

        规则：
        - 超过引擎允许的最大长度（默认 128 字符）：必须改写
        - 长度 <= 60 且包含明显搜索操作符（如 site:）：无需改写
        - 长度 > 25 且包含自然语言提示特征（如“帮我”“请”“查找”“how to”等）：需要改写
        """
        text = " ".join((query or "").split()).strip()
        if not text:
            return False

        if len(text) > max_query_length:
            return True

        if len(text) <= 60 and _SEARCH_OPERATOR_RE.search(text):
            return False

        if len(text) > 25:
            lower_text = text.lower()
            for hint in _NATURAL_LANGUAGE_HINTS:
                if hint in lower_text:
                    return True

        return False

    def _get_ai_client(self) -> Optional[Any]:
        """按需创建并校验 AI 客户端"""
        if not self.ai_config:
            return None
        if self._client is None:
            client_cls = AIClient
            if client_cls is None:
                from trendradar.ai.client import AIClient as _AIClient

                client_cls = _AIClient
            self._client = client_cls(self.ai_config)
        return self._client

    @staticmethod
    def _parse_rewrite_json(raw_text: str, max_query_length: int) -> Tuple[List[str], str]:
        """从 AI 回复文本中提取并校验改写结果 JSON"""
        cleaned = (raw_text or "").strip()
        # 去除推理模型可能输出的思考标签
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE).strip()

        # 优先提取 Markdown 代码块中的 JSON
        fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, flags=re.DOTALL | re.IGNORECASE)
        if fence_match:
            json_str = fence_match.group(1)
        else:
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}")
            if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
                raise ValueError("AI 回复中未找到有效的 JSON 内容")
            json_str = cleaned[start_idx : end_idx + 1]

        data = json.loads(json_str)
        if not isinstance(data, dict):
            raise ValueError("AI 返回的 JSON 不是对象格式")

        raw_queries = data.get("queries")
        if not isinstance(raw_queries, list):
            raise ValueError("AI 返回的 JSON 缺少 queries 列表")

        query_limit = min(100, max(1, max_query_length))
        queries: List[str] = []
        for q in raw_queries:
            if not isinstance(q, str):
                continue
            normalized = " ".join(q.split()).strip()
            if not normalized:
                continue
            if len(normalized) > query_limit:
                normalized = normalized[:query_limit].strip()
            if normalized and normalized not in queries:
                queries.append(normalized)
            if len(queries) >= 3:
                break

        if not queries:
            raise ValueError("AI 提炼后的搜索词列表为空")

        ori_question = str(data.get("ori_question") or "").strip()
        ori_question = " ".join(ori_question.split()).strip()[:max_query_length].strip()

        return queries, ori_question

    def rewrite(
        self,
        text: str,
        date_str: str,
        max_query_length: int = 128,
    ) -> Tuple[List[str], str]:
        """
        将自然语言搜索需求提炼为 1~3 条精准搜索词（带按日缓存和优雅回退）

        Args:
            text: 用户原始输入
            date_str: 当天日期字符串（YYYY-MM-DD，用于按日缓存隔离）
            max_query_length: 目标搜索引擎允许的单条最大长度

        Returns:
            (提炼后的搜索词列表, 提炼后的原始意图 ori_question)
        """
        cleaned = " ".join((text or "").split()).strip()
        if not cleaned:
            return [], ""

        fallback_query = cleaned[:max_query_length].strip()
        prompt_hash = hashlib.sha256(f"{date_str}|{cleaned}".encode("utf-8")).hexdigest()[:16]

        # 1. 优先读取当日缓存
        if self.storage_manager is not None and hasattr(self.storage_manager, "get_search_query_cache"):
            try:
                cached = self.storage_manager.get_search_query_cache(prompt_hash, date_str)
                if isinstance(cached, dict):
                    cached_queries = cached.get("queries") or []
                    if isinstance(cached_queries, list):
                        valid_queries = []
                        for item in cached_queries:
                            q = " ".join(str(item).split()).strip()[:max_query_length].strip()
                            if q and q not in valid_queries:
                                valid_queries.append(q)
                        if valid_queries:
                            cached_ori = (
                                " ".join(str(cached.get("ori_question") or "").split()).strip()[:max_query_length].strip()
                                or fallback_query
                            )
                            print(f"[联网搜索] 已复用今日搜索词提炼缓存，共 {len(valid_queries)} 条搜索词")
                            return valid_queries[:3], cached_ori
            except Exception as e:
                print(f"[联网搜索] 读取搜索词提炼缓存失败，将继续尝试提炼：{e}")

        # 2. 检查 AI 配置是否可用
        client = self._get_ai_client()
        if client is None:
            print("[联网搜索] 未配置 AI 模型，跳过智能搜索词提炼，已直接使用原始搜索词")
            return [fallback_query], fallback_query

        valid, err_msg = client.validate_config()
        if not valid:
            print(f"[联网搜索] AI 配置未就绪（{err_msg}），跳过智能搜索词提炼，已直接使用原始搜索词")
            return [fallback_query], fallback_query

        # 3. 调用 AI 提炼精准搜索词
        try:
            messages = [
                {"role": "system", "content": _REWRITE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"今天日期：{date_str}\n用户搜索需求：{cleaned}",
                },
            ]
            chat_kwargs: Dict[str, Any] = {}
            configured_max_tokens = self.ai_config.get("MAX_TOKENS", 5000)
            if isinstance(configured_max_tokens, int) and configured_max_tokens > 0:
                chat_kwargs["max_tokens"] = min(configured_max_tokens, 800)

            raw_response = client.chat(messages, **chat_kwargs)
            queries, ori_question = self._parse_rewrite_json(raw_response, max_query_length)
            ori_question = ori_question or fallback_query

            print(f"[联网搜索] 已将长句提炼为 {len(queries)} 条精准搜索词：{queries}")

            # 4. 写入当日缓存
            if self.storage_manager is not None and hasattr(self.storage_manager, "save_search_query_cache"):
                try:
                    self.storage_manager.save_search_query_cache(
                        prompt_hash=prompt_hash,
                        original_text=cleaned,
                        rewritten_queries=queries,
                        ori_question=ori_question,
                        date=date_str,
                    )
                except Exception as e:
                    print(f"[联网搜索] 保存搜索词提炼缓存失败（不影响本次搜索）：{e}")

            return queries, ori_question

        except Exception as e:
            print(f"[联网搜索] 智能提炼搜索词失败（{e}），已自动回退为原始搜索词")
            return [fallback_query], fallback_query
