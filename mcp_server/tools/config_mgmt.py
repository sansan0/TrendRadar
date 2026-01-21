"""
配置管理工具

实现配置查询和管理功能。
"""

from typing import Dict, Optional, Any, TypedDict

from ..services.data_service import DataService
from ..utils.validators import validate_config_section
from ..utils.errors import MCPError


class ErrorInfo(TypedDict, total=False):
    """错误信息结构"""
    code: str
    message: str
    suggestion: str


class ConfigResult(TypedDict):
    """配置查询结果 - success 字段必需，其他字段可选"""
    success: bool
    config: Optional[Dict[str, Any]]
    section: Optional[str]
    error: Optional[ErrorInfo]


class ConfigManagementTools:
    """配置管理工具类"""

    def __init__(self, project_root: str = None):
        """
        初始化配置管理工具

        Args:
            project_root: 项目根目录
        """
        self.data_service = DataService(project_root)

    def get_current_config(self, section: Optional[str] = None) -> ConfigResult:
        """
        获取当前系统配置

        Args:
            section: 配置节 - all/crawler/push/keywords/weights，默认all

        Returns:
            配置字典

        Example:
            >>> tools = ConfigManagementTools()
            >>> result = tools.get_current_config(section="crawler")
            >>> print(result['crawler']['platforms'])
        """
        try:
            # 参数验证
            section = validate_config_section(section)

            # 获取配置
            config = self.data_service.get_current_config(section=section)

            return ConfigResult(
                success=True,
                config=config,
                section=section,
                error=None
            )

        except MCPError as e:
            return ConfigResult(
                success=False,
                config=None,
                section=None,
                error=e.to_dict()
            )
        except Exception as e:
            return ConfigResult(
                success=False,
                config=None,
                section=None,
                error={"code": "INTERNAL_ERROR", "message": str(e), "suggestion": "请查看服务日志获取详细信息"}
            )
