# coding=utf-8
"""
频率词配置加载模块

负责从配置文件加载频率词规则，支持：
- 普通词组
- 必须词（+前缀）
- 过滤词（!前缀）
- 全局过滤词（[GLOBAL_FILTER] 区域）
- 最大显示数量（@前缀）
"""

import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import jieba
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def load_frequency_words(
    custom_dict_file: Optional[str] = None,
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
        custom_dict_file: 自定义词典文件路径，默认从环境变量 CUSTOM_DICT_FILE 获取或使用 config/custom_dict.txt
        frequency_file: 频率词配置文件路径，默认从环境变量 FREQUENCY_WORDS_PATH 获取或使用 config/frequency_words.txt

    Returns:
        (词组列表, 词组内过滤词, 全局过滤词)

    Raises:
        FileNotFoundError: 频率词文件不存在
    """
    if custom_dict_file is None:
        custom_dict_file = os.environ.get(
            "CUSTOM_DICT_FILE", "config/custom_dict.txt"
        )

    # 检查文件是否存在
    if Path(custom_dict_file).exists():
        jieba.load_userdict(custom_dict_file)
        print(f"成功加载自定义词典: {custom_dict_file}")
    else:
        print(f"自定义词典文件 {custom_dict_file} 不存在，将使用默认分词")

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
        lines = [line.strip() for line in group.split("\n") if line.strip()]

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
                filter_words.append(word[1:])
                group_filter_words.append(word[1:])
            elif word.startswith("+"):
                group_required_words.append(word[1:])
            else:
                group_normal_words.append(word)

        if group_required_words or group_normal_words:
            if group_normal_words:
                group_key = " ".join(group_normal_words)
            else:
                group_key = " ".join(group_required_words)

            processed_groups.append(
                {
                    "required": group_required_words,
                    "normal": group_normal_words,
                    "group_key": group_key,
                    "max_count": group_max_count,
                }
            )

    return processed_groups, filter_words, global_filters


def matches_word_groups(
    title: str,
    word_groups: List[Dict],
    filter_words: List[str],
    global_filters: Optional[List[str]] = None
) -> bool:
    """
    检查标题是否匹配词组规则

    Args:
        title: 标题文本
        word_groups: 词组列表
        filter_words: 过滤词列表
        global_filters: 全局过滤词列表

    Returns:
        是否匹配
    """
    # 防御性类型检查：确保 title 是有效字符串
    if not isinstance(title, str):
        title = str(title) if title is not None else ""
    if not title.strip():
        return False

    # 使用jieba进行分词
    title_tokens = ' '.join(
        [token.lower() for token in jieba.lcut(title) if token.strip()]
    )
    title_lower = title.lower()

    # 全局过滤检查（优先级最高）
    if global_filters:
        if any(global_word.lower() in title_lower for global_word in global_filters):
            return False

    # 如果没有配置词组，则匹配所有标题（支持显示全部新闻）
    if not word_groups:
        return True

    # 过滤词检查
    if any(filter_word.lower() in title_lower for filter_word in filter_words):
        return False

    # TF-IDF相似度匹配检查
    for group in word_groups:
        required_words = group["required"]
        normal_words = group["normal"]

        # 构建关键词集合
        keywords = []
        # 必须词检查
        if required_words:
            keywords.extend(required_words)
        # 普通词检查
        if normal_words:
            keywords.extend(normal_words)

        if not keywords:
            continue

        # 使用TF-IDF计算相似度
        keyword_text = " ".join(keywords).lower()
        if tfidf_match(title_tokens, keyword_text):
            return True
        return True

    return False


def tfidf_match(
    title_tokens: str, keyword_text: str, threshold: float = 0.105
) -> bool:
    """
    使用TF-IDF计算标题与关键词的相似度

    Args:
        title_tokens: 分词后的标题文本
        keyword_text: 关键词文本
        threshold: 相似度阈值，建议0.1-0.3之间，对于新闻热点分析场景，建议将阈值设置在 0.15-0.25 之间比较合适，既能保证足够的召回率，又能维持较好的准确性。

    Returns:
        bool: 是否匹配
    """
    # 创建TF-IDF向量化器
    vectorizer = TfidfVectorizer(
        tokenizer=None, preprocessor=lambda x: x if x else "",
        stop_words=['的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
                    '都', '一', '一个',
                    '上', '也', '很',
                    '到', '说', '要',
                    '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
                    '那', '来', '被',
                    '与', '为', '对', '将',
                    '从', '以', '及',
                    '等', '但', '或', '而', '于', '中', '由', '可', '可以',
                    '已', '已经', '还',
                    '更', '最', '再',
                    '因为', '所以', '如果',
                    '虽然', '然而'], lowercase=True, )

    try:
        # 向量化处理
        tfidf_matrix = vectorizer.fit_transform([title_tokens, keyword_text])

        # 计算余弦相似度
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][
            0]

        return similarity >= threshold
    except:
        # 如果TF-IDF计算失败，回退到传统匹配方式
        return keyword_text in title_tokens
