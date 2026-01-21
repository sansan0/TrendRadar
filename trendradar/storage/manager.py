# coding=utf-8
"""
存储管理器 - 统一管理存储后端

根据环境和配置自动选择合适的存储后端
"""

import os
from typing import Optional

from trendradar.storage.base import StorageBackend, NewsData, RSSData


# 存储管理器单例
_storage_manager: Optional["StorageManager"] = None


class StorageManager:
    """
    存储管理器

    功能：
    - 自动检测运行环境（GitHub Actions / Docker / 本地）
    - 根据配置选择存储后端（local / remote / auto）
    - 提供统一的存储接口
    - 支持从远程拉取数据到本地
    """

    def __init__(
        self,
        backend_type: str = "auto",
        data_dir: str = "output",
        enable_txt: bool = True,
        enable_html: bool = True,
        remote_config: Optional[dict] = None,
        local_retention_days: int = 0,
        remote_retention_days: int = 0,
        pull_enabled: bool = False,
        pull_days: int = 0,
        timezone: str = "Asia/Shanghai",
    ):
        """
        初始化存储管理器

        Args:
            backend_type: 存储后端类型 (local / remote / auto)
            data_dir: 本地数据目录
            enable_txt: 是否启用 TXT 快照
            enable_html: 是否启用 HTML 报告
            remote_config: 远程存储配置（endpoint_url, bucket_name, access_key_id 等）
            local_retention_days: 本地数据保留天数（0 = 无限制）
            remote_retention_days: 远程数据保留天数（0 = 无限制）
            pull_enabled: 是否启用启动时自动拉取
            pull_days: 拉取最近 N 天的数据
            timezone: 时区配置（默认 Asia/Shanghai）
        """
        self.backend_type = backend_type
        self.data_dir = data_dir
        self.enable_txt = enable_txt
        self.enable_html = enable_html
        self.remote_config = remote_config or {}
        self.local_retention_days = local_retention_days
        self.remote_retention_days = remote_retention_days
        self.pull_enabled = pull_enabled
        self.pull_days = pull_days
        self.timezone = timezone

        self._backend: Optional[StorageBackend] = None
        self._remote_backend: Optional[StorageBackend] = None

    @staticmethod
    def is_github_actions() -> bool:
        """检测是否在 GitHub Actions 环境中运行"""
        return os.environ.get("GITHUB_ACTIONS") == "true"

    @staticmethod
    def is_docker() -> bool:
        """检测是否在 Docker 容器中运行"""
        # 方法1: 检查 /.dockerenv 文件
        if os.path.exists("/.dockerenv"):
            return True

        # 方法2: 检查 cgroup（Linux）
        try:
            with open("/proc/1/cgroup", "r") as f:
                return "docker" in f.read()
        except (FileNotFoundError, PermissionError):
            pass

        # 方法3: 检查环境变量
        return os.environ.get("DOCKER_CONTAINER") == "true"

    def _resolve_backend_type(self) -> str:
        """解析实际使用的后端类型"""
        if self.backend_type == "auto":
            if self.is_github_actions():
                # GitHub Actions 环境，检查是否配置了远程存储
                if self._has_remote_config():
                    return "remote"
                else:
                    print("[存储管理器] GitHub Actions 环境但未配置远程存储，使用本地存储")
                    return "local"
            else:
                return "local"
        return self.backend_type

    def _has_remote_config(self) -> bool:
        """检查是否有有效的远程存储配置"""
        # 检查配置或环境变量
        bucket_name = self.remote_config.get("bucket_name") or os.environ.get("S3_BUCKET_NAME")
        access_key = self.remote_config.get("access_key_id") or os.environ.get("S3_ACCESS_KEY_ID")
        secret_key = self.remote_config.get("secret_access_key") or os.environ.get("S3_SECRET_ACCESS_KEY")
        endpoint = self.remote_config.get("endpoint_url") or os.environ.get("S3_ENDPOINT_URL")

        # 调试日志
        has_config = bool(bucket_name and access_key and secret_key and endpoint)
        if not has_config:
            print(f"[存储管理器] 远程存储配置检查失败:")
            print(f"  - bucket_name: {'已配置' if bucket_name else '未配置'}")
            print(f"  - access_key_id: {'已配置' if access_key else '未配置'}")
            print(f"  - secret_access_key: {'已配置' if secret_key else '未配置'}")
            print(f"  - endpoint_url: {'已配置' if endpoint else '未配置'}")

        return has_config

    def _create_remote_backend(self) -> Optional[StorageBackend]:
        """创建远程存储后端"""
        try:
            from trendradar.storage.remote import RemoteStorageBackend

            return RemoteStorageBackend(
                bucket_name=self.remote_config.get("bucket_name") or os.environ.get("S3_BUCKET_NAME", ""),
                access_key_id=self.remote_config.get("access_key_id") or os.environ.get("S3_ACCESS_KEY_ID", ""),
                secret_access_key=self.remote_config.get("secret_access_key") or os.environ.get("S3_SECRET_ACCESS_KEY", ""),
                endpoint_url=self.remote_config.get("endpoint_url") or os.environ.get("S3_ENDPOINT_URL", ""),
                region=self.remote_config.get("region") or os.environ.get("S3_REGION", ""),
                enable_txt=self.enable_txt,
                enable_html=self.enable_html,
                timezone=self.timezone,
            )
        except ImportError as e:
            print(f"[存储管理器] 远程后端导入失败: {e}")
            print("[存储管理器] 请确保已安装 boto3: pip install boto3")
            return None
        except Exception as e:
            print(f"[存储管理器] 远程后端初始化失败: {e}")
            return None

    def get_backend(self) -> StorageBackend:
        """获取存储后端实例"""
        if self._backend is None:
            resolved_type = self._resolve_backend_type()

            if resolved_type == "remote":
                self._backend = self._create_remote_backend()
                if self._backend:
                    print(f"[存储管理器] 使用远程存储后端")
                else:
                    print("[存储管理器] 回退到本地存储")
                    resolved_type = "local"

            if resolved_type == "local" or self._backend is None:
                from trendradar.storage.local import LocalStorageBackend

                self._backend = LocalStorageBackend(
                    data_dir=self.data_dir,
                    enable_txt=self.enable_txt,
                    enable_html=self.enable_html,
                    timezone=self.timezone,
                )
                print(f"[存储管理器] 使用本地存储后端 (数据目录: {self.data_dir})")

        return self._backend

    def pull_from_remote(self) -> int:
        """
        从远程拉取数据到本地

        Returns:
            成功拉取的文件数量
        """
        if not self.pull_enabled or self.pull_days <= 0:
            return 0

        if not self._has_remote_config():
            print("[存储管理器] 未配置远程存储，无法拉取")
            return 0

        # 创建远程后端（如果还没有）
        if self._remote_backend is None:
            self._remote_backend = self._create_remote_backend()

        if self._remote_backend is None:
            print("[存储管理器] 无法创建远程后端，拉取失败")
            return 0

        # 调用拉取方法
        return self._remote_backend.pull_recent_days(self.pull_days, self.data_dir)

    def save_news_data(self, data: NewsData) -> bool:
        """保存新闻数据"""
        return self.get_backend().save_news_data(data)

    def save_rss_data(self, data: RSSData) -> bool:
        """保存 RSS 数据"""
        return self.get_backend().save_rss_data(data)

    def get_rss_data(self, date: Optional[str] = None) -> Optional[RSSData]:
        """获取指定日期的所有 RSS 数据（当日汇总模式）"""
        return self.get_backend().get_rss_data(date)

    def get_latest_rss_data(self, date: Optional[str] = None) -> Optional[RSSData]:
        """获取最新一次抓取的 RSS 数据（当前榜单模式）"""
        return self.get_backend().get_latest_rss_data(date)

    def detect_new_rss_items(self, current_data: RSSData) -> dict:
        """检测新增的 RSS 条目（增量模式）"""
        return self.get_backend().detect_new_rss_items(current_data)

    def get_today_all_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """获取当天所有数据"""
        return self.get_backend().get_today_all_data(date)

    def get_latest_crawl_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """获取最新抓取数据"""
        return self.get_backend().get_latest_crawl_data(date)

    def detect_new_titles(self, current_data: NewsData) -> dict:
        """检测新增标题"""
        return self.get_backend().detect_new_titles(current_data)

    def save_txt_snapshot(self, data: NewsData) -> Optional[str]:
        """保存 TXT 快照"""
        return self.get_backend().save_txt_snapshot(data)

    def save_html_report(self, html_content: str, filename: str, is_summary: bool = False) -> Optional[str]:
        """保存 HTML 报告"""
        return self.get_backend().save_html_report(html_content, filename, is_summary)

    def is_first_crawl_today(self, date: Optional[str] = None) -> bool:
        """检查是否是当天第一次抓取"""
        return self.get_backend().is_first_crawl_today(date)

    def cleanup(self) -> None:
        """清理资源"""
        if self._backend:
            self._backend.cleanup()
        if self._remote_backend:
            self._remote_backend.cleanup()

    def cleanup_old_data(self) -> int:
        """
        清理过期数据

        Returns:
            删除的日期目录数量
        """
        total_deleted = 0

        # 清理本地数据
        if self.local_retention_days > 0:
            total_deleted += self.get_backend().cleanup_old_data(self.local_retention_days)

        # 清理远程数据（如果配置了）
        if self.remote_retention_days > 0 and self._has_remote_config():
            if self._remote_backend is None:
                self._remote_backend = self._create_remote_backend()
            if self._remote_backend:
                total_deleted += self._remote_backend.cleanup_old_data(self.remote_retention_days)

        return total_deleted

    @property
    def backend_name(self) -> str:
        """获取当前后端名称"""
        return self.get_backend().backend_name

    @property
    def supports_txt(self) -> bool:
        """是否支持 TXT 快照"""
        return self.get_backend().supports_txt

    # === 推送记录相关方法 ===

    def has_pushed_today(self, date: Optional[str] = None) -> bool:
        """
        检查指定日期是否已推送过

        Args:
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            是否已推送
        """
        return self.get_backend().has_pushed_today(date)

    def record_push(self, report_type: str, date: Optional[str] = None) -> bool:
        """
        记录推送

        Args:
            report_type: 报告类型
            date: 日期字符串（YYYY-MM-DD），默认为今天

        Returns:
            是否记录成功
        """
        return self.get_backend().record_push(report_type, date)


def get_storage_manager(
    backend_type: str = "auto",
    data_dir: str = "output",
    enable_txt: bool = True,
    enable_html: bool = True,
    remote_config: Optional[dict] = None,
    local_retention_days: int = 0,
    remote_retention_days: int = 0,
    pull_enabled: bool = False,
    pull_days: int = 0,
    timezone: str = "Asia/Shanghai",
    force_new: bool = False,
) -> StorageManager:
    """
    获取存储管理器单例

    Args:
        backend_type: 存储后端类型
        data_dir: 本地数据目录
        enable_txt: 是否启用 TXT 快照
        enable_html: 是否启用 HTML 报告
        remote_config: 远程存储配置
        local_retention_days: 本地数据保留天数（0 = 无限制）
        remote_retention_days: 远程数据保留天数（0 = 无限制）
        pull_enabled: 是否启用启动时自动拉取
        pull_days: 拉取最近 N 天的数据
        timezone: 时区配置（默认 Asia/Shanghai）
        force_new: 是否强制创建新实例

    Returns:
        StorageManager 实例
    """
    global _storage_manager

    if _storage_manager is None or force_new:
        _storage_manager = StorageManager(
            backend_type=backend_type,
            data_dir=data_dir,
            enable_txt=enable_txt,
            enable_html=enable_html,
            remote_config=remote_config,
            local_retention_days=local_retention_days,
            remote_retention_days=remote_retention_days,
            pull_enabled=pull_enabled,
            pull_days=pull_days,
            timezone=timezone,
        )

    return _storage_manager
