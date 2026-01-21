# coding=utf-8
"""
AI 翻译器模块

对推送内容进行多语言翻译
基于 LiteLLM 统一接口，支持 100+ AI 提供商
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from trendradar.ai.client import AIClient


@dataclass
class TranslationResult:
    """翻译结果"""
    translated_text: str = ""       # 翻译后的文本
    original_text: str = ""         # 原始文本
    success: bool = False           # 是否成功
    error: str = ""                 # 错误信息


@dataclass
class BatchTranslationResult:
    """批量翻译结果"""
    results: List[TranslationResult] = field(default_factory=list)
    success_count: int = 0
    fail_count: int = 0
    total_count: int = 0


class AITranslator:
    """AI 翻译器"""

    def __init__(self, translation_config: Dict[str, Any], ai_config: Dict[str, Any]):
        """
        初始化 AI 翻译器

        Args:
            translation_config: AI 翻译配置 (AI_TRANSLATION)
            ai_config: AI 模型配置（LiteLLM 格式）
        """
        self.translation_config = translation_config
        self.ai_config = ai_config

        # 翻译配置
        self.enabled = translation_config.get("ENABLED", False)
        self.target_language = translation_config.get("LANGUAGE", "English")

        # 创建 AI 客户端（基于 LiteLLM）
        self.client = AIClient(ai_config)

        # 加载提示词模板
        self.system_prompt, self.user_prompt_template = self._load_prompt_template(
            translation_config.get("PROMPT_FILE", "ai_translation_prompt.txt")
        )

    def _load_prompt_template(self, prompt_file: str) -> tuple:
        """加载提示词模板"""
        config_dir = Path(__file__).parent.parent.parent / "config"
        prompt_path = config_dir / prompt_file

        if not prompt_path.exists():
            print(f"[翻译] 提示词文件不存在: {prompt_path}")
            return "", ""

        content = prompt_path.read_text(encoding="utf-8")

        # 解析 [system] 和 [user] 部分
        system_prompt = ""
        user_prompt = ""

        if "[system]" in content and "[user]" in content:
            parts = content.split("[user]")
            system_part = parts[0]
            user_part = parts[1] if len(parts) > 1 else ""

            if "[system]" in system_part:
                system_prompt = system_part.split("[system]")[1].strip()

            user_prompt = user_part.strip()
        else:
            user_prompt = content

        return system_prompt, user_prompt

    def translate(self, text: str) -> TranslationResult:
        """
        翻译单条文本

        Args:
            text: 要翻译的文本

        Returns:
            TranslationResult: 翻译结果
        """
        result = TranslationResult(original_text=text)

        if not self.enabled:
            result.error = "翻译功能未启用"
            return result

        if not self.client.api_key:
            result.error = "未配置 AI API Key"
            return result

        if not text or not text.strip():
            result.translated_text = text
            result.success = True
            return result

        try:
            # 构建提示词
            user_prompt = self.user_prompt_template
            user_prompt = user_prompt.replace("{target_language}", self.target_language)
            user_prompt = user_prompt.replace("{content}", text)

            # 调用 AI API
            response = self._call_ai(user_prompt)
            result.translated_text = response.strip()
            result.success = True

        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            if len(error_msg) > 100:
                error_msg = error_msg[:100] + "..."
            result.error = f"翻译失败 ({error_type}): {error_msg}"

        return result

    def translate_batch(self, texts: List[str]) -> BatchTranslationResult:
        """
        批量翻译文本（单次 API 调用）

        Args:
            texts: 要翻译的文本列表

        Returns:
            BatchTranslationResult: 批量翻译结果
        """
        batch_result = BatchTranslationResult(total_count=len(texts))

        if not self.enabled:
            for text in texts:
                batch_result.results.append(TranslationResult(
                    original_text=text,
                    error="翻译功能未启用"
                ))
            batch_result.fail_count = len(texts)
            return batch_result

        if not self.client.api_key:
            for text in texts:
                batch_result.results.append(TranslationResult(
                    original_text=text,
                    error="未配置 AI API Key"
                ))
            batch_result.fail_count = len(texts)
            return batch_result

        if not texts:
            return batch_result

        # 过滤空文本
        non_empty_indices = []
        non_empty_texts = []
        for i, text in enumerate(texts):
            if text and text.strip():
                non_empty_indices.append(i)
                non_empty_texts.append(text)

        # 初始化结果列表
        for text in texts:
            batch_result.results.append(TranslationResult(original_text=text))

        # 空文本直接标记成功
        for i, text in enumerate(texts):
            if not text or not text.strip():
                batch_result.results[i].translated_text = text
                batch_result.results[i].success = True
                batch_result.success_count += 1

        if not non_empty_texts:
            return batch_result

        try:
            # 构建批量翻译内容（使用编号格式）
            batch_content = self._format_batch_content(non_empty_texts)

            # 构建提示词
            user_prompt = self.user_prompt_template
            user_prompt = user_prompt.replace("{target_language}", self.target_language)
            user_prompt = user_prompt.replace("{content}", batch_content)

            # 调用 AI API
            response = self._call_ai(user_prompt)

            # 解析批量翻译结果
            translated_texts = self._parse_batch_response(response, len(non_empty_texts))

            # 填充结果
            for idx, translated in zip(non_empty_indices, translated_texts):
                batch_result.results[idx].translated_text = translated
                batch_result.results[idx].success = True
                batch_result.success_count += 1

        except Exception as e:
            error_msg = f"批量翻译失败: {type(e).__name__}: {str(e)[:100]}"
            for idx in non_empty_indices:
                batch_result.results[idx].error = error_msg
            batch_result.fail_count = len(non_empty_indices)

        return batch_result

    def _format_batch_content(self, texts: List[str]) -> str:
        """格式化批量翻译内容"""
        lines = []
        for i, text in enumerate(texts, 1):
            lines.append(f"[{i}] {text}")
        return "\n".join(lines)

    def _parse_batch_response(self, response: str, expected_count: int) -> List[str]:
        """
        解析批量翻译响应

        Args:
            response: AI 响应文本
            expected_count: 期望的翻译数量

        Returns:
            List[str]: 翻译结果列表
        """
        results = []
        lines = response.strip().split("\n")

        current_idx = None
        current_text = []

        for line in lines:
            # 尝试匹配 [数字] 格式
            stripped = line.strip()
            if stripped.startswith("[") and "]" in stripped:
                bracket_end = stripped.index("]")
                try:
                    idx = int(stripped[1:bracket_end])
                    # 保存之前的内容
                    if current_idx is not None:
                        results.append((current_idx, "\n".join(current_text).strip()))
                    current_idx = idx
                    current_text = [stripped[bracket_end + 1:].strip()]
                except ValueError:
                    if current_idx is not None:
                        current_text.append(line)
            else:
                if current_idx is not None:
                    current_text.append(line)

        # 保存最后一条
        if current_idx is not None:
            results.append((current_idx, "\n".join(current_text).strip()))

        # 按索引排序并提取文本
        results.sort(key=lambda x: x[0])
        translated = [text for _, text in results]

        # 如果解析结果数量不匹配，尝试简单按行分割
        if len(translated) != expected_count:
            # 回退：按行分割（去除编号）
            translated = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith("[") and "]" in stripped:
                    bracket_end = stripped.index("]")
                    translated.append(stripped[bracket_end + 1:].strip())
                elif stripped:
                    translated.append(stripped)

        # 确保返回正确数量
        while len(translated) < expected_count:
            translated.append("")

        return translated[:expected_count]

    def _call_ai(self, user_prompt: str) -> str:
        """调用 AI API（使用 LiteLLM）"""
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        return self.client.chat(messages)
