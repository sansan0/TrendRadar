from loguru import logger

import json
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float = 8.0, prompt_file: Optional[str] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._prompt_file = prompt_file
        self._system_prompt = None
        self._user_prompt = None
        self._load_prompt_file()

    def _load_prompt_file(self) -> None:
        """Load and parse prompt file, store in instance variables."""
        if not self._prompt_file:
            return
        
        try:
            with open(self._prompt_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Parse [system] and [user] sections
            system_prompt = ""
            user_prompt = ""
            
            if "[system]" in content and "[user]" in content:
                parts = content.split("[user]")
                system_part = parts[0]
                user_part = parts[1] if len(parts) > 1 else ""
                
                # Extract system content
                if "[system]" in system_part:
                    system_prompt = system_part.split("[system]")[1].strip()
                
                user_prompt = user_part.strip()
            else:
                # Entire file as user prompt
                user_prompt = content.strip()
            
            self._system_prompt = system_prompt
            self._user_prompt = user_prompt
            logger.debug(f"Loaded prompt file: {self._prompt_file}")
                
        except FileNotFoundError:
            logger.warning(f"Prompt file {self._prompt_file} not found, using embedded default")
            self._use_default_prompt()
        except Exception as e:
            logger.warning(f"Failed to load prompt file {self._prompt_file}: {e}, using embedded default")
            self._use_default_prompt()
    
    def _use_default_prompt(self) -> None:
        """Use embedded default prompt as fallback."""
        self._system_prompt = """你是一位专业的新闻分析师，擅长识别相似新闻事件。你的任务是判断两个新闻标题是否描述同一新闻事件。

## 判断原则

### 1. 核心事件一致性
- 两个标题必须描述**同一个具体事件**，才能判定为"相同"
- 事件识别优先级：具体事件 > 话题主题 > 关键词匹配
- 关注事件的**核心要素**：时间、地点、人物、对象、行为

### 2. 细节层级差异
- 如果标题A是标题B的**扩展/详细版**（包含更多背景、解释、影响分析等），判定为"相同"
  - 示例A：美国将暂停办理俄罗斯等75个国家的所有签证，将带来哪些影响？（知乎）
  - 示例B：美国将暂停对75个国家的所有签证（华尔街见闻/今日头条）
  - 判断：相同事件（A是B的详细分析版）
- 如果标题涉及不同方面或分支事件，判定为"不同"
  - 示例：同一事件的后续报道 vs 最初报道（如：政策颁布 vs 政策实施）
  - 判断：不同事件（时间线不同）

### 3. 时间维度
- 两个标题的事件**发生时间**应当相近（同一新闻周期）
- 超过24小时的差异判定为"不同"（除非是明确的后续报道）
- 相近时间（1小时内）提高"相同"判断的概率

### 4. 来源可信度
- 考虑不同来源的报道角度差异
- 官方通报 vs 舆论评论（角度差异≠不同事件）
- 多平台交叉验证（同一事件在多个平台出现）

### 5. 标题关键词分析
- 提取两个标题的核心关键词
- 关键词重叠率≥70% + 时间相近 → 倾向判定为"相同"
- 关键词完全不同（重叠率≤30%） → 判定为"不同"
- 中间情况（30%-70%）综合其他因素判断

## 特殊情况处理

### 1. 问号结尾的疑问型标题
- 如果标题A是疑问型（如"...，将带来哪些影响？"）
- 标题B是事实陈述型（如"..."）
- 其他因素（时间、主题、对象）一致 → 判定为"相同"
- 判断逻辑：疑问型 = 事实陈述型 + 分析/影响评估

### 2. 数字范围表示
- "75个国家" vs "俄罗斯等国家" → 判定为"相同"（模糊表达 vs 具体数字）
- 不同数字（如75 vs 80）→ 判定为"不同"（除非明确是统计范围）

### 3. 标点符号差异
- 问号、冒号、逗号等标点不影响事件一致性
- 内容实质相同，标点不同 → 仍判定为"相同"

## 输出格式要求

必须返回纯JSON格式，无其他文字：
```json
{
  "same": true/false,
  "confidence": 0.0-1.0
}
```

- `same`: 布尔值，true表示相同事件，false表示不同事件
- `confidence`: 置信度，表示判断的置信度（0.0-1.0）
  - 0.9-1.0: 高置信度（事件特征明显匹配）
  - 0.7-0.9: 中等置信度（大部分因素匹配，但存在不确定性）
  - 0.5-0.7: 低置信度（关键因素模糊或冲突）"""
        self._user_prompt = """判断以下两个新闻标题是否描述同一新闻事件：

标题A（{source_a}，出现{count_a}次）：{title_a}
标题B（{source_b}，出现{count_b}次）：{title_b}

时间信息：
- 标题A：{time_a}
- 标题B：{time_b}

请返回JSON格式的判断结果，包含字段：same（布尔）和confidence（0到1的置信度）。"""
        logger.debug(f"Using embedded default prompt")
    
    def _substitute_variables(self, template: str, **kwargs) -> str:
        """Substitute variables in template using .replace() method."""
        result = template
        for key, value in kwargs.items():
            placeholder = f"{{{key}}}"
            result = result.replace(placeholder, str(value))
        return result
    
    def _build_judgment_prompt(self, title_a: str, title_b: str, **kwargs) -> str:
        """Build complete prompt with system and user sections."""
        if self._system_prompt and self._user_prompt:
            # Substitute variables in user prompt
            user_prompt = self._substitute_variables(
                self._user_prompt,
                title_a=title_a,
                title_b=title_b,
                **kwargs
            )
            return f"{self._system_prompt}\n\n{user_prompt}"
        else:
            # Fallback to hardcoded prompt
            prompt = (
                "判断以下两个标题是否描述同一新闻事件，只返回JSON对象，"
                "字段为same(布尔)和confidence(0到1的小数)。"
                f"\n标题A：{title_a}\n标题B：{title_b}"
            )
            return prompt

    def judge_similarity(self, title_a: str, title_b: str, **kwargs) -> Optional[Dict[str, Any]]:
        """Judge if two news titles describe the same event.
        
        Accepts optional keyword arguments for rich context:
        - source_a: str - Source platform of title A
        - source_b: str - Source platform of title B
        - time_a: str - Time display for title A
        - time_b: str - Time display for title B
        - count_a: str - Appearance count for title A
        - count_b: str - Appearance count for title B
        
        Returns: JSON dict with "same" (bool) and "confidence" (float)
        """
        # Build complete prompt with variables
        prompt = self._build_judgment_prompt(title_a, title_b, **kwargs)
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        try:
            data = self._request("POST", "/api/generate", payload)
        except Exception:
            return None
            
        response_text = ""
        if isinstance(data, dict):
            response_text = data.get("response") or ""
        result = self._parse_json(response_text)
        if isinstance(result, dict) and "same" in result:
            return result
        if isinstance(data, dict) and "message" in data:
            content = data["message"].get("content", "")
            result = self._parse_json(content)
            if isinstance(result, dict) and "same" in result:
                return result
        return None

    def _request(
        self, method: str, path: str, payload: Optional[Dict[str, Any]]
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            body = resp.read().decode("utf-8")
        if not body:
            return {}
        return json.loads(body)

    def _parse_json(self, text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    def is_available(self) -> bool:
        try:
            self._request("GET", "/api/tags", None)
            return True
        except Exception:
            return False
