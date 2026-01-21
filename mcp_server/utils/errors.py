"""
自定义错误类

定义MCP Server使用的所有自定义异常类型。
"""

from typing import Optional, List, Callable


# ==================== 延迟加载支持的平台列表 ====================

_get_supported_platforms: Optional[Callable[[], List[str]]] = None


def _load_supported_platforms() -> List[str]:
    """延迟加载支持的平台列表"""
    global _get_supported_platforms
    if _get_supported_platforms is None:
        try:
            from .validators import get_supported_platforms
            _get_supported_platforms = get_supported_platforms
        except ImportError:
            # 降级：返回空列表
            return []
    return _get_supported_platforms()


class MCPError(Exception):
    """MCP工具错误基类"""

    def __init__(self, message: str, code: str = "MCP_ERROR", suggestion: Optional[str] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.suggestion = suggestion

    def to_dict(self) -> dict:
        """转换为字典格式"""
        error_dict = {
            "code": self.code,
            "message": self.message
        }
        if self.suggestion:
            error_dict["suggestion"] = self.suggestion
        return error_dict


class DataNotFoundError(MCPError):
    """数据不存在错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="DATA_NOT_FOUND",
            suggestion=suggestion or "请检查日期范围或等待爬取任务完成"
        )


class InvalidParameterError(MCPError):
    """参数无效错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="INVALID_PARAMETER",
            suggestion=suggestion or "请检查参数格式是否正确"
        )


class ConfigurationError(MCPError):
    """配置错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="CONFIGURATION_ERROR",
            suggestion=suggestion or "请检查配置文件是否正确"
        )


class PlatformNotSupportedError(MCPError):
    """平台不支持错误"""

    def __init__(self, platform: str):
        supported = _load_supported_platforms()
        suggestion = f"支持的平台: {', '.join(supported)}" if supported else "请检查 config/config.yaml 中的平台配置"
        super().__init__(
            message=f"平台 '{platform}' 不受支持",
            code="PLATFORM_NOT_SUPPORTED",
            suggestion=suggestion
        )


class CrawlTaskError(MCPError):
    """爬取任务错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="CRAWL_TASK_ERROR",
            suggestion=suggestion or "请稍后重试或查看日志"
        )


class FileParseError(MCPError):
    """文件解析错误"""

    def __init__(self, file_path: str, reason: str):
        super().__init__(
            message=f"解析文件 {file_path} 失败: {reason}",
            code="FILE_PARSE_ERROR",
            suggestion="请检查文件格式是否正确"
        )
