#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bark 推送格式测试脚本
"""

import requests
import json
from datetime import datetime

# Bark 配置
BARK_DEVICE_KEY = "X9Nj52vwrTJz9qEXVgt5h"
BARK_SERVER_URL = "https://api.day.app"
BARK_GROUP = "TrendRadar"
BARK_SOUND = "bell"

def send_bark_test(title, body, group=None, sound=None):
    """发送 Bark 测试推送"""
    url = f"{BARK_SERVER_URL}/{BARK_DEVICE_KEY}"
    
    params = {
        "title": title,
        "body": body,
    }
    
    if group:
        params["group"] = group
    if sound:
        params["sound"] = sound
    
    try:
        response = requests.post(url, json=params, timeout=30)
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 200:
                print(f"✅ 推送成功: {title}")
                return True
            else:
                print(f"❌ 推送失败: {result.get('message', '未知错误')}")
                return False
        else:
            print(f"❌ HTTP 错误: {response.status_code}")
            print(f"响应: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 异常: {e}")
        return False

def test_format_1_simple():
    """测试1: 简单格式"""
    print("\n" + "="*50)
    print("测试1: 简单格式推送")
    print("="*50)
    
    title = "📊 当日汇总"
    body = """📊 **总新闻数：** 5

🔥 **热点词汇统计**

🔥 [1/2] **AI** : **3** 条

  1. **今日头条** [AI 技术突破](https://example.com) • 2小时前
  2. **微博** [AI 应用场景](https://example.com) • 1小时前
  3. **知乎** [AI 发展趋势](https://example.com) • 30分钟前

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def test_format_2_multiple_keywords():
    """测试2: 多个关键词"""
    print("\n" + "="*50)
    print("测试2: 多个关键词格式")
    print("="*50)
    
    title = "📊 当日汇总"
    body = """📊 **总新闻数：** 12

🔥 **热点词汇统计**

🔥 [1/3] **AI** : **5** 条

  1. **今日头条** [AI 技术突破](https://example.com) • 2小时前
  2. **微博** [AI 应用场景](https://example.com) • 1小时前
  3. **知乎** [AI 发展趋势](https://example.com) • 30分钟前
  4. **百度热搜** [AI 产业分析](https://example.com) • 1小时前
  5. **bilibili 热搜** [AI 视频内容](https://example.com) • 45分钟前

---

📈 [2/3] **科技** : **4** 条

  1. **百度热搜** [科技创新](https://example.com) • 1小时前
  2. **bilibili 热搜** [科技前沿](https://example.com) • 45分钟前
  3. **今日头条** [科技新闻](https://example.com) • 2小时前
  4. **微博** [科技动态](https://example.com) • 1小时前

---

📌 [3/3] **教育** : **3** 条

  1. **知乎** [教育政策](https://example.com) • 30分钟前
  2. **澎湃新闻** [教育改革](https://example.com) • 1小时前
  3. **今日头条** [教育新闻](https://example.com) • 2小时前

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def test_format_3_with_new_titles():
    """测试3: 包含新增新闻"""
    print("\n" + "="*50)
    print("测试3: 包含新增新闻区域")
    print("="*50)
    
    title = "📊 当日汇总"
    body = """📊 **总新闻数：** 8

🔥 **热点词汇统计**

🔥 [1/2] **AI** : **3** 条

  1. **今日头条** [AI 技术突破](https://example.com) • 2小时前
  2. **微博** [AI 应用场景](https://example.com) • 1小时前
  3. **知乎** [AI 发展趋势](https://example.com) • 30分钟前

---

📈 [2/2] **科技** : **2** 条

  1. **百度热搜** [科技创新](https://example.com) • 1小时前
  2. **bilibili 热搜** [科技前沿](https://example.com) • 45分钟前

---

🆕 **本次新增热点新闻** (共 3 条)

**今日头条** (2 条):

  1. [新增AI新闻标题](https://example.com) • 10分钟前
  2. [新增科技新闻标题](https://example.com) • 5分钟前

**微博** (1 条):

  1. [新增微博热点](https://example.com) • 15分钟前

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def test_format_4_incremental():
    """测试4: 增量更新模式"""
    print("\n" + "="*50)
    print("测试4: 增量更新模式")
    print("="*50)
    
    title = "🆕 增量更新"
    body = """📊 **总新闻数：** 3

🔥 **热点词汇统计**

🔥 [1/2] **AI** : **2** 条

  1. **今日头条** [AI 技术新突破](https://example.com) • 10分钟前
  2. **微博** [AI 最新应用](https://example.com) • 5分钟前

---

📈 [2/2] **科技** : **1** 条

  1. **百度热搜** [科技新动态](https://example.com) • 15分钟前

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def test_format_5_current_ranking():
    """测试5: 当前榜单模式"""
    print("\n" + "="*50)
    print("测试5: 当前榜单模式")
    print("="*50)
    
    title = "📈 当前榜单汇总"
    body = """📊 **总新闻数：** 6

🔥 **热点词汇统计**

🔥 [1/2] **AI** : **4** 条

  1. **今日头条** [AI 技术突破](https://example.com) 🔥 排名: 1 • 2小时前
  2. **微博** [AI 应用场景](https://example.com) 🔥 排名: 2 • 1小时前
  3. **知乎** [AI 发展趋势](https://example.com) 📌 排名: 5 • 30分钟前
  4. **百度热搜** [AI 产业分析](https://example.com) 🔥 排名: 3 • 1小时前

---

📈 [2/2] **科技** : **2** 条

  1. **百度热搜** [科技创新](https://example.com) 🔥 排名: 1 • 1小时前
  2. **bilibili 热搜** [科技前沿](https://example.com) 📌 排名: 8 • 45分钟前

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def test_format_6_empty():
    """测试6: 无匹配内容"""
    print("\n" + "="*50)
    print("测试6: 无匹配内容")
    print("="*50)
    
    title = "📊 当日汇总"
    body = """📊 **总新闻数：** 0

📭 暂无匹配的热点词汇

---
更新时间：2025-01-23 14:30:00"""
    
    return send_bark_test(title, body, BARK_GROUP, BARK_SOUND)

def main():
    """运行所有测试"""
    print("\n" + "="*50)
    print("Bark 推送格式测试")
    print("="*50)
    print(f"设备密钥: {BARK_DEVICE_KEY}")
    print(f"服务器: {BARK_SERVER_URL}")
    print(f"分组: {BARK_GROUP}")
    print(f"声音: {BARK_SOUND}")
    print("\n开始测试...")
    
    tests = [
        ("简单格式", test_format_1_simple),
        ("多个关键词", test_format_2_multiple_keywords),
        ("包含新增新闻", test_format_3_with_new_titles),
        ("增量更新模式", test_format_4_incremental),
        ("当前榜单模式", test_format_5_current_ranking),
        ("无匹配内容", test_format_6_empty),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
            import time
            time.sleep(2)  # 避免推送过快
        except Exception as e:
            print(f"❌ 测试 '{name}' 异常: {e}")
            results.append((name, False))
    
    # 汇总结果
    print("\n" + "="*50)
    print("测试结果汇总")
    print("="*50)
    for name, result in results:
        status = "✅ 成功" if result else "❌ 失败"
        print(f"{status}: {name}")
    
    success_count = sum(1 for _, result in results if result)
    total_count = len(results)
    print(f"\n总计: {success_count}/{total_count} 测试通过")
    
    if success_count == total_count:
        print("\n🎉 所有测试通过！Bark 推送格式正常。")
    else:
        print(f"\n⚠️ 有 {total_count - success_count} 个测试失败，请检查配置。")

if __name__ == "__main__":
    main()

