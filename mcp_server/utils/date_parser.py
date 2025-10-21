"""
日期解析工具

支持多种自然语言日期格式解析，包括相对日期和绝对日期。
"""

import re
from datetime import datetime, timedelta

from .errors import InvalidParameterError


class DateParser:
    """日期解析器类"""

    # 中文日期映射
    CN_DATE_MAPPING = {
        "今天": 0,
        "昨天": 1,
        "前天": 2,
        "大前天": 3,
    }

    # 英文日期映射
    EN_DATE_MAPPING = {
        "today": 0,
        "yesterday": 1,
    }

    # 星期映射
    WEEKDAY_CN = {
        "一": 0, "二": 1, "三": 2, "四": 3,
        "五": 4, "六": 5, "日": 6, "天": 6
    }

    WEEKDAY_EN = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    @staticmethod
    def parse_date_query(date_query: str) -> datetime:
        """
        解析日期查询字符串

        支持的格式：
        - 相对日期（中文）：今天、昨天、前天、大前天、N天前
        - 相对日期（英文）：today、yesterday、N days ago
        - 星期（中文）：上周一、上周二、本周三
        - 星期（英文）：last monday、this friday
        - 绝对日期：2025-10-10、10月10日、2025年10月10日

        Args:
            date_query: 日期查询字符串

        Returns:
            datetime对象

        Raises:
            InvalidParameterError: 日期格式无法识别

        Examples:
            >>> DateParser.parse_date_query("今天")
            datetime(2025, 10, 11)
            >>> DateParser.parse_date_query("昨天")
            datetime(2025, 10, 10)
            >>> DateParser.parse_date_query("3天前")
            datetime(2025, 10, 8)
            >>> DateParser.parse_date_query("2025-10-10")
            datetime(2025, 10, 10)
        """
        if not date_query or not isinstance(date_query, str):
            raise InvalidParameterError(
                "日期查询字符串不能为空",
                suggestion="请提供有效的日期查询，如：今天、昨天、2025-10-10"
            )

        date_query = date_query.strip().lower()

        # 1. 尝试解析中文常用相对日期
        if date_query in DateParser.CN_DATE_MAPPING:
            days_ago = DateParser.CN_DATE_MAPPING[date_query]
            return datetime.now() - timedelta(days=days_ago)

        # 2. 尝试解析英文常用相对日期
        if date_query in DateParser.EN_DATE_MAPPING:
            days_ago = DateParser.EN_DATE_MAPPING[date_query]
            return datetime.now() - timedelta(days=days_ago)

        # 3. 尝试解析 "N天前" 或 "N days ago"
        cn_days_ago_match = re.match(r'(\d+)\s*天前', date_query)
        if cn_days_ago_match:
            days = int(cn_days_ago_match.group(1))
            if days > 365:
                raise InvalidParameterError(
                    f"天数过大: {days}天",
                    suggestion="请使用小于365天的相对日期或使用绝对日期"
                )
            return datetime.now() - timedelta(days=days)

        en_days_ago_match = re.match(r'(\d+)\s*days?\s+ago', date_query)
        if en_days_ago_match:
            days = int(en_days_ago_match.group(1))
            if days > 365:
                raise InvalidParameterError(
                    f"天数过大: {days}天",
                    suggestion="请使用小于365天的相对日期或使用绝对日期"
                )
            return datetime.now() - timedelta(days=days)

        # 4. 尝试解析星期（中文）：上周一、本周三
        cn_weekday_match = re.match(r'(上|本)周([一二三四五六日天])', date_query)
        if cn_weekday_match:
            week_type = cn_weekday_match.group(1)  # 上 或 本
            weekday_str = cn_weekday_match.group(2)
            target_weekday = DateParser.WEEKDAY_CN[weekday_str]
            return DateParser._get_date_by_weekday(target_weekday, week_type == "上")

        # 5. 尝试解析星期（英文）：last monday、this friday
        en_weekday_match = re.match(r'(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', date_query)
        if en_weekday_match:
            week_type = en_weekday_match.group(1)  # last 或 this
            weekday_str = en_weekday_match.group(2)
            target_weekday = DateParser.WEEKDAY_EN[weekday_str]
            return DateParser._get_date_by_weekday(target_weekday, week_type == "last")

        # 6. 尝试解析绝对日期：YYYY-MM-DD
        iso_date_match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', date_query)
        if iso_date_match:
            year = int(iso_date_match.group(1))
            month = int(iso_date_match.group(2))
            day = int(iso_date_match.group(3))
            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 7. 尝试解析中文日期：MM月DD日 或 YYYY年MM月DD日
        cn_date_match = re.match(r'(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日', date_query)
        if cn_date_match:
            year_str = cn_date_match.group(1)
            month = int(cn_date_match.group(2))
            day = int(cn_date_match.group(3))

            # 如果没有年份，使用当前年份
            if year_str:
                year = int(year_str)
            else:
                year = datetime.now().year
                # 如果月份大于当前月份，说明是去年
                current_month = datetime.now().month
                if month > current_month:
                    year -= 1

            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 8. 尝试解析斜杠格式：YYYY/MM/DD 或 MM/DD
        slash_date_match = re.match(r'(?:(\d{4})/)?(\d{1,2})/(\d{1,2})', date_query)
        if slash_date_match:
            year_str = slash_date_match.group(1)
            month = int(slash_date_match.group(2))
            day = int(slash_date_match.group(3))

            if year_str:
                year = int(year_str)
            else:
                year = datetime.now().year
                current_month = datetime.now().month
                if month > current_month:
                    year -= 1

            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 如果所有格式都不匹配
        raise InvalidParameterError(
            f"无法识别的日期格式: {date_query}",
            suggestion=(
                "支持的格式:\n"
                "- 相对日期: 今天、昨天、前天、3天前、today、yesterday、3 days ago\n"
                "- 星期: 上周一、本周三、last monday、this friday\n"
                "- 绝对日期: 2025-10-10、10月10日、2025年10月10日"
            )
        )

    @staticmethod
    def _get_date_by_weekday(target_weekday: int, is_last_week: bool) -> datetime:
        """
        根据星期几获取日期

        Args:
            target_weekday: 目标星期 (0=周一, 6=周日)
            is_last_week: 是否是上周

        Returns:
            datetime对象
        """
        today = datetime.now()
        current_weekday = today.weekday()

        # 计算天数差
        if is_last_week:
            # 上周的某一天
            days_diff = current_weekday - target_weekday + 7
        else:
            # 本周的某一天
            days_diff = current_weekday - target_weekday
            if days_diff < 0:
                days_diff += 7

        return today - timedelta(days=days_diff)

    @staticmethod
    def format_date_folder(date: datetime) -> str:
        """
        将日期格式化为文件夹名称

        Args:
            date: datetime对象

        Returns:
            文件夹名称，格式: YYYY年MM月DD日

        Examples:
            >>> DateParser.format_date_folder(datetime(2025, 10, 11))
            '2025年10月11日'
        """
        return date.strftime("%Y年%m月%d日")

    @staticmethod
    def validate_date_not_future(date: datetime) -> None:
        """
        验证日期不在未来

        Args:
            date: 待验证的日期

        Raises:
            InvalidParameterError: 日期在未来
        """
        if date.date() > datetime.now().date():
            raise InvalidParameterError(
                f"不能查询未来的日期: {date.strftime('%Y-%m-%d')}",
                suggestion="请使用今天或过去的日期"
            )

    @staticmethod
    def validate_date_not_too_old(date: datetime, max_days: int = 365) -> None:
        """
        验证日期不太久远

        Args:
            date: 待验证的日期
            max_days: 最大天数

        Raises:
            InvalidParameterError: 日期太久远
        """
        days_ago = (datetime.now().date() - date.date()).days
        if days_ago > max_days:
            raise InvalidParameterError(
                f"日期太久远: {date.strftime('%Y-%m-%d')} ({days_ago}天前)",
                suggestion=f"请查询{max_days}天内的数据"
            )
