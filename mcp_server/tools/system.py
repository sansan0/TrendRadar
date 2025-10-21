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
            import json
            import time
            import random
            import requests
            from datetime import datetime
            import pytz
            import yaml

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

            # 获取请求间隔
            request_interval = config_data.get("crawler", {}).get("request_interval", 100)

            # 构建平台ID列表
            ids = []
            for platform in target_platforms:
                if "name" in platform:
                    ids.append((platform["id"], platform["name"]))
                else:
                    ids.append(platform["id"])

            print(f"开始临时爬取，平台: {[p.get('name', p['id']) for p in target_platforms]}")

            # 爬取数据
            results = {}
            id_to_name = {}
            failed_ids = []

            for i, id_info in enumerate(ids):
                if isinstance(id_info, tuple):
                    id_value, name = id_info
                else:
                    id_value = id_info
                    name = id_value

                id_to_name[id_value] = name

                # 构建请求URL
                url = f"https://newsnow.busiyi.world/api/s?id={id_value}&latest"

                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Connection": "keep-alive",
                    "Cache-Control": "no-cache",
                }

                # 重试机制
                max_retries = 2
                retries = 0
                success = False

                while retries <= max_retries and not success:
                    try:
                        response = requests.get(url, headers=headers, timeout=10)
                        response.raise_for_status()

                        data_text = response.text
                        data_json = json.loads(data_text)

                        status = data_json.get("status", "未知")
                        if status not in ["success", "cache"]:
                            raise ValueError(f"响应状态异常: {status}")

                        status_info = "最新数据" if status == "success" else "缓存数据"
                        print(f"获取 {id_value} 成功（{status_info}）")

                        # 解析数据
                        results[id_value] = {}
                        for index, item in enumerate(data_json.get("items", []), 1):
                            title = item["title"]
                            url_link = item.get("url", "")
                            mobile_url = item.get("mobileUrl", "")

                            if title in results[id_value]:
                                results[id_value][title]["ranks"].append(index)
                            else:
                                results[id_value][title] = {
                                    "ranks": [index],
                                    "url": url_link,
                                    "mobileUrl": mobile_url,
                                }

                        success = True

                    except Exception as e:
                        retries += 1
                        if retries <= max_retries:
                            wait_time = random.uniform(3, 5)
                            print(f"请求 {id_value} 失败: {e}. {wait_time:.2f}秒后重试...")
                            time.sleep(wait_time)
                        else:
                            print(f"请求 {id_value} 失败: {e}")
                            failed_ids.append(id_value)

                # 请求间隔
                if i < len(ids) - 1:
                    actual_interval = request_interval + random.randint(-10, 20)
                    actual_interval = max(50, actual_interval)
                    time.sleep(actual_interval / 1000)

            # 格式化返回数据
            news_data = []
            for platform_id, titles_data in results.items():
                platform_name = id_to_name.get(platform_id, platform_id)
                for title, info in titles_data.items():
                    news_item = {
                        "platform_id": platform_id,
                        "platform_name": platform_name,
                        "title": title,
                        "ranks": info["ranks"]
                    }

                    # 条件性添加 URL 字段
                    if include_url:
                        news_item["url"] = info.get("url", "")
                        news_item["mobile_url"] = info.get("mobileUrl", "")

                    news_data.append(news_item)

            # 获取北京时间
            beijing_tz = pytz.timezone("Asia/Shanghai")
            now = datetime.now(beijing_tz)

            # 构建返回结果
            result = {
                "success": True,
                "task_id": f"crawl_{int(time.time())}",
                "status": "completed",
                "crawl_time": now.strftime("%Y-%m-%d %H:%M:%S"),
                "platforms": list(results.keys()),
                "total_news": len(news_data),
                "failed_platforms": failed_ids,
                "data": news_data,
                "saved_to_local": save_to_local
            }

            # 如果需要持久化，调用保存逻辑
            if save_to_local:
                try:
                    import re

                    # 辅助函数：清理标题
                    def clean_title(title: str) -> str:
                        """清理标题中的特殊字符"""
                        if not isinstance(title, str):
                            title = str(title)
                        cleaned_title = title.replace("\n", " ").replace("\r", " ")
                        cleaned_title = re.sub(r"\s+", " ", cleaned_title)
                        cleaned_title = cleaned_title.strip()
                        return cleaned_title

                    # 辅助函数：创建目录
                    def ensure_directory_exists(directory: str):
                        """确保目录存在"""
                        Path(directory).mkdir(parents=True, exist_ok=True)

                    # 格式化日期和时间
                    date_folder = now.strftime("%Y年%m月%d日")
                    time_filename = now.strftime("%H时%M分")

                    # 创建 txt 文件路径
                    txt_dir = self.project_root / "output" / date_folder / "txt"
                    ensure_directory_exists(str(txt_dir))
                    txt_file_path = txt_dir / f"{time_filename}.txt"

                    # 创建 html 文件路径
                    html_dir = self.project_root / "output" / date_folder / "html"
                    ensure_directory_exists(str(html_dir))
                    html_file_path = html_dir / f"{time_filename}.html"

                    # 保存 txt 文件（按照 main.py 的格式）
                    with open(txt_file_path, "w", encoding="utf-8") as f:
                        for id_value, title_data in results.items():
                            # id | name 或 id
                            name = id_to_name.get(id_value)
                            if name and name != id_value:
                                f.write(f"{id_value} | {name}\n")
                            else:
                                f.write(f"{id_value}\n")

                            # 按排名排序标题
                            sorted_titles = []
                            for title, info in title_data.items():
                                cleaned = clean_title(title)
                                if isinstance(info, dict):
                                    ranks = info.get("ranks", [])
                                    url = info.get("url", "")
                                    mobile_url = info.get("mobileUrl", "")
                                else:
                                    ranks = info if isinstance(info, list) else []
                                    url = ""
                                    mobile_url = ""

                                rank = ranks[0] if ranks else 1
                                sorted_titles.append((rank, cleaned, url, mobile_url))

                            sorted_titles.sort(key=lambda x: x[0])

                            for rank, cleaned, url, mobile_url in sorted_titles:
                                line = f"{rank}. {cleaned}"
                                if url:
                                    line += f" [URL:{url}]"
                                if mobile_url:
                                    line += f" [MOBILE:{mobile_url}]"
                                f.write(line + "\n")

                            f.write("\n")

                        if failed_ids:
                            f.write("==== 以下ID请求失败 ====\n")
                            for id_value in failed_ids:
                                f.write(f"{id_value}\n")

                    # 保存 html 文件（简化版）
                    html_content = self._generate_simple_html(results, id_to_name, failed_ids, now)
                    with open(html_file_path, "w", encoding="utf-8") as f:
                        f.write(html_content)

                    print(f"数据已保存到:")
                    print(f"  TXT: {txt_file_path}")
                    print(f"  HTML: {html_file_path}")

                    result["saved_files"] = {
                        "txt": str(txt_file_path),
                        "html": str(html_file_path)
                    }
                    result["note"] = "数据已持久化到 output 文件夹"

                except Exception as e:
                    print(f"保存文件失败: {e}")
                    result["save_error"] = str(e)
                    result["note"] = "爬取成功但保存失败，数据仅在内存中"
            else:
                result["note"] = "临时爬取结果，未持久化到output文件夹"

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
