import json
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float = 8.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def is_available(self) -> bool:
        try:
            self._request("GET", "/api/tags", None)
            return True
        except Exception:
            return False

    def judge_similarity(self, title_a: str, title_b: str) -> Optional[Dict[str, Any]]:
        prompt = (
            "判断以下两个标题是否描述同一新闻事件，只返回JSON对象，"
            "字段为same(布尔)和confidence(0到1的小数)。"
            f"\n标题A：{title_a}\n标题B：{title_b}"
        )
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
