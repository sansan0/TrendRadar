import feedparser
import requests
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import pytz
import re
import time

class RSSFeed:
    def __init__(self, url: str, name: str = "", proxy_url: Optional[str] = None):
        self.url = url
        self.name = name or url
        self.proxy_url = proxy_url
        self.proxies = {
            "http": proxy_url,
            "https": proxy_url
        } if proxy_url else None

    def fetch_feed(self) -> Optional[feedparser.FeedParserDict]:
        """
        获取并解析RSS订阅源
        """
        try:
            response = requests.get(self.url, proxies=self.proxies, timeout=10)
            response.raise_for_status()
            feed = feedparser.parse(response.text)
            return feed
        except Exception as e:
            print(f"获取RSS订阅源 {self.name} 失败: {e}")
            return None

    def parse_feed(self, feed: feedparser.FeedParserDict) -> Dict[str, Dict]:
        """
        解析RSS订阅源，转换为项目所需的数据格式
        """
        results = {}
        for index, entry in enumerate(feed.entries, 1):
            title = entry.get("title", "")
            if not title:
                continue
            
            # 清理标题
            cleaned_title = self.clean_title(title)
            
            # 获取链接
            url = entry.get("link", "")
            
            # 将数据添加到结果中
            if cleaned_title in results:
                results[cleaned_title]["ranks"].append(index)
            else:
                results[cleaned_title] = {
                    "ranks": [index],
                    "url": url,
                    "mobileUrl": ""
                }
        
        return results

    def clean_title(self, title: str) -> str:
        """
        清理标题中的特殊字符
        """
        if not isinstance(title, str):
            title = str(title)
        cleaned_title = title.replace("\n", " ").replace("\r", " ")
        cleaned_title = re.sub(r"\s+", " ", cleaned_title)
        cleaned_title = cleaned_title.strip()
        return cleaned_title

    def get_feed_data(self) -> Tuple[Optional[Dict[str, Dict]], str]:
        """
        获取并解析RSS订阅源，返回数据和源名称
        """
        feed = self.fetch_feed()
        if not feed:
            return None, self.name
        
        data = self.parse_feed(feed)
        return data, self.name


def load_rss_config(config_data: Dict) -> List[Dict]:
    """
    加载RSS配置
    """
    # 支持两种配置方式：rss.feeds 和 rss_sources
    # 同时支持大小写键名
    rss_config = config_data.get("rss", {})
    if not rss_config:
        rss_config = config_data.get("RSS", {})
    
    feeds = rss_config.get("feeds", [])
    
    # 如果没有配置rss.feeds，尝试从rss_sources加载
    if not feeds:
        feeds = config_data.get("rss_sources", [])
        if not feeds:
            feeds = config_data.get("RSS_SOURCES", [])
    
    return feeds


def fetch_all_rss_feeds(feeds_config: List[Dict], proxy_url: Optional[str] = None) -> Tuple[Dict, Dict, List]:
    """
    获取所有RSS订阅源的数据
    
    Args:
        feeds_config: RSS订阅源配置列表
        proxy_url: 代理URL
        
    Returns:
        (results, id_to_name, failed_ids)
    """
    results = {}
    id_to_name = {}
    failed_ids = []
    
    for feed_config in feeds_config:
        url = feed_config.get("url", "")
        name = feed_config.get("name", url)
        
        if not url:
            continue
        
        rss_feed = RSSFeed(url, name, proxy_url)
        feed_data, feed_name = rss_feed.get_feed_data()
        
        if feed_data:
            # 使用URL作为唯一标识符
            results[url] = feed_data
            id_to_name[url] = feed_name
            print(f'获取 {feed_name} 成功')
            time.sleep(1)  # 等待1000毫秒
        else:
            failed_ids.append(url)
            print(f'获取 {feed_name} 失败')
    
    return results, id_to_name, failed_ids
