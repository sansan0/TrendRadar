import unittest
from xml.etree import ElementTree

from trendradar.report.formatter import format_title_for_platform


class TelegramTitleTests(unittest.TestCase):
    def test_special_characters_round_trip_in_headlines_and_links(self):
        title = "New R&D <preview>"
        source = "News & analysis"
        url = 'https://example.org/?topic=a&title="preview"'
        for link in ("", url):
            with self.subTest(link=link):
                data = {
                    "title": title, "source_name": source, "url": link, "mobile_url": "",
                    "ranks": [], "rank_threshold": 3, "time_display": "", "count": 1,
                }
                rendered = format_title_for_platform("telegram", data, show_source=True)
                root = ElementTree.fromstring(f"<root>{rendered}</root>")
                self.assertEqual("".join(root.itertext()), f"[{source}] {title}")
                if link:
                    self.assertEqual(root.find("a").get("href"), link)
