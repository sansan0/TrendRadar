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
                **status,
                "success": True
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

            # 获取平台配置
            all_platforms = config_data.get("platforms", [])
            if not all_platforms:
                raise CrawlTaskError(
                    "配置文件中没有平台配置",
                    suggestion="请检查 config/config.yaml 中的 platforms 配置"
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
            api_url = crawler_config.get("api_url", "https://newsnow.busiyi.world/api/s")
            proxy_url = None
            if crawler_config.get("use_proxy"):
                proxy_url = crawler_config.get("default_proxy")

            fetcher = DataFetcher(api_url=api_url, proxy_url=proxy_url)
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
                "task_id": f"crawl_{int(time.time())}",
                "status": "completed",
                "crawl_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                "platforms": list(results.keys()),
                "total_news": len(news_response_data),
                "failed_platforms": failed_ids,
                "data": news_response_data,
                "saved_to_local": save_success and save_to_local
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
