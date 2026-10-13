"""Exercise the real stdio transport without user configuration or network access."""

import contextlib
import io
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch


SOURCE_ROOT = Path(__file__).resolve().parents[1]
KEYWORDS = "[WORD_GROUPS]\n人工智能\n机器学习\n"


def stdio_roundtrip(source_root, keywords=KEYWORDS):
    """Return the config response and both streams from a real MCP subprocess."""
    with tempfile.TemporaryDirectory(prefix="trendradar-mcp-stdio-") as directory:
        project_root = Path(directory)
        config_dir = project_root / "config"
        config_dir.mkdir()
        (config_dir / "config.yaml").write_text("{}\n", encoding="utf-8")
        (config_dir / "frequency_words.txt").write_text(keywords, encoding="utf-8")
        (project_root / ".env").write_text("", encoding="utf-8")
        # Allow asyncio's local socket pair, but prevent any external connection.
        (project_root / "sitecustomize.py").write_text(
            "import sys\n"
            "def guard(event, args):\n"
            "    if event == 'socket.connect':\n"
            "        address = args[1]\n"
            "        if not isinstance(address, tuple) or address[0] not in "
            "('127.0.0.1', '::1'):\n"
            "            raise RuntimeError('External network disabled in stdio test')\n"
            "    if event == 'socket.getaddrinfo' and args[0] not in "
            "('localhost', '127.0.0.1', '::1', None):\n"
            "        raise RuntimeError('External DNS disabled in stdio test')\n"
            "sys.addaudithook(guard)\n",
            encoding="utf-8",
        )
        env = {
            key: value for key, value in os.environ.items()
            if key.upper() in {"SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP", "COMSPEC"}
        }
        env.update(
            PYTHONPATH=os.pathsep.join((str(project_root), str(source_root))),
            PYTHONDONTWRITEBYTECODE="1",
            PYTHONIOENCODING="utf-8",
            PYTHONNOUSERSITE="1",
            USERPROFILE=str(project_root),
            LITELLM_LOCAL_MODEL_COST_MAP="True",
        )
        process = subprocess.Popen(
            [sys.executable, "-B", "-u", "-m", "mcp_server.server",
             "--transport", "stdio", "--project-root", str(project_root)],
            cwd=project_root,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            bufsize=1,
        )
        responses = queue.Queue()
        stdout_lines = []
        stderr_lines = []

        def collect(stream, output, channel=None):
            for line in stream:
                output.append(line)
                if channel is not None:
                    channel.put(line)
            if channel is not None:
                channel.put(None)

        readers = [
            threading.Thread(target=collect, args=(process.stdout, stdout_lines, responses)),
            threading.Thread(target=collect, args=(process.stderr, stderr_lines)),
        ]
        for reader in readers:
            reader.start()

        def send(message):
            process.stdin.write(json.dumps(message, ensure_ascii=False) + "\n")
            process.stdin.flush()

        def receive(request_id):
            while True:
                try:
                    line = responses.get(timeout=20)
                except queue.Empty as error:
                    raise AssertionError("Timed out waiting for MCP response") from error
                if line is None:
                    raise AssertionError("MCP exited before replying: " + "".join(stderr_lines))
                message = json.loads(line)
                if message.get("jsonrpc") != "2.0":
                    raise AssertionError(f"Non-JSON-RPC stdout: {line!r}")
                if message.get("id") == request_id:
                    if "error" in message:
                        raise AssertionError(message["error"])
                    return message["result"]

        try:
            send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
                "protocolVersion": "2024-11-05", "capabilities": {},
                "clientInfo": {"name": "stdio-regression-test", "version": "1.0"},
            }})
            initialized = receive(1)
            if "tools" not in initialized["capabilities"]:
                raise AssertionError("Server did not advertise tools")
            send({"jsonrpc": "2.0", "method": "notifications/initialized"})
            send({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
            tools = receive(2)["tools"]
            if "get_current_config" not in {tool["name"] for tool in tools}:
                raise AssertionError("Configuration tool was not registered")
            send({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
                "name": "get_current_config", "arguments": {"section": "keywords"},
            }})
            result = receive(3)
            if result.get("isError"):
                raise AssertionError(result)
            config = json.loads(next(
                item["text"] for item in result["content"] if item["type"] == "text"
            ))
        finally:
            process.stdin.close()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            for reader in readers:
                reader.join(timeout=5)
            process.stdout.close()
            process.stderr.close()

        if process.returncode != 0:
            raise AssertionError("MCP exited unsuccessfully: " + "".join(stderr_lines))
        # Check the entire stream, including anything written after the last reply.
        for line in stdout_lines:
            message = json.loads(line)
            if message.get("jsonrpc") != "2.0":
                raise AssertionError(f"Non-JSON-RPC stdout: {line!r}")
        return config, "".join(stdout_lines), "".join(stderr_lines)


class MCPTransportTests(unittest.TestCase):
    def test_real_stdio_handshake_list_and_keyword_config(self):
        config, stdout, stderr = stdio_roundtrip(SOURCE_ROOT)
        self.assertTrue(config["success"], config)
        self.assertEqual(config["section"], "keywords")
        self.assertEqual(config["config"]["total_groups"], 1)
        self.assertIn("人工智能", json.dumps(config, ensure_ascii=False))
        self.assertIn("机器学习", json.dumps(config, ensure_ascii=False))
        self.assertNotIn("TrendRadar MCP Server - FastMCP 2.0", stdout)
        self.assertIn("TrendRadar MCP Server - FastMCP 2.0", stderr)

    def test_http_keeps_banner_and_original_run_arguments(self):
        # Import while cwd contains no user .env (FastMCP reads it at import time).
        with tempfile.TemporaryDirectory(prefix="trendradar-mcp-http-") as directory:
            with (
                contextlib.chdir(directory),
                patch.dict(os.environ, {"LITELLM_LOCAL_MODEL_COST_MAP": "True"}),
                patch("socket.socket.connect", side_effect=AssertionError("Network disabled")) as connect,
                patch("socket.getaddrinfo", side_effect=AssertionError("DNS disabled")) as resolve,
            ):
                from mcp_server import server
                connect.assert_not_called()
                resolve.assert_not_called()

            stdout, stderr = io.StringIO(), io.StringIO()
            with (
                contextlib.redirect_stdout(stdout),
                contextlib.redirect_stderr(stderr),
                patch.object(server, "_get_tools") as get_tools,
                patch.object(server.mcp, "run") as run,
            ):
                server.run_server(directory, transport="http", host="127.0.0.1", port=8765)
                self.assertIs(sys.stdout, stdout)
            get_tools.assert_called_once_with(directory)
            run.assert_called_once_with(transport="http", host="127.0.0.1", port=8765, path="/mcp")
            self.assertIn("TrendRadar MCP Server - FastMCP 2.0", stdout.getvalue())
            self.assertEqual(stderr.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
