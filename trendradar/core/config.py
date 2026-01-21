# coding=utf-8
"""
配置工具模块 - 多账号配置解析和验证

提供多账号推送配置的解析、验证和限制功能
"""

from typing import Dict, List, Optional, Tuple


def parse_multi_account_config(config_value: str, separator: str = ";") -> List[str]:
    """
    解析多账号配置，返回账号列表

    Args:
        config_value: 配置值字符串，多个账号用分隔符分隔
        separator: 分隔符，默认为 ;

    Returns:
        账号列表，空字符串会被保留（用于占位）

    Examples:
        >>> parse_multi_account_config("url1;url2;url3")
        ['url1', 'url2', 'url3']
        >>> parse_multi_account_config(";token2")  # 第一个账号无token
        ['', 'token2']
        >>> parse_multi_account_config("")
        []
    """
    if not config_value:
        return []
    # 保留空字符串用于占位（如 ";token2" 表示第一个账号无token）
    accounts = [acc.strip() for acc in config_value.split(separator)]
    # 过滤掉全部为空的情况
    if all(not acc for acc in accounts):
        return []
    return accounts


def validate_paired_configs(
    configs: Dict[str, List[str]],
    channel_name: str,
    required_keys: Optional[List[str]] = None
) -> Tuple[bool, int]:
    """
    验证配对配置的数量是否一致

    对于需要多个配置项配对的渠道（如 Telegram 的 token 和 chat_id），
    验证所有配置项的账号数量是否一致。

    Args:
        configs: 配置字典，key 为配置名，value 为账号列表
        channel_name: 渠道名称，用于日志输出
        required_keys: 必须有值的配置项列表

    Returns:
        (是否验证通过, 账号数量)

    Examples:
        >>> validate_paired_configs({
        ...     "token": ["t1", "t2"],
        ...     "chat_id": ["c1", "c2"]
        ... }, "Telegram", ["token", "chat_id"])
        (True, 2)

        >>> validate_paired_configs({
        ...     "token": ["t1", "t2"],
        ...     "chat_id": ["c1"]  # 数量不匹配
        ... }, "Telegram", ["token", "chat_id"])
        (False, 0)
    """
    # 过滤掉空列表
    non_empty_configs = {k: v for k, v in configs.items() if v}

    if not non_empty_configs:
        return True, 0

    # 检查必须项
    if required_keys:
        for key in required_keys:
            if key not in non_empty_configs or not non_empty_configs[key]:
                return True, 0  # 必须项为空，视为未配置

    # 获取所有非空配置的长度
    lengths = {k: len(v) for k, v in non_empty_configs.items()}
    unique_lengths = set(lengths.values())

    if len(unique_lengths) > 1:
        print(f"❌ {channel_name} 配置错误：配对配置数量不一致，将跳过该渠道推送")
        for key, length in lengths.items():
            print(f"   - {key}: {length} 个")
        return False, 0

    return True, list(unique_lengths)[0] if unique_lengths else 0


def limit_accounts(
    accounts: List[str],
    max_count: int,
    channel_name: str
) -> List[str]:
    """
    限制账号数量

    当配置的账号数量超过最大限制时，只使用前 N 个账号，
    并输出警告信息。

    Args:
        accounts: 账号列表
        max_count: 最大账号数量
        channel_name: 渠道名称，用于日志输出

    Returns:
        限制后的账号列表

    Examples:
        >>> limit_accounts(["a1", "a2", "a3"], 2, "飞书")
        ⚠️ 飞书 配置了 3 个账号，超过最大限制 2，只使用前 2 个
        ['a1', 'a2']
    """
    if len(accounts) > max_count:
        print(f"⚠️ {channel_name} 配置了 {len(accounts)} 个账号，超过最大限制 {max_count}，只使用前 {max_count} 个")
        print(f"   ⚠️ 警告：如果您是 fork 用户，过多账号可能导致 GitHub Actions 运行时间过长，存在账号风险")
        return accounts[:max_count]
    return accounts


def get_account_at_index(accounts: List[str], index: int, default: str = "") -> str:
    """
    安全获取指定索引的账号值

    当索引超出范围或账号值为空时，返回默认值。

    Args:
        accounts: 账号列表
        index: 索引
        default: 默认值

    Returns:
        账号值或默认值

    Examples:
        >>> get_account_at_index(["a", "b", "c"], 1)
        'b'
        >>> get_account_at_index(["a", "", "c"], 1, "default")
        'default'
        >>> get_account_at_index(["a"], 5, "default")
        'default'
    """
    if index < len(accounts):
        return accounts[index] if accounts[index] else default
    return default
