"""Email notification configuration and SMTP behavior tests."""

import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from typing import ClassVar
from unittest.mock import patch

from mcp_server.tools.notification import NotificationTools
from mcp_server.tools.notification import _send_email as send_mcp_email
from trendradar.core.loader import _load_webhook_config
from trendradar.notification.dispatcher import NotificationDispatcher


class FakeSMTP:
    """Minimal SMTP boundary fake used to verify the generated message."""

    instances: ClassVar[list["FakeSMTP"]] = []

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.login_args = None
        self.message = None
        self.started_tls = False
        self.quit_called = False
        self.__class__.instances.append(self)

    def set_debuglevel(self, _level):
        pass

    def ehlo(self):
        pass

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.message = message

    def quit(self):
        self.quit_called = True


class EmailConfigTests(unittest.TestCase):
    def test_yaml_supports_independent_smtp_username_and_reply_to(self):
        config = {
            "notification": {
                "channels": {
                    "email": {
                        "from": "reports@example.com",
                        "password": "secret",
                        "to": "reader@example.net",
                        "smtp_server": "smtp.example.com",
                        "smtp_port": "587",
                        "smtp_username": "smtp-user",
                        "reply_to": "ops@example.com",
                    }
                }
            }
        }

        with patch.dict("os.environ", {}, clear=True):
            loaded = _load_webhook_config(config)

        self.assertEqual(loaded["EMAIL_SMTP_USERNAME"], "smtp-user")
        self.assertEqual(loaded["EMAIL_REPLY_TO"], "ops@example.com")

    def test_environment_overrides_yaml_email_fields(self):
        config = {
            "notification": {
                "channels": {
                    "email": {
                        "smtp_username": "yaml-user",
                        "reply_to": "yaml@example.com",
                    }
                }
            }
        }

        with patch.dict(
            "os.environ",
            {
                "EMAIL_SMTP_USERNAME": "env-user",
                "EMAIL_REPLY_TO": "env@example.com",
            },
            clear=True,
        ):
            loaded = _load_webhook_config(config)

        self.assertEqual(loaded["EMAIL_SMTP_USERNAME"], "env-user")
        self.assertEqual(loaded["EMAIL_REPLY_TO"], "env@example.com")


class EmailSenderTests(unittest.TestCase):
    def setUp(self):
        FakeSMTP.instances.clear()

    def _html_report(self, directory):
        path = Path(directory) / "report.html"
        path.write_text("<html><body>report</body></html>", encoding="utf-8")
        return str(path)

    def _dispatcher(self, **overrides):
        config = {
            "EMAIL_FROM": "reports@example.com",
            "EMAIL_PASSWORD": "api-key",
            "EMAIL_TO": "reader@example.net",
            "EMAIL_SMTP_SERVER": "smtp.example.com",
            "EMAIL_SMTP_PORT": "587",
        }
        config.update(overrides)
        return NotificationDispatcher(
            config,
            get_time_func=lambda: datetime(2026, 10, 19, 12, 0),
            split_content_func=lambda *_args, **_kwargs: [],
        )

    @patch("trendradar.notification.senders.smtplib.SMTP", FakeSMTP)
    def test_dispatcher_uses_independent_username_from_and_reply_to(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self._dispatcher(
                EMAIL_SMTP_USERNAME="resend",
                EMAIL_REPLY_TO="ops@example.com",
            )._send_email("daily", self._html_report(directory))

        self.assertTrue(result)
        smtp = FakeSMTP.instances[-1]
        self.assertEqual(smtp.login_args, ("resend", "api-key"))
        self.assertEqual(smtp.message["From"], "TrendRadar <reports@example.com>")
        self.assertEqual(smtp.message["Reply-To"], "ops@example.com")
        self.assertTrue(smtp.started_tls)
        self.assertTrue(smtp.quit_called)

    @patch("trendradar.notification.senders.smtplib.SMTP", FakeSMTP)
    def test_existing_configuration_still_logs_in_with_from_address(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self._dispatcher()._send_email(
                "daily", self._html_report(directory)
            )

        self.assertTrue(result)
        smtp = FakeSMTP.instances[-1]
        self.assertEqual(smtp.login_args, ("reports@example.com", "api-key"))
        self.assertIsNone(smtp.message["Reply-To"])


class MCPEmailSenderTests(unittest.TestCase):
    def setUp(self):
        FakeSMTP.instances.clear()

    @patch("mcp_server.tools.notification.smtplib.SMTP", FakeSMTP)
    def test_mcp_sender_uses_independent_username_from_and_reply_to(self):
        result = send_mcp_email(
            from_email="reports@example.com",
            password="api-key",
            to_email="reader@example.net",
            message="Daily report",
            title="TrendRadar",
            smtp_server="smtp.example.com",
            smtp_port="587",
            smtp_username="resend",
            reply_to="ops@example.com",
        )

        self.assertTrue(result["success"])
        smtp = FakeSMTP.instances[-1]
        self.assertEqual(smtp.login_args, ("resend", "api-key"))
        self.assertEqual(smtp.message["From"], "TrendRadar <reports@example.com>")
        self.assertEqual(smtp.message["Reply-To"], "ops@example.com")

    @patch("mcp_server.tools.notification.smtplib.SMTP", FakeSMTP)
    def test_mcp_dispatcher_forwards_smtp_username_and_reply_to(self):
        result = NotificationTools()._dispatch_to_channel(
            "email",
            {
                "EMAIL_FROM": "reports@example.com",
                "EMAIL_PASSWORD": "api-key",
                "EMAIL_TO": "reader@example.net",
                "EMAIL_SMTP_SERVER": "smtp.example.com",
                "EMAIL_SMTP_PORT": "587",
                "EMAIL_SMTP_USERNAME": "resend",
                "EMAIL_REPLY_TO": "ops@example.com",
            },
            "Daily report",
            "TrendRadar",
        )

        self.assertTrue(result["success"])
        smtp = FakeSMTP.instances[-1]
        self.assertEqual(smtp.login_args, ("resend", "api-key"))
        self.assertEqual(smtp.message["Reply-To"], "ops@example.com")

    @patch("mcp_server.tools.notification.smtplib.SMTP", FakeSMTP)
    def test_mcp_existing_configuration_still_uses_from_address(self):
        result = send_mcp_email(
            from_email="reports@example.com",
            password="api-key",
            to_email="reader@example.net",
            message="Daily report",
            title="TrendRadar",
            smtp_server="smtp.example.com",
            smtp_port="587",
        )

        self.assertTrue(result["success"])
        smtp = FakeSMTP.instances[-1]
        self.assertEqual(smtp.login_args, ("reports@example.com", "api-key"))
        self.assertIsNone(smtp.message["Reply-To"])


if __name__ == "__main__":
    unittest.main()
