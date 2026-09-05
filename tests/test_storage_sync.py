from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from mcp_server.tools.storage_sync import StorageSyncTools


class _FakeS3Client:
    def download_file(self, bucket_name, remote_key, local_path):
        Path(local_path).write_bytes(b"database")


class _FakeRemoteBackend:
    bucket_name = "test-bucket"
    s3_client = _FakeS3Client()

    def __init__(self, available_date):
        self.available_date = available_date

    def list_remote_dates(self):
        return [self.available_date]


class StorageSyncTests(TestCase):
    def test_sync_downloads_news_database_to_readable_location(self):
        with TemporaryDirectory() as project_root:
            tools = StorageSyncTools(project_root)
            tools._config = {
                "app": {"timezone": "Asia/Shanghai"},
                "storage": {
                    "local": {"data_dir": "output"},
                    "remote": {
                        "endpoint_url": "https://example.invalid",
                        "bucket_name": "test-bucket",
                        "access_key_id": "test-key",
                        "secret_access_key": "test-secret",
                    },
                },
            }
            today = "2026-09-05"
            tools._remote_backend = _FakeRemoteBackend(today)

            with patch(
                "trendradar.utils.time.get_configured_time",
                return_value=datetime(2026, 9, 5),
            ):
                result = tools.sync_from_remote(days=1)

            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["synced_dates"], [today])
            self.assertEqual(tools._get_local_dates(), [today])
            self.assertTrue(
                (Path(project_root) / "output" / "news" / f"{today}.db").is_file()
            )
