"""
系统管理工具

实现系统状态查询和爬虫触发功能。
"""

from pathlib import Path
from typing import Dict, List, Optional

from ..services.data_service import DataService
from ..utils.validators import validate_platforms
from ..utils.errors import MCPError, CrawlTaskError


class SystemManagementTools:
    """系统管理工具类"""

    def __init__(self, project_root: str = None):
        """
        初始化系统管理工具

        Args:
            project_root: 项目根目录
        """
        self.data_service = DataService(project_root)
        if project_root:
            self.project_root = Path(project_root)
        else:
            # 获取项目根目录
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent

    def get_system_status(self) -> Dict:
        """
        获取系统运行状态和健康检查信息

        Returns:
            系统状态字典

        Example:
            >>> tools = SystemManagementTools()
            >>> result = tools.get_system_status()
            >>> print(result['system']['version'])
        """
        try:
            # 获取系统状态
            status = self.data_service.get_system_status()

            return {
                "success": True,
                "summary": {
                    "description": "系统运行状态和健康检查信息"
                },
                "data": status
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

    def trigger_crawl(self, platforms: Optional[List[str]] = None, save_to_local: bool = False, include_url: bool = False) -> Dict:
        """
        手动触发一次临时爬取任务（可选持久化）

        Args:
            platforms: 指定平台列表，为空则爬取所有平台
            save_to_local: 是否保存到本地 output 目录，默认 False
            include_url: 是否包含URL链接，默认False（节省token）

        Returns:
            爬取结果字典，包含新闻数据和保存路径（如果保存）

        Example:
            >>> tools = SystemManagementTools()
            >>> # 临时爬取，不保存
            >>> result = tools.trigger_crawl(platforms=['zhihu', 'weibo'])
            >>> print(result['data'])
            >>> # 爬取并保存到本地
            >>> result = tools.trigger_crawl(platforms=['zhihu'], save_to_local=True)
            >>> print(result['saved_files'])
        """
        try:
            import time
            import yaml
            from trendradar.crawler.fetcher import DataFetcher
            from trendradar.storage.local import LocalStorageBackend
            from trendradar.storage.base import convert_crawl_results_to_news_data
            from trendradar.utils.time import get_configured_time, format_date_folder, format_time_filename
            from ..services.cache_service import get_cache

            # 参数验证
            platforms = validate_platforms(platforms)

            # 加载配置文件
            config_path = self.project_root / "config" / "config.yaml"
            if not config_path.exists():
                raise CrawlTaskError(
                    "配置文件不存在",
                    suggestion=f"请确保配置文件存在: {config_path}"
                )

            # 读取配置
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f)

            # 获取平台配置（嵌套结构：{enabled: bool, sources: [...]})
            platforms_config = config_data.get("platforms", {})
            if not platforms_config.get("enabled", True):
                raise CrawlTaskError(
                    "热榜平台已禁用",
                    suggestion="请检查 config/config.yaml 中的 platforms.enabled 配置"
                )
            all_platforms = platforms_config.get("sources", [])
            if not all_platforms:
                raise CrawlTaskError(
                    "配置文件中没有平台配置",
                    suggestion="请检查 config/config.yaml 中的 platforms.sources 配置"
                )

            # 过滤平台
            if platforms:
                target_platforms = [p for p in all_platforms if p["id"] in platforms]
                if not target_platforms:
                    raise CrawlTaskError(
                        f"指定的平台不存在: {platforms}",
                        suggestion=f"可用平台: {[p['id'] for p in all_platforms]}"
                    )
            else:
                target_platforms = all_platforms

            # 构建平台ID列表
            ids = []
            for platform in target_platforms:
                if "name" in platform:
                    ids.append((platform["id"], platform["name"]))
                else:
                    ids.append(platform["id"])

            print(f"开始临时爬取，平台: {[p.get('name', p['id']) for p in target_platforms]}")

            # 初始化数据获取器
            advanced = config_data.get("advanced", {})
            crawler_config = advanced.get("crawler", {})
            proxy_url = None
            if crawler_config.get("use_proxy"):
                proxy_url = crawler_config.get("default_proxy")
            
            fetcher = DataFetcher(proxy_url=proxy_url)
            request_interval = crawler_config.get("request_interval", 100)

            # 执行爬取
            results, id_to_name, failed_ids = fetcher.crawl_websites(
                ids_list=ids,
                request_interval=request_interval
            )

            # 获取当前时间（统一使用 trendradar 的时间工具）
            # 从配置中读取时区，默认为 Asia/Shanghai
            timezone = config_data.get("app", {}).get("timezone", "Asia/Shanghai")
            current_time = get_configured_time(timezone)
            crawl_date = format_date_folder(None, timezone)
            crawl_time_str = format_time_filename(timezone)

            # 转换为标准数据模型
            news_data = convert_crawl_results_to_news_data(
                results=results,
                id_to_name=id_to_name,
                failed_ids=failed_ids,
                crawl_time=crawl_time_str,
                crawl_date=crawl_date
            )

            # 初始化存储后端
            storage = LocalStorageBackend(
                data_dir=str(self.project_root / "output"),
                enable_txt=True,
                enable_html=True,
                timezone=timezone
            )

            # 尝试持久化数据
            save_success = False
            save_error_msg = ""
            saved_files = {}

            try:
                # 1. 保存到 SQLite (核心持久化)
                if storage.save_news_data(news_data):
                    save_success = True
                
                # 2. 如果请求保存到本地，生成 TXT/HTML 快照
                if save_to_local:
                    # 保存 TXT
                    txt_path = storage.save_txt_snapshot(news_data)
                    if txt_path:
                        saved_files["txt"] = txt_path

                    # 保存 HTML (使用简化版生成器)
                    html_content = self._generate_simple_html(results, id_to_name, failed_ids, current_time)
                    html_filename = f"{crawl_time_str}.html"
                    html_path = storage.save_html_report(html_content, html_filename)
                    if html_path:
                        saved_files["html"] = html_path

            except Exception as e:
                # 捕获所有保存错误（特别是 Docker 只读卷导致的 PermissionError）
                print(f"[System] 数据保存失败: {e}")
                save_success = False
                save_error_msg = str(e)

            # 3. 清除缓存，确保下次查询获取最新数据
            # 即使保存失败，内存中的数据可能已经通过其他方式更新，或者是临时的
            get_cache().clear()
            print("[System] 缓存已清除")

            # 构建返回结果
            news_response_data = []
            for platform_id, titles_data in results.items():
                platform_name = id_to_name.get(platform_id, platform_id)
                for title, info in titles_data.items():
                    news_item = {
                        "platform_id": platform_id,
                        "platform_name": platform_name,
                        "title": title,
                        "ranks": info.get("ranks", [])
                    }
                    if include_url:
                        news_item["url"] = info.get("url", "")
                        news_item["mobile_url"] = info.get("mobileUrl", "")
                    news_response_data.append(news_item)

            result = {
                "success": True,
                "summary": {
                    "description": "爬取任务执行结果",
                    "task_id": f"crawl_{int(time.time())}",
                    "status": "completed",
                    "crawl_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "total_news": len(news_response_data),
                    "platforms": list(results.keys()),
                    "failed_platforms": failed_ids,
                    "saved_to_local": save_success and save_to_local
                },
                "data": news_response_data
            }

            if save_success:
                if save_to_local:
                    result["saved_files"] = saved_files
                    result["note"] = "数据已保存到 SQLite 数据库及 output 文件夹"
                else:
                    result["note"] = "数据已保存到 SQLite 数据库 (仅内存中返回结果，未生成TXT快照)"
            else:
                # 明确告知用户保存失败
                result["saved_to_local"] = False
                result["save_error"] = save_error_msg
                if "Read-only file system" in save_error_msg or "Permission denied" in save_error_msg:
                    result["note"] = "爬取成功，但无法写入数据库（Docker只读模式）。数据仅在本次返回中有效。"
                else:
                    result["note"] = f"爬取成功但保存失败: {save_error_msg}"

            # 清理资源
            storage.cleanup()

            return result

        except MCPError as e:
            return {
                "success": False,
                "error": e.to_dict()
            }
        except Exception as e:
            import traceback
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e),
                    "traceback": traceback.format_exc()
                }
            }

    def _generate_simple_html(self, results: Dict, id_to_name: Dict, failed_ids: List, now) -> str:
        """生成简化的 HTML 报告"""
        html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP 爬取结果</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .platform { margin-bottom: 30px; }
        .platform-name { background: #4CAF50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; }
        .news-item { padding: 8px; border-bottom: 1px solid #eee; }
        .rank { color: #666; font-weight: bold; margin-right: 10px; }
        .title { color: #333; }
        .link { color: #1976D2; text-decoration: none; margin-left: 10px; font-size: 0.9em; }
        .link:hover { text-decoration: underline; }
        .failed { background: #ffebee; padding: 10px; border-radius: 5px; margin-top: 20px; }
        .failed h3 { color: #c62828; margin-top: 0; }
        .timestamp { color: #666; font-size: 0.9em; text-align: right; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MCP 爬取结果</h1>
"""

        # 添加时间戳
        html += f'        <p class="timestamp">爬取时间: {now.strftime("%Y-%m-%d %H:%M:%S")}</p>\n\n'

        # 遍历每个平台
        for platform_id, titles_data in results.items():
            platform_name = id_to_name.get(platform_id, platform_id)
            html += f'        <div class="platform">\n'
            html += f'            <div class="platform-name">{platform_name}</div>\n'

            # 排序标题
            sorted_items = []
            for title, info in titles_data.items():
                ranks = info.get("ranks", [])
                url = info.get("url", "")
                mobile_url = info.get("mobileUrl", "")
                rank = ranks[0] if ranks else 999
                sorted_items.append((rank, title, url, mobile_url))

            sorted_items.sort(key=lambda x: x[0])

            # 显示新闻
            for rank, title, url, mobile_url in sorted_items:
                html += f'            <div class="news-item">\n'
                html += f'                <span class="rank">{rank}.</span>\n'
                html += f'                <span class="title">{self._html_escape(title)}</span>\n'
                if url:
                    html += f'                <a class="link" href="{self._html_escape(url)}" target="_blank">链接</a>\n'
                if mobile_url and mobile_url != url:
                    html += f'                <a class="link" href="{self._html_escape(mobile_url)}" target="_blank">移动版</a>\n'
                html += '            </div>\n'

            html += '        </div>\n\n'

        # 失败的平台
        if failed_ids:
            html += '        <div class="failed">\n'
            html += '            <h3>请求失败的平台</h3>\n'
            html += '            <ul>\n'
            for platform_id in failed_ids:
                html += f'                <li>{self._html_escape(platform_id)}</li>\n'
            html += '            </ul>\n'
            html += '        </div>\n'

        html += """    </div>
</body>
</html>"""

        return html

    def _html_escape(self, text: str) -> str:
        """HTML 转义"""
        if not isinstance(text, str):
            text = str(text)
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
        )

    def check_version(self, proxy_url: Optional[str] = None) -> Dict:
        """
        检查版本更新

        同时检查 TrendRadar 和 MCP Server 两个组件的版本更新。
        远程版本 URL 从 config.yaml 获取：
        - version_check_url: TrendRadar 版本
        - mcp_version_check_url: MCP Server 版本

        Args:
            proxy_url: 可选的代理URL，用于访问远程版本

        Returns:
            版本检查结果字典，包含：
            - success: 是否成功
            - trendradar: TrendRadar 版本检查结果
            - mcp: MCP Server 版本检查结果
            - any_update: 是否有任何组件需要更新

        Example:
            >>> tools = SystemManagementTools()
            >>> result = tools.check_version()
            >>> print(result['data']['any_update'])
        """
        import yaml
        import requests

        def parse_version(version_str: str):
            """将版本号字符串解析为元组"""
            try:
                parts = version_str.strip().split(".")
                if len(parts) != 3:
                    raise ValueError("版本号格式不正确")
                return int(parts[0]), int(parts[1]), int(parts[2])
            except:
                return 0, 0, 0

        def check_single_version(
            name: str,
            local_version: str,
            remote_url: str,
            proxies: Optional[Dict],
            headers: Dict
        ) -> Dict:
            """检查单个组件的版本"""
            try:
                response = requests.get(
                    remote_url, proxies=proxies, headers=headers, timeout=10
                )
                response.raise_for_status()
                remote_version = response.text.strip()

                local_tuple = parse_version(local_version)
                remote_tuple = parse_version(remote_version)
                need_update = local_tuple < remote_tuple

                if need_update:
                    message = f"发现新版本 {remote_version}，当前版本 {local_version}，建议更新"
                elif local_tuple > remote_tuple:
                    message = f"当前版本 {local_version} 高于远程版本 {remote_version}（可能是开发版本）"
                else:
                    message = f"当前版本 {local_version} 已是最新版本"

                return {
                    "success": True,
                    "name": name,
                    "current_version": local_version,
                    "remote_version": remote_version,
                    "need_update": need_update,
                    "current_parsed": list(local_tuple),
                    "remote_parsed": list(remote_tuple),
                    "message": message
                }
            except requests.exceptions.Timeout:
                return {
                    "success": False,
                    "name": name,
                    "current_version": local_version,
                    "error": "获取远程版本超时"
                }
            except requests.exceptions.RequestException as e:
                return {
                    "success": False,
                    "name": name,
                    "current_version": local_version,
                    "error": f"网络请求失败: {str(e)}"
                }
            except Exception as e:
                return {
                    "success": False,
                    "name": name,
                    "current_version": local_version,
                    "error": str(e)
                }

        try:
            # 导入本地版本
            from trendradar import __version__ as trendradar_version
            from mcp_server import __version__ as mcp_version

            # 从配置文件获取远程版本 URL
            config_path = self.project_root / "config" / "config.yaml"
            if not config_path.exists():
                return {
                    "success": False,
                    "error": {
                        "code": "CONFIG_NOT_FOUND",
                        "message": f"配置文件不存在: {config_path}"
                    }
                }

            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f)

            advanced_config = config_data.get("advanced", {})
            trendradar_url = advanced_config.get(
                "version_check_url",
                "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version"
            )
            mcp_url = advanced_config.get(
                "mcp_version_check_url",
                "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/version_mcp"
            )

            # 配置代理
            proxies = None
            if proxy_url:
                proxies = {"http": proxy_url, "https": proxy_url}

            # 请求头
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/plain, */*",
                "Cache-Control": "no-cache",
            }

            # 检查两个版本
            trendradar_result = check_single_version(
                "TrendRadar", trendradar_version, trendradar_url, proxies, headers
            )
            mcp_result = check_single_version(
                "MCP Server", mcp_version, mcp_url, proxies, headers
            )

            # 判断是否有任何更新
            any_update = (
                (trendradar_result.get("success") and trendradar_result.get("need_update", False)) or
                (mcp_result.get("success") and mcp_result.get("need_update", False))
            )

            return {
                "success": True,
                "summary": {
                    "description": "版本检查结果（TrendRadar + MCP Server）",
                    "any_update": any_update
                },
                "data": {
                    "trendradar": trendradar_result,
                    "mcp": mcp_result,
                    "any_update": any_update
                }
            }

        except ImportError as e:
            return {
                "success": False,
                "error": {
                    "code": "IMPORT_ERROR",
                    "message": f"无法导入版本信息: {str(e)}"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(e)
                }
            }
