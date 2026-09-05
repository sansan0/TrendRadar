import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mcp_server.services.data_service import DataService


class SystemVersionResolutionTest(unittest.TestCase):
    def test_get_system_status_prefers_package_version_when_version_file_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_root = Path(tmp)
            output_dir = project_root / "output"
            output_dir.mkdir(parents=True, exist_ok=True)
            (project_root / "version").write_text("", encoding="utf-8")

            service = DataService(str(project_root))

            with patch.object(service, "get_available_date_range", return_value=(None, None)):
                status = service.get_system_status()

            self.assertIn("version", status["system"])
            self.assertNotEqual(status["system"]["version"], "unknown")


if __name__ == "__main__":
    unittest.main()
