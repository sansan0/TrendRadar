"""Exercise registered MCP dispatch and the outbound HTTP protocol."""

import asyncio
import json
import unittest
from unittest.mock import patch

import httpx
from fastmcp import Client

from mcp_server.server import mcp
from mcp_server.tools import web_search


ARGS = {
    "objective": "Find official EU AI Act sources",
    "search_queries": ["EU AI Act implementation timeline"],
    "session_id": "e23ea9c2-78ce-4d02-8b7b-107d8b01cceb",
}
DATA = {"results": [{"url": "https://example.org/ai-act", "title": "AI Act",
                     "excerpts": ["Implementation timeline"]}],
        "session_id": ARGS["session_id"], "search_id": "search_fixture"}


class WebSearchTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []
        self.mode = "success"
        self.started = asyncio.Event()

    async def respond(self, request):
        self.requests.append(request)
        self.assertEqual(str(request.url), web_search.PARALLEL_MCP_URL)
        self.assertEqual(request.headers["user-agent"], web_search.USER_AGENT)
        self.assertNotIn("authorization", request.headers)
        self.assertNotIn("cookie", request.headers)
        self.assertNotIn("x-private", request.headers)
        if request.method == "DELETE":
            return httpx.Response(200)
        body = json.loads(request.content)
        method = body["method"]
        if "id" not in body:
            return httpx.Response(202)
        if method == "initialize":
            result = {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}},
                      "serverInfo": {"name": "parallel-fixture", "version": "1"}}
        elif method == "tools/list":
            result = {"tools": [{"name": "web_search", "inputSchema": {
                "type": "object", "properties": {}}}]}
        elif method == "tools/call":
            self.assertEqual(body["params"]["name"], "web_search")
            self.assertEqual(body["params"]["arguments"], ARGS)
            self.started.set()
            if self.mode == "wait":
                await asyncio.Event().wait()
            if self.mode == "http_error":
                return httpx.Response(503)
            result = {"content": [{"type": "text", "text": json.dumps(DATA)}],
                      "isError": self.mode == "tool_error"}
            if self.mode == "success":
                result["structuredContent"] = DATA
            if self.mode == "malformed":
                result["content"][0]["text"] = "not JSON"
        else:
            self.fail(f"Unexpected outbound method: {method}")
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"],
                                         "result": result})

    def mock_http(self):
        real_client = httpx.AsyncClient

        def make_client(**kwargs):
            return real_client(transport=httpx.MockTransport(self.respond), **kwargs)

        return patch.object(web_search.httpx, "AsyncClient", side_effect=make_client)

    async def dispatch(self, args=None):
        async with Client(mcp) as client:
            tools = await client.list_tools()
            self.assertIn("search_news", {tool.name for tool in tools})
            self.assertIn("read_article", {tool.name for tool in tools})
            self.assertIn("search_web", {tool.name for tool in tools})
            result = await client.call_tool("search_web", args or ARGS)
            return json.loads(result.content[0].text)

    async def test_registered_dispatch_anonymous_headers_and_results(self):
        # Simulate an authenticated inbound HTTP caller, saved/environment keys
        # and private headers. None may reach the external anonymous endpoint.
        with self.mock_http(), patch(
            "fastmcp.client.transports.get_http_headers",
            return_value={"authorization": "Bearer private", "cookie": "secret=1",
                          "x-private": "do-not-forward"},
        ), patch.dict("os.environ", {"PARALLEL_API_KEY": "unused"}):
            result = await self.dispatch()
        self.assertEqual(result, {"success": True, "data": DATA})
        self.assertGreaterEqual(len(self.requests), 3)

    async def test_text_response_fallback(self):
        self.mode = "text"
        with self.mock_http():
            self.assertEqual((await self.dispatch())["data"], DATA)

    async def test_invalid_inputs_do_not_connect(self):
        for changes in [{"objective": " "}, {"search_queries": []},
                        {"search_queries": [" "]}, {"session_id": ""},
                        {"session_id": "a" * 101}]:
            with self.mock_http():
                result = await self.dispatch(ARGS | changes)
            self.assertEqual(result["error"]["code"], "INVALID_PARAMETER")
        self.assertEqual(self.requests, [])

    async def test_remote_errors_do_not_claim_success_or_retry(self):
        for mode in ["tool_error", "http_error", "malformed"]:
            self.mode = mode
            self.requests.clear()
            with self.mock_http():
                result = await self.dispatch()
            self.assertFalse(result["success"])
            self.assertEqual(result["error"]["code"], "SEARCH_FAILED")
            calls = [r for r in self.requests if r.content and
                     json.loads(r.content).get("method") == "tools/call"]
            self.assertEqual(len(calls), 1)

    async def test_total_timeout(self):
        self.mode = "wait"
        with self.mock_http(), patch.object(web_search, "SEARCH_TIMEOUT", 0.1):
            result = await web_search.search_web(**ARGS)
        self.assertEqual(result["error"]["code"], "TIMEOUT")

    async def test_cancellation_propagates(self):
        self.mode = "wait"
        with self.mock_http():
            task = asyncio.create_task(web_search.search_web(**ARGS))
            await asyncio.wait_for(self.started.wait(), timeout=2)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task


if __name__ == "__main__":
    unittest.main()
