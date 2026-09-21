# -*- coding: utf-8 -*-
"""#1198 修复的逻辑验证：窗口读取 + push_history 读写"""
import sys, os, tempfile, types
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from trendradar.core.data import read_titles_since_time
from trendradar.storage.sqlite_mixin import SQLiteStorageMixin


class StubStorage(SQLiteStorageMixin):
    """只测 mixin 的 push_history 读写与数据窗口逻辑"""
    def __init__(self):
        import sqlite3
        self._conn = sqlite3.connect(":memory:")
        self.news = None
    def _get_connection(self, date=None):
        return self._conn
    def _get_configured_time(self):
        from datetime import datetime
        return datetime(2026, 9, 21, 12, 0)
    def get_today_all_data(self):
        return self.news


class FakeItems:
    def __init__(self, items):
        self.items = items


def make_item(title, first_time):
    return types.SimpleNamespace(
        title=title, rank=1, ranks=[1], url="u", mobile_url="m",
        first_time=first_time, last_time=first_time, count=1,
        crawl_time=first_time, rank_timeline=[],
    )


# --- 测试1: push_history 记录/读取 ---
s = StubStorage()
assert s._get_last_push_time_impl() is None, "无推送时应返回 None"
assert s._record_push_time_impl() is True
t = s._get_last_push_time_impl()
assert t == "12-00", f"推送时间应为 HH-MM 格式 12-00, got {t}"
print("TEST1 push_history 读写 OK ->", t)

# --- 测试2: 窗口过滤 ---
news = {
    "weibo": [
        make_item("早间新闻", "07-30"),
        make_item("午间热点", "11-20"),
        make_item("刚上的热搜", "11-55"),
    ],
    "zhihu": [make_item("上午问题", "09-10")],
}
class FakeMgr:
    def get_today_all_data(self):
        class D: items = news; id_to_name = {"weibo": "微博", "zhihu": "知乎"}
        return D()

# 场景A：上次推送 09-00 → 应返回 09-10/11-20/11-55 三条，排除 07-30
res, id2name, info = read_titles_since_time(FakeMgr(), "09-00")
titles = sorted(t for d in res.values() for t in d)
assert titles == ["上午问题", "刚上的热搜", "午间热点"], titles
print("TEST2a 窗口过滤(排除已推送) OK ->", titles)

# 场景B：当天首推（since=""）→ 全部数据
res, _, _ = read_titles_since_time(FakeMgr(), "")
total = sum(len(d) for d in res.values())
assert total == 4, total
print("TEST2b 首推覆盖全天 OK ->", total, "条")

# 场景C：平台过滤仍然生效
res, _, _ = read_titles_since_time(FakeMgr(), "09-00", ["weibo"])
assert set(res.keys()) == {"weibo"} and len(res["weibo"]) == 2
print("TEST2c 平台过滤 OK")

# 场景D：窗口内无新增 → 空
res, _, _ = read_titles_since_time(FakeMgr(), "12-30")
assert res == {}
print("TEST2d 空窗口 OK")
print("\nALL PASS")
