# coding=utf-8
"""
AI 智能筛选模块

通过 AI 对新闻进行标签分类：
1. 阶段 A：从用户兴趣描述中提取结构化标签
2. 阶段 B：对新闻标题按标签进行批量分类
"""

import hashlib
import logging
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from trendradar.ai.client import AIClient
from trendradar.ai.prompt_loader import load_prompt_template


@dataclass
class AIFilterResult:
    """AI 筛选结果，传给报告和通知模块"""
    tags: List[Dict] = field(default_factory=list)
    # [{"tag": str, "description": str, "count": int, "items": [
    #     {"title": str, "source_id": str, "source_name": str,
    #      "url": str, "mobile_url": str, "rank": int, "ranks": [...],
    #      "first_time": str, "last_time": str, "count": int,
    #      "relevance_score": float, "source_type": str}
    # ]}]
    total_matched: int = 0       # 匹配新闻总数
    total_processed: int = 0     # 处理新闻总数
    success: bool = False
    error: str = ""


class AIFilter:
    """AI 智能筛选器"""

    def __init__(
        self,
        ai_config: Dict[str, Any],
        filter_config: Dict[str, Any],
        get_time_func: Callable,
        debug: bool = False,
    ):
        self.client = AIClient(ai_config)
        self.filter_config = filter_config
        self.batch_size = filter_config.get("BATCH_SIZE", 200)
        self.get_time_func = get_time_func
        self.debug = debug

        # 加载提示词模板
        self.classify_system, self.classify_user = load_prompt_template(
            filter_config.get("PROMPT_FILE", "ai_filter_prompt.txt"),
            config_subdir="ai_filter", label="AI筛选",
        )
        self.extract_system, self.extract_user = load_prompt_template(
            filter_config.get("EXTRACT_PROMPT_FILE", "ai_filter_extract_prompt.txt"),
            config_subdir="ai_filter", label="AI筛选",
        )
        self.update_tags_system, self.update_tags_user = load_prompt_template(
            filter_config.get("UPDATE_TAGS_PROMPT_FILE", "update_tags_prompt.txt"),
            config_subdir="ai_filter", label="AI筛选",
        )

    def compute_interests_hash(self, interests_content: str, filename: str = "ai_interests.txt") -> str:
        """计算兴趣描述的 hash，格式为 filename:md5"""
        # 去除前后空白和注释行，确保内容变化才改变 hash
        lines = []
        for line in interests_content.strip().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                lines.append(line)
        normalized = "\n".join(lines)
        content_hash = hashlib.md5(normalized.encode("utf-8")).hexdigest()
        return f"{filename}:{content_hash}"

    def load_interests_content(self, interests_file: Optional[str] = None) -> Optional[str]:
        """加载兴趣描述文件内容

        解析逻辑：
        - interests_file 为 None：使用默认 config/ai_interests.txt
        - interests_file 有值：仅查 config/custom/ai/{filename}

        注意：调用方（context.py）已完成 config/timeline 的合并决策，
        此处不再二次读取 filter_config，避免语义冲突。
        """
        config_dir = Path(__file__).parent.parent.parent / "config"
        configured_file = interests_file

        if configured_file:
            # 自定义兴趣文件：仅查 custom/ai 目录
            filename = configured_file
            interests_path = config_dir / "custom" / "ai" / filename
            if not interests_path.exists():
                print(f"[AI筛选] 自定义兴趣描述文件不存在: {filename}")
                print(f"[AI筛选]   已查找: {interests_path}")
                return None
        else:
            # 默认兴趣文件：固定使用 config/ai_interests.txt
            filename = "ai_interests.txt"
            interests_path = config_dir / filename
            if not interests_path.exists():
                print(f"[AI筛选] 默认兴趣描述文件不存在: {filename}")
                print(f"[AI筛选]   已查找: {interests_path}")
                return None

        if not interests_path.exists():
            print(f"[AI筛选] 兴趣描述文件不存在: {interests_path}")
            return None

        content = interests_path.read_text(encoding="utf-8").strip()
        if not content:
            print("[AI筛选] 兴趣描述文件为空")
            return None

        return content

    def extract_tags(self, interests_content: str) -> List[Dict]:
        """
        阶段 A：从兴趣描述中提取结构化标签

        Args:
            interests_content: 用户的兴趣描述文本

        Returns:
            [{"tag": str, "description": str}, ...]
        """
        if not self.extract_user:
            print("[AI筛选] 标签提取提示词模板为空")
            return []

        user_prompt = self.extract_user.replace("{interests_content}", interests_content)

        messages = []
        if self.extract_system:
            messages.append({"role": "system", "content": self.extract_system})
        messages.append({"role": "user", "content": user_prompt})

        if self.debug:
            print(f"\n[AI筛选][DEBUG] === 标签提取 Prompt ===")
            for m in messages:
                print(f"[{m['role']}]\n{m['content']}")
            print(f"[AI筛选][DEBUG] === Prompt 结束 ===")

        try:
            response = self.client.chat(messages)

            if self.debug:
                print(f"\n[AI筛选][DEBUG] === 标签提取 AI 原始响应 ===")
                # 尝试格式化 JSON 便于阅读
                self._print_formatted_json(response)
                print(f"[AI筛选][DEBUG] === 响应结束 ===")

            tags = self._parse_tags_response(response)
            print(f"[AI筛选] 提取到 {len(tags)} 个标签")
            for t in tags:
                print(f"   {t['tag']}: {t.get('description', '')}")

            if self.debug:
                json_str = self._extract_json(response)
                if not json_str:
                    print(f"[AI筛选][DEBUG] 无法从响应中提取 JSON")
                else:
                    raw_data = json.loads(json_str)
                    raw_tags = raw_data.get("tags", [])
                    skipped = len(raw_tags) - len(tags)
                    if skipped > 0:
                        print(f"[AI筛选][DEBUG] 原始标签 {len(raw_tags)} 个，有效 {len(tags)} 个，跳过 {skipped} 个（缺少 tag 字段或格式无效）")

            return tags
        except json.JSONDecodeError as e:
            print(f"[AI筛选] 标签提取失败: JSON 解析错误: {e}")
            if self.debug:
                print(f"[AI筛选][DEBUG] 尝试解析的 JSON 内容: {self._extract_json(response) if response else '(空响应)'}")
            return []
        except Exception as e:
            print(f"[AI筛选] 标签提取失败: {type(e).__name__}: {e}")
            return []

    def update_tags(self, old_tags: List[Dict], interests_content: str) -> Optional[Dict]:
        """
        阶段 A'：AI 对比旧标签和新兴趣描述，给出更新方案

        Args:
            old_tags: [{"tag": str, "description": str, "id": int}, ...]
            interests_content: 新的兴趣描述文本

        Returns:
            {"keep": [{"tag": str, "description": str}],
             "add": [{"tag": str, "description": str}],
             "remove": [str],
             "change_ratio": float}
            失败返回 None
        """
        if not self.update_tags_user:
            print("[AI筛选] 标签更新提示词模板为空，回退到重新提取")
            return None

        # 构造旧标签 JSON
        old_tags_json = json.dumps(
            [{"tag": t["tag"], "description": t.get("description", "")} for t in old_tags],
            ensure_ascii=False, indent=2
        )

        user_prompt = self.update_tags_user.replace(
            "{old_tags_json}", old_tags_json
        ).replace(
            "{interests_content}", interests_content
        )

        messages = []
        if self.update_tags_system:
            messages.append({"role": "system", "content": self.update_tags_system})
        messages.append({"role": "user", "content": user_prompt})

        if self.debug:
            print(f"\n[AI筛选][DEBUG] === 标签更新 Prompt ===")
            for m in messages:
                print(f"[{m['role']}]\n{m['content']}")
            print(f"[AI筛选][DEBUG] === Prompt 结束 ===")

        try:
            response = self.client.chat(messages)

            if self.debug:
                print(f"\n[AI筛选][DEBUG] === 标签更新 AI 原始响应 ===")
                self._print_formatted_json(response)
                print(f"[AI筛选][DEBUG] === 响应结束 ===")

            result = self._parse_update_tags_response(response)
            if result is None:
                return None

            keep_count = len(result.get("keep", []))
            add_count = len(result.get("add", []))
            remove_count = len(result.get("remove", []))
            ratio = result.get("change_ratio", 0)
            print(f"[AI筛选] AI 标签更新方案: 保留 {keep_count}, 新增 {add_count}, 移除 {remove_count}, change_ratio={ratio:.2f}")

            return result
        except Exception as e:
            print(f"[AI筛选] 标签更新失败: {type(e).__name__}: {e}")
            return None

    def _parse_update_tags_response(self, response: str) -> Optional[Dict]:
        """解析标签更新的 AI 响应"""
        json_str = self._extract_json(response)
        if not json_str:
            print("[AI筛选] 无法从标签更新响应中提取 JSON")
            return None

        data = json.loads(json_str)

        # 校验必需字段
        keep = data.get("keep", [])
        add = data.get("add", [])
        remove = data.get("remove", [])
        change_ratio = float(data.get("change_ratio", 0))

        # 校验 keep/add 格式
        validated_keep = []
        for t in keep:
            if isinstance(t, dict) and "tag" in t:
                validated_keep.append({
                    "tag": str(t["tag"]).strip(),
                    "description": str(t.get("description", "")).strip(),
                })

        validated_add = []
        for t in add:
            if isinstance(t, dict) and "tag" in t:
                validated_add.append({
                    "tag": str(t["tag"]).strip(),
                    "description": str(t.get("description", "")).strip(),
                })

        validated_remove = [str(r).strip() for r in remove if r]

        # change_ratio 限制在 0~1
        change_ratio = max(0.0, min(1.0, change_ratio))

        return {
            "keep": validated_keep,
            "add": validated_add,
            "remove": validated_remove,
            "change_ratio": change_ratio,
        }

    def _parse_tags_response(self, response: str) -> List[Dict]:
        """解析标签提取的 AI 响应"""
        json_str = self._extract_json(response)
        if not json_str:
            logging.warning("[AI filter] JSON extraction failed in tags response; raw snippet: %.200s", (response or ""))
            return []

        data = json.loads(json_str)
        tags_raw = data.get("tags", [])

        tags = []
        for t in tags_raw:
            if not isinstance(t, dict) or "tag" not in t:
                continue
            tags.append({
                "tag": str(t["tag"]).strip(),
                "description": str(t.get("description", "")).strip(),
            })

        return tags

    def classify_batch(
        self,
        titles: List[Dict],
        tags: List[Dict],
        interests_content: str = "",
    ) -> List[Dict]:
        """
        阶段 B：对一批新闻标题做分类

        Args:
            titles: [{"id": news_item_id, "title": str, "source": str}]
            tags: [{"id": tag_id, "tag": str, "description": str}]
            interests_content: 用户的兴趣描述（含质量过滤要求）

        Returns:
            [{"news_item_id": int, "tag_id": int, "relevance_score": float}, ...]
        """
        if not titles or not tags:
            return []

        if not self.classify_user:
            print("[AI筛选] 分类提示词模板为空")
            return []

        # 构建标签列表文本
        tags_list = "\n".join(
            f"{t['id']}. {t['tag']}: {t.get('description', '')}"
            for t in tags
        )

        # 构建新闻列表文本
        news_list = "\n".join(
            f"{t['id']}. [{t.get('source', '')}] {t['title']}"
            for t in titles
        )

        # 填充模板
        user_prompt = self.classify_user
        user_prompt = user_prompt.replace("{interests_content}", interests_content)
        user_prompt = user_prompt.replace("{tags_list}", tags_list)
        user_prompt = user_prompt.replace("{news_count}", str(len(titles)))
        user_prompt = user_prompt.replace("{news_list}", news_list)

        messages = []
        if self.classify_system:
            messages.append({"role": "system", "content": self.classify_system})
        messages.append({"role": "user", "content": user_prompt})

        if self.debug:
            print(f"\n[AI筛选][DEBUG] === 分类 Prompt (标题数={len(titles)}, 标签={len(tags)}) ===")
            for m in messages:
                role = m['role']
                content = m['content']
                # 截断过长的新闻列表：只显示前5条和后5条
                lines = content.split('\n')
                # 找到新闻列表区域并截断
                if len(lines) > 30:
                    # 显示前15行 + 省略提示 + 后10行
                    head = lines[:15]
                    tail = lines[-10:]
                    omitted = len(lines) - 25
                    truncated = '\n'.join(head) + f'\n... (省略 {omitted} 行) ...\n' + '\n'.join(tail)
                    print(f"[{role}]\n{truncated}")
                else:
                    print(f"[{role}]\n{content}")
            print(f"[AI筛选][DEBUG] === Prompt 结束 (长度: {sum(len(m['content']) for m in messages)} 字符) ===")

        try:
            response = self.client.chat(messages)

            return self._parse_classify_response(response, titles, tags)
        except Exception as e:
            print(f"[AI筛选] 分类请求失败: {type(e).__name__}: {e}")
            return []

    def _parse_classify_response(
        self,
        response: str,
        titles: List[Dict],
        tags: List[Dict],
    ) -> List[Dict]:
        """解析分类的 AI 响应

        支持两种 JSON 格式：
        - 新格式（扁平）: [{"id": 1, "tag_id": 1, "score": 0.9}, ...]
        - 旧格式（嵌套）: [{"id": 1, "tags": [{"tag_id": 1, "score": 0.9}]}, ...]

        每条新闻只保留一个最高分的 tag，杜绝同一条出现在多个标签下。
        """
        json_str = self._extract_json(response)
        if not json_str:
            logging.warning("[AI filter] JSON extraction failed in classify response; raw snippet: %.200s", (response or ""))
            if self.debug:
                print(f"[AI筛选][DEBUG] 无法从分类响应中提取 JSON，原始响应前 500 字符: {(response or '')[:500]}")
            return []

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            if self.debug:
                print(f"[AI筛选][DEBUG] 分类响应 JSON 解析失败: {e}")
                print(f"[AI筛选][DEBUG] 提取的 JSON 文本前 500 字符: {json_str[:500]}")
            return []

        if not isinstance(data, list):
            if self.debug:
                print(f"[AI筛选][DEBUG] 分类响应顶层不是数组，实际类型: {type(data).__name__}")
            return []

        # 构建 id 映射
        title_ids = {t["id"] for t in titles}
        title_map = {t["id"]: t["title"] for t in titles}
        tag_id_set = {t["id"] for t in tags}
        tag_name_map = {t["id"]: t["tag"] for t in tags}

        # 每条新闻只保留一个最高分的 tag
        best_per_news: Dict[int, Dict] = {}  # news_id -> {"tag_id": ..., "score": ...}
        skipped_news_ids = 0
        skipped_tag_ids = 0
        skipped_empty = 0

        for item in data:
            if not isinstance(item, dict):
                continue
            news_id = item.get("id")
            if news_id not in title_ids:
                skipped_news_ids += 1
                continue

            # 收集此条新闻的所有候选 tag
            candidates = []

            if "tag_id" in item:
                # 新格式（扁平）: {"id": 1, "tag_id": 1, "score": 0.9}
                candidates.append({"tag_id": item["tag_id"], "score": item.get("score", 0.5)})
            elif "tags" in item:
                # 旧格式（嵌套）: {"id": 1, "tags": [{"tag_id": 1, "score": 0.9}]}
                matched_tags = item.get("tags", [])
                if isinstance(matched_tags, list):
                    if not matched_tags:
                        skipped_empty += 1
                        continue
                    candidates.extend(matched_tags)

            if not candidates:
                skipped_empty += 1
                continue

            # 取最高分的有效 tag
            best_tag_id = None
            best_score = -1.0

            for tag_match in candidates:
                if not isinstance(tag_match, dict):
                    continue
                tag_id = tag_match.get("tag_id")
                if tag_id not in tag_id_set:
                    skipped_tag_ids += 1
                    continue

                score = tag_match.get("score", 0.5)
                try:
                    score = float(score)
                    score = max(0.0, min(1.0, score))
                except (ValueError, TypeError):
                    score = 0.5

                if score > best_score:
                    best_score = score
                    best_tag_id = tag_id

            if best_tag_id is not None:
                # 如果同一条新闻被多次返回，只保留分数更高的
                existing = best_per_news.get(news_id)
                if existing is None or best_score > existing["relevance_score"]:
                    best_per_news[news_id] = {
                        "news_item_id": news_id,
                        "tag_id": best_tag_id,
                        "relevance_score": best_score,
                    }

        results = list(best_per_news.values())

        if self.debug:
            ai_returned = len(data)
            print(f"[AI筛选][DEBUG] --- 分类解析结果 ---")
            print(f"[AI筛选][DEBUG] AI 返回 {ai_returned} 条, 有效 {len(results)} 条 (每条新闻仅保留最高分 tag)")
            if skipped_empty > 0:
                print(f"[AI筛选][DEBUG] 跳过空 tags: {skipped_empty} 条")
            if skipped_news_ids > 0:
                print(f"[AI筛选][DEBUG] !! 跳过无效 news_id: {skipped_news_ids} 条")
            if skipped_tag_ids > 0:
                print(f"[AI筛选][DEBUG] !! 跳过无效 tag_id: {skipped_tag_ids} 条")

            # 按标签汇总
            tag_summary: Dict[int, List[str]] = {}
            for r in results:
                tid = r["tag_id"]
                if tid not in tag_summary:
                    tag_summary[tid] = []
                tag_summary[tid].append(
                    f"  [{r['news_item_id']}] {title_map.get(r['news_item_id'], '?')[:40]} (score={r['relevance_score']:.2f})"
                )

            for tid, items in tag_summary.items():
                tname = tag_name_map.get(tid, f"tag_{tid}")
                print(f"[AI筛选][DEBUG] 标签「{tname}」匹配 {len(items)} 条:")
                for line in items:
                    print(line)

        return results

    def _extract_json(self, response: str) -> Optional[str]:
        """从 AI 响应中提取 JSON 字符串"""
        if not response or not response.strip():
            return None

        json_str = response.strip()

        if "```json" in json_str:
            parts = json_str.split("```json", 1)
            if len(parts) > 1:
                code_block = parts[1]
                end_idx = code_block.find("```")
                json_str = code_block[:end_idx] if end_idx != -1 else code_block
        elif "```" in json_str:
            parts = json_str.split("```", 2)
            if len(parts) >= 2:
                json_str = parts[1]

        json_str = json_str.strip()
        return json_str if json_str else None

    def _print_formatted_json(self, response: str) -> None:
        """格式化打印 AI 响应中的 JSON，便于 debug 阅读"""
        if not response:
            print("(空响应)")
            return

        json_str = self._extract_json(response)
        if json_str:
            try:
                data = json.loads(json_str)
                if isinstance(data, list):
                    # 数组：每个元素压成一行
                    lines = [json.dumps(item, ensure_ascii=False) for item in data]
                    print("[\n  " + ",\n  ".join(lines) + "\n]")
                else:
                    print(json.dumps(data, ensure_ascii=False, indent=2))
                return
            except json.JSONDecodeError:
                pass

        # JSON 解析失败，直接打印原始响应
        print(response)
