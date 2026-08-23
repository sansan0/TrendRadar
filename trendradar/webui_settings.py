# coding=utf-8
"""Web 控制面板的持久化设置（覆盖 config.yaml / 环境变量）。

overlay 保存在 output/.webui.json，键说明：
- schedule_preset / schedule_enabled / ai_analysis_enabled: 调度与 AI 开关
- frequency_words: 主题词配置全文（覆盖 config/frequency_words.txt）
- rss: {"enabled": bool, "feeds": [...]} 覆盖 config.yaml 的 rss.feeds
- ai: {"model": str, "api_key": str, "api_base": str} 覆盖 ai 模型配置（优先级高于环境变量）
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

OVERLAY_FILENAME = ".webui.json"

PRESETS = (
    {"id": "off", "label": "关闭调度", "description": "每次定时任务都抓取；是否分析由 AI 开关决定"},
    {"id": "always_on", "label": "全天监控", "description": "全天候采集，有新增就推送，默认定时不跑 AI"},
    {"id": "morning_evening", "label": "早晚汇总", "description": "全天推送当前热点，晚间做一次当日汇总分析"},
    {"id": "office_hours", "label": "办公时间", "description": "工作日到岗 / 午间 / 收工三段式"},
    {"id": "night_owl", "label": "夜猫子", "description": "午后速览 + 深夜全天汇总"},
)

KNOWN_PRESETS = {item["id"] for item in PRESETS}

# RSS 订阅源允许的键
_FEED_KEYS = {"id", "name", "url", "enabled", "max_age_days"}

# 推理强度可选值（空串 = 不发送）
REASONING_EFFORTS = {"", "minimal", "low", "medium", "high"}

_RE_FEED_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


def slugify_feed_id(source: Any) -> str:
    """把名称/URL 转成合法的 feed id；无法提取时返回空串。"""
    text = str(source or "").strip()
    if not text:
        return ""
    # URL 来源时取主机名（去掉 www. 前缀与 TLD 后缀）
    host_match = re.match(r"^https?://([^/:]+)", text, re.IGNORECASE)
    if host_match:
        text = host_match.group(1)
        if text.lower().startswith("www."):
            text = text[4:]
        labels = text.split(".")
        if len(labels) > 1:
            text = "-".join(labels[:-1]) or text
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _validate_feeds(feeds: Any) -> List[Dict[str, Any]]:
    """校验并归一化 RSS 订阅源列表，返回可写入 overlay 的列表。"""
    if not isinstance(feeds, list):
        raise ValueError("feeds 必须是列表")
    normalized: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, feed in enumerate(feeds, start=1):
        if not isinstance(feed, dict):
            raise ValueError(f"第 {index} 个订阅源必须是对象")
        unknown = set(feed.keys()) - _FEED_KEYS
        if unknown:
            raise ValueError(f"第 {index} 个订阅源含未知字段: {', '.join(sorted(unknown))}")

        url = str(feed.get("url") or "").strip()
        if not url.startswith(("http://", "https://")):
            raise ValueError(f"第 {index} 个订阅源的 url 必须以 http:// 或 https:// 开头")

        feed_id = str(feed.get("id") or "").strip()
        if not feed_id:
            # 名称无法转 slug（如纯中文）时退回 URL 主机名；再冲突则追加序号
            base = (
                slugify_feed_id(feed.get("name"))
                or slugify_feed_id(feed.get("url"))
                or "feed"
            )
            feed_id = base
            suffix = 2
            while feed_id in seen_ids:
                feed_id = f"{base}-{suffix}"
                suffix += 1
        if not _RE_FEED_ID.match(feed_id):
            raise ValueError(f"第 {index} 个订阅源 id 含非法字符（仅限字母数字、下划线、连字符）")
        if feed_id in seen_ids:
            raise ValueError(f"订阅源 id 重复: {feed_id}")
        seen_ids.add(feed_id)

        name = str(feed.get("name") or "").strip() or feed_id

        raw_max_age = feed.get("max_age_days")
        if raw_max_age in (None, ""):
            max_age_days = None
        else:
            try:
                max_age_days = int(raw_max_age)
            except (TypeError, ValueError):
                raise ValueError(f"第 {index} 个订阅源 max_age_days 必须是整数")
            if max_age_days < 0:
                raise ValueError(f"第 {index} 个订阅源 max_age_days 不能为负数")

        normalized.append(
            {
                "id": feed_id,
                "name": name,
                "url": url,
                "enabled": bool(feed.get("enabled", True)),
                **({"max_age_days": max_age_days} if max_age_days is not None else {}),
            }
        )
    return normalized


def validate_frequency_words(content: Any) -> str:
    """校验主题词配置文本，返回规整后的字符串。"""
    if not isinstance(content, str):
        raise ValueError("主题词内容必须是文本")
    if "\x00" in content:
        raise ValueError("主题词内容含有非法字符")
    return content


def mask_secret(value: Any) -> Optional[str]:
    """脱敏展示密钥，仅保留首尾少量字符。"""
    text = str(value or "")
    if not text:
        return None
    if len(text) <= 8:
        return "***"
    return f"{text[:3]}***{text[-4:]}"


def _validate_ai_override(ai: Any) -> Dict[str, Any]:
    """校验 AI 模型配置覆盖项（model / api_key / api_base / reasoning_effort）。"""
    if not isinstance(ai, dict):
        raise ValueError("ai 必须是对象")
    unknown = set(ai.keys()) - {"model", "api_key", "api_base", "reasoning_effort"}
    if unknown:
        raise ValueError(f"ai 含未知字段: {', '.join(sorted(unknown))}")

    model = str(ai.get("model") or "").strip()
    if not model:
        raise ValueError("model 不能为空")

    result: Dict[str, Any] = {"model": model}

    if ai.get("api_key") is not None:
        api_key = str(ai["api_key"]).strip()
        if not api_key:
            raise ValueError("api_key 不能为空（保持不变请直接省略该字段）")
        result["api_key"] = api_key

    api_base = str(ai.get("api_base") or "").strip()
    if api_base and not api_base.startswith(("http://", "https://")):
        raise ValueError("api_base 必须以 http:// 或 https:// 开头")
    result["api_base"] = api_base

    effort = str(ai.get("reasoning_effort") or "").strip().lower()
    if effort not in REASONING_EFFORTS:
        raise ValueError(f"reasoning_effort 仅支持: minimal / low / medium / high（留空为不设置）")
    result["reasoning_effort"] = effort
    return result


def overlay_path(output_dir: str | Path = "output") -> Path:
    return Path(output_dir) / OVERLAY_FILENAME


def load_overlay(output_dir: str | Path = "output") -> Dict[str, Any]:
    path = overlay_path(output_dir)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_overlay(data: Dict[str, Any], output_dir: str | Path = "output") -> Dict[str, Any]:
    current = load_overlay(output_dir)
    incoming = dict(data or {})

    if "schedule_preset" in incoming:
        preset = str(incoming["schedule_preset"])
        if preset not in KNOWN_PRESETS:
            raise ValueError(f"未知预设: {preset}")
        incoming["schedule_preset"] = preset
        incoming["schedule_enabled"] = preset != "off"

    if "ai_analysis_enabled" in incoming:
        incoming["ai_analysis_enabled"] = bool(incoming["ai_analysis_enabled"])
    if "schedule_enabled" in incoming:
        incoming["schedule_enabled"] = bool(incoming["schedule_enabled"])

    if "frequency_words" in incoming:
        incoming["frequency_words"] = validate_frequency_words(incoming["frequency_words"])

    if "rss" in incoming:
        incoming["rss"] = _validate_rss_override(incoming["rss"])

    if "ai" in incoming:
        incoming["ai"] = _validate_ai_override(incoming["ai"])

    current.update(incoming)
    return _write_overlay(current, output_dir)


def remove_overlay_keys(keys: List[str], output_dir: str | Path = "output") -> Dict[str, Any]:
    """从 overlay 中移除指定键（恢复使用配置文件），其余键保留。"""
    current = load_overlay(output_dir)
    for key in keys:
        current.pop(key, None)
    return _write_overlay(current, output_dir)


def _write_overlay(data: Dict[str, Any], output_dir: str | Path = "output") -> Dict[str, Any]:
    path = overlay_path(output_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def _validate_rss_override(rss: Any) -> Dict[str, Any]:
    """校验 rss 覆盖项，仅保留 enabled / feeds。"""
    if not isinstance(rss, dict):
        raise ValueError("rss 必须是对象")
    unknown = set(rss.keys()) - {"enabled", "feeds"}
    if unknown:
        raise ValueError(f"rss 含未知字段: {', '.join(sorted(unknown))}")
    result: Dict[str, Any] = {}
    if "enabled" in rss and rss["enabled"] is not None:
        result["enabled"] = bool(rss["enabled"])
    if "feeds" in rss and rss["feeds"] is not None:
        result["feeds"] = _validate_feeds(rss["feeds"])
    return result


def _env_bool(key: str) -> Optional[bool]:
    value = os.environ.get(key, "").strip().lower()
    if not value:
        return None
    return value in ("true", "1", "yes")


def apply_overlay(
    config: Dict[str, Any],
    overlay: Optional[Dict[str, Any]] = None,
    output_dir: str | Path = "output",
) -> Dict[str, Any]:
    data = load_overlay(output_dir) if overlay is None else overlay

    if data.get("ai_analysis_enabled") is not None:
        config.setdefault("AI_ANALYSIS", {})["ENABLED"] = bool(data["ai_analysis_enabled"])
    if data.get("schedule_enabled") is not None:
        config.setdefault("SCHEDULE", {})["enabled"] = bool(data["schedule_enabled"])
    preset = data.get("schedule_preset")
    if preset and preset != "off":
        config.setdefault("SCHEDULE", {})["preset"] = preset
    elif preset == "off":
        config.setdefault("SCHEDULE", {})["enabled"] = False

    rss_override = data.get("rss")
    if isinstance(rss_override, dict):
        rss_config = config.setdefault("RSS", {})
        if rss_override.get("enabled") is not None:
            rss_config["ENABLED"] = bool(rss_override["enabled"])
        if rss_override.get("feeds") is not None:
            rss_config["FEEDS"] = rss_override["feeds"]

    ai_override = data.get("ai")
    if isinstance(ai_override, dict):
        ai_config = config.setdefault("AI", {})
        if ai_override.get("model"):
            ai_config["MODEL"] = ai_override["model"]
        if ai_override.get("api_key"):
            ai_config["API_KEY"] = ai_override["api_key"]
        if "api_base" in ai_override:
            ai_config["API_BASE"] = str(ai_override.get("api_base") or "")
        if "reasoning_effort" in ai_override:
            ai_config["REASONING_EFFORT"] = str(ai_override.get("reasoning_effort") or "")

    force_ai = _env_bool("WEBUI_RUN_AI")
    if force_ai is not None:
        config.setdefault("AI_ANALYSIS", {})["ENABLED"] = force_ai

    return config
