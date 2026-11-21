"""Regression tests for ignoring extra MCP tool arguments (issue #768)."""

import asyncio
import json
import unittest

from fastmcp import Client
from fastmcp.exceptions import ToolError

from mcp_server.server import mcp


class MCPExtraArgumentsTests(unittest.TestCase):
    def test_ignores_unknown_arguments_injected_by_clients(self):
        async def run():
            async with Client(mcp) as client:
                result = await client.call_tool(
                    "get_current_config",
                    {
                        "section": "keywords",
                        "sessionId": "1bd19f08a0474d6aafc5df28e09b9c47",
                        "action": "sendMessage",
                        "chatInput": "触发一次抓取",
                        "toolCallId": "call_123",
                    },
                )
                return json.loads(result.content[0].text)

        payload = asyncio.run(run())
        self.assertTrue(payload.get("success"), payload)

    def test_zero_arg_tool_ignores_unknown_arguments(self):
        async def run():
            async with Client(mcp) as client:
                result = await client.call_tool(
                    "get_system_status",
                    {
                        "sessionId": "sess-1",
                        "action": "sendMessage",
                        "chatInput": "check status",
                        "toolCallId": "call_456",
                    },
                )
                return json.loads(result.content[0].text)

        payload = asyncio.run(run())
        self.assertTrue(payload.get("success"), payload)
        self.assertIn("system", payload.get("data", {}))

    def test_invalid_declared_argument_still_fails_validation(self):
        async def run():
            async with Client(mcp) as client:
                await client.call_tool(
                    "get_latest_news",
                    {
                        "limit": "not-an-integer",
                        "sessionId": "sess-2",
                    },
                )

        with self.assertRaises(ToolError) as ctx:
            asyncio.run(run())
        self.assertIn("not-an-integer", str(ctx.exception))

    def test_unknown_tool_still_raises_error(self):
        async def run():
            async with Client(mcp) as client:
                await client.call_tool(
                    "nonexistent_trendradar_tool",
                    {"sessionId": "sess-3"},
                )

        with self.assertRaises(ToolError) as ctx:
            asyncio.run(run())
        self.assertIn("Unknown tool", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
