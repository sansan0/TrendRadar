# coding=utf-8
"""
AI 客户端模块

基于 LiteLLM 的统一 AI 模型接口
支持 100+ AI 提供商（OpenAI、DeepSeek、Gemini、Claude、国内模型等）
"""

import os
from typing import Any, Dict, List
from urllib.parse import urlparse

from litellm import completion


class AIClient:
    """统一的 AI 客户端（基于 LiteLLM）"""

    def __init__(self, config: Dict[str, Any]):
        """
        初始化 AI 客户端

        Args:
            config: AI 配置字典
                - MODEL: 模型标识（格式: provider/model_name）
                - API_KEY: API 密钥
                - API_BASE: API 基础 URL（可选）
                - TEMPERATURE: 采样温度
                - MAX_TOKENS: 最大生成 token 数
                - TIMEOUT: 请求超时时间（秒）
                - NUM_RETRIES: 重试次数（可选）
                - FALLBACK_MODELS: 备用模型列表（可选）
        """
        self.model = config.get("MODEL", "deepseek/deepseek-chat")
        self.api_key = config.get("API_KEY") or os.environ.get("AI_API_KEY", "")
        self.api_base = config.get("API_BASE", "")
        self.temperature = config.get("TEMPERATURE", 1.0)
        self.max_tokens = config.get("MAX_TOKENS", 5000)
        self.timeout = config.get("TIMEOUT", 120)
        self.num_retries = config.get("NUM_RETRIES", 2)
        self.fallback_models = config.get("FALLBACK_MODELS", [])

    def _get_provider(self) -> str:
        """从 model 字段提取 provider 名称。"""
        if not self.model or "/" not in self.model:
            return ""
        return self.model.split("/", 1)[0].strip().lower()

    @staticmethod
    def _is_loopback_host(hostname: str) -> bool:
        return hostname.lower() in {"127.0.0.1", "localhost", "::1"}

    @staticmethod
    def _is_running_in_docker() -> bool:
        """检测当前是否运行在 Docker 容器中。"""
        return os.path.exists("/.dockerenv") or os.environ.get("container", "").lower() == "docker"

    def _validate_api_base(self) -> tuple[bool, str]:
        """
        校验 api_base 是否适合作为客户端访问地址。

        Returns:
            tuple: (是否有效, 错误信息)
        """
        if not self.api_base:
            return True, ""

        try:
            parsed = urlparse(self.api_base)
        except Exception:
            return False, f"AI API Base 格式错误: {self.api_base}"

        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False, (
                f"AI API Base 格式错误: {self.api_base}，"
                "请使用 http://host:port 或 https://host/v1 这样的完整地址"
            )

        hostname = parsed.hostname.lower()

        if hostname == "0.0.0.0":
            return False, (
                "AI API Base 不能填写 0.0.0.0。"
                "0.0.0.0 是服务端监听地址，不是客户端可连接地址；"
                "请改成实际可访问的主机名或 IP（如 127.0.0.1、host.docker.internal、局域网 IP）。"
            )

        if self._is_running_in_docker() and self._is_loopback_host(hostname):
            return False, (
                "当前运行在 Docker 容器内，AI API Base 不能使用 localhost/127.0.0.1。"
                "容器内的回环地址只指向容器自身；如果要连接宿主机上的 Ollama 或其他本地模型，"
                "请改用 host.docker.internal、同 docker-compose 网络内的服务名，或宿主机局域网 IP。"
            )

        return True, ""

    def chat(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        调用 AI 模型进行对话

        Args:
            messages: 消息列表，格式: [{"role": "system/user/assistant", "content": "..."}]
            **kwargs: 额外参数，会覆盖默认配置

        Returns:
            str: AI 响应内容

        Raises:
            Exception: API 调用失败时抛出异常
        """
        # 构建请求参数
        params = {
            "model": self.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "timeout": kwargs.get("timeout", self.timeout),
            "num_retries": kwargs.get("num_retries", self.num_retries),
        }

        # 添加 API Key
        if self.api_key:
            params["api_key"] = self.api_key

        # 添加 API Base（如果配置了）
        if self.api_base:
            params["api_base"] = self.api_base

        # 添加 max_tokens（如果配置了且不为 0）
        max_tokens = kwargs.get("max_tokens", self.max_tokens)
        if max_tokens and max_tokens > 0:
            params["max_tokens"] = max_tokens

        # 添加 fallback 模型（如果配置了）
        if self.fallback_models:
            params["fallbacks"] = self.fallback_models

        # 合并其他额外参数
        for key, value in kwargs.items():
            if key not in params:
                params[key] = value

        # 调用 LiteLLM
        response = completion(**params)

        # 提取响应内容
        # 某些模型/提供商返回 list（内容块）而非 str，统一转为 str
        content = response.choices[0].message.content
        if isinstance(content, list):
            content = "\n".join(
                item.get("text", str(item)) if isinstance(item, dict) else str(item)
                for item in content
            )
        return content or ""

    def validate_config(self) -> tuple[bool, str]:
        """
        验证配置是否有效

        Returns:
            tuple: (是否有效, 错误信息)
        """
        if not self.model:
            return False, "未配置 AI 模型（model）"

        provider = self._get_provider()
        needs_api_key = provider not in {"ollama"}

        api_base_valid, api_base_error = self._validate_api_base()
        if not api_base_valid:
            return False, api_base_error

        if not self.api_key and needs_api_key:
            return False, "未配置 AI API Key，请在 config.yaml 或环境变量 AI_API_KEY 中设置"

        # 验证模型格式（应该包含 provider/model）
        if "/" not in self.model:
            return False, f"模型格式错误: {self.model}，应为 'provider/model' 格式（如 'deepseek/deepseek-chat'）"

        return True, ""
