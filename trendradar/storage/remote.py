# coding=utf-8
"""
远程存储后端（S3 兼容协议）

支持 Cloudflare R2、阿里云 OSS、腾讯云 COS、AWS S3、MinIO 等
使用 S3 兼容 API (boto3) 访问对象存储
数据流程：下载当天 SQLite → 合并新数据 → 上传回远程
"""

import pytz
import re
import shutil
import sys
import tempfile
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import ClientError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    boto3 = None
    BotoConfig = None
    ClientError = Exception

from trendradar.storage.base import StorageBackend, NewsItem, NewsData, RSSItem, RSSData
from trendradar.storage.sqlite_mixin import SQLiteStorageMixin
from trendradar.utils.time import (
    DEFAULT_TIMEZONE,
    get_configured_time,
    format_date_folder,
    format_time_filename,
)


class RemoteStorageBackend(SQLiteStorageMixin, StorageBackend):
    """
    远程云存储后端（S3 兼容协议）

    特点：
    - 使用 S3 兼容 API 访问远程存储
    - 支持 Cloudflare R2、阿里云 OSS、腾讯云 COS、AWS S3、MinIO 等
    - 下载 SQLite 到临时目录进行操作
    - 支持数据合并和上传
    - 支持从远程拉取历史数据到本地
    - 运行结束后自动清理临时文件
    """

    def __init__(
        self,
        bucket_name: str,
        access_key_id: str,
        secret_access_key: str,
        endpoint_url: str,
        region: str = "",
        enable_txt: bool = False,  # 远程模式默认不生成 TXT
        enable_html: bool = True,
        temp_dir: Optional[str] = None,
        timezone: str = DEFAULT_TIMEZONE,
    ):
        """
        初始化远程存储后端

        Args:
            bucket_name: 存储桶名称
            access_key_id: 访问密钥 ID
            secret_access_key: 访问密钥
            endpoint_url: 服务端点 URL
            region: 区域（可选，部分服务商需要）
            enable_txt: 是否启用 TXT 快照（默认关闭）
            enable_html: 是否启用 HTML 报告
            temp_dir: 临时目录路径（默认使用系统临时目录）
            timezone: 时区配置
        """
        if not HAS_BOTO3:
            raise ImportError("远程存储后端需要安装 boto3: pip install boto3")

        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.region = region
        self.enable_txt = enable_txt
        self.enable_html = enable_html
        self.timezone = timezone

        # 创建临时目录
        self.temp_dir = Path(temp_dir) if temp_dir else Path(tempfile.mkdtemp(prefix="trendradar_"))
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        # 初始化 S3 客户端
        # 使用 virtual-hosted style addressing（主流）
        # 根据服务商选择签名版本：
        # - 腾讯云 COS 和 阿里云 OSS 使用 SigV2 以避免 chunked encoding 问题
        # - 其他服务商（AWS S3、Cloudflare R2、MinIO 等）默认使用 SigV4
        use_sigv2 = "myqcloud.com" in endpoint_url.lower() or "aliyuncs.com" in endpoint_url.lower()
        signature_version = 's3' if use_sigv2 else 's3v4'

        s3_config = BotoConfig(
            s3={"addressing_style": "virtual"},
            signature_version=signature_version,
        )

        client_kwargs = {
            "endpoint_url": endpoint_url,
            "aws_access_key_id": access_key_id,
            "aws_secret_access_key": secret_access_key,
            "config": s3_config,
        }
        if region:
            client_kwargs["region_name"] = region

        self.s3_client = boto3.client("s3", **client_kwargs)

        # 跟踪下载的文件（用于清理）
        self._downloaded_files: List[Path] = []
        self._db_connections: Dict[str, sqlite3.Connection] = {}

        print(f"[远程存储] 初始化完成，存储桶: {bucket_name}，签名版本: {signature_version}")

    @property
    def backend_name(self) -> str:
        return "remote"

    @property
    def supports_txt(self) -> bool:
        return self.enable_txt

    # ========================================
    # SQLiteStorageMixin 抽象方法实现
    # ========================================

    def _get_configured_time(self) -> datetime:
        """获取配置时区的当前时间"""
        return get_configured_time(self.timezone)

    def _format_date_folder(self, date: Optional[str] = None) -> str:
        """格式化日期文件夹名 (ISO 格式: YYYY-MM-DD)"""
        return format_date_folder(date, self.timezone)

    def _format_time_filename(self) -> str:
        """格式化时间文件名 (格式: HH-MM)"""
        return format_time_filename(self.timezone)

    def _get_remote_db_key(self, date: Optional[str] = None, db_type: str = "news") -> str:
        """
        获取远程存储中 SQLite 文件的对象键

        Args:
            date: 日期字符串
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            远程对象键，如 "news/2025-12-28.db" 或 "rss/2025-12-28.db"
        """
        date_folder = self._format_date_folder(date)
        return f"{db_type}/{date_folder}.db"

    def _get_local_db_path(self, date: Optional[str] = None, db_type: str = "news") -> Path:
        """
        获取本地临时 SQLite 文件路径

        Args:
            date: 日期字符串
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            本地临时文件路径
        """
        date_folder = self._format_date_folder(date)
        db_dir = self.temp_dir / db_type
        db_dir.mkdir(parents=True, exist_ok=True)
        return db_dir / f"{date_folder}.db"

    def _check_object_exists(self, r2_key: str) -> bool:
        """
        检查远程存储中对象是否存在

        Args:
            r2_key: 远程对象键

        Returns:
            是否存在
        """
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=r2_key)
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            # S3 兼容存储可能返回 404, NoSuchKey, 或其他变体
            if error_code in ("404", "NoSuchKey", "Not Found"):
                return False
            # 其他错误（如权限问题）也视为不存在，但打印警告
            print(f"[远程存储] 检查对象存在性失败 ({r2_key}): {e}")
            return False
        except Exception as e:
            print(f"[远程存储] 检查对象存在性异常 ({r2_key}): {e}")
            return False

    def _download_sqlite(self, date: Optional[str] = None, db_type: str = "news") -> Optional[Path]:
        """
        从远程存储下载当天的 SQLite 文件到本地临时目录

        使用 get_object + iter_chunks 替代 download_file，
        以正确处理腾讯云 COS 的 chunked transfer encoding。

        Args:
            date: 日期字符串
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            本地文件路径，如果不存在返回 None
        """
        r2_key = self._get_remote_db_key(date, db_type)
        local_path = self._get_local_db_path(date, db_type)

        # 确保目录存在
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # 先检查文件是否存在
        if not self._check_object_exists(r2_key):
            print(f"[远程存储] 文件不存在，将创建新数据库: {r2_key}")
            return None

        try:
            # 使用 get_object + iter_chunks 替代 download_file
            # iter_chunks 会自动处理 chunked transfer encoding
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=r2_key)
            with open(local_path, 'wb') as f:
                for chunk in response['Body'].iter_chunks(chunk_size=1024*1024):
                    f.write(chunk)
            self._downloaded_files.append(local_path)
            print(f"[远程存储] 已下载: {r2_key} -> {local_path}")
            return local_path
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            # S3 兼容存储可能返回不同的错误码
            if error_code in ("404", "NoSuchKey", "Not Found"):
                print(f"[远程存储] 文件不存在，将创建新数据库: {r2_key}")
                return None
            else:
                print(f"[远程存储] 下载失败 (错误码: {error_code}): {e}")
                raise
        except Exception as e:
            print(f"[远程存储] 下载异常: {e}")
            raise

    def _upload_sqlite(self, date: Optional[str] = None, db_type: str = "news") -> bool:
        """
        上传本地 SQLite 文件到远程存储

        Args:
            date: 日期字符串
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            是否上传成功
        """
        local_path = self._get_local_db_path(date, db_type)
        r2_key = self._get_remote_db_key(date, db_type)

        if not local_path.exists():
            print(f"[远程存储] 本地文件不存在，无法上传: {local_path}")
            return False

        try:
            # 获取本地文件大小
            local_size = local_path.stat().st_size
            print(f"[远程存储] 准备上传: {local_path} ({local_size} bytes) -> {r2_key}")

            # 读取文件内容为 bytes 后上传
            # 避免传入文件对象时 requests 库使用 chunked transfer encoding
            # 腾讯云 COS 等 S3 兼容服务可能无法正确处理 chunked encoding
            with open(local_path, 'rb') as f:
                file_content = f.read()

            # 使用 put_object 并明确设置 ContentLength，确保不使用 chunked encoding
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=r2_key,
                Body=file_content,
                ContentLength=local_size,
                ContentType='application/x-sqlite3',
            )
            print(f"[远程存储] 已上传: {local_path} -> {r2_key}")

            # 验证上传成功
            if self._check_object_exists(r2_key):
                print(f"[远程存储] 上传验证成功: {r2_key}")
                return True
            else:
                print(f"[远程存储] 上传验证失败: 文件未在远程存储中找到")
                return False

        except Exception as e:
            print(f"[远程存储] 上传失败: {e}")
            return False

    def _get_connection(self, date: Optional[str] = None, db_type: str = "news") -> sqlite3.Connection:
        """
        获取数据库连接

        Args:
            date: 日期字符串
            db_type: 数据库类型 ("news" 或 "rss")

        Returns:
            数据库连接
        """
        local_path = self._get_local_db_path(date, db_type)
        db_path = str(local_path)

        if db_path not in self._db_connections:
            # 确保目录存在
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # 如果本地不存在，尝试从远程存储下载
            if not local_path.exists():
                self._download_sqlite(date, db_type)

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            self._init_tables(conn, db_type)
            self._db_connections[db_path] = conn

        return self._db_connections[db_path]

    # ========================================
    # StorageBackend 接口实现（委托给 mixin + 上传）
    # ========================================

    def save_news_data(self, data: NewsData) -> bool:
        """
        保存新闻数据到远程存储

        流程：下载现有数据库 → 插入/更新数据 → 上传回远程存储
        """
        # 查询已有记录数
        conn = self._get_connection(data.date)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM news_items")
        row = cursor.fetchone()
        existing_count = row[0] if row else 0
        if existing_count > 0:
            print(f"[远程存储] 已有 {existing_count} 条历史记录，将合并新数据")

        # 使用 mixin 的实现保存数据
        success, new_count, updated_count, title_changed_count, off_list_count = \
            self._save_news_data_impl(data, "[远程存储]")

        if not success:
            return False

        # 查询合并后的总记录数
        cursor.execute("SELECT COUNT(*) as count FROM news_items")
        row = cursor.fetchone()
        final_count = row[0] if row else 0

        # 输出详细的存储统计日志
        log_parts = [f"[远程存储] 处理完成：新增 {new_count} 条"]
        if updated_count > 0:
            log_parts.append(f"更新 {updated_count} 条")
        if title_changed_count > 0:
            log_parts.append(f"标题变更 {title_changed_count} 条")
        if off_list_count > 0:
            log_parts.append(f"脱榜 {off_list_count} 条")
        log_parts.append(f"(去重后总计: {final_count} 条)")
        print("，".join(log_parts))

        # 上传到远程存储
        if self._upload_sqlite(data.date):
            print(f"[远程存储] 数据已同步到远程存储")
            return True
        else:
            print(f"[远程存储] 上传远程存储失败")
            return False

    def get_today_all_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """获取指定日期的所有新闻数据（合并后）"""
        return self._get_today_all_data_impl(date)

    def get_latest_crawl_data(self, date: Optional[str] = None) -> Optional[NewsData]:
        """获取最新一次抓取的数据"""
        return self._get_latest_crawl_data_impl(date)

    def detect_new_titles(self, current_data: NewsData) -> Dict[str, Dict]:
        """检测新增的标题"""
        return self._detect_new_titles_impl(current_data)

    def is_first_crawl_today(self, date: Optional[str] = None) -> bool:
        """检查是否是当天第一次抓取"""
        return self._is_first_crawl_today_impl(date)

    # ========================================
    # 时间段执行记录（调度系统）
    # ========================================

    def has_period_executed(self, date_str: str, period_key: str, action: str) -> bool:
        """检查指定时间段的某个 action 是否已执行"""
        return self._has_period_executed_impl(date_str, period_key, action)

    def record_period_execution(self, date_str: str, period_key: str, action: str) -> bool:
        """记录时间段的 action 执行"""
        success = self._record_period_execution_impl(date_str, period_key, action)

        if success:
            now_str = self._get_configured_time().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[远程存储] 时间段执行记录已保存: {period_key}/{action} at {now_str}")

            # 上传到远程存储确保记录持久化
            if self._upload_sqlite(date_str):
                print(f"[远程存储] 时间段执行记录已同步到远程存储")
                return True
            else:
                print(f"[远程存储] 时间段执行记录同步到远程存储失败")
                return False

        return False

    # ========================================
    # RSS 数据存储方法
    # ========================================

    def save_rss_data(self, data: RSSData) -> bool:
        """
        保存 RSS 数据到远程存储

        流程：下载现有数据库 → 插入/更新数据 → 上传回远程存储
        """
        success, new_count, updated_count = self._save_rss_data_impl(data, "[远程存储]")

        if not success:
            return False

        # 输出统计日志
        log_parts = [f"[远程存储] RSS 处理完成：新增 {new_count} 条"]
        if updated_count > 0:
            log_parts.append(f"更新 {updated_count} 条")
        print("，".join(log_parts))

        # 上传到远程存储
        if self._upload_sqlite(data.date, db_type="rss"):
            print(f"[远程存储] RSS 数据已同步到远程存储")
            return True
        else:
            print(f"[远程存储] RSS 上传远程存储失败")
            return False

    def get_rss_data(self, date: Optional[str] = None) -> Optional[RSSData]:
        """获取指定日期的所有 RSS 数据"""
        return self._get_rss_data_impl(date)

    def detect_new_rss_items(self, current_data: RSSData) -> Dict[str, List[RSSItem]]:
        """检测新增的 RSS 条目"""
        return self._detect_new_rss_items_impl(current_data)

    def get_latest_rss_data(self, date: Optional[str] = None) -> Optional[RSSData]:
        """获取最新一次抓取的 RSS 数据"""
        return self._get_latest_rss_data_impl(date)

    # ========================================
    # 远程特有功能：TXT/HTML 快照（临时目录）
    # ========================================

    def save_txt_snapshot(self, data: NewsData) -> Optional[str]:
        """保存 TXT 快照（远程存储模式下默认不支持）"""
        if not self.enable_txt:
            return None

        # 如果启用，保存到本地临时目录
        try:
            date_folder = self._format_date_folder(data.date)
            txt_dir = self.temp_dir / date_folder / "txt"
            txt_dir.mkdir(parents=True, exist_ok=True)

            file_path = txt_dir / f"{data.crawl_time}.txt"

            with open(file_path, "w", encoding="utf-8") as f:
                for source_id, news_list in data.items.items():
                    source_name = data.id_to_name.get(source_id, source_id)

                    if source_name and source_name != source_id:
                        f.write(f"{source_id} | {source_name}\n")
                    else:
                        f.write(f"{source_id}\n")

                    sorted_news = sorted(news_list, key=lambda x: x.rank)

                    for item in sorted_news:
                        line = f"{item.rank}. {item.title}"
                        if item.url:
                            line += f" [URL:{item.url}]"
                        if item.mobile_url:
                            line += f" [MOBILE:{item.mobile_url}]"
                        f.write(line + "\n")

                    f.write("\n")

                if data.failed_ids:
                    f.write("==== 以下ID请求失败 ====\n")
                    for failed_id in data.failed_ids:
                        f.write(f"{failed_id}\n")

            print(f"[远程存储] TXT 快照已保存: {file_path}")
            return str(file_path)

        except Exception as e:
            print(f"[远程存储] 保存 TXT 快照失败: {e}")
            return None

    def save_html_report(self, html_content: str, filename: str, is_summary: bool = False) -> Optional[str]:
        """保存 HTML 报告到临时目录"""
        if not self.enable_html:
            return None

        try:
            date_folder = self._format_date_folder()
            html_dir = self.temp_dir / date_folder / "html"
            html_dir.mkdir(parents=True, exist_ok=True)

            file_path = html_dir / filename

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            print(f"[远程存储] HTML 报告已保存: {file_path}")
            return str(file_path)

        except Exception as e:
            print(f"[远程存储] 保存 HTML 报告失败: {e}")
            return None

    # ========================================
    # 远程特有功能：资源清理
    # ========================================

    def cleanup(self) -> None:
        """清理资源（关闭连接和删除临时文件）"""
        # 检查 Python 是否正在关闭
        if sys.meta_path is None:
            return

        # 关闭数据库连接
        db_connections = getattr(self, "_db_connections", {})
        for db_path, conn in list(db_connections.items()):
            try:
                conn.close()
                print(f"[远程存储] 关闭数据库连接: {db_path}")
            except Exception as e:
                print(f"[远程存储] 关闭连接失败 {db_path}: {e}")

        if db_connections:
            db_connections.clear()

        # 删除临时目录
        temp_dir = getattr(self, "temp_dir", None)
        if temp_dir:
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
                    print(f"[远程存储] 临时目录已清理: {temp_dir}")
            except Exception as e:
                # 忽略 Python 关闭时的错误
                if sys.meta_path is not None:
                    print(f"[远程存储] 清理临时目录失败: {e}")

        downloaded_files = getattr(self, "_downloaded_files", None)
        if downloaded_files:
            downloaded_files.clear()

    def cleanup_old_data(self, retention_days: int) -> int:
        """
        清理远程存储上的过期数据

        Args:
            retention_days: 保留天数（0 表示不清理）

        Returns:
            删除的数据库文件数量
        """
        if retention_days <= 0:
            return 0

        deleted_count = 0
        cutoff_date = self._get_configured_time() - timedelta(days=retention_days)

        try:
            # 列出远程存储中 news/ 前缀下的所有对象
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix="news/")

            # 收集需要删除的对象键
            objects_to_delete = []
            deleted_dates = set()

            for page in pages:
                if 'Contents' not in page:
                    continue

                for obj in page['Contents']:
                    key = obj['Key']

                    # 解析日期（格式: news/YYYY-MM-DD.db）
                    folder_date = None
                    date_str = None
                    try:
                        date_match = re.match(r'news/(\d{4})-(\d{2})-(\d{2})\.db$', key)
                        if date_match:
                            folder_date = datetime(
                                int(date_match.group(1)),
                                int(date_match.group(2)),
                                int(date_match.group(3)),
                                tzinfo=pytz.timezone(self.timezone)
                            )
                            date_str = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
                    except Exception:
                        continue

                    if folder_date and folder_date < cutoff_date:
                        objects_to_delete.append({'Key': key})
                        deleted_dates.add(date_str)

            # 批量删除对象（每次最多 1000 个）
            if objects_to_delete:
                batch_size = 1000
                for i in range(0, len(objects_to_delete), batch_size):
                    batch = objects_to_delete[i:i + batch_size]
                    try:
                        self.s3_client.delete_objects(
                            Bucket=self.bucket_name,
                            Delete={'Objects': batch}
                        )
                        print(f"[远程存储] 删除 {len(batch)} 个对象")
                    except Exception as e:
                        print(f"[远程存储] 批量删除失败: {e}")

                deleted_count = len(deleted_dates)
                for date_str in sorted(deleted_dates):
                    print(f"[远程存储] 清理过期数据: news/{date_str}.db")

                print(f"[远程存储] 共清理 {deleted_count} 个过期日期数据库文件")

            return deleted_count

        except Exception as e:
            print(f"[远程存储] 清理过期数据失败: {e}")
            return deleted_count

    def __del__(self):
        """析构函数"""
        # 检查 Python 是否正在关闭
        if sys.meta_path is None:
            return
        try:
            self.cleanup()
        except Exception:
            # Python 关闭时可能会出错，忽略即可
            pass

    # ========================================
    # 远程特有功能：数据拉取和列表
    # ========================================

    def pull_recent_days(self, days: int, local_data_dir: str = "output") -> int:
        """
        从远程拉取最近 N 天的数据到本地

        Args:
            days: 拉取天数
            local_data_dir: 本地数据目录

        Returns:
            成功拉取的数据库文件数量
        """
        if days <= 0:
            return 0

        local_dir = Path(local_data_dir)
        local_dir.mkdir(parents=True, exist_ok=True)

        pulled_count = 0
        now = self._get_configured_time()

        print(f"[远程存储] 开始拉取最近 {days} 天的数据...")

        for i in range(days):
            date = now - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")

            # 本地目标路径
            local_date_dir = local_dir / date_str
            local_db_path = local_date_dir / "news.db"

            # 如果本地已存在，跳过
            if local_db_path.exists():
                print(f"[远程存储] 跳过（本地已存在）: {date_str}")
                continue

            # 远程对象键
            remote_key = f"news/{date_str}.db"

            # 检查远程是否存在
            if not self._check_object_exists(remote_key):
                print(f"[远程存储] 跳过（远程不存在）: {date_str}")
                continue

            # 下载（使用 get_object + iter_chunks 处理 chunked encoding）
            try:
                local_date_dir.mkdir(parents=True, exist_ok=True)
                response = self.s3_client.get_object(Bucket=self.bucket_name, Key=remote_key)
                with open(local_db_path, 'wb') as f:
                    for chunk in response['Body'].iter_chunks(chunk_size=1024*1024):
                        f.write(chunk)
                print(f"[远程存储] 已拉取: {remote_key} -> {local_db_path}")
                pulled_count += 1
            except Exception as e:
                print(f"[远程存储] 拉取失败 ({date_str}): {e}")

        print(f"[远程存储] 拉取完成，共下载 {pulled_count} 个数据库文件")
        return pulled_count

    def list_remote_dates(self) -> List[str]:
        """
        列出远程存储中所有可用的日期

        Returns:
            日期字符串列表（YYYY-MM-DD 格式）
        """
        dates = []

        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix="news/")

            for page in pages:
                if 'Contents' not in page:
                    continue

                for obj in page['Contents']:
                    key = obj['Key']
                    # 解析日期
                    date_match = re.match(r'news/(\d{4}-\d{2}-\d{2})\.db$', key)
                    if date_match:
                        dates.append(date_match.group(1))

            return sorted(dates, reverse=True)

        except Exception as e:
            print(f"[远程存储] 列出远程日期失败: {e}")
            return []
