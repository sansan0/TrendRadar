# coding=utf-8
"""
统计分析模块

提供新闻统计和分析功能：
- calculate_news_weight: 计算新闻权重
- format_time_display: 格式化时间显示
- count_word_frequency: 统计词频
"""

from typing import Dict, List, Tuple, Optional, Callable

from trendradar.core.frequency import matches_word_groups, _word_matches


def calculate_news_weight(
    title_data: Dict,
    rank_threshold: int,
    weight_config: Dict,
) -> float:
    """
    计算新闻权重，用于排序

    Args:
        title_data: 标题数据，包含 ranks 和 count
        rank_threshold: 排名阈值
        weight_config: 权重配置 {RANK_WEIGHT, FREQUENCY_WEIGHT, HOTNESS_WEIGHT}

    Returns:
        float: 计算出的权重值
    """
    ranks = title_data.get("ranks", [])
    if not ranks:
        return 0.0

    count = title_data.get("count", len(ranks))

    # 排名权重：Σ(11 - min(rank, 10)) / 出现次数
    rank_scores = []
    for rank in ranks:
        score = 11 - min(rank, 10)
        rank_scores.append(score)

    rank_weight = sum(rank_scores) / len(ranks) if ranks else 0

    # 频次权重：min(出现次数, 10) × 10
    frequency_weight = min(count, 10) * 10

    # 热度加成：高排名次数 / 总出现次数 × 100
    high_rank_count = sum(1 for rank in ranks if rank <= rank_threshold)
    hotness_ratio = high_rank_count / len(ranks) if ranks else 0
    hotness_weight = hotness_ratio * 100

    total_weight = (
        rank_weight * weight_config["RANK_WEIGHT"]
        + frequency_weight * weight_config["FREQUENCY_WEIGHT"]
        + hotness_weight * weight_config["HOTNESS_WEIGHT"]
    )

    return total_weight


def format_time_display(
    first_time: str,
    last_time: str,
    convert_time_func: Callable[[str], str],
) -> str:
    """
    格式化时间显示（将 HH-MM 转换为 HH:MM）

    Args:
        first_time: 首次出现时间
        last_time: 最后出现时间
        convert_time_func: 时间格式转换函数

    Returns:
        str: 格式化后的时间显示字符串
    """
    if not first_time:
        return ""
    # 转换为显示格式
    first_display = convert_time_func(first_time)
    last_display = convert_time_func(last_time)
    if first_display == last_display or not last_display:
        return first_display
    else:
        return f"[{first_display} ~ {last_display}]"


def count_word_frequency(
    results: Dict,
    word_groups: List[Dict],
    filter_words: List[str],
    id_to_name: Dict,
    title_info: Optional[Dict] = None,
    rank_threshold: int = 3,
    new_titles: Optional[Dict] = None,
    mode: str = "daily",
    global_filters: Optional[List[str]] = None,
    weight_config: Optional[Dict] = None,
    max_news_per_keyword: int = 0,
    sort_by_position_first: bool = False,
    is_first_crawl_func: Optional[Callable[[], bool]] = None,
    convert_time_func: Optional[Callable[[str], str]] = None,
    quiet: bool = False,
) -> Tuple[List[Dict], int]:
    """
    统计词频，支持必须词、频率词、过滤词、全局过滤词，并标记新增标题

    Args:
        results: 抓取结果 {source_id: {title: title_data}}
        word_groups: 词组配置列表
        filter_words: 过滤词列表
        id_to_name: ID 到名称的映射
        title_info: 标题统计信息（可选）
        rank_threshold: 排名阈值
        new_titles: 新增标题（可选）
        mode: 报告模式 (daily/incremental/current)
        global_filters: 全局过滤词（可选）
        weight_config: 权重配置
        max_news_per_keyword: 每个关键词最大显示数量
        sort_by_position_first: 是否优先按配置位置排序
        is_first_crawl_func: 检测是否是当天第一次爬取的函数
        convert_time_func: 时间格式转换函数
        quiet: 是否静默模式（不打印日志）

    Returns:
        Tuple[List[Dict], int]: (统计结果列表, 总标题数)
    """
    # 默认权重配置
    if weight_config is None:
        weight_config = {
            "RANK_WEIGHT": 0.4,
            "FREQUENCY_WEIGHT": 0.3,
            "HOTNESS_WEIGHT": 0.3,
        }

    # 默认时间转换函数
    if convert_time_func is None:
        convert_time_func = lambda x: x

    # 默认首次爬取检测函数
    if is_first_crawl_func is None:
        is_first_crawl_func = lambda: True

    # 如果没有配置词组，创建一个包含所有新闻的虚拟词组
    if not word_groups:
        print("频率词配置为空，将显示所有新闻")
        word_groups = [{"required": [], "normal": [], "group_key": "全部新闻"}]
        filter_words = []  # 清空过滤词，显示所有新闻

    is_first_today = is_first_crawl_func()

    # 确定处理的数据源和新增标记逻辑
    if mode == "incremental":
        if is_first_today:
            # 增量模式 + 当天第一次：处理所有新闻，都标记为新增
            results_to_process = results
            all_news_are_new = True
        else:
            # 增量模式 + 当天非第一次：只处理新增的新闻
            results_to_process = new_titles if new_titles else {}
            all_news_are_new = True
    elif mode == "current":
        # current 模式：只处理当前时间批次的新闻，但统计信息来自全部历史
        if title_info:
            latest_time = None
            for source_titles in title_info.values():
                for title_data in source_titles.values():
                    last_time = title_data.get("last_time", "")
                    if last_time:
                        if latest_time is None or last_time > latest_time:
                            latest_time = last_time

            # 只处理 last_time 等于最新时间的新闻
            if latest_time:
                results_to_process = {}
                for source_id, source_titles in results.items():
                    if source_id in title_info:
                        filtered_titles = {}
                        for title, title_data in source_titles.items():
                            if title in title_info[source_id]:
                                info = title_info[source_id][title]
                                if info.get("last_time") == latest_time:
                                    filtered_titles[title] = title_data
                        if filtered_titles:
                            results_to_process[source_id] = filtered_titles

                if not quiet:
                    print(
                        f"当前榜单模式：最新时间 {latest_time}，筛选出 {sum(len(titles) for titles in results_to_process.values())} 条当前榜单新闻"
                    )
            else:
                results_to_process = results
        else:
            results_to_process = results
        all_news_are_new = False
    else:
        # 当日汇总模式：处理所有新闻
        results_to_process = results
        all_news_are_new = False
        total_input_news = sum(len(titles) for titles in results.values())
        filter_status = (
            "全部显示"
            if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻"
            else "频率词过滤"
        )
        print(f"当日汇总模式：处理 {total_input_news} 条新闻，模式：{filter_status}")

    word_stats = {}
    total_titles = 0
    processed_titles = {}
    matched_new_count = 0

    if title_info is None:
        title_info = {}
    if new_titles is None:
        new_titles = {}

    for group in word_groups:
        group_key = group["group_key"]
        word_stats[group_key] = {"count": 0, "titles": {}}

    for source_id, titles_data in results_to_process.items():
        total_titles += len(titles_data)

        if source_id not in processed_titles:
            processed_titles[source_id] = {}

        for title, title_data in titles_data.items():
            if title in processed_titles.get(source_id, {}):
                continue

            # 使用统一的匹配逻辑
            matches_frequency_words = matches_word_groups(
                title, word_groups, filter_words, global_filters
            )

            if not matches_frequency_words:
                continue

            # 如果是增量模式或 current 模式第一次，统计匹配的新增新闻数量
            if (mode == "incremental" and all_news_are_new) or (
                mode == "current" and is_first_today
            ):
                matched_new_count += 1

            source_ranks = title_data.get("ranks", [])
            source_url = title_data.get("url", "")
            source_mobile_url = title_data.get("mobileUrl", "")

            # 找到匹配的词组（防御性转换确保类型安全）
            title_lower = str(title).lower() if not isinstance(title, str) else title.lower()
            for group in word_groups:
                required_words = group["required"]
                normal_words = group["normal"]

                # 如果是"全部新闻"模式，所有标题都匹配第一个（唯一的）词组
                if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻":
                    group_key = group["group_key"]
                    word_stats[group_key]["count"] += 1
                    if source_id not in word_stats[group_key]["titles"]:
                        word_stats[group_key]["titles"][source_id] = []
                else:
                    # 原有的匹配逻辑（支持正则语法）
                    if required_words:
                        all_required_present = all(
                            _word_matches(req_item, title_lower)
                            for req_item in required_words
                        )
                        if not all_required_present:
                            continue

                    if normal_words:
                        any_normal_present = any(
                            _word_matches(normal_item, title_lower)
                            for normal_item in normal_words
                        )
                        if not any_normal_present:
                            continue

                    group_key = group["group_key"]
                    word_stats[group_key]["count"] += 1
                    if source_id not in word_stats[group_key]["titles"]:
                        word_stats[group_key]["titles"][source_id] = []

                first_time = ""
                last_time = ""
                count_info = 1
                ranks = source_ranks if source_ranks else []
                url = source_url
                mobile_url = source_mobile_url
                rank_timeline = []

                # 对于 current 模式，从历史统计信息中获取完整数据
                if (
                    mode == "current"
                    and title_info
                    and source_id in title_info
                    and title in title_info[source_id]
                ):
                    info = title_info[source_id][title]
                    first_time = info.get("first_time", "")
                    last_time = info.get("last_time", "")
                    count_info = info.get("count", 1)
                    if "ranks" in info and info["ranks"]:
                        ranks = info["ranks"]
                    url = info.get("url", source_url)
                    mobile_url = info.get("mobileUrl", source_mobile_url)
                    rank_timeline = info.get("rank_timeline", [])
                elif (
                    title_info
                    and source_id in title_info
                    and title in title_info[source_id]
                ):
                    info = title_info[source_id][title]
                    first_time = info.get("first_time", "")
                    last_time = info.get("last_time", "")
                    count_info = info.get("count", 1)
                    if "ranks" in info and info["ranks"]:
                        ranks = info["ranks"]
                    url = info.get("url", source_url)
                    mobile_url = info.get("mobileUrl", source_mobile_url)
                    rank_timeline = info.get("rank_timeline", [])

                if not ranks:
                    ranks = [99]

                time_display = format_time_display(first_time, last_time, convert_time_func)

                source_name = id_to_name.get(source_id, source_id)

                # 判断是否为新增
                is_new = False
                if all_news_are_new:
                    # 增量模式下所有处理的新闻都是新增，或者当天第一次的所有新闻都是新增
                    is_new = True
                elif new_titles and source_id in new_titles:
                    # 检查是否在新增列表中
                    new_titles_for_source = new_titles[source_id]
                    is_new = title in new_titles_for_source

                word_stats[group_key]["titles"][source_id].append(
                    {
                        "title": title,
                        "source_name": source_name,
                        "first_time": first_time,
                        "last_time": last_time,
                        "time_display": time_display,
                        "count": count_info,
                        "ranks": ranks,
                        "rank_threshold": rank_threshold,
                        "url": url,
                        "mobileUrl": mobile_url,
                        "is_new": is_new,
                        "rank_timeline": rank_timeline,
                    }
                )

                if source_id not in processed_titles:
                    processed_titles[source_id] = {}
                processed_titles[source_id][title] = True

                break

    # 最后统一打印汇总信息
    if mode == "incremental":
        if is_first_today:
            total_input_news = sum(len(titles) for titles in results.values())
            filter_status = (
                "全部显示"
                if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻"
                else "频率词匹配"
            )
            if not quiet:
                print(
                    f"增量模式：当天第一次爬取，{total_input_news} 条新闻中有 {matched_new_count} 条{filter_status}"
                )
        else:
            if new_titles:
                total_new_count = sum(len(titles) for titles in new_titles.values())
                filter_status = (
                    "全部显示"
                    if len(word_groups) == 1
                    and word_groups[0]["group_key"] == "全部新闻"
                    else "匹配频率词"
                )
                if not quiet:
                    print(
                        f"增量模式：{total_new_count} 条新增新闻中，有 {matched_new_count} 条{filter_status}"
                    )
                    if matched_new_count == 0 and len(word_groups) > 1:
                        print("增量模式：没有新增新闻匹配频率词，将不会发送通知")
            else:
                if not quiet:
                    print("增量模式：未检测到新增新闻")
    elif mode == "current":
        total_input_news = sum(len(titles) for titles in results_to_process.values())
        if is_first_today:
            filter_status = (
                "全部显示"
                if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻"
                else "频率词匹配"
            )
            if not quiet:
                print(
                    f"当前榜单模式：当天第一次爬取，{total_input_news} 条当前榜单新闻中有 {matched_new_count} 条{filter_status}"
                )
        else:
            matched_count = sum(stat["count"] for stat in word_stats.values())
            filter_status = (
                "全部显示"
                if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻"
                else "频率词匹配"
            )
            if not quiet:
                print(
                    f"当前榜单模式：{total_input_news} 条当前榜单新闻中有 {matched_count} 条{filter_status}"
                )

    stats = []
    # 创建 group_key 到位置、最大数量、显示名称的映射
    group_key_to_position = {
        group["group_key"]: idx for idx, group in enumerate(word_groups)
    }
    group_key_to_max_count = {
        group["group_key"]: group.get("max_count", 0) for group in word_groups
    }
    group_key_to_display_name = {
        group["group_key"]: group.get("display_name") for group in word_groups
    }

    for group_key, data in word_stats.items():
        all_titles = []
        for source_id, title_list in data["titles"].items():
            all_titles.extend(title_list)

        # 按权重排序
        sorted_titles = sorted(
            all_titles,
            key=lambda x: (
                -calculate_news_weight(x, rank_threshold, weight_config),
                min(x["ranks"]) if x["ranks"] else 999,
                -x["count"],
            ),
        )

        # 应用最大显示数量限制（优先级：单独配置 > 全局配置）
        group_max_count = group_key_to_max_count.get(group_key, 0)
        if group_max_count == 0:
            # 使用全局配置
            group_max_count = max_news_per_keyword

        if group_max_count > 0:
            sorted_titles = sorted_titles[:group_max_count]

        # 优先使用 display_name，否则使用 group_key
        display_word = group_key_to_display_name.get(group_key) or group_key

        stats.append(
            {
                "word": display_word,
                "count": data["count"],
                "position": group_key_to_position.get(group_key, 999),
                "titles": sorted_titles,
                "percentage": (
                    round(data["count"] / total_titles * 100, 2)
                    if total_titles > 0
                    else 0
                ),
            }
        )

    # 根据配置选择排序优先级
    if sort_by_position_first:
        # 先按配置位置，再按热点条数
        stats.sort(key=lambda x: (x["position"], -x["count"]))
    else:
        # 先按热点条数，再按配置位置（原逻辑）
        stats.sort(key=lambda x: (-x["count"], x["position"]))

    # 打印过滤后的匹配新闻数
    matched_news_count = sum(len(stat["titles"]) for stat in stats if stat["count"] > 0)
    if not quiet and mode == "daily":
        print(f"当日汇总模式：处理 {total_titles} 条新闻，模式：频率词过滤")
        print(f"频率词过滤后：{matched_news_count} 条新闻匹配")

    return stats, total_titles


def count_rss_frequency(
    rss_items: List[Dict],
    word_groups: List[Dict],
    filter_words: List[str],
    global_filters: Optional[List[str]] = None,
    new_items: Optional[List[Dict]] = None,
    max_news_per_keyword: int = 0,
    sort_by_position_first: bool = False,
    timezone: str = "Asia/Shanghai",
    rank_threshold: int = 5,
    quiet: bool = False,
) -> Tuple[List[Dict], int]:
    """
    按关键词分组统计 RSS 条目（与热榜统计格式一致）

    Args:
        rss_items: RSS 条目列表，每个条目包含：
            - title: 标题
            - feed_id: RSS 源 ID
            - feed_name: RSS 源名称
            - url: 文章链接
            - published_at: 发布时间（ISO 格式）
        word_groups: 词组配置列表
        filter_words: 过滤词列表
        global_filters: 全局过滤词（可选）
        new_items: 新增条目列表（可选，用于标记 is_new）
        max_news_per_keyword: 每个关键词最大显示数量
        sort_by_position_first: 是否优先按配置位置排序
        timezone: 时区名称（用于时间格式化）
        quiet: 是否静默模式

    Returns:
        Tuple[List[Dict], int]: (统计结果列表, 总条目数)
        统计结果格式与热榜一致：
        [
            {
                "word": "关键词",
                "count": 5,
                "position": 0,
                "titles": [
                    {
                        "title": "标题",
                        "source_name": "Hacker News",
                        "time_display": "12-29 08:20",
                        "count": 1,
                        "ranks": [1],  # RSS 用发布时间顺序作为排名
                        "rank_threshold": 50,
                        "url": "...",
                        "mobile_url": "",
                        "is_new": True/False
                    }
                ],
                "percentage": 10.0
            }
        ]
    """
    from trendradar.utils.time import format_iso_time_friendly

    if not rss_items:
        return [], 0

    # 如果没有配置词组，创建一个包含所有条目的虚拟词组
    if not word_groups:
        if not quiet:
            print("[RSS] 频率词配置为空，将显示所有 RSS 条目")
        word_groups = [{"required": [], "normal": [], "group_key": "全部 RSS"}]
        filter_words = []

    # 创建新增条目的 URL 集合，用于快速查找
    new_urls = set()
    if new_items:
        for item in new_items:
            if item.get("url"):
                new_urls.add(item["url"])

    # 初始化词组统计
    word_stats = {}
    for group in word_groups:
        group_key = group["group_key"]
        word_stats[group_key] = {"count": 0, "titles": []}

    total_items = len(rss_items)
    processed_urls = set()  # 用于去重

    # 为每个条目分配一个基于发布时间的"排名"
    # 按发布时间排序，最新的排在前面
    sorted_items = sorted(
        rss_items,
        key=lambda x: x.get("published_at", ""),
        reverse=True
    )
    url_to_rank = {item.get("url", ""): idx + 1 for idx, item in enumerate(sorted_items)}

    for item in rss_items:
        title = item.get("title", "")
        url = item.get("url", "")

        # 去重
        if url and url in processed_urls:
            continue
        if url:
            processed_urls.add(url)

        # 使用统一的匹配逻辑
        if not matches_word_groups(title, word_groups, filter_words, global_filters):
            continue

        # 找到匹配的词组
        title_lower = title.lower()
        for group in word_groups:
            required_words = group["required"]
            normal_words = group["normal"]
            group_key = group["group_key"]

            # "全部 RSS" 模式：所有条目都匹配
            if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部 RSS":
                matched = True
            else:
                # 检查必须词（支持正则语法）
                if required_words:
                    all_required_present = all(
                        _word_matches(req_item, title_lower)
                        for req_item in required_words
                    )
                    if not all_required_present:
                        continue

                # 检查普通词（支持正则语法）
                if normal_words:
                    any_normal_present = any(
                        _word_matches(normal_item, title_lower)
                        for normal_item in normal_words
                    )
                    if not any_normal_present:
                        continue

                matched = True

            if matched:
                word_stats[group_key]["count"] += 1

                # 格式化时间显示
                published_at = item.get("published_at", "")
                time_display = format_iso_time_friendly(published_at, timezone, include_date=True) if published_at else ""

                # 判断是否为新增
                is_new = url in new_urls if url else False

                # 获取排名（基于发布时间顺序）
                rank = url_to_rank.get(url, 99) if url else 99

                title_data = {
                    "title": title,
                    "source_name": item.get("feed_name", item.get("feed_id", "RSS")),
                    "time_display": time_display,
                    "count": 1,  # RSS 条目通常只出现一次
                    "ranks": [rank],
                    "rank_threshold": rank_threshold,
                    "url": url,
                    "mobile_url": "",
                    "is_new": is_new,
                }
                word_stats[group_key]["titles"].append(title_data)
                break  # 一个条目只匹配第一个词组

    # 构建统计结果
    stats = []
    group_key_to_position = {
        group["group_key"]: idx for idx, group in enumerate(word_groups)
    }
    group_key_to_max_count = {
        group["group_key"]: group.get("max_count", 0) for group in word_groups
    }
    group_key_to_display_name = {
        group["group_key"]: group.get("display_name") for group in word_groups
    }

    for group_key, data in word_stats.items():
        if data["count"] == 0:
            continue

        # 按发布时间排序（最新在前）
        sorted_titles = sorted(
            data["titles"],
            key=lambda x: x["ranks"][0] if x["ranks"] else 999
        )

        # 应用最大显示数量限制
        group_max_count = group_key_to_max_count.get(group_key, 0)
        if group_max_count == 0:
            group_max_count = max_news_per_keyword
        if group_max_count > 0:
            sorted_titles = sorted_titles[:group_max_count]

        # 优先使用 display_name，否则使用 group_key
        display_word = group_key_to_display_name.get(group_key) or group_key

        stats.append({
            "word": display_word,
            "count": data["count"],
            "position": group_key_to_position.get(group_key, 999),
            "titles": sorted_titles,
            "percentage": round(data["count"] / total_items * 100, 2) if total_items > 0 else 0,
        })

    # 排序
    if sort_by_position_first:
        stats.sort(key=lambda x: (x["position"], -x["count"]))
    else:
        stats.sort(key=lambda x: (-x["count"], x["position"]))

    matched_count = sum(stat["count"] for stat in stats)
    if not quiet:
        print(f"[RSS] 关键词分组统计：{matched_count}/{total_items} 条匹配")

    return stats, total_items


def convert_keyword_stats_to_platform_stats(
    keyword_stats: List[Dict],
    weight_config: Dict,
    rank_threshold: int = 5,
) -> List[Dict]:
    """
    将按关键词分组的统计数据转换为按平台分组的统计数据

    Args:
        keyword_stats: 原始按关键词分组的统计数据
        weight_config: 权重配置
        rank_threshold: 排名阈值

    Returns:
        按平台分组的统计数据，格式与原 stats 一致
    """
    # 1. 收集所有新闻，按平台分组
    platform_map: Dict[str, List[Dict]] = {}

    for stat in keyword_stats:
        keyword = stat["word"]
        for title_data in stat["titles"]:
            source_name = title_data["source_name"]

            if source_name not in platform_map:
                platform_map[source_name] = []

            # 复制 title_data 并添加匹配的关键词
            title_with_keyword = title_data.copy()
            title_with_keyword["matched_keyword"] = keyword
            platform_map[source_name].append(title_with_keyword)

    # 2. 去重（同一平台下相同标题只保留一条，保留第一个匹配的关键词）
    for source_name, titles in platform_map.items():
        seen_titles: Dict[str, bool] = {}
        unique_titles = []
        for title_data in titles:
            title_text = title_data["title"]
            if title_text not in seen_titles:
                seen_titles[title_text] = True
                unique_titles.append(title_data)
        platform_map[source_name] = unique_titles

    # 3. 按权重排序每个平台内的新闻
    for source_name, titles in platform_map.items():
        platform_map[source_name] = sorted(
            titles,
            key=lambda x: (
                -calculate_news_weight(x, rank_threshold, weight_config),
                min(x["ranks"]) if x["ranks"] else 999,
                -x["count"],
            ),
        )

    # 4. 构建平台统计结果
    platform_stats = []
    for source_name, titles in platform_map.items():
        platform_stats.append({
            "word": source_name,  # 平台名作为分组标识
            "count": len(titles),
            "titles": titles,
            "percentage": 0,  # 可后续计算
        })

    # 5. 按新闻条数排序平台
    platform_stats.sort(key=lambda x: -x["count"])

    return platform_stats
