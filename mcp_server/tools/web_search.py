"""按需通过免费的 Parallel Search MCP 搜索外部网页。"""

import asyncio
import json
from typing import Dict, List

import httpx
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport


PARALLEL_MCP_URL = "https://search.parallel.ai/mcp"
USER_AGENT = "TrendRadar (+https://github.com/sansan0/TrendRadar)"
SEARCH_TIMEOUT = 30


def _anonymous_http_client(headers=None, timeout=None, auth=None):
    # FastMCP 的 HTTP transport 会继承入站请求头。这里不转发客户端的
    # Authorization、Cookie 或其他私有头，确保始终使用匿名免费接口。
    # MCP 协议头由 SDK 在每次请求时添加。
    async def anonymous_request(request):
        # SDK 也会在单次请求中合并 transport 的请求头，因此在发送前
        # 仅保留 HTTP/MCP 协议必需的头，并固定 User-Agent。
        allowed = {"host", "content-length", "content-type", "accept",
                   "accept-encoding", "connection", "mcp-session-id",
                   "mcp-protocol-version", "last-event-id", "user-agent"}
        for name in list(request.headers):
            if name not in allowed:
                del request.headers[name]
        request.headers["User-Agent"] = USER_AGENT

    return httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        timeout=timeout or httpx.Timeout(SEARCH_TIMEOUT),
        follow_redirects=True,
        event_hooks={"request": [anonymous_request]},
    )


def _error(code: str, message: str) -> Dict:
    return {"success": False, "error": {"code": code, "message": message}}


async def search_web(objective: str, search_queries: List[str], session_id: str) -> Dict:
    """搜索外部来源，不读取或修改 TrendRadar 的本地数据及配置。"""
    if not objective.strip() or not search_queries or any(
        not query.strip() for query in search_queries
    ):
        return _error("INVALID_PARAMETER", "请提供搜索目标和至少一个非空搜索词。")
    if not session_id.strip() or len(session_id) > 100:
        return _error("INVALID_PARAMETER", "请提供最多 100 字符的会话标识，并在同一对话中复用。")

    transport = StreamableHttpTransport(
        PARALLEL_MCP_URL,
        httpx_client_factory=_anonymous_http_client,
        sse_read_timeout=SEARCH_TIMEOUT,
    )
    try:
        # 限制连接、初始化和搜索的总耗时；取消操作正常向上传播。
        async with asyncio.timeout(SEARCH_TIMEOUT):
            async with Client(transport, timeout=SEARCH_TIMEOUT) as client:
                result = await client.call_tool_mcp("web_search", {
                    "objective": objective,
                    "search_queries": search_queries,
                    "session_id": session_id,
                })
        if result.isError:
            return _error("SEARCH_FAILED", "Parallel 搜索未完成，请稍后重试（免费接口有速率限制）。")
        data = result.structuredContent
        if data is None:
            data = json.loads("\n".join(
                block.text for block in result.content if block.type == "text"
            ))
        if not isinstance(data, dict) or not isinstance(data.get("results"), list):
            return _error("SEARCH_FAILED", "Parallel 返回了无法识别的搜索结果。")
        return {"success": True, "data": data}
    except TimeoutError:
        return _error("TIMEOUT", "网页搜索超时，请稍后重试。")
    except Exception:
        return _error("SEARCH_FAILED", "无法完成 Parallel 网页搜索，请检查网络或稍后重试。")
