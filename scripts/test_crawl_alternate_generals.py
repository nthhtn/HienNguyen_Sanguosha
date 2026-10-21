"""Tests for crawl-alternate-generals.py against small saved excerpts of the blog.
Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("crawl_alternate_generals", HERE / "crawl-alternate-generals.py")
crawl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawl)

INDEX = (HERE / "fixtures/kw-index-excerpt.html").read_text(encoding="utf-8")


class ParseIndex(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = crawl.parse_index(INDEX)

    def test_links_grouped_by_force(self):
        self.assertEqual(len(self.entries), 12)
        for force in ("shu", "wei", "wu", "qun"):
            self.assertEqual(len([e for e in self.entries if e["force"] == force]), 3)

    def test_page_order_and_slug(self):
        first = self.entries[0]
        self.assertEqual((first["force"], first["slug"]), ("shu", "liu-bei"))
        self.assertTrue(first["url"].endswith("/2012/08/liu-bei.html"))
        self.assertEqual(self.entries[-1]["slug"], "lu-bu")

    def test_links_outside_the_post_body_are_ignored(self):
        self.assertNotIn("not-a-general", [e["slug"] for e in self.entries])


if __name__ == "__main__":
    unittest.main()
