# coding=utf-8
"""
频率词配置加载模块

负责从配置文件加载频率词规则，支持：
- 普通词组
- 必须词（+前缀）
- 过滤词（!前缀）
- 全局过滤词（[GLOBAL_FILTER] 区域）
- 最大显示数量（@前缀）
- 正则表达式（/pattern/ 语法）
- 显示名称（=> 别名 语法）
- 组别名（[组别名] 语法，作为词组第一行）
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union


def _parse_word(word: str) -> Dict:
    """
    解析单个词，识别是否为正则表达式，支持显示名称

    语法：
    - 普通词：word
    - 正则表达式：/pattern/ 或 /pattern/i（flags 会被忽略，默认已启用忽略大小写）
    - 带显示名称：word => 显示名称 或 word=>显示名称（=>两边空格可选）
    - 正则带显示名称：/pattern/ => 显示名称

    Args:
        word: 原始词

    Returns:
        {"word": str, "is_regex": bool, "pattern": Optional[re.Pattern], "display_name": Optional[str]}
    """
    display_name = None

    # 解析 => 显示名称 语法（支持 => 两边有或没有空格）
    # 使用正则匹配：空格可选的 =>
    display_match = re.search(r'\s*=>\s*', word)
    if display_match:
        parts = re.split(r'\s*=>\s*', word, 1)
        word = parts[0].strip()
        display_name = parts[1].strip() if len(parts) > 1 and parts[1].strip() else None

    # 解析正则表达式：支持 /pattern/ 或 /pattern/flags（如 /pattern/i）
    # flags 会被忽略，因为默认已启用 IGNORECASE
    regex_match = re.match(r'^/(.+)/([gimsux]*)$', word)
    if regex_match:
        pattern_str = regex_match.group(1)
        # flags 参数被忽略，统一使用 IGNORECASE
        try:
            pattern = re.compile(pattern_str, re.IGNORECASE)
            return {
                "word": pattern_str,
                "is_regex": True,
                "pattern": pattern,
                "display_name": display_name,
            }
        except re.error:
            # 正则表达式无效，当作普通词处理
            pass

    return {"word": word, "is_regex": False, "pattern": None, "display_name": display_name}


def _word_matches(word_config: Union[str, Dict], title_lower: str) -> bool:
    """
    检查词是否在标题中匹配

    Args:
        word_config: 词配置（字符串或字典）
        title_lower: 小写的标题

    Returns:
        是否匹配
    """
    if isinstance(word_config, str):
        # 向后兼容：纯字符串
        return word_config.lower() in title_lower

    if word_config.get("is_regex") and word_config.get("pattern"):
        # 正则匹配
        return bool(word_config["pattern"].search(title_lower))
    else:
        # 子字符串匹配
        return word_config["word"].lower() in title_lower


def load_frequency_words(
    frequency_file: Optional[str] = None,
) -> Tuple[List[Dict], List[str], List[str]]:
    """
    加载频率词配置

    配置文件格式说明：
    - 每个词组由空行分隔
    - [GLOBAL_FILTER] 区域定义全局过滤词
    - [WORD_GROUPS] 区域定义词组（默认）

    词组语法：
    - 普通词：直接写入，任意匹配即可
    - +词：必须词，所有必须词都要匹配
    - !词：过滤词，匹配则排除
    - @数字：该词组最多显示的条数

    Args:
        frequency_file: 频率词配置文件路径，默认从环境变量 FREQUENCY_WORDS_PATH 获取或使用 config/frequency_words.txt

    Returns:
        (词组列表, 词组内过滤词, 全局过滤词)

    Raises:
        FileNotFoundError: 频率词文件不存在
    """
    if frequency_file is None:
        frequency_file = os.environ.get(
            "FREQUENCY_WORDS_PATH", "config/frequency_words.txt"
        )

    frequency_path = Path(frequency_file)
    if not frequency_path.exists():
        raise FileNotFoundError(f"频率词文件 {frequency_file} 不存在")

    with open(frequency_path, "r", encoding="utf-8") as f:
        content = f.read()

    word_groups = [group.strip() for group in content.split("\n\n") if group.strip()]

    processed_groups = []
    filter_words = []
    global_filters = []

    # 默认区域（向后兼容）
    current_section = "WORD_GROUPS"

    for group in word_groups:
        # 过滤空行和注释行（# 开头）
        lines = [line.strip() for line in group.split("\n") if line.strip() and not line.strip().startswith("#")]

        if not lines:
            continue

        # 检查是否为区域标记
        if lines[0].startswith("[") and lines[0].endswith("]"):
            section_name = lines[0][1:-1].upper()
            if section_name in ("GLOBAL_FILTER", "WORD_GROUPS"):
                current_section = section_name
                lines = lines[1:]  # 移除标记行

        # 处理全局过滤区域
        if current_section == "GLOBAL_FILTER":
            # 直接添加所有非空行到全局过滤列表
            for line in lines:
                # 忽略特殊语法前缀，只提取纯文本
                if line.startswith(("!", "+", "@")):
                    continue  # 全局过滤区不支持特殊语法
                if line:
                    global_filters.append(line)
            continue

        # 处理词组区域
        words = lines
        group_alias = None  # 组别名（[别名] 语法）

        # 检查第一行是否为组别名（非区域标记）
        if words and words[0].startswith("[") and words[0].endswith("]"):
            potential_alias = words[0][1:-1].strip()
            # 排除区域标记（GLOBAL_FILTER, WORD_GROUPS）
            if potential_alias.upper() not in ("GLOBAL_FILTER", "WORD_GROUPS"):
                group_alias = potential_alias
                words = words[1:]  # 移除组别名行

        group_required_words = []
        group_normal_words = []
        group_filter_words = []
        group_max_count = 0  # 默认不限制

        for word in words:
            if word.startswith("@"):
                # 解析最大显示数量（只接受正整数）
                try:
                    count = int(word[1:])
                    if count > 0:
                        group_max_count = count
                except (ValueError, IndexError):
                    pass  # 忽略无效的@数字格式
            elif word.startswith("!"):
                # 过滤词（支持正则语法）
                filter_word = word[1:]
                parsed = _parse_word(filter_word)
                filter_words.append(parsed)
                group_filter_words.append(parsed)
            elif word.startswith("+"):
                # 必须词（支持正则语法）
                req_word = word[1:]
                group_required_words.append(_parse_word(req_word))
            else:
                # 普通词（支持正则语法）
                group_normal_words.append(_parse_word(word))

        if group_required_words or group_normal_words:
            if group_normal_words:
                group_key = " ".join(w["word"] for w in group_normal_words)
            else:
                group_key = " ".join(w["word"] for w in group_required_words)

            # 生成显示名称
            # 优先级：组别名 > 行别名拼接 > 关键词拼接
            if group_alias:
                # 有组别名，直接使用
                display_name = group_alias
            else:
                # 没有组别名，拼接每行的显示名（行别名或关键词本身）
                all_words = group_normal_words + group_required_words
                display_parts = []
                for w in all_words:
                    # 优先使用行别名，否则使用关键词本身
                    part = w.get("display_name") or w["word"]
                    display_parts.append(part)
                # 用 " / " 拼接多个词
                display_name = " / ".join(display_parts) if display_parts else None

            processed_groups.append(
                {
                    "required": group_required_words,
                    "normal": group_normal_words,
                    "group_key": group_key,
                    "display_name": display_name,  # 可能为 None
                    "max_count": group_max_count,
                }
            )

    return processed_groups, filter_words, global_filters


def matches_word_groups(
    title: str,
    word_groups: List[Dict],
    filter_words: List,
    global_filters: Optional[List[str]] = None
) -> bool:
    """
    检查标题是否匹配词组规则

    Args:
        title: 标题文本
        word_groups: 词组列表
        filter_words: 过滤词列表（可以是字符串列表或字典列表）
        global_filters: 全局过滤词列表

    Returns:
        是否匹配
    """
    # 防御性类型检查：确保 title 是有效字符串
    if not isinstance(title, str):
        title = str(title) if title is not None else ""
    if not title.strip():
        return False

    title_lower = title.lower()

    # 全局过滤检查（优先级最高）
    if global_filters:
        if any(global_word.lower() in title_lower for global_word in global_filters):
            return False

    # 如果没有配置词组，则匹配所有标题（支持显示全部新闻）
    if not word_groups:
        return True

    # 过滤词检查（兼容新旧格式）
    for filter_item in filter_words:
        if _word_matches(filter_item, title_lower):
            return False

    # 词组匹配检查
    for group in word_groups:
        required_words = group["required"]
        normal_words = group["normal"]

        # 必须词检查
        if required_words:
            all_required_present = all(
                _word_matches(req_item, title_lower) for req_item in required_words
            )
            if not all_required_present:
                continue

        # 普通词检查
        if normal_words:
            any_normal_present = any(
                _word_matches(normal_item, title_lower) for normal_item in normal_words
            )
            if not any_normal_present:
                continue

        return True

    return False
