"""
文件解析服务

提供txt格式新闻数据和YAML配置文件的解析功能。
"""

import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime

import yaml

from ..utils.errors import FileParseError, DataNotFoundError
from .cache_service import get_cache


class ParserService:
    """文件解析服务类"""

    def __init__(self, project_root: str = None):
        """
        初始化解析服务

        Args:
            project_root: 项目根目录，默认为当前目录的父目录
        """
        if project_root is None:
            # 获取当前文件所在目录的父目录的父目录
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        # 初始化缓存服务
        self.cache = get_cache()

    @staticmethod
    def clean_title(title: str) -> str:
        """
        清理标题文本

        Args:
            title: 原始标题

        Returns:
            清理后的标题
        """
        # 移除多余空白
        title = re.sub(r'\s+', ' ', title)
        # 移除特殊字符
        title = title.strip()
        return title

    def parse_txt_file(self, file_path: Path) -> Tuple[Dict, Dict]:
        """
        解析单个txt文件的标题数据

        Args:
            file_path: txt文件路径

        Returns:
            (titles_by_id, id_to_name) 元组
            - titles_by_id: {platform_id: {title: {ranks, url, mobileUrl}}}
            - id_to_name: {platform_id: platform_name}

        Raises:
            FileParseError: 文件解析错误
        """
        if not file_path.exists():
            raise FileParseError(str(file_path), "文件不存在")

        titles_by_id = {}
        id_to_name = {}

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                sections = content.split("\n\n")

                for section in sections:
                    if not section.strip() or "==== 以下ID请求失败 ====" in section:
                        continue

                    lines = section.strip().split("\n")
                    if len(lines) < 2:
                        continue

                    # 解析header: id | name 或 id
                    header_line = lines[0].strip()
                    if " | " in header_line:
                        parts = header_line.split(" | ", 1)
                        source_id = parts[0].strip()
                        name = parts[1].strip()
                        id_to_name[source_id] = name
                    else:
                        source_id = header_line
                        id_to_name[source_id] = source_id

                    titles_by_id[source_id] = {}

                    # 解析标题行
                    for line in lines[1:]:
                        if line.strip():
                            try:
                                title_part = line.strip()
                                rank = None

                                # 提取排名
                                if ". " in title_part and title_part.split(". ")[0].isdigit():
                                    rank_str, title_part = title_part.split(". ", 1)
                                    rank = int(rank_str)

                                # 提取 MOBILE URL
                                mobile_url = ""
                                if " [MOBILE:" in title_part:
                                    title_part, mobile_part = title_part.rsplit(" [MOBILE:", 1)
                                    if mobile_part.endswith("]"):
                                        mobile_url = mobile_part[:-1]

                                # 提取 URL
                                url = ""
                                if " [URL:" in title_part:
                                    title_part, url_part = title_part.rsplit(" [URL:", 1)
                                    if url_part.endswith("]"):
                                        url = url_part[:-1]

                                title = self.clean_title(title_part.strip())
                                ranks = [rank] if rank is not None else [1]

                                titles_by_id[source_id][title] = {
                                    "ranks": ranks,
                                    "url": url,
                                    "mobileUrl": mobile_url,
                                }

                            except Exception as e:
                                # 忽略单行解析错误
                                continue

        except Exception as e:
            raise FileParseError(str(file_path), str(e))

        return titles_by_id, id_to_name

    def get_date_folder_name(self, date: datetime = None) -> str:
        """
        获取日期文件夹名称

        Args:
            date: 日期对象，默认为今天

        Returns:
            文件夹名称，格式: YYYY年MM月DD日
        """
        if date is None:
            date = datetime.now()
        return date.strftime("%Y年%m月%d日")

    def read_all_titles_for_date(
        self,
        date: datetime = None,
        platform_ids: Optional[List[str]] = None
    ) -> Tuple[Dict, Dict, Dict]:
        """
        读取指定日期的所有标题文件（带缓存）

        Args:
            date: 日期对象，默认为今天
            platform_ids: 平台ID列表，None表示所有平台

        Returns:
            (all_titles, id_to_name, all_timestamps) 元组
            - all_titles: {platform_id: {title: {ranks, url, mobileUrl, ...}}}
            - id_to_name: {platform_id: platform_name}
            - all_timestamps: {filename: timestamp}

        Raises:
            DataNotFoundError: 数据不存在
        """
        # 生成缓存键
        date_str = self.get_date_folder_name(date)
        platform_key = ','.join(sorted(platform_ids)) if platform_ids else 'all'
        cache_key = f"read_all_titles:{date_str}:{platform_key}"

        # 尝试从缓存获取
        # 对于历史数据（非今天），使用更长的缓存时间（1小时）
        # 对于今天的数据，使用较短的缓存时间（15分钟），因为可能有新数据
        is_today = (date is None) or (date.date() == datetime.now().date())
        ttl = 900 if is_today else 3600  # 15分钟 vs 1小时

        cached = self.cache.get(cache_key, ttl=ttl)
        if cached:
            return cached

        # 缓存未命中，读取文件
        date_folder = self.get_date_folder_name(date)
        txt_dir = self.project_root / "output" / date_folder / "txt"

        if not txt_dir.exists():
            raise DataNotFoundError(
                f"未找到 {date_folder} 的数据目录",
                suggestion="请先运行爬虫或检查日期是否正确"
            )

        all_titles = {}
        id_to_name = {}
        all_timestamps = {}

        # 读取所有txt文件
        txt_files = sorted(txt_dir.glob("*.txt"))

        if not txt_files:
            raise DataNotFoundError(
                f"{date_folder} 没有数据文件",
                suggestion="请等待爬虫任务完成"
            )

        for txt_file in txt_files:
            try:
                titles_by_id, file_id_to_name = self.parse_txt_file(txt_file)

                # 更新id_to_name
                id_to_name.update(file_id_to_name)

                # 合并标题数据
                for platform_id, titles in titles_by_id.items():
                    # 如果指定了平台过滤
                    if platform_ids and platform_id not in platform_ids:
                        continue

                    if platform_id not in all_titles:
                        all_titles[platform_id] = {}

                    for title, info in titles.items():
                        if title in all_titles[platform_id]:
                            # 合并排名
                            all_titles[platform_id][title]["ranks"].extend(info["ranks"])
                        else:
                            all_titles[platform_id][title] = info.copy()

                # 记录文件时间戳
                all_timestamps[txt_file.name] = txt_file.stat().st_mtime

            except Exception as e:
                # 忽略单个文件的解析错误，继续处理其他文件
                print(f"Warning: 解析文件 {txt_file} 失败: {e}")
                continue

        if not all_titles:
            raise DataNotFoundError(
                f"{date_folder} 没有有效的数据",
                suggestion="请检查数据文件格式或重新运行爬虫"
            )

        # 缓存结果
        result = (all_titles, id_to_name, all_timestamps)
        self.cache.set(cache_key, result)

        return result

    def parse_yaml_config(self, config_path: str = None) -> dict:
        """
        解析YAML配置文件

        Args:
            config_path: 配置文件路径，默认为 config/config.yaml

        Returns:
            配置字典

        Raises:
            FileParseError: 配置文件解析错误
        """
        if config_path is None:
            config_path = self.project_root / "config" / "config.yaml"
        else:
            config_path = Path(config_path)

        if not config_path.exists():
            raise FileParseError(str(config_path), "配置文件不存在")

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f)
            return config_data
        except Exception as e:
            raise FileParseError(str(config_path), str(e))

    def parse_frequency_words(self, words_file: str = None) -> List[Dict]:
        """
        解析关键词配置文件

        Args:
            words_file: 关键词文件路径，默认为 config/frequency_words.txt

        Returns:
            词组列表

        Raises:
            FileParseError: 文件解析错误
        """
        if words_file is None:
            words_file = self.project_root / "config" / "frequency_words.txt"
        else:
            words_file = Path(words_file)

        if not words_file.exists():
            return []

        word_groups = []

        try:
            with open(words_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue

                    # 使用 | 分隔符
                    parts = [p.strip() for p in line.split("|")]
                    if not parts:
                        continue

                    group = {
                        "required": [],
                        "normal": [],
                        "filter_words": []
                    }

                    for part in parts:
                        if not part:
                            continue

                        words = [w.strip() for w in part.split(",")]
                        for word in words:
                            if not word:
                                continue
                            if word.endswith("+"):
                                # 必须词
                                group["required"].append(word[:-1])
                            elif word.endswith("!"):
                                # 过滤词
                                group["filter_words"].append(word[:-1])
                            else:
                                # 普通词
                                group["normal"].append(word)

                    if group["required"] or group["normal"]:
                        word_groups.append(group)

        except Exception as e:
            raise FileParseError(str(words_file), str(e))

        return word_groups
