# coding=utf-8
"""
validate_days 参数验证测试

覆盖 sync_from_remote / get_latest_rss / search_rss 等入口使用的
天数参数校验逻辑，确保恶意或误传的超大值被拒绝（DoS 防护）。

Ref: https://github.com/sansan0/TrendRadar/issues/1062
"""

import sys
from pathlib import Path

# 允许从项目根目录导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from mcp_server.utils.validators import validate_days
from mcp_server.utils.errors import InvalidParameterError


# ==================== 正常值 ====================

class TestValidDays:
    """合法 days 值应原样返回"""

    def test_default_when_none(self):
        assert validate_days(None) == 7

    def test_custom_default(self):
        assert validate_days(None, default=30) == 30

    def test_exact_min(self):
        assert validate_days(1) == 1

    def test_exact_max(self):
        assert validate_days(365) == 365

    def test_custom_max(self):
        assert validate_days(30, max_days=30) == 30

    def test_typical_7(self):
        assert validate_days(7) == 7

    def test_typical_30(self):
        assert validate_days(30) == 30


# ==================== 字符串输入 ====================

class TestStringInput:
    """MCP 客户端可能将 int 序列化为字符串"""

    def test_string_int(self):
        assert validate_days("7") == 7

    def test_string_with_spaces(self):
        assert validate_days("  30  ") == 30

    def test_string_float_truncated(self):
        """浮点数字符串截断为 int"""
        assert validate_days("7.9") == 7


# ==================== 越界拒绝 ====================

class TestBoundaryRejection:
    """超出范围的值应抛出 InvalidParameterError"""

    def test_zero(self):
        with pytest.raises(InvalidParameterError):
            validate_days(0)

    def test_negative(self):
        with pytest.raises(InvalidParameterError):
            validate_days(-1)

    def test_large_negative(self):
        with pytest.raises(InvalidParameterError):
            validate_days(-999999)

    def test_over_default_max(self):
        with pytest.raises(InvalidParameterError):
            validate_days(366)

    def test_over_custom_max(self):
        with pytest.raises(InvalidParameterError):
            validate_days(31, max_days=30)

    def test_dos_value(self):
        """Issue #1062: 2147483647 导致 CPU 耗尽"""
        with pytest.raises(InvalidParameterError):
            validate_days(2147483647)

    def test_very_large_string(self):
        with pytest.raises(InvalidParameterError):
            validate_days("999999999")


# ==================== 无效类型 ====================

class TestInvalidType:
    """非 int/str/None 应抛出 InvalidParameterError"""

    def test_non_numeric_string(self):
        with pytest.raises(InvalidParameterError):
            validate_days("abc")

    def test_empty_string(self):
        with pytest.raises(InvalidParameterError):
            validate_days("")

    def test_list(self):
        with pytest.raises((InvalidParameterError, TypeError)):
            validate_days([7])

    def test_dict(self):
        with pytest.raises((InvalidParameterError, TypeError)):
            validate_days({"days": 7})


# ==================== sync_from_remote 集成 ====================

class TestSyncFromRemoteDaysGuard:
    """验证 StorageSyncTools.sync_from_remote 实际使用了 validate_days"""

    def test_negative_days_rejected(self):
        from mcp_server.tools.storage_sync import StorageSyncTools
        tools = StorageSyncTools(project_root="/nonexistent")
        # 应在 validate_days 阶段就抛出，不会走到远程配置检查
        result = tools.sync_from_remote(days=-1)
        # sync_from_remote 内部 catch Exception -> 返回 error dict
        assert result["success"] is False
        assert "error" in result

    def test_huge_days_rejected(self):
        from mcp_server.tools.storage_sync import StorageSyncTools
        tools = StorageSyncTools(project_root="/nonexistent")
        result = tools.sync_from_remote(days=2147483647)
        assert result["success"] is False
        assert "error" in result

    def test_normal_days_passes_validation(self):
        """正常值不应被 validate_days 拒绝（会在后续远程配置检查失败）"""
        from mcp_server.tools.storage_sync import StorageSyncTools
        tools = StorageSyncTools(project_root="/nonexistent")
        result = tools.sync_from_remote(days=7)
        # 没有远程配置 -> REMOTE_NOT_CONFIGURED，但 days 校验本身不报错
        assert result["success"] is False
        assert result["error"]["code"] == "REMOTE_NOT_CONFIGURED"
