# coding=utf-8
"""
存储同步工具

实现从远程存储拉取数据到本地、获取存储状态、列出可用日期等功能。
"""

import os
import re
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import yaml

from ..utils.errors import MCPError


class StorageSyncTools:
    """存储同步工具类"""

    def __init__(self, project_root: str = None):
        """
        初始化存储同步工具

        Args:
            project_root: 项目根目录
        """
        if project_root:
            self.project_root = Path(project_root)
        else:
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent

        self._config = None
        self._remote_backend = None

    def _load_config(self) -> dict:
        """加载配置文件"""
        if self._config is None:
            config_path = self.project_root / "config" / "config.yaml"
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._config = yaml.safe_load(f)
            else:
                self._config = {}
        return self._config

    def _get_storage_config(self) -> dict:
        """获取存储配置"""
        config = self._load_config()
        return config.get("storage", {})

    def _get_remote_config(self) -> dict:
        """
        获取远程存储配置（合并配置文件和环境变量）
        """
        storage_config = self._get_storage_config()
        remote_config = storage_config.get("remote", {})

        return {
            "endpoint_url": remote_config.get("endpoint_url") or os.environ.get("S3_ENDPOINT_URL", ""),
            "bucket_name": remote_config.get("bucket_name") or os.environ.get("S3_BUCKET_NAME", ""),
            "access_key_id": remote_config.get("access_key_id") or os.environ.get("S3_ACCESS_KEY_ID", ""),
            "secret_access_key": remote_config.get("secret_access_key") or os.environ.get("S3_SECRET_ACCESS_KEY", ""),
            "region": remote_config.get("region") or os.environ.get("S3_REGION", ""),
        }

    def _has_remote_config(self) -> bool:
        """检查是否有有效的远程存储配置"""
        config = self._get_remote_config()
        return bool(
            config.get("bucket_name") and
            config.get("access_key_id") and
            config.get("secret_access_key") and
            config.get("endpoint_url")
        )

    def _get_remote_backend(self):
        """获取远程存储后端实例"""
        if self._remote_backend is not None:
            return self._remote_backend

        if not self._has_remote_config():
            return None

        try:
            from trendradar.storage.remote import RemoteStorageBackend

            remote_config = self._get_remote_config()
            config = self._load_config()
            timezone = config.get("app", {}).get("timezone", "Asia/Shanghai")

            self._remote_backend = RemoteStorageBackend(
                bucket_name=remote_config["bucket_name"],
                access_key_id=remote_config["access_key_id"],
                secret_access_key=remote_config["secret_access_key"],
                endpoint_url=remote_config["endpoint_url"],
                region=remote_config.get("region", ""),
                timezone=timezone,
            )
            return self._remote_backend
        except ImportError:
            print("[存储同步] 远程存储后端需要安装 boto3: pip install boto3")
            return None
        except Exception as e:
            print(f"[存储同步] 创建远程后端失败: {e}")
            return None

    def _get_local_data_dir(self) -> Path:
        """获取本地数据目录"""
        storage_config = self._get_storage_config()
        local_config = storage_config.get("local", {})
        data_dir = local_config.get("data_dir", "output")
        return self.project_root / data_dir

    def _parse_date_folder_name(self, folder_name: str) -> Optional[datetime]:
        """
        解析日期文件夹名称（兼容中文和 ISO 格式）

        支持两种格式：
        - 中文格式：YYYY年MM月DD日
        - ISO 格式：YYYY-MM-DD
        """
        # 尝试 ISO 格式
        iso_match = re.match(r'(\d{4})-(\d{2})-(\d{2})', folder_name)
        if iso_match:
            try:
                return datetime(
                    int(iso_match.group(1)),
                    int(iso_match.group(2)),
                    int(iso_match.group(3))
                )
            except ValueError:
                pass

        # 尝试中文格式
        chinese_match = re.match(r'(\d{4})年(\d{2})月(\d{2})日', folder_name)
        if chinese_match:
            try:
                return datetime(
                    int(chinese_match.group(1)),
                    int(chinese_match.group(2)),
                    int(chinese_match.group(3))
                )
            except ValueError:
                pass

        return None

    def _get_local_dates(self, db_type: str = "news") -> List[str]:
        """
        获取本地可用的日期列表

        存储结构: output/{db_type}/{date}.db
        例如: output/news/2025-12-30.db, output/rss/2025-12-30.db

        Args:
            db_type: 数据库类型 ("news" 或 "rss")，默认 "news"

        Returns:
            日期列表（按时间倒序）
        """
        local_dir = self._get_local_data_dir()
        dates = set()

        if not local_dir.exists():
            return []

        # 扫描 output/{db_type}/{date}.db 文件
        type_dir = local_dir / db_type
        if type_dir.exists():
            for item in type_dir.iterdir():
                if item.is_file() and item.suffix == ".db":
                    # 从文件名解析日期 (2025-12-30.db -> 2025-12-30)
                    date_str = item.stem  # 去除 .db 后缀
                    folder_date = self._parse_date_folder_name(date_str)
                    if folder_date:
                        dates.add(folder_date.strftime("%Y-%m-%d"))

        return sorted(list(dates), reverse=True)

    def _get_all_local_dates(self) -> Dict[str, List[str]]:
        """
        获取所有本地可用的日期列表（包括 news 和 rss）

        Returns:
            {
                "news": ["2025-12-30", ...],
                "rss": ["2025-12-30", ...],
                "all": ["2025-12-30", ...]  # 合并去重
            }
        """
        news_dates = set(self._get_local_dates("news"))
        rss_dates = set(self._get_local_dates("rss"))
        all_dates = news_dates | rss_dates

        return {
            "news": sorted(list(news_dates), reverse=True),
            "rss": sorted(list(rss_dates), reverse=True),
            "all": sorted(list(all_dates), reverse=True)
        }

    def _calculate_dir_size(self, path: Path) -> int:
        """计算目录大小（字节）"""
        total_size = 0
        if path.exists():
            for item in path.rglob("*"):
                if item.is_file():
                    total_size += item.stat().st_size
        return total_size

    def sync_from_remote(self, days: int = 7) -> Dict:
        """
        从远程存储拉取数据到本地

        Args:
            days: 拉取最近 N 天的数据，默认 7 天

        Returns:
            同步结果字典
        """
        try:
            # 检查远程配置
            if not self._has_remote_config():
                return {
                    "success": False,
                    "error": {
                        "code": "REMOTE_NOT_CONFIGURED",
                        "message": "未配置远程存储",
                        "suggestion": "请在 config/config.yaml 中配置 storage.remote 或设置环境变量"
                    }
                }

            # 获取远程后端
            remote_backend = self._get_remote_backend()
            if remote_backend is None:
                return {
                    "success": False,
                    "error": {
                        "code": "REMOTE_BACKEND_FAILED",
                        "message": "无法创建远程存储后端",
                        "suggestion": "请检查远程存储配置和 boto3 是否已安装"
                    }
                }

            # 获取本地数据目录
            local_dir = self._get_local_data_dir()
            local_dir.mkdir(parents=True, exist_ok=True)

            # 获取远程可用日期
            remote_dates = remote_backend.list_remote_dates()

            # 获取本地已有日期
            local_dates = set(self._get_local_dates())

            # 计算需要拉取的日期（最近 N 天）
            from trendradar.utils.time import get_configured_time
            config = self._load_config()
            timezone = config.get("app", {}).get("timezone", "Asia/Shanghai")
            now = get_configured_time(timezone)

            target_dates = []
            for i in range(days):
                date = now - timedelta(days=i)
                date_str = date.strftime("%Y-%m-%d")
                if date_str in remote_dates:
                    target_dates.append(date_str)

            # 执行拉取
            synced_dates = []
            skipped_dates = []
            failed_dates = []

            for date_str in target_dates:
                # 检查本地是否已存在
                if date_str in local_dates:
                    skipped_dates.append(date_str)
                    continue

                # 拉取单个日期
                try:
                    local_date_dir = local_dir / date_str
                    local_db_path = local_date_dir / "news.db"
                    remote_key = f"news/{date_str}.db"

                    local_date_dir.mkdir(parents=True, exist_ok=True)
                    remote_backend.s3_client.download_file(
                        remote_backend.bucket_name,
                        remote_key,
                        str(local_db_path)
                    )
                    synced_dates.append(date_str)
                    print(f"[存储同步] 已拉取: {date_str}")
                except Exception as e:
                    failed_dates.append({"date": date_str, "error": str(e)})
                    print(f"[存储同步] 拉取失败 ({date_str}): {e}")

            return {
                "success": True,
                "summary": {
                    "description": "远程存储同步结果",
                    "synced_files": len(synced_dates),
                    "skipped_count": len(skipped_dates),
                    "failed_count": len(failed_dates)
                },
                "data": {
                    "synced_dates": synced_dates,
                    "skipped_dates": skipped_dates,
                    "failed_dates": failed_dates
                },
                "message": f"成功同步 {len(synced_dates)} 天数据" + (
                    f"，跳过 {len(skipped_dates)} 天（本地已存在）" if skipped_dates else ""
                ) + (
                    f"，失败 {len(failed_dates)} 天" if failed_dates else ""
                )
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def get_storage_status(self) -> Dict:
        """
        获取存储配置和状态

        Returns:
            存储状态字典
        """
        try:
            storage_config = self._get_storage_config()
            config = self._load_config()

            # 本地存储状态
            local_config = storage_config.get("local", {})
            local_dir = self._get_local_data_dir()
            local_size = self._calculate_dir_size(local_dir)

            # 获取分类的日期列表
            all_dates = self._get_all_local_dates()
            news_dates = all_dates["news"]
            rss_dates = all_dates["rss"]
            combined_dates = all_dates["all"]

            local_status = {
                "data_dir": local_config.get("data_dir", "output"),
                "retention_days": local_config.get("retention_days", 0),
                "total_size": f"{local_size / 1024 / 1024:.2f} MB",
                "total_size_bytes": local_size,
                "date_count": len(combined_dates),
                "earliest_date": combined_dates[-1] if combined_dates else None,
                "latest_date": combined_dates[0] if combined_dates else None,
                "news": {
                    "date_count": len(news_dates),
                    "dates": news_dates[:10],  # 最近 10 天
                },
                "rss": {
                    "date_count": len(rss_dates),
                    "dates": rss_dates[:10],  # 最近 10 天
                },
            }

            # 远程存储状态
            remote_config = storage_config.get("remote", {})
            has_remote = self._has_remote_config()

            remote_status = {
                "configured": has_remote,
                "retention_days": remote_config.get("retention_days", 0),
            }

            if has_remote:
                merged_config = self._get_remote_config()
                # 脱敏显示
                endpoint = merged_config.get("endpoint_url", "")
                bucket = merged_config.get("bucket_name", "")
                remote_status["endpoint_url"] = endpoint
                remote_status["bucket_name"] = bucket

                # 尝试获取远程日期列表
                remote_backend = self._get_remote_backend()
                if remote_backend:
                    try:
                        remote_dates = remote_backend.list_remote_dates()
                        remote_status["date_count"] = len(remote_dates)
                        remote_status["earliest_date"] = remote_dates[-1] if remote_dates else None
                        remote_status["latest_date"] = remote_dates[0] if remote_dates else None
                    except Exception as e:
                        remote_status["error"] = str(e)

            # 拉取配置状态
            pull_config = storage_config.get("pull", {})
            pull_status = {
                "enabled": pull_config.get("enabled", False),
                "days": pull_config.get("days", 7),
            }

            return {
                "success": True,
                "summary": {
                    "description": "存储配置和状态信息",
                    "backend": storage_config.get("backend", "auto")
                },
                "data": {
                    "local": local_status,
                    "remote": remote_status,
                    "pull": pull_status
                }
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }

    def list_available_dates(self, source: str = "both") -> Dict:
        """
        列出可用的日期范围

        Args:
            source: 数据来源
                - "local": 仅本地
                - "remote": 仅远程
                - "both": 两者都列出（默认）

        Returns:
            日期列表字典
        """
        try:
            data_result = {}
            summary_info = {
                "description": "可用日期列表",
                "source": source
            }

            # 本地日期
            if source in ("local", "both"):
                all_dates = self._get_all_local_dates()
                news_dates = all_dates["news"]
                rss_dates = all_dates["rss"]
                combined_dates = all_dates["all"]

                data_result["local"] = {
                    "dates": combined_dates,
                    "count": len(combined_dates),
                    "earliest": combined_dates[-1] if combined_dates else None,
                    "latest": combined_dates[0] if combined_dates else None,
                    "news": {
                        "dates": news_dates,
                        "count": len(news_dates),
                    },
                    "rss": {
                        "dates": rss_dates,
                        "count": len(rss_dates),
                    },
                }

            # 远程日期
            if source in ("remote", "both"):
                if not self._has_remote_config():
                    data_result["remote"] = {
                        "configured": False,
                        "dates": [],
                        "count": 0,
                        "earliest": None,
                        "latest": None,
                        "error": "未配置远程存储"
                    }
                else:
                    remote_backend = self._get_remote_backend()
                    if remote_backend:
                        try:
                            remote_dates = remote_backend.list_remote_dates()
                            data_result["remote"] = {
                                "configured": True,
                                "dates": remote_dates,
                                "count": len(remote_dates),
                                "earliest": remote_dates[-1] if remote_dates else None,
                                "latest": remote_dates[0] if remote_dates else None,
                            }
                        except Exception as e:
                            data_result["remote"] = {
                                "configured": True,
                                "dates": [],
                                "count": 0,
                                "earliest": None,
                                "latest": None,
                                "error": str(e)
                            }
                    else:
                        data_result["remote"] = {
                            "configured": True,
                            "dates": [],
                            "count": 0,
                            "earliest": None,
                            "latest": None,
                            "error": "无法创建远程存储后端"
                        }

            # 如果同时查询两者，计算差异
            if source == "both" and "local" in data_result and "remote" in data_result:
                local_set = set(data_result["local"]["dates"])
                remote_set = set(data_result["remote"].get("dates", []))

                data_result["comparison"] = {
                    "only_local": sorted(list(local_set - remote_set), reverse=True),
                    "only_remote": sorted(list(remote_set - local_set), reverse=True),
                    "both": sorted(list(local_set & remote_set), reverse=True),
                }

            return {
                "success": True,
                "summary": summary_info,
                "data": data_result
            }

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }
